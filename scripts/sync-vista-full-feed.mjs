// =============================================================
// Sincroniza o db.json com o feed XML REAL e COMPLETO que o Vista
// gera para o portal "Loft" (formato padrão VRSync/VivaReal).
//
// Diferente do feed do Zap (que só tem os ~40 imóveis marcados
// "Publicar Zap"), este feed usa o modo "Exibir no site" — ou seja,
// cobre TODO o portfólio disponível (327 de 340 imóveis na última
// checagem; a diferença são imóveis vendidos/inativos/sem "exibir
// no site" marcado). É a mesma URL/formato que originou a carga
// inicial do BrokerImobAI.
//
// Fonte: https://loboimov-portais.vistahost.com.br/<token>
// (Vista > Portais > Loft > "3 - Dados e XML")
//
// Uso:
//   node scripts/sync-vista-full-feed.mjs [caminho-xml-local]
//
// Sem argumento, busca a URL ao vivo (precisa de internet real).
// =============================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'src', 'data', 'db.json');
const LOG_PATH = path.join(__dirname, '..', 'src', 'data', 'sync-vista-log.json');
const FEED_URL = 'https://loboimov-portais.vistahost.com.br/155d5d5c328f52df1fb907cb8e43515c';

async function carregarXML() {
  const argPath = process.argv[2];
  if (argPath) {
    console.log('Lendo XML local:', argPath);
    return fs.readFileSync(argPath, 'utf-8');
  }
  console.log('Buscando feed completo (Loft/VRSync) ao vivo em', FEED_URL);
  const res = await fetch(FEED_URL);
  if (!res.ok) throw new Error(`Falha ao buscar feed: HTTP ${res.status}`);
  return res.text(); // este feed já declara e serve UTF-8 corretamente
}

// O feed do Vista tem um bug de dupla-codificação (texto UTF-8 relido
// como Latin-1 e regravado) — aparece como "GoiÃ¢nia" em vez de
// "Goiânia". Revertendo: interpretamos a string como Latin-1 e
// decodificamos os bytes resultantes como UTF-8.
function corrigirMojibake(s) {
  try {
    return Buffer.from(s, 'latin1').toString('utf-8');
  } catch {
    return s;
  }
}

function q1(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  if (!m) return '';
  return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, '$1').trim();
}

function mapTipo(propertyType) {
  const p = (propertyType || '').toLowerCase();
  if (p.includes('land') || p.includes('terreno') || p.includes('lot')) return 'terreno';
  if (p.includes('commercial') || p.includes('comercial') || p.includes('office') || p.includes('store') || p.includes('warehouse')) return 'comercial';
  if (p.includes('penthouse') || p.includes('cobertura')) return 'cobertura';
  if (p.includes('flat')) return 'flat';
  if (p.includes('studio') || p.includes('kitnet') || p.includes('loft')) return 'studio';
  if (p.includes('house') || p.includes('casa') || p.includes('sobrado')) return 'casa';
  return 'apartamento';
}

function parseListings(xmlText) {
  const blocks = xmlText.match(/<Listing>[\s\S]*?<\/Listing>/g) || [];
  return blocks.map(block => {
    const id = q1(block, 'ListingID');
    const listPrice = parseFloat(q1(block, 'ListPrice') || '0') || 0;
    const rentalPrice = parseFloat(q1(block, 'RentalPrice') || '0') || 0;
    const finalidade = rentalPrice > 0 && listPrice === 0 ? 'aluguel' : 'venda';
    const preco = finalidade === 'aluguel' ? rentalPrice : listPrice;

    return {
      id_externo: `LOFT-${id}`,
      titulo: corrigirMojibake(q1(block, 'Title')),
      descricao: corrigirMojibake(q1(block, 'Description')),
      bairro: corrigirMojibake(q1(block, 'Neighborhood')),
      cidade: corrigirMojibake(q1(block, 'City')),
      endereco_raw: corrigirMojibake(q1(block, 'Address')),
      tipo: mapTipo(q1(block, 'PropertyType')),
      finalidade,
      preco,
      area_util: parseFloat(q1(block, 'LivingArea') || '0') || 0,
      area_total: parseFloat(q1(block, 'LotArea') || '0') || 0,
      quartos: parseInt(q1(block, 'Bedrooms') || '0', 10) || 0,
      suites: parseInt(q1(block, 'Suites') || '0', 10) || 0,
      banheiros: parseInt(q1(block, 'Bathrooms') || '0', 10) || 0,
      vagas: parseInt(q1(block, 'Garage') || '0', 10) || 0,
      publication_type: q1(block, 'PublicationType') || 'STANDARD',
    };
  });
}

