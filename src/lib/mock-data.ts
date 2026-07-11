import {
  Imovel,
  FarolStatus,
  ImovelTipo,
  Portal,
  PortalSlug,
  Destaque,
  RegraEnriquecimento,
  RevenueData,
  DashboardKPIs,
  CargaXML,
  CriterioQualidade,
  Imobiliaria,
} from './types';
import realImoveisData from './real-imoveis-data.json';

// =============================================
// IMOBILIÁRIA (TENANT)
// =============================================
export const mockImobiliaria: Imobiliaria = {
  id: 'imob-001',
  nome: 'LOBO IMOVEIS',
  cnpj: '12.345.678/0001-90',
  plano: 'enterprise',
  imoveis_limite: 25000,
  portais_limite: 7,
  data_criacao: '2023-01-15',
  config: {
    cadencia_republicacao_horas: 24,
    proteger_endereco: true,
    gerar_descricao_auto: true,
    score_minimo_destaque: 7.5,
  },
};

// =============================================
// HELPERS
// =============================================
const bairros = [
  'Batel', 'Água Verde', 'Mercês', 'Bigorrilho', 'Alto da XV',
  'Cabral', 'Hugo Lange', 'Jardim Social', 'Cristo Rei', 'Ahú',
  'Santa Felicidade', 'Bacacheri', 'Portão', 'Champagnat', 'Seminário',
];
const tipos: ImovelTipo[] = ['apartamento', 'casa', 'studio', 'cobertura', 'flat', 'comercial'];
const farolStatus: FarolStatus[] = ['venda_iminente', 'venda_potencial', 'baixo_potencial'];

// PRNG determinística (mulberry32) — garante que o mesmo conjunto de dados
// mock seja gerado tanto no servidor quanto no client, evitando hydration
// mismatch entre SSR e a primeira renderização no browser.
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const seededRandom = mulberry32(20260711); // seed fixa (data de referência do projeto)

