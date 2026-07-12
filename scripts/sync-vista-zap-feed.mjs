// =============================================================
// Sincroniza o db.json com o feed XML REAL que o Vista gera todo
// noite para o portal Zap (Grupo OLX/VivaReal).
//
// Fonte: https://loboimov-portais.vistahost.com.br/<token>
// Esse é o MESMO arquivo que o robô do Grupo OLX baixa a cada 12h
// (confirmado em Canal Pro > Configurações > Integrações > Imóveis
// e no cadastro Vista > Portais > Zap > "3 - Dados e XML").
//
// Importante: esse feed só contém os imóveis marcados "Publicar Zap"
// no Vista (hoje ~40 dos 340 do portfólio total) — não é a base
// inteira, é o recorte que está realmente publicado no Zap/OLX.
// Este script atualiza APENAS esses imóveis dentro do db.json
// (preço, área, quartos, descrição, bairro/endereço) e recalcula a
// nota_qualidade deles. Os demais ~300 imóveis do inventário não são
// tocados.
//
// Uso:
//   node scripts/sync-vista-zap-feed.mjs [caminho-xml-local]
//
// Sem argumento, busca a URL ao vivo (precisa de internet real —
// não funciona atrás de proxy/allowlist restrito).
// =============================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'src', 'data', 'db.json');
const FEED_URL = 'https://loboimov-portais.vistahost.com.br/47366e944b4a56df1713df75fda662da';
const LOG_PATH = path.join(__dirname, '..', 'src', 'data', 'sync-vista-log.json');

