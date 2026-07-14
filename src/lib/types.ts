// =============================================
// BrokerImobAI — TypeScript Type Definitions
// =============================================

// --- Enums ---

export type FarolStatus = 'venda_iminente' | 'venda_potencial' | 'baixo_potencial';
export type ImovelTipo = 'apartamento' | 'casa' | 'studio' | 'terreno' | 'comercial' | 'cobertura' | 'flat';
export type ImovelFinalidade = 'venda' | 'aluguel';
export type PortalSlug = 'olx' | 'zap' | 'vivareal' | 'portal62' | 'imovelweb' | 'meta' | 'google';
export type QualidadeCriterio = 'endereco' | 'preco' | 'descricao' | 'fotos' | 'video' | 'titulo' | 'area';

// --- Quality ---

export interface CriterioQualidade {
  id: QualidadeCriterio;
  label: string;
  presente: boolean;
  peso: number;
  pontos: number;
  sugestao?: string;
  valor_atual?: string;
}

// --- Property ---

export interface Imovel {
  id: string;
  id_externo: string;          // ref no CRM de origem
  titulo: string;
  tipo: ImovelTipo;
  finalidade: ImovelFinalidade;
  bairro: string;
  cidade: string;
  uf: string;
  endereco: string;
  geo?: { lat: number; lng: number };
  area_util: number;
  area_total?: number;
  quartos: number;
  suites: number;
  banheiros: number;
  vagas: number;
  preco_atual: number;
  preco_sugerido_ia?: number;
  preco_condominio?: number;
  preco_iptu?: number;
  descricao: string;
  descricao_enriquecida?: string;
  fotos: string[];
  video_url?: string;
  tour_virtual_url?: string;
  status_farol: FarolStatus;
  nota_qualidade: number;       // 0–10
  criterios_qualidade: CriterioQualidade[];
  portais_publicados: PortalSlug[];
  historico_preco: HistoricoPreco[];
  metricas: ImovelMetricas;
  regras_aplicadas: string[];
  data_cadastro: string;
  data_atualizacao: string;
  destaque_ativo: boolean;
  imobiliaria_id: string;
  // true quando o preço deste imóvel diverge fortemente (>8x ou <0.12x) da
  // mediana de imóveis comparáveis (mesma finalidade + tipo). Isso pega
  // erros reais de cadastro no CRM de origem — ex: um imóvel de aluguel
  // com o valor de venda digitado por engano no campo de aluguel. Imóveis
  // marcados aqui são excluídos dos cálculos de receita para não distorcer
  // os números, mas continuam visíveis no inventário com um alerta.
  preco_suspeito?: boolean;
  // Valor bruto do <PublicationType> do XML do CRM de origem (STANDARD,
  // PREMIUM, etc.) — é a fonte real do destaque_ativo. Guardado para
  // rastreabilidade/transparência de onde veio a classificação.
  publication_type?: string;
  // ISO timestamp de quando um humano (ou a Lisa, a pedido de um humano)
  // corrigiu manualmente os critérios de qualidade deste imóvel. Enquanto
  // esse campo estiver preenchido, os scripts de sync do Vista NÃO
  // recalculam criterios_qualidade/nota_qualidade automaticamente — só
  // atualizam os dados brutos (preço, área, etc.). Evita que um sync
  // diário reverta silenciosamente um enriquecimento manual.
  enriquecido_manualmente_em?: string;
}

export interface HistoricoPreco {
  data: string;
  preco: number;
  motivo?: string;
}

export interface ImovelMetricas {
  visualizacoes_total: number;
  leads_total: number;
  visualizacoes_semana: number;
  leads_semana: number;
  taxa_conversao: number;      // leads / visualizacoes
  dias_no_mercado: number;
  posicao_ranking?: number;
}

// --- XML ---

export type XMLFormato = 'vrsync' | 'zap_native' | 'portal62_native' | 'imovelweb_native';

export interface CargaXML {
  id: string;
  imobiliaria_id: string;
  portal: PortalSlug;
  formato: XMLFormato;
  url_origem?: string;
  conteudo_original: string;    // XML string original
  conteudo_enriquecido?: string; // XML string após enriquecimento
  imoveis_total: number;
  imoveis_processados: number;
  imoveis_com_erro: number;
  nota_qualidade_media: number;
  status: 'pendente' | 'processando' | 'concluido' | 'erro';
  erros?: XMLErro[];
  regras_aplicadas: RegraEnriquecimento[];
  data_criacao: string;
  data_processamento?: string;
}

export interface XMLErro {
  imovel_id: string;
  campo: string;
  mensagem: string;
  severidade: 'warning' | 'error';
}

// --- Enrichment Rules ---

export interface RegraEnriquecimento {
  id: string;
  nome: string;
  descricao: string;
  tipo: 'completar_campo' | 'reformatar' | 'validar' | 'gerar_descricao' | 'normalizar_endereco' | 'calcular_nota' | 'proteger_endereco';
  ativo: boolean;
  campo_alvo?: string;
  condicao?: string;           // ex: "descricao.length < 100"
  valor_padrao?: string;
  template?: string;
  impacto_nota: number;        // quanto essa regra impacta na nota de qualidade
  portais_alvo: PortalSlug[];
}

