const fs = require('fs');
const { DOMParser } = require('@xmldom/xmldom');

const INPUT = process.argv[2];
const OUTPUT = process.argv[3];

function q1(el, name) {
  if (!el) return null;
  const list = el.getElementsByTagName(name);
  return list.length ? list[0] : null;
}
function q1any(el, names) {
  for (const n of names) {
    const f = q1(el, n);
    if (f) return f;
  }
  return null;
}
function text(node) {
  return node && node.textContent != null ? node.textContent.trim() : '';
}

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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

const descricoesFallback = [
  'Excelente imovel bem localizado, com otima infraestrutura no entorno: comercios, escolas e transporte publico por perto. Consulte condicoes de financiamento.',
  'Otima oportunidade de investimento nesta regiao valorizada. Imovel pronto para morar, com boa iluminacao natural e ventilacao.',
  'Imovel em localizacao privilegiada, proximo a areas de lazer e servicos essenciais. Agende sua visita e conheca pessoalmente.',
];

function subtipoComercial(titulo) {
  const t = (titulo || '').toLowerCase();
  if (t.includes('galpão') || t.includes('galpao') || t.includes('depósito') || t.includes('deposito') || t.includes('barracão') || t.includes('barracao')) return 'galpao';
  if (t.includes('prédio') || t.includes('predio')) return 'predio';
  if (t.includes('sobreloja')) return 'sala';
  if (t.includes('sala')) return 'sala';
  if (t.includes('loja')) return 'loja';
  if (t.includes('sobrado')) return 'sobrado';
  if (t.includes('terreno') || t.includes('área') || t.includes('area')) return 'terreno_comercial';
  if (t.includes('ponto')) return 'ponto';
  return 'outro';
}

function buildCriterios(temEndereco, temPreco, temDescricao, temFotos, temVideo, temTitulo, temArea) {
  return [
    { id: 'endereco', label: 'Endereço completo', presente: temEndereco, peso: 1.5, pontos: temEndereco ? 1.5 : 0, sugestao: temEndereco ? undefined : 'Adicione o número e complemento do endereço' },
    { id: 'preco', label: 'Preço cadastrado', presente: temPreco, peso: 2.0, pontos: temPreco ? 2.0 : 0, sugestao: temPreco ? undefined : 'Preço inválido ou ausente — informe o valor de mercado' },
    { id: 'descricao', label: 'Descrição completa (+300 chars)', presente: temDescricao, peso: 2.0, pontos: temDescricao ? 2.0 : 0, sugestao: temDescricao ? undefined : 'Descrição muito curta. Adicione diferenciais do imóvel' },
    { id: 'fotos', label: 'Fotos de qualidade (mín. 8)', presente: temFotos, peso: 2.5, pontos: temFotos ? 2.5 : 0, sugestao: temFotos ? undefined : 'Adicione pelo menos 8 fotos de boa resolução' },
    { id: 'video', label: 'Vídeo / tour virtual', presente: temVideo, peso: 1.0, pontos: temVideo ? 1.0 : 0, sugestao: temVideo ? undefined : 'Adicionar vídeo aumenta visualizações em +24%' },
    { id: 'titulo', label: 'Título atrativo e completo', presente: temTitulo, peso: 0.5, pontos: temTitulo ? 0.5 : 0, sugestao: temTitulo ? undefined : 'Use título descritivo: tipo + quartos + bairro' },
    { id: 'area', label: 'Área útil informada', presente: temArea, peso: 0.5, pontos: temArea ? 0.5 : 0, sugestao: temArea ? undefined : 'Informe a área útil do imóvel' },
  ];
}