function rand(min: number, max: number) {
  return Math.floor(seededRandom() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number, decimals = 1) {
  return parseFloat((seededRandom() * (max - min) + min).toFixed(decimals));
}

function randomDate(daysAgo: number) {
  const d = new Date('2026-07-11T12:00:00'); // data de referência fixa, não Date.now()
  d.setDate(d.getDate() - rand(0, daysAgo));
  return d.toISOString().split('T')[0];
}

function buildCriterios(
  temEndereco: boolean, temPreco: boolean, temDescricao: boolean,
  temFotos: boolean, temVideo: boolean, temTitulo: boolean, temArea: boolean
): CriterioQualidade[] {
  return [
    {
      id: 'endereco', label: 'Endereço completo', presente: temEndereco,
      peso: 1.5, pontos: temEndereco ? 1.5 : 0,
      sugestao: temEndereco ? undefined : 'Adicione o número e complemento do endereço',
    },
    {
      id: 'preco', label: 'Preço cadastrado', presente: temPreco,
      peso: 2.0, pontos: temPreco ? 2.0 : 0,
      sugestao: temPreco ? undefined : 'Preço inválido ou ausente — informe o valor de mercado',
    },
    {
      id: 'descricao', label: 'Descrição completa (+300 chars)', presente: temDescricao,
      peso: 2.0, pontos: temDescricao ? 2.0 : 0,
      sugestao: temDescricao ? undefined : 'Descrição muito curta. Adicione diferenciais do imóvel',
    },
    {
      id: 'fotos', label: 'Fotos de qualidade (mín. 8)', presente: temFotos,
      peso: 2.5, pontos: temFotos ? 2.5 : 0,
      sugestao: temFotos ? undefined : 'Adicione pelo menos 8 fotos de boa resolução',
    },
    {
      id: 'video', label: 'Vídeo / tour virtual', presente: temVideo,
      peso: 1.0, pontos: temVideo ? 1.0 : 0,
      sugestao: temVideo ? undefined : 'Adicionar vídeo aumenta visualizações em +24%',
    },
    {
      id: 'titulo', label: 'Título atrativo e completo', presente: temTitulo,
      peso: 0.5, pontos: temTitulo ? 0.5 : 0,
      sugestao: temTitulo ? undefined : 'Use título descritivo: tipo + quartos + bairro',
    },
    {
      id: 'area', label: 'Área útil informada', presente: temArea,
      peso: 0.5, pontos: temArea ? 0.5 : 0,
      sugestao: temArea ? undefined : 'Informe a área útil do imóvel',
    },
  ];
}

const descricoes = [
  'Excelente apartamento com acabamento de alto padrão, cozinha americana integrada à sala de estar com varanda gourmet. Piso porcelanato, armários planejados em todos os ambientes. Lazer completo: piscina, sauna, academia e salão de festas. Localização privilegiada, próximo a supermercados, escolas e transporte público.',
  'Linda casa em condomínio fechado, com 4 suítes sendo 1 master com closet e banheiro premium. Área gourmet coberta com churrasqueira, piscina aquecida e jardim. 3 vagas de garagem. Condomínio com segurança 24h e portaria monitorada. Excelente oportunidade!',
  'Studio moderno e funcional, ideal para quem busca praticidade e estilo. Piso vinílico, cozinha compacta equipada e banheiro com box de vidro. Condomínio com coworking, academia e bicicletário. Próximo ao metrô.',
  'Cobertura duplex com vista panorâmica. Piscina privativa na cobertura, terraço de 80m², 5 suítes, adega climatizada. Acabamento importado. Área de lazer exclusiva. Heliponto no prédio. Uma raridade no mercado.',
  'Apartamento bem localizado no coração do bairro. 2 quartos, sala ampla, cozinha equipada. Andar alto com boa ventilação natural. Vaga de garagem inclusa. Prédio com porteiro 24h. Aceita financiamento.',
];

const fotos_mock = [
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400',
  'https://images.unsplash.com/photo-1560185127-6a251c622e51?w=400',
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=400',
  'https://images.unsplash.com/photo-1554995207-c18c203602cb?w=400',
  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400',
  'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=400',
  'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=400',
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400',
];

// =============================================
// GENERATE MOCK IMÓVEIS
// =============================================
function generateImovel(i: number): Imovel {
  const tipo = tipos[i % tipos.length];
  const bairro = bairros[i % bairros.length];
  const quartos = tipo === 'studio' ? 0 : tipo === 'comercial' ? 0 : rand(1, 5);
  const suites = Math.min(quartos, rand(0, quartos));
  const banheiros = rand(1, quartos + 2);
  const vagas = rand(0, 3);
  const area = tipo === 'studio' ? rand(28, 45) : tipo === 'comercial' ? rand(40, 300) : rand(60, 400);
  const preco = tipo === 'comercial'
    ? rand(300000, 2000000)
    : tipo === 'cobertura'
    ? rand(800000, 5000000)
    : rand(180000, 1800000);
  const farol = farolStatus[i % 3] as FarolStatus;
  const diasMercado = rand(1, 360);
  const temEndereco = seededRandom() > 0.2;
  const temDescricao = seededRandom() > 0.3;
  const temFotos = seededRandom() > 0.25;
  const temVideo = seededRandom() > 0.55;
  const temTitulo = seededRandom() > 0.15;
  const temArea = seededRandom() > 0.1;
  const criterios = buildCriterios(temEndereco, true, temDescricao, temFotos, temVideo, temTitulo, temArea);
  const nota = parseFloat(criterios.reduce((acc, c) => acc + c.pontos, 0).toFixed(1));
  const numFotos = temFotos ? rand(8, 20) : rand(1, 5);

  return {
    id: `imovel-${String(i + 1).padStart(4, '0')}`,
    id_externo: `CRM-${rand(10000, 99999)}`,
    titulo: `${tipo.charAt(0).toUpperCase() + tipo.slice(1)} ${quartos > 0 ? quartos + ' quartos' : ''} - ${bairro}`,
    tipo,
    finalidade: seededRandom() > 0.35 ? 'venda' : 'aluguel',
    bairro,
    cidade: 'Curitiba',
    uf: 'PR',
    endereco: temEndereco
      ? `Rua das Flores, ${rand(100, 999)} - ${bairro}, Curitiba - PR`
      : `${bairro}, Curitiba - PR`,
    area_util: area,
    area_total: area + rand(0, 30),
    quartos,
    suites,
    banheiros,
    vagas,
    preco_atual: preco,
    preco_sugerido_ia: Math.round(preco * randFloat(0.88, 1.12)),
    preco_condominio: rand(300, 2000),
    preco_iptu: rand(100, 800),
    descricao: temDescricao ? descricoes[i % descricoes.length] : 'Imóvel disponível. Consulte.',
    descricao_enriquecida: undefined,
    fotos: fotos_mock.slice(0, numFotos),
    video_url: temVideo ? 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' : undefined,
    status_farol: farol,
    nota_qualidade: nota,
    criterios_qualidade: criterios,
    portais_publicados: ['olx', 'zap', seededRandom() > 0.5 ? 'vivareal' : 'chaves'].slice(0, rand(1, 3)) as any,
    historico_preco: [
      { data: randomDate(180), preco: Math.round(preco * 1.08), motivo: 'Valor inicial' },
      { data: randomDate(90), preco: Math.round(preco * 1.03), motivo: 'Ajuste de mercado' },
      { data: randomDate(30), preco, motivo: 'Preço atual' },
    ],
    metricas: {
      visualizacoes_total: rand(50, 3500),
      leads_total: rand(0, 80),
      visualizacoes_semana: rand(5, 120),
      leads_semana: rand(0, 12),
      taxa_conversao: randFloat(0.5, 8.5),
      dias_no_mercado: diasMercado,
      posicao_ranking: rand(1, 50),
    },
    regras_aplicadas: [],
    data_cadastro: randomDate(365),
    data_atualizacao: randomDate(7),
    destaque_ativo: seededRandom() > 0.75,
    imobiliaria_id: 'imob-001',
  };
}

// =============================================
// DADOS REAIS: 340 imóveis do feed VRSync real da
// LOBO IMOVEIS (Loft CRM), convertidos 1x via script
// (scripts/build-real-imoveis.js) a partir do XML real
// baixado do feed de produção. Sem banco de dados ainda —
// isso substitui a geração aleatória de 120 imóveis fake
// por conteúdo real (título, preço, endereço, descrição,
// fotos), mantendo apenas métricas de portal (leads/views)
// como estimativa, pois isso depende de integração de API
// de parceiro dos portais que ainda não temos.
const imoveis: Imovel[] = realImoveisData as unknown as Imovel[];

// generateImovel() acima fica disponível caso precise gerar
// dados sintéticos adicionais no futuro (ex: ambiente de demo).
void generateImovel;

export const mockImoveis = imoveis;

// =============================================
// PORTALS
// =============================================
const mockPortaisBase: Portal[] = [
  {
    slug: 'zap', nome: 'ZAP Imóveis', cor: '#ff5a00',
    formato_xml: 'vrsync', ativo: true,
    destaques_disponiveis: 50, destaques_usados: 32,
    orcamento_mensal: 8000, orcamento_gasto: 5600,
    leads_mes: 312, visualizacoes_mes: 18400,
    custo_por_lead: 17.9, api_disponivel: true,
  },
  {
    slug: 'vivareal', nome: 'VivaReal', cor: '#0066cc',
    formato_xml: 'vrsync', ativo: true,
    destaques_disponiveis: 40, destaques_usados: 28,
    orcamento_mensal: 6000, orcamento_gasto: 3900,
    leads_mes: 198, visualizacoes_mes: 12100,
    custo_por_lead: 19.7, api_disponivel: true,
  },
  {
    slug: 'olx', nome: 'OLX Imóveis', cor: '#6a1faf',
    formato_xml: 'vrsync', ativo: true,
    destaques_disponiveis: 60, destaques_usados: 45,
    orcamento_mensal: 5000, orcamento_gasto: 4200,
    leads_mes: 287, visualizacoes_mes: 22800,
    custo_por_lead: 14.6, api_disponivel: true,
  },
  {
    slug: 'chaves', nome: 'Chaves na Mão', cor: '#e11d48',
    formato_xml: 'chaves_native', ativo: true,
    destaques_disponiveis: 30, destaques_usados: 12,
    orcamento_mensal: 2500, orcamento_gasto: 900,
    leads_mes: 89, visualizacoes_mes: 5600,
    custo_por_lead: 10.1, api_disponivel: false,
  },
  {
    slug: 'imovelweb', nome: 'ImovelWeb', cor: '#059669',
    formato_xml: 'imovelweb_native', ativo: true,
    destaques_disponiveis: 25, destaques_usados: 18,
    orcamento_mensal: 3500, orcamento_gasto: 2800,
    leads_mes: 134, visualizacoes_mes: 8900,
    custo_por_lead: 20.9, api_disponivel: true,
  },
  {
    slug: 'meta', nome: 'Meta Ads', cor: '#1877f2',
    formato_xml: 'vrsync', ativo: true,
    destaques_disponiveis: 0, destaques_usados: 0,
    orcamento_mensal: 4000, orcamento_gasto: 3100,
    leads_mes: 156, visualizacoes_mes: 41000,
    custo_por_lead: 19.9, api_disponivel: true,
  },
  {
    slug: 'google', nome: 'Google Ads', cor: '#ea4335',
    formato_xml: 'vrsync', ativo: false,
    destaques_disponiveis: 0, destaques_usados: 0,
    orcamento_mensal: 0, orcamento_gasto: 0,
    leads_mes: 0, visualizacoes_mes: 0,
    custo_por_lead: 0, api_disponivel: true,
  },
];

// Nota do portal: calculada a partir dos 340 imóveis REAIS (não simulada).
// Combina 3 sinais reais por portal, a partir de quais imóveis têm esse
// portal em portais_publicados:
//   40% qualidade média dos anúncios publicados nele (nota_qualidade)
//   35% taxa de conversão média real (leads/visualizações, de imovel.metricas)
//   25% % de imóveis com farol favorável (venda/locação iminente ou potencial)
// Com penalidade proporcional ao % de imóveis com preco_suspeito publicados
// nesse portal (indica dado de origem ruim entrando no canal).
// leads_mes/visualizacoes_mes/orcamento continuam estimados, pois dependem
// de API de parceiro dos portais que ainda não temos acesso.
const TAXA_CONVERSAO_REF = 8; // maior taxa observada na base real, usada p/ normalizar

function calcularNotaPortal(slug: PortalSlug): Pick<Portal,
  'imoveis_publicados' | 'qualidade_media_portal' | 'farol_favoravel_pct' | 'preco_suspeito_pct' | 'nota_portal'
> {
  const publicados = mockImoveis.filter(i => i.portais_publicados?.includes(slug));
  const n = publicados.length;
  if (n === 0) {
    return { imoveis_publicados: 0, qualidade_media_portal: 0, farol_favoravel_pct: 0, preco_suspeito_pct: 0, nota_portal: 0 };
  }
  const qualidadeMedia = publicados.reduce((acc, i) => acc + i.nota_qualidade, 0) / n;
  const taxaConversaoMedia = publicados.reduce((acc, i) => acc + i.metricas.taxa_conversao, 0) / n;
  const favoraveis = publicados.filter(i => i.status_farol !== 'baixo_potencial').length;
  const farolFavoravelPct = (favoraveis / n) * 100;
  const suspeitos = publicados.filter(i => i.preco_suspeito).length;
  const precoSuspeitoPct = (suspeitos / n) * 100;

  const scoreQualidade = qualidadeMedia / 10;
  const scoreConversao = Math.min(taxaConversaoMedia / TAXA_CONVERSAO_REF, 1);
  const scoreFarol = farolFavoravelPct / 100;
  const penalidade = (precoSuspeitoPct / 100) * 0.3;

  const notaPortal = Math.max(0, Math.min(10,
    10 * (0.4 * scoreQualidade + 0.35 * scoreConversao + 0.25 * scoreFarol - penalidade)
  ));

  return {
    imoveis_publicados: n,
    qualidade_media_portal: Math.round(qualidadeMedia * 10) / 10,
    farol_favoravel_pct: Math.round(farolFavoravelPct),
    preco_suspeito_pct: Math.round(precoSuspeitoPct * 10) / 10,
    nota_portal: Math.round(notaPortal * 10) / 10,
  };
}

export const mockPortais: Portal[] = mockPortaisBase.map(p => ({
  ...p,
  ...calcularNotaPortal(p.slug),
}));

// =============================================
// DESTAQUES
// =============================================
// Mapeia TODOS os imóveis marcados como destaque_ativo, sem cortar em um
// número fixo (antes um .slice(0, 25) descartava resultado silenciosamente).
// destaque_ativo agora vem do PublicationType real do XML do CRM (não é
// mais sorteado) — hoje só 1 dos 340 imóveis reais está como PREMIUM.
export const mockDestaques: Destaque[] = mockImoveis
  .filter(i => i.destaque_ativo)
  .map((imovel, idx) => ({
    id: `destaque-${idx + 1}`,
    imovel_id: imovel.id,
    imovel: {
      titulo: imovel.titulo,
      bairro: imovel.bairro,
      preco_atual: imovel.preco_atual,
      tipo: imovel.tipo,
      status_farol: imovel.status_farol,
      nota_qualidade: imovel.nota_qualidade,
      finalidade: imovel.finalidade,
    },
    portal: imovel.portais_publicados[0] || 'zap',
    tipo_destaque: idx < 5 ? 'super_destaque' : idx < 12 ? 'destaque_premium' : 'destaque',
    data_inicio: randomDate(30),
    data_fim: new Date(new Date('2026-07-11T12:00:00').getTime() + rand(1, 25) * 86400000)
      .toISOString()
      .split('T')[0],
    custo: idx < 5 ? 450 : idx < 12 ? 280 : 120,
    leads_gerados: rand(2, 28),
    visualizacoes_geradas: rand(80, 1200),
    roi_estimado: randFloat(1.2, 8.5),
    status: 'ativo',
    score_ia: rand(60, 98),
  }));

// =============================================
// RECEITA — calculada a partir do portfólio real, separando SEMPRE
// venda de locação, porque são modelos de comissão completamente
// diferentes. E dentro de locação existem DUAS receitas distintas que
// a versão anterior desta tela esquecia de separar:
//   • Venda: comissão única de ~5% sobre o valor do imóvel, paga
//     quando a venda fecha.
//   • Locação — Intermediação: comissão única equivalente a 1 aluguel
//     (o "primeiro aluguel"), cobrada quando um NOVO contrato de
//     locação é fechado. É o equivalente, em locação, à comissão de
//     venda — um evento pontual, não recorrente.
//   • Locação — Administração: taxa recorrente de ~10% do aluguel,
//     cobrada TODO MÊS enquanto o contrato de locação já fechado
//     continuar ativo (gestão do imóvel alugado).
// Tratar locação como se só existisse a taxa recorrente (como a versão
// anterior fazia) ignorava a maior parte da receita real de uma
// imobiliária que também atua como intermediadora de aluguéis.
// =============================================
const COMISSAO_VENDA_PCT = 0.05;
const COMISSAO_INTERMEDIACAO_LOCACAO_PCT = 1.0; // 1x o valor do aluguel — "primeiro aluguel", cobrança única ao fechar o contrato
const COMISSAO_ADMINISTRACAO_LOCACAO_PCT = 0.10; // taxa de administração recorrente mensal

// Probabilidade de conversão por status do farol — usada para diferenciar
// "receita potencial" (se tudo fechasse) de "receita inferida" (estimativa
// realista, ponderada pela liquidez de cada imóvel).
// Fechar uma venda ou fechar um NOVO contrato de locação são eventos do
// mesmo tipo (uma negociação que precisa ser concluída), então usam a
// mesma curva de probabilidade por liquidez.
const PROB_FECHAMENTO: Record<FarolStatus, number> = {
  venda_iminente: 0.85,
  venda_potencial: 0.45,
  baixo_potencial: 0.12,
};
// Já a administração mensal depende de o imóvel já estar ocupado/gerido,
// não de fechar um negócio novo — por isso usa uma curva mais "estável"
// (mesmo um aluguel com preço acima do mercado tende a continuar ocupado
// por um tempo antes de rescindir, só corre mais risco de rotatividade).
const PROB_OCUPACAO_LOCACAO: Record<FarolStatus, number> = {
  venda_iminente: 0.95,
  venda_potencial: 0.75,
  baixo_potencial: 0.5,
};

// Imóveis com preço marcado como suspeito (ex: valor de venda digitado por
// engano no campo de aluguel no CRM de origem) ficam FORA dos cálculos de
// receita — incluir um "aluguel" de R$ 2,9 milhões/mês destruiria qualquer
// análise. Eles continuam visíveis no inventário com um alerta para revisão.
const imoveisVenda = mockImoveis.filter(i => i.finalidade === 'venda' && !i.preco_suspeito);
const imoveisLocacao = mockImoveis.filter(i => i.finalidade === 'aluguel' && !i.preco_suspeito);
export const imoveisComPrecoSuspeito = mockImoveis.filter(i => i.preco_suspeito);

function segmentarPorFarol(lista: Imovel[], comissaoPct: number, probMap: Record<FarolStatus, number>) {
  return (['venda_iminente', 'venda_potencial', 'baixo_potencial'] as FarolStatus[]).map(status => {
    const itens = lista.filter(i => i.status_farol === status);
    const valorTotal = itens.reduce((acc, i) => acc + i.preco_atual, 0);
    const comissaoPotencial = valorTotal * comissaoPct;
    const comissaoInferida = comissaoPotencial * probMap[status];
    return { status, count: itens.length, valorTotal, comissaoPotencial, comissaoInferida };
  });
}

export const receitaVendaPorFarol = segmentarPorFarol(imoveisVenda, COMISSAO_VENDA_PCT, PROB_FECHAMENTO);
export const receitaLocacaoIntermediacaoPorFarol = segmentarPorFarol(imoveisLocacao, COMISSAO_INTERMEDIACAO_LOCACAO_PCT, PROB_FECHAMENTO);
export const receitaLocacaoPorFarol = segmentarPorFarol(imoveisLocacao, COMISSAO_ADMINISTRACAO_LOCACAO_PCT, PROB_OCUPACAO_LOCACAO);

export const receitaResumo = {
  valorTotalPortfolioVenda: imoveisVenda.reduce((acc, i) => acc + i.preco_atual, 0),
  valorTotalAlugueisMes: imoveisLocacao.reduce((acc, i) => acc + i.preco_atual, 0),
  comissaoPotencialVenda: receitaVendaPorFarol.reduce((acc, s) => acc + s.comissaoPotencial, 0),
  comissaoInferidaVenda: receitaVendaPorFarol.reduce((acc, s) => acc + s.comissaoInferida, 0),
  // Intermediação de locação — comissão única (1º aluguel), fechamento de novo contrato
  comissaoPotencialIntermediacaoLocacao: receitaLocacaoIntermediacaoPorFarol.reduce((acc, s) => acc + s.comissaoPotencial, 0),
  comissaoInferidaIntermediacaoLocacao: receitaLocacaoIntermediacaoPorFarol.reduce((acc, s) => acc + s.comissaoInferida, 0),
  // Administração de locação — taxa recorrente mensal sobre contratos já ativos
  comissaoPotencialLocacaoMensal: receitaLocacaoPorFarol.reduce((acc, s) => acc + s.comissaoPotencial, 0),
  comissaoInferidaLocacaoMensal: receitaLocacaoPorFarol.reduce((acc, s) => acc + s.comissaoInferida, 0),
  ticketMedioVenda: imoveisVenda.length ? imoveisVenda.reduce((acc, i) => acc + i.preco_atual, 0) / imoveisVenda.length : 0,
  ticketMedioLocacao: imoveisLocacao.length ? imoveisLocacao.reduce((acc, i) => acc + i.preco_atual, 0) / imoveisLocacao.length : 0,
  qtdVenda: imoveisVenda.length,
  qtdLocacao: imoveisLocacao.length,
  comissaoVendaPct: COMISSAO_VENDA_PCT,
  comissaoIntermediacaoLocacaoPct: COMISSAO_INTERMEDIACAO_LOCACAO_PCT,
  comissaoLocacaoPct: COMISSAO_ADMINISTRACAO_LOCACAO_PCT,
};

// Receita estimada por tipo de imóvel, sempre separando venda de locação
// (misturar as duas com a mesma % de comissão estava incorreto).
function receitaPorTipo(lista: Imovel[], comissaoPct: number) {
  const grupos = lista.reduce((acc: Record<string, { count: number; total: number }>, i) => {
    if (!acc[i.tipo]) acc[i.tipo] = { count: 0, total: 0 };
    acc[i.tipo].count++;
    acc[i.tipo].total += i.preco_atual;
    return acc;
  }, {});
  return Object.entries(grupos)
    .map(([tipo, data]) => ({
      tipo,
      count: data.count,
      ticket_medio: Math.round(data.total / data.count),
      receita_estimada: Math.round(data.total * comissaoPct),
    }))
    .sort((a, b) => b.receita_estimada - a.receita_estimada);
}
export const receitaVendaPorTipo = receitaPorTipo(imoveisVenda, COMISSAO_VENDA_PCT);
export const receitaLocacaoIntermediacaoPorTipo = receitaPorTipo(imoveisLocacao, COMISSAO_INTERMEDIACAO_LOCACAO_PCT);
export const receitaLocacaoPorTipo = receitaPorTipo(imoveisLocacao, COMISSAO_ADMINISTRACAO_LOCACAO_PCT);

// Tabela combinada por tipo: intermediação (única) + administração
// (recorrente/mês) lado a lado, já que ambas vêm do mesmo grupo de imóveis
// de locação e o corretor precisa ver as duas para entender a receita real.
export const receitaLocacaoCombinadaPorTipo = receitaLocacaoIntermediacaoPorTipo.map(row => {
  const admin = receitaLocacaoPorTipo.find(r => r.tipo === row.tipo);
  return {
    tipo: row.tipo,
    count: row.count,
    ticket_medio: row.ticket_medio,
    receita_intermediacao: row.receita_estimada,
    receita_administracao_mes: admin ? admin.receita_estimada : 0,
  };
}).sort((a, b) => b.receita_intermediacao - a.receita_intermediacao);

// Mantido por compatibilidade com telas que ainda usam a série mensal
// (ex: gráfico histórico da Visão Geral). Não é usado no Dashboard de
// Receita, que agora usa os dados reais acima.
export const mockRevenueData: RevenueData[] = [
  { mes: 'Jan', receita_projetada: 1850000, receita_inferida: 1620000, imoveisVendidos: 38, ticketMedio: 426316 },
  { mes: 'Fev', receita_projetada: 1950000, receita_inferida: 1780000, imoveisVendidos: 42, ticketMedio: 423810 },
  { mes: 'Mar', receita_projetada: 2100000, receita_inferida: 2050000, imoveisVendidos: 48, ticketMedio: 427083 },
  { mes: 'Abr', receita_projetada: 2300000, receita_inferida: 1980000, imoveisVendidos: 45, ticketMedio: 440000 },
  { mes: 'Mai', receita_projetada: 2200000, receita_inferida: 2180000, imoveisVendidos: 51, ticketMedio: 427451 },
  { mes: 'Jun', receita_projetada: 2450000, receita_inferida: 2320000, imoveisVendidos: 55, ticketMedio: 421818 },
  {
    mes: 'Jul',
    receita_projetada: Math.round(receitaResumo.comissaoPotencialVenda),
    receita_inferida: Math.round(receitaResumo.comissaoInferidaVenda),
    imoveisVendidos: receitaVendaPorFarol.find(s => s.status === 'venda_iminente')?.count || 0,
    ticketMedio: Math.round(receitaResumo.ticketMedioVenda),
  },
];

// =======================