export interface EnriquecimentoResultado {
  imovel_id: string;
  campos_alterados: CampoAlterado[];
  nota_antes: number;
  nota_depois: number;
  ganho_nota: number;
  regras_aplicadas: string[];
  xml_gerado?: string;
}

export interface CampoAlterado {
  campo: string;
  valor_original?: string;
  valor_novo: string;
  regra_id: string;
  tipo_alteracao: 'completado' | 'reformatado' | 'gerado' | 'normalizado';
}

// --- Portals ---

export interface Portal {
  slug: PortalSlug;
  nome: string;
  cor: string;
  logo_url?: string;
  formato_xml: XMLFormato;
  ativo: boolean;
  destaques_disponiveis: number;
  destaques_usados: number;
  orcamento_mensal: number;
  orcamento_gasto: number;
  leads_mes: number;
  visualizacoes_mes: number;
  custo_por_lead?: number;
  api_disponivel: boolean;
  url_parceiro?: string;
  // --- Métricas reais, calculadas a partir da base de 340 imóveis (não simuladas) ---
  imoveis_publicados?: number;        // qtde real de imóveis com este portal em portais_publicados
  qualidade_media_portal?: number;    // média real de nota_qualidade dos imóveis publicados nele
  farol_favoravel_pct?: number;       // % de imóveis publicados com farol iminente/potencial
  preco_suspeito_pct?: number;        // % de imóveis publicados com preco_suspeito
  nota_portal?: number;               // 0–10, nota geral do portal calculada a partir dos itens acima
}

// --- Highlights ---

export interface Destaque {
  id: string;
  imovel_id: string;
  imovel: Pick<Imovel, 'titulo' | 'bairro' | 'preco_atual' | 'tipo' | 'status_farol' | 'nota_qualidade' | 'finalidade'>;
  portal: PortalSlug;
  tipo_destaque: 'super_destaque' | 'destaque_premium' | 'destaque';
  data_inicio: string;
  data_fim: string;
  custo: number;
  leads_gerados: number;
  visualizacoes_geradas: number;
  roi_estimado: number;        // (leads_gerados * ticket_medio) / custo
  status: 'ativo' | 'expirado' | 'agendado';
  score_ia: number;            // score de prioridade dado pela IA (0-100)
  criado_por?: string;         // nome de quem tomou a decisão (auditoria)
  criado_em?: string;          // timestamp ISO de quando foi registrado
}

// --- Revenue ---

export interface RevenueData {
  mes: string;
  receita_projetada: number;
  receita_inferida: number;
  imoveisVendidos: number;
  ticketMedio: number;
}

// --- Business Rules ---

export interface RegraDestaque {
  id: string;
  nome: string;
  descricao: string;
  condicoes: RegraCondicao[];
  acao: 'aplicar_destaque' | 'remover_destaque' | 'priorizar';
  tipo_destaque: Destaque['tipo_destaque'];
  portais: PortalSlug[];
  ativo: boolean;
  prioridade: number;
}

export interface RegraCondicao {
  campo: string;
  operador: 'eq' | 'gte' | 'lte' | 'contains' | 'in';
  valor: string | number | string[];
}

// --- Dashboard / KPI ---

export interface DashboardKPIs {
  total_imoveis: number;
  imoveis_venda_iminente: number;
  imoveis_venda_potencial: number;
  imoveis_baixo_potencial: number;
  nota_qualidade_media: number;
  leads_mes: number;
  visualizacoes_mes: number;
  receita_projetada: number;
  receita_inferida: number;
  imoveis_com_destaque: number;
  portais_ativos: number;
  xml_processados_mes: number;
}

// --- Imobiliária (Tenant) ---

export interface Imobiliaria {
  id: string;
  nome: string;
  cnpj: string;
  logo_url?: string;
  plano: 'starter' | 'growth' | 'enterprise';
  imoveis_limite: number;
  portais_limite: number;
  data_criacao: string;
  config: {
    cadencia_republicacao_horas: number;
    proteger_endereco: boolean;
    gerar_descricao_auto: boolean;
    score_minimo_destaque: number;
  };
}

// --- XML Enrichment Engine ---

export interface XMLEnrichmentConfig {
  portais: PortalSlug[];
  regras: RegraEnriquecimento[];
  gerar_descricao_llm: boolean;
  normalizar_enderecos: boolean;
  proteger_enderecos: boolean;
  minimo_fotos: number;
  minimo_chars_descricao: number;
  calcular_preco_sugerido: boolean;
}

export interface XMLProcessingJob {
  id: string;
  carga_id: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  progress: number;            // 0–100
  imoveis_processados: number;
  total_imoveis: number;
  started_at?: string;
  finished_at?: string;
  logs: string[];
}

// --- API Responses ---

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  meta?: {
    page?: number;
    per_page?: number;
    total?: number;
  };
}

export interface ImovelFiltros {
  bairro?: string;
  tipo?: ImovelTipo;
  finalidade?: ImovelFinalidade;
  status_farol?: FarolStatus;
  nota_qualidade_min?: number;
  preco_min?: number;
  preco_max?: number;
  portal?: PortalSlug;
  com_destaque?: boolean;
  search?: string;
  ordenar_por?: 'nota_qualidade' | 'preco' | 'leads' | 'data_cadastro' | 'dias_mercado';
  ordem?: 'asc' | 'desc';
  page?: number;
  per_page?: number;
}