function recalcularCriterios(imovelExistente, novo) {
  const temEndereco = !!(imovelExistente.endereco && imovelExistente.endereco.length > 15);
  const temPreco = novo.preco > 0;
  const temDescricao = (novo.descricao || '').length >= 300 || (imovelExistente.descricao || '').length >= 300;
  const temFotos = (imovelExistente.fotos || []).length >= 8;
  const temVideo = !!imovelExistente.video_url;
  const temTitulo = (novo.titulo || imovelExistente.titulo || '').length > 15;
  const temArea = novo.area_util > 0;

  const criterios = [
    { id: 'endereco', label: 'Endereço completo', presente: temEndereco, peso: 1.5, pontos: temEndereco ? 1.5 : 0, sugestao: temEndereco ? undefined : 'Adicione o número e complemento do endereço' },
    { id: 'preco', label: 'Preço cadastrado', presente: temPreco, peso: 2.0, pontos: temPreco ? 2.0 : 0, sugestao: temPreco ? undefined : 'Preço inválido ou ausente — informe o valor de mercado' },
    { id: 'descricao', label: 'Descrição completa (+300 chars)', presente: temDescricao, peso: 2.0, pontos: temDescricao ? 2.0 : 0, sugestao: temDescricao ? undefined : 'Descrição muito curta. Adicione diferenciais do imóvel' },
    { id: 'fotos', label: 'Fotos de qualidade (mín. 8)', presente: temFotos, peso: 2.5, pontos: temFotos ? 2.5 : 0, sugestao: temFotos ? undefined : 'Adicione pelo menos 8 fotos de boa resolução' },
    { id: 'video', label: 'Vídeo / tour virtual', presente: temVideo, peso: 1.0, pontos: temVideo ? 1.0 : 0, sugestao: temVideo ? undefined : 'Adicionar vídeo aumenta visualizações em +24%' },
    { id: 'titulo', label: 'Título atrativo e completo', presente: temTitulo, peso: 0.5, pontos: temTitulo ? 0.5 : 0, sugestao: temTitulo ? undefined : 'Use título descritivo: tipo + quartos + bairro' },
    { id: 'area', label: 'Área útil informada', presente: temArea, peso: 0.5, pontos: temArea ? 0.5 : 0, sugestao: temArea ? undefined : 'Informe a área útil do imóvel' },
  ];
  const nota = parseFloat(criterios.reduce((acc, c) => acc + c.pontos, 0).toFixed(1));
  return { criterios, nota };
}

async function main() {
  const xmlText = await carregarXML();
  const feedImoveis = parseListings(xmlText);
  console.log(`Feed completo (Loft/VRSync): ${feedImoveis.length} imóveis publicados ("Exibir no site").`);

  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  const porIdExterno = new Map(db.imoveis.map(im => [im.id_externo, im]));

  const agora = new Date().toISOString();
  const alterados = [];
  const novosNoFeed = [];
  const idsNoFeed = new Set(feedImoveis.map(f => f.id_externo));
  const removidosDoFeed = db.imoveis.filter(im => !idsNoFeed.has(im.id_externo)).map(im => im.id_externo);

  for (const f of feedImoveis) {
    const existente = porIdExterno.get(f.id_externo);
    if (!existente) {
      novosNoFeed.push(f.id_externo);
      continue; // novo imóvel: não criamos automaticamente, só sinalizamos
    }

    const mudancas = [];
    if (f.preco > 0 && f.preco !== existente.preco_atual) {
      mudancas.push(`preço ${existente.preco_atual} → ${f.preco}`);
      existente.historico_preco = existente.historico_preco || [];
      existente.historico_preco.push({ data: agora.split('T')[0], preco: f.preco, motivo: 'Sincronização com feed real do Vista' });
      existente.preco_atual = f.preco;
    }
    if (f.area_util > 0 && f.area_util !== existente.area_util) {
      mudancas.push(`área ${existente.area_util}m² → ${f.area_util}m²`);
      existente.area_util = f.area_util;
      existente.area_total = f.area_total || f.area_util;
    }
    if (f.quartos !== existente.quartos) { mudancas.push(`quartos ${existente.quartos} → ${f.quartos}`); existente.quartos = f.quartos; }
    if (f.banheiros !== existente.banheiros) { existente.banheiros = f.banheiros; }
    if (f.vagas !== existente.vagas) { existente.vagas = f.vagas; }
    if (f.bairro && f.bairro !== existente.bairro) { mudancas.push(`bairro "${existente.bairro}" → "${f.bairro}"`); existente.bairro = f.bairro; }
    if (f.publication_type && f.publication_type !== existente.publication_type) {
      mudancas.push(`publication_type ${existente.publication_type || '—'} → ${f.publication_type}`);
      existente.publication_type = f.publication_type;
    }
    if (f.descricao && f.descricao.length > (existente.descricao || '').length) {
      existente.descricao = f.descricao;
    }

    if (mudancas.length > 0) {
      const { criterios, nota } = recalcularCriterios(existente, f);
      existente.criterios_qualidade = criterios;
      existente.nota_qualidade = nota;
      existente.data_atualizacao = agora.split('T')[0];
      alterados.push({ id_externo: f.id_externo, titulo: existente.titulo, mudancas });
    }
  }

  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');

  const relatorio = {
    executado_em: agora,
    fonte: FEED_URL,
    total_no_feed: feedImoveis.length,
    total_na_base_local: db.imoveis.length,
    total_alterados: alterados.length,
    novos_no_feed_nao_criados: novosNoFeed,
    presentes_na_base_mas_nao_no_feed: removidosDoFeed,
    alteracoes: alterados,
  };
  fs.writeFileSync(LOG_PATH, JSON.stringify(relatorio, null, 2), 'utf-8');

  console.log(`\n${alterados.length} imóveis atualizados de ${feedImoveis.length} no feed.`);
  if (novosNoFeed.length) console.log(`${novosNoFeed.length} imóveis novos no feed (não estão na base local, não foram criados automaticamente):`, novosNoFeed.join(', '));
  if (removidosDoFeed.length) console.log(`${removidosDoFeed.length} imóveis da base local não aparecem mais no feed (possível venda/baixa):`, removidosDoFeed.slice(0, 20).join(', '), removidosDoFeed.length > 20 ? '...' : '');
  for (const a of alterados.slice(0, 30)) console.log(`  ${a.id_externo} — ${a.mudancas.join('; ')}`);
  if (alterados.length > 30) console.log(`  ... e mais ${alterados.length - 30}`);
  console.log('\nRelatório completo salvo em', LOG_PATH);
}

main().catch(err => {
  console.error('Erro na sincronização:', err.message);
  process.exit(1);
});