async function carregarXML() {
  const argPath = process.argv[2];
  if (argPath) {
    console.log('Lendo XML local:', argPath);
    const buf = fs.readFileSync(argPath);
    // Arquivo local já deve estar em UTF-8 (ex: salvo pelo navegador já
    // decodificado). Se vier cru do Vista, ele é ISO-8859-1.
    return buf.toString('utf-8');
  }
  console.log('Buscando feed ao vivo em', FEED_URL);
  const res = await fetch(FEED_URL);
  if (!res.ok) throw new Error(`Falha ao buscar feed: HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  // O Vista declara iso-8859-1 no XML mas o header HTTP diz UTF-8 — o
  // header mente. Decodificamos como latin1, que é o que bate com os
  // bytes reais enviados pelo servidor.
  return new TextDecoder('iso-8859-1').decode(buf);
}

function g(block, tag) {
  const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return m ? m[1].trim() : '';
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function parseNumeroBR(s) {
  if (!s) return 0;
  // Formato Vista: "1.330.000" (ponto = milhar, sem decimal) ou "1.600" etc.
  const limpo = s.replace(/\./g, '').replace(',', '.').trim();
  const n = parseFloat(limpo);
  return isFinite(n) ? n : 0;
}

function tituloCase(s) {
  if (!s) return s;
  return s
    .toLowerCase()
    .split(' ')
    .map(w => (w.length <= 2 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

function parseImoveisXML(xmlText) {
  const blocks = xmlText.match(/<Imovel>[\s\S]*?<\/Imovel>/g) || [];
  return blocks.map(block => {
    const codigo = g(block, 'CodigoImovel');
    const precoVenda = parseNumeroBR(g(block, 'PrecoVenda'));
    const precoLocacao = parseNumeroBR(g(block, 'PrecoLocacao'));
    const finalidade = precoVenda > 0 ? 'venda' : 'aluguel';
    const preco = finalidade === 'venda' ? precoVenda : precoLocacao;

    return {
      codigo,
      id_externo: `LOFT-${codigo}`,
      tipo_raw: g(block, 'TipoImovel'),
      bairro: tituloCase(decodeEntities(g(block, 'Bairro'))),
      cidade: tituloCase(decodeEntities(g(block, 'Cidade'))),
      endereco_raw: decodeEntities(g(block, 'Endereco')),
      numero: g(block, 'Numero'),
      complemento: decodeEntities(g(block, 'Complemento')),
      finalidade,
      preco,
      area_util: parseNumeroBR(g(block, 'AreaUtil')),
      area_total: parseNumeroBR(g(block, 'AreaTotal')),
      quartos: parseInt(g(block, 'QtdDormitorios') || '0', 10) || 0,
      suites: parseInt(g(block, 'QtdSuites') || '0', 10) || 0,
      banheiros: parseInt(g(block, 'QtdBanheiros') || '0', 10) || 0,
      vagas: parseInt(g(block, 'QtdVagas') || '0', 10) || 0,
      preco_condominio: parseNumeroBR(g(block, 'PrecoCondominio')),
      descricao: decodeEntities(g(block, 'Observacao')),
    };
  });
}

// Mesmos critérios/pesos usados na carga inicial (build-real-imoveis-v3.js)
// — mantemos consistência na nota entre a base inicial e as atualizações.
function recalcularCriterios(imovelExistente, novo) {
  const temEndereco = !!(imovelExistente.endereco && imovelExistente.endereco.length > 15);
  const temPreco = novo.preco > 0;
  const temDescricao = novo.descricao.length >= 300 || (imovelExistente.descricao || '').length >= 300;
  const temFotos = (imovelExistente.fotos || []).length >= 8;
  const temVideo = !!imovelExistente.video_url;
  const temTitulo = (imovelExistente.titulo || '').length > 15;
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
  const feedImoveis = parseImoveisXML(xmlText);
  console.log(`Feed real do Zap: ${feedImoveis.length} imóveis (só os marcados "Publicar Zap" no Vista).`);

  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  const porIdExterno = new Map(db.imoveis.map(im => [im.id_externo, im]));

  const agora = new Date().toISOString();
  const alterados = [];
  const naoEncontrados = [];

  for (const f of feedImoveis) {
    const existente = porIdExterno.get(f.id_externo);
    if (!existente) {
      naoEncontrados.push(f.id_externo);
      continue;
    }

    const mudancas = [];
    if (f.preco > 0 && f.preco !== existente.preco_atual) {
      mudancas.push(`preço ${existente.preco_atual} → ${f.preco}`);
      existente.historico_preco = existente.historico_preco || [];
      existente.historico_preco.push({ data: agora.split('T')[0], preco: f.preco, motivo: 'Sincronização com feed real do Zap' });
      existente.preco_atual = f.preco;
    }
    if (f.area_util > 0 && f.area_util !== existente.area_util) {
      mudancas.push(`área ${existente.area_util}m² → ${f.area_util}m²`);
      existente.area_util = f.area_util;
      existente.area_total = f.area_total || f.area_util;
    }
    if (f.quartos && f.quartos !== existente.quartos) { mudancas.push(`quartos ${existente.quartos} → ${f.quartos}`); existente.quartos = f.quartos; }
    if (f.suites !== undefined && f.suites !== existente.suites) { existente.suites = f.suites; }
    if (f.banheiros && f.banheiros !== existente.banheiros) { existente.banheiros = f.banheiros; }
    if (f.vagas !== undefined && f.vagas !== existente.vagas) { existente.vagas = f.vagas; }
    if (f.bairro && f.bairro !== existente.bairro) { mudancas.push(`bairro "${existente.bairro}" → "${f.bairro}"`); existente.bairro = f.bairro; }
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
    total_alterados: alterados.length,
    total_nao_encontrados_na_base: naoEncontrados.length,
    nao_encontrados: naoEncontrados,
    alteracoes: alterados,
  };
  fs.writeFileSync(LOG_PATH, JSON.stringify(relatorio, null, 2), 'utf-8');

  console.log(`\n${alterados.length} imóveis atualizados de ${feedImoveis.length} no feed.`);
  if (naoEncontrados.length) console.log(`${naoEncontrados.length} códigos do feed não encontrados na base local:`, naoEncontrados.join(', '));
  for (const a of alterados) console.log(`  ${a.id_externo} — ${a.mudancas.join('; ')}`);
  console.log('\nRelatório salvo em', LOG_PATH);
}

main().catch(err => {
  console.error('Erro na sincronização:', err.message);
  process.exit(1);
});