const REF_DATE = new Date('2026-07-11T12:00:00');
function isoDateMinusDays(days) {
  const d = new Date(REF_DATE);
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

const xml = fs.readFileSync(INPUT, 'utf-8');
const doc = new DOMParser({ onError: () => {} }).parseFromString(xml, 'application/xml');
const listingsNodeList = doc.getElementsByTagName('Listing');
const listings = [];
for (let i = 0; i < listingsNodeList.length; i++) listings.push(listingsNodeList[i]);

const brutos = listings.map((listing, i) => {
  const idNode = q1any(listing, ['ListingID', 'id', 'Codigo']);
  const idExterno = text(idNode) || ('LOBO-' + (i + 1));
  const rnd = mulberry32(hashSeed(idExterno));

  const titleNode = q1any(listing, ['Title', 'Titulo']);
  const descNode = q1any(listing, ['Description', 'Descricao']);
  const addressNode = q1any(listing, ['Address', 'Logradouro']);
  const streetNumberNode = q1(listing, 'StreetNumber');
  const neighborhoodNode = q1any(listing, ['Neighborhood', 'Bairro']);
  const cityNode = q1any(listing, ['City', 'Cidade']);
  const stateNode = q1any(listing, ['State']);
  const listPriceNode = q1(listing, 'ListPrice');
  const rentalPriceNode = q1(listing, 'RentalPrice');
  const priceNode = listPriceNode || rentalPriceNode;
  const areaNode = q1any(listing, ['LivingArea', 'UsableArea', 'LotArea', 'Area', 'TotalArea']);
  const bedroomsNode = q1any(listing, ['Bedrooms', 'NumBedrooms']);
  const bathroomsNode = q1any(listing, ['Bathrooms', 'NumBathrooms']);
  const suitesNode = q1any(listing, ['Suites', 'NumSuites']);
  const garageNode = q1any(listing, ['Garage', 'NumGarages']);
  const propertyTypeNode = q1(listing, 'PropertyType');
  const publicationTypeNode = q1(listing, 'PublicationType');

  const mediaItems = listing.getElementsByTagName('Item');
  const fotos = [];
  let hasVideo = false;
  for (let j = 0; j < mediaItems.length; j++) {
    const m = mediaItems[j];
    const type = m.getAttribute('medium') || m.getAttribute('tipo');
    const url = text(m);
    if (type === 'video') hasVideo = true;
    else if (url) fotos.push(url);
  }

  const tipo = mapTipo(text(propertyTypeNode));
  const subtipo = tipo === 'comercial' ? subtipoComercial(text(titleNode)) : null;
  const isAluguel = !!rentalPriceNode;
  const preco = parseFloat(text(priceNode) || '0') || 0;
  const area = parseFloat(text(areaNode) || '0') || 0;
  const quartos = parseInt(text(bedroomsNode) || '0', 10) || 0;
  const suites = parseInt(text(suitesNode) || '0', 10) || 0;
  const banheiros = parseInt(text(bathroomsNode) || '0', 10) || 0;
  const vagas = parseInt(text(garageNode) || '0', 10) || 0;
  const bairro = text(neighborhoodNode) || 'Centro';
  const cidade = text(cityNode) || 'Goiânia';
  const uf = text(stateNode) || 'GO';
  const streetNumber = text(streetNumberNode);
  const enderecoBase = text(addressNode);
  const endereco = [enderecoBase, streetNumber].filter(Boolean).join(', ') || (bairro + ', ' + cidade + ' - ' + uf);

  let titulo = text(titleNode);
  if (!titulo || titulo.length < 10) {
    const tipoLabel = tipo.charAt(0).toUpperCase() + tipo.slice(1);
    titulo = (tipoLabel + ' ' + (quartos > 0 ? quartos + ' quartos' : '') + ' - ' + bairro).replace(/\s+/g, ' ').trim();
  }

  let descricao = text(descNode);
  const temDescricaoOriginal = descricao.length >= 100;
  if (!temDescricaoOriginal) {
    descricao = descricao || descricoesFallback[i % descricoesFallback.length];
  }

  const temEndereco = endereco.length > 15;
  const temPreco = preco > 0;
  const temFotos = fotos.length >= 8;
  const temTitulo = titulo.length > 15;
  const temArea = area > 0;
  const criterios = buildCriterios(temEndereco, temPreco, temDescricaoOriginal, temFotos, hasVideo, temTitulo, temArea);
  const nota = parseFloat(criterios.reduce(function(acc, c) { return acc + c.pontos; }, 0).toFixed(1));
  const diasMercado = Math.floor(rnd() * 300) + 1;
  const finalidade = isAluguel ? 'aluguel' : 'venda';
  // Controle de destaque real: vem do <PublicationType> do XML do CRM
  // (tag padrão VRSync), não é sorteado. No feed de origem, valores vistos
  // são STANDARD e PREMIUM. Só PREMIUM (ou variações SUPER/DESTAQUE, caso
  // o CRM passe a usá-las) conta como destaque ativo — porque é o próprio
  // ERP/CRM reportando que aquele imóvel está configurado com publicação
  // destacada. Isso NÃO significa que compramos/alocamos destaque por aqui:
  // a compra em si acontece no painel de anunciante de cada portal.
  const publicationType = (text(publicationTypeNode) || 'STANDARD').toUpperCase();
  const destaqueAtivo = /PREMIUM|SUPER|DESTAQUE|FEATURED/.test(publicationType);

  return {
    idExterno: idExterno, rnd: rnd, finalidade: finalidade, tipo: tipo, subtipo: subtipo, preco: preco, area: area, temPreco: temPreco, temArea: temArea,
    id: 'imovel-' + String(i + 1).padStart(4, '0'),
    id_externo: 'LOFT-' + idExterno,
    titulo: titulo, bairro: bairro, cidade: cidade, uf: uf, endereco: endereco,
    area_util: area,
    area_total: area,
    quartos: quartos, suites: suites, banheiros: banheiros, vagas: vagas,
    preco_atual: preco,
    preco_condominio: Math.round(rnd() * 1200) + 150,
    preco_iptu: Math.round(rnd() * 500) + 50,
    descricao: descricao,
    descricao_enriquecida: undefined,
    fotos: fotos.length ? fotos : [],
    video_url: hasVideo ? 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' : undefined,
    nota_qualidade: nota,
    criterios_qualidade: criterios,
    portais_publicados: ['zap', 'olx', rnd() > 0.5 ? 'vivareal' : 'chaves'].slice(0, Math.floor(rnd() * 3) + 1),
    metricas: {
      visualizacoes_total: Math.floor(rnd() * 3000) + 50,
      leads_total: Math.floor(rnd() * 60),
      visualizacoes_semana: Math.floor(rnd() * 100) + 5,
      leads_semana: Math.floor(rnd() * 10),
      taxa_conversao: parseFloat((rnd() * 7 + 0.5).toFixed(1)),
      dias_no_mercado: diasMercado,
      posicao_ranking: Math.floor(rnd() * 50) + 1,
    },
    regras_aplicadas: [],
    data_cadastro: isoDateMinusDays(diasMercado),
    data_atualizacao: isoDateMinusDays(Math.floor(rnd() * 7)),
    destaque_ativo: destaqueAtivo,
    publication_type: publicationType,
    imobiliaria_id: 'imob-001',
  };
});

function median(arr) {
  if (!arr.length) return 0;
  const sorted = arr.slice().sort(function(a, b) { return a - b; });
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function segKey(im) {
  return im.finalidade + '|' + im.tipo + (im.subtipo ? ('|' + im.subtipo) : '');
}
function tipoKey(im) {
  return im.finalidade + '|' + im.tipo;
}

const segmentos = {};
const segmentosTipo = {};
for (const im of brutos) {
  if (!im.temPreco || !im.temArea) continue;
  const precoM2 = im.preco / im.area;
  if (!isFinite(precoM2) || precoM2 <= 0) continue;
  const kFino = segKey(im);
  const kTipo = tipoKey(im);
  (segmentos[kFino] = segmentos[kFino] || []).push(precoM2);
  (segmentosTipo[kTipo] = segmentosTipo[kTipo] || []).push(precoM2);
}
const segmentoRef = {};
for (const key in segmentos) {
  segmentoRef[key] = median(segmentos[key]);
}
const segmentoTipoRef = {};
for (const key in segmentosTipo) {
  segmentoTipoRef[key] = median(segmentosTipo[key]);
}
const globalPorFinalidade = { venda: [], aluguel: [] };
for (const im of brutos) {
  if (im.temPreco && im.temArea) {
    const precoM2 = im.preco / im.area;
    if (isFinite(precoM2) && precoM2 > 0) globalPorFinalidade[im.finalidade].push(precoM2);
  }
}
const globalRef = {
  venda: median(globalPorFinalidade.venda),
  aluguel: median(globalPorFinalidade.aluguel),
};

console.log('--- Segmentos (mediana preco/m2, n amostras) ---');
for (const key in segmentoRef) {
  console.log('  ' + key + ': R$ ' + segmentoRef[key].toFixed(2) + '/m2 (n=' + segmentos[key].length + ')');
}
console.log('--- (fallback) segmentos por tipo amplo ---');
for (const key in segmentoTipoRef) {
  console.log('  ' + key + ': R$ ' + segmentoTipoRef[key].toFixed(2) + '/m2 (n=' + segmentosTipo[key].length + ')');
}
console.log('Global venda:', globalRef.venda.toFixed(2), '| Global aluguel:', globalRef.aluguel.toFixed(2));

const imoveis = brutos.map(function(im) {
  const kFino = segKey(im);
  const kTipo = tipoKey(im);
  const nFino = (segmentos[kFino] || []).length;
  const nTipo = (segmentosTipo[kTipo] || []).length;
  let mediaRef;
  if (nFino >= 4) mediaRef = segmentoRef[kFino];
  else if (nTipo >= 5) mediaRef = segmentoTipoRef[kTipo];
  else mediaRef = globalRef[im.finalidade];

  let status_farol = 'venda_potencial';
  let preco_sugerido_ia = im.preco;
  let preco_suspeito = false;

  if (im.temPreco && im.temArea && mediaRef > 0) {
    preco_sugerido_ia = Math.round(mediaRef * im.area);
    const precoM2Atual = im.preco / im.area;
    const razao = precoM2Atual / mediaRef;
    if (razao > 8 || razao < 0.12) {
      preco_suspeito = true;
      status_farol = 'baixo_potencial';
    } else if (razao <= 0.92) status_farol = 'venda_iminente';
    else if (razao <= 1.12) status_farol = 'venda_potencial';
    else status_farol = 'baixo_potencial';
  } else {
    status_farol = 'baixo_potencial';
    preco_sugerido_ia = im.preco || 0;
  }

  const rest = Object.assign({}, im);
  delete rest.idExterno; delete rest.rnd; delete rest.finalidade; delete rest.tipo; delete rest.subtipo;
  delete rest.preco; delete rest.area; delete rest.temPreco; delete rest.temArea;

  return Object.assign({}, rest, {
    finalidade: im.finalidade,
    tipo: im.tipo,
    preco_sugerido_ia: preco_sugerido_ia,
    status_farol: status_farol,
    preco_suspeito: preco_suspeito,
    historico_preco: [
      { data: isoDateMinusDays(180), preco: Math.round(im.preco * 1.06), motivo: 'Valor inicial' },
      { data: isoDateMinusDays(60), preco: Math.round(im.preco * 1.02), motivo: 'Ajuste de mercado' },
      { data: isoDateMinusDays(7), preco: im.preco, motivo: 'Preço atual' },
    ],
  });
});

fs.writeFileSync(OUTPUT, JSON.stringify(imoveis, null, 2), 'utf-8');
console.log('Gerados ' + imoveis.length + ' imoveis reais em ' + OUTPUT);
console.log('Tipos:', Array.from(new Set(imoveis.map(function(i){return i.tipo;}))));
console.log('Com foto:', imoveis.filter(function(i){return i.fotos.length > 0;}).length, '/', imoveis.length);
console.log('Nota media:', (imoveis.reduce(function(a,i){return a+i.nota_qualidade;}, 0) / imoveis.length).toFixed(2));
console.log('Venda:', imoveis.filter(function(i){return i.finalidade==='venda';}).length, '| Aluguel:', imoveis.filter(function(i){return i.finalidade==='aluguel';}).length);
function farolCount(fin, status) {
  return imoveis.filter(function(i){ return i.finalidade===fin && i.status_farol===status; }).length;
}
console.log('Farol venda: iminente=' + farolCount('venda','venda_iminente') + ' potencial=' + farolCount('venda','venda_potencial') + ' baixo=' + farolCount('venda','baixo_potencial'));
console.log('Farol aluguel: iminente=' + farolCount('aluguel','venda_iminente') + ' potencial=' + farolCount('aluguel','venda_potencial') + ' baixo=' + farolCount('aluguel','baixo_potencial'));
console.log('Precos suspeitos (excluidos da receita):', imoveis.filter(function(i){return i.preco_suspeito;}).length);
console.log('Destaque ativo (PublicationType real):', imoveis.filter(function(i){return i.destaque_ativo;}).length, '/', imoveis.length);
console.log('PublicationType distintos:', JSON.stringify(imoveis.reduce(function(acc,i){acc[i.publication_type]=(acc[i.publication_type]||0)+1; return acc;}, {})));
