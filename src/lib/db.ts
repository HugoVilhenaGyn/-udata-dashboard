import bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import { mockImoveis, mockPortais, mockDestaques, mockRevenueData } from './mock-data';

// =============================================
// BACKEND — Postgres (Supabase) via pool `pg`
// =============================================
// Antes disso o "banco" era um arquivo db.json no disco (só funciona rodando
// direto num servidor com disco persistente — quebra em serverless e não é
// um backend de verdade). Agora o estado inteiro da aplicação vive numa
// única linha JSONB (tabela app_state) no Postgres. Isso preserva a MESMA
// forma de uso (readDb()/writeDb()) que todas as rotas de API já usavam,
// só que agora assíncrona e apontando pra um banco real — sem precisar
// reescrever 15+ entidades em tabelas relacionais numa migração só.
// Ver DEPLOY.md pra como provisionar o Postgres (Supabase) e configurar
// DATABASE_URL.

let pool: Pool | null = null;

function getPool(): Pool {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL não configurada. Defina no .env.local (dev) ou nas variáveis de ambiente do servidor (produção) — ver DEPLOY.md.'
    );
  }

  pool = new Pool({
    connectionString,
    // Supabase (e a maioria dos Postgres gerenciados) exige TLS, mas com
    // certificado que o driver `pg` não valida por padrão nesse cenário de
    // conexão direta. `rejectUnauthorized: false` é o ajuste padrão
    // recomendado pelo próprio Supabase pra conexão via node-postgres.
    ssl: process.env.DATABASE_SSL === 'false' ? undefined : { rejectUnauthorized: false },
    max: 5,
  });

  return pool;
}

export interface User {
  id: string;
  nome: string;
  email: string;
  senhaHash: string;
  cargo: 'ADMIN' | 'CORRETOR' | 'MARKETING';
  imobiliariaId: string;
  imobiliariaNome: string;
}

export interface LeadAvaliacao {
  id: string;
  nome: string;
  telefone: string;
  email: string;
  finalidade: 'venda' | 'aluguel';
  tipo: string;
  bairro: string;
  area_util: number;
  quartos: number;
  mensagem?: string;
  valor_estimado: number;
  valor_min: number;
  valor_max: number;
  comparaveis_usados: number;
  criado_em: string;
  status: 'novo' | 'em_atendimento' | 'atendido';
  // Estudo de mercado automático gerado pela Lisa assim que o lead chega
  // pela calculadora pública (ver POST /api/leads-avaliacao) — dispara em
  // background, sem bloquear a resposta ao visitante. 'erro' também cobre
  // leads antigos que nunca tiveram o campo populado.
  estudo_mercado_status?: 'gerando' | 'pronto' | 'erro';
  estudo_mercado_relatorio_id?: string;
}

export interface ConfigAvaliacao {
  ativo: boolean;
  telefoneContato: string;
  tituloHero: string;
  mensagemHero: string;
  mensagemIndisponivel: string;
}

export const CONFIG_AVALIACAO_PADRAO: ConfigAvaliacao = {
  ativo: true,
  telefoneContato: '62 3018.2500',
  tituloHero: 'Quanto vale o seu imóvel?',
  mensagemHero: 'Avaliação gratuita baseada em imóveis reais do nosso portfólio na sua região — preencha seus dados e o do imóvel para ver o resultado do estudo de mercado.',
  mensagemIndisponivel: 'A avaliação online está temporariamente indisponível. Fale direto com a gente pelo telefone abaixo.',
};

// Documento de pesquisa de mercado (RAG) enviado pela equipe — ex: prints/
// exports de anúncios do Portal 62 e do Zap, pra Lisa cruzar com o
// portfólio real na hora de montar um estudo de mercado. O texto extraído
// do arquivo fica salvo aqui e é injetado (truncado) no prompt da Lisa.
export interface DocumentoRag {
  id: string;
  nome: string;
  fonte: 'portal62' | 'zap' | 'outro';
  conteudo: string;
  tamanho: number;
  enviado_em: string;
  enviado_por?: string;
}

// Instruções permanentes de treinamento da Lisa (Orquestrador IA) — texto
// livre escrito pela equipe, injetado no system prompt em toda chamada ao
// Gemini. Permite ajustar tom, regras de negócio e prioridades sem mexer
// em código.
export interface ConfigOrquestrador {
  instrucoes: string;
  documentos: DocumentoRag[];
  atualizado_em?: string;
  atualizado_por?: string;
}

export const CONFIG_ORQUESTRADOR_PADRAO: ConfigOrquestrador = {
  instrucoes: '',
  documentos: [],
};

// Agendamento da sincronização diária com o Vista CRM (extração dos feeds
// XML Loft e Zap). Cada "feed" tem seu próprio liga/desliga e lista de
// horários (formato "HH:MM", 24h, horário de Brasília) — em geral faz
// sentido rodar de madrugada e reforçar à tarde, mas isso fica configurável
// aqui em vez de fixo no código. O processo scripts/sync-scheduler.mjs (um
// 4º processo PM2, separado do Next.js) lê isso e dispara os scripts
// scripts/sync-vista-*.mjs nos horários configurados.
export interface ConfigSyncFeed {
  habilitado: boolean;
  horarios: string[];
}

export interface ConfigSync {
  loft: ConfigSyncFeed;
  zap: ConfigSyncFeed;
}

export const CONFIG_SYNC_PADRAO: ConfigSync = {
  loft: { habilitado: false, horarios: ['06:00', '18:00'] },
  zap: { habilitado: false, horarios: ['07:00'] },
};

// Histórico de execuções da sincronização (agendada ou disparada
// manualmente pelo botão "Rodar agora" na tela Motor de XML). Substitui o
// antigo sync-vista-log.json (um arquivo local, sobrescrito a cada rodada e
// perdido em ambiente sem disco persistente) por um histórico real que
// sobrevive entre execuções e entre os dois scripts (Loft/Zap não se
// sobrescrevem mais um ao outro).
export interface SyncLogEntry {
  id: string;
  feed: 'loft' | 'zap';
  disparado_por: 'agendado' | 'manual';
  executado_em: string;
  status: 'sucesso' | 'erro';
  duracao_ms?: number;
  total_no_feed?: number;
  total_alterados?: number;
  novos_no_feed?: number;
  removidos_do_feed?: number;
  erro_mensagem?: string;
}

// Relatório estruturado que a Lisa gera sob demanda (ferramenta
// "gerar_relatorio") — fica salvo pra revisão posterior, não é só uma
// mensagem de chat que some quando a conversa rola. Cada seção pode ter
// texto e/ou uma tabela simples (colunas + linhas, tudo como texto).
export interface RelatorioSecao {
  titulo: string;
  texto?: string;
  colunas?: string[];
  linhas?: string[][];
}

export interface RelatorioLisa {
  id: string;
  titulo: string;
  tipo: 'qualidade' | 'precificacao' | 'oportunidade' | 'destaques' | 'geral';
  resumo: string;
  secoes: RelatorioSecao[];
  pergunta_origem: string;
  criado_em: string;
  criado_por?: string;
}

export interface DbSchema {
  users: User[];
  imoveis: typeof mockImoveis;
  portais: typeof mockPortais;
  destaques: typeof mockDestaques;
  revenue: typeof mockRevenueData;
  leadsAvaliacao: LeadAvaliacao[];
  configAvaliacao: ConfigAvaliacao;
  configOrquestrador: ConfigOrquestrador;
  relatoriosLisa: RelatorioLisa[];
  configSync: ConfigSync;
  syncLog: SyncLogEntry[];
}

const APP_STATE_ROW_ID = 1;

function buildSenhaPadrao(): string {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync('Lobo@2026', salt);
}

function buildInitialDb(): DbSchema {
  const senhaHash = buildSenhaPadrao();
  const users: User[] = [
    {
      id: 'usr-hugo',
      nome: 'Hugo Vilhena',
      email: 'hugo.f.vilhena@gmail.com',
      senhaHash,
      cargo: 'ADMIN',
      imobiliariaId: 'imob-001',
      imobiliariaNome: 'LOBO IMOVEIS',
    },
    {
      id: 'usr-comercial',
      nome: 'Equipe Comercial',
      email: 'atendimento@loboimoveis.imb.br',
      senhaHash,
      cargo: 'CORRETOR',
      imobiliariaId: 'imob-001',
      imobiliariaNome: 'LOBO IMOVEIS',
    },
    {
      id: 'usr-marketing',
      nome: 'Equipe Marketing',
      email: 'marketing@loboimoveis.imb.br',
      senhaHash,
      cargo: 'MARKETING',
      imobiliariaId: 'imob-001',
      imobiliariaNome: 'LOBO IMOVEIS',
    },
  ];

  return {
    users,
    imoveis: mockImoveis,
    portais: mockPortais,
    destaques: mockDestaques,
    revenue: mockRevenueData,
    leadsAvaliacao: [],
    configAvaliacao: CONFIG_AVALIACAO_PADRAO,
    configOrquestrador: CONFIG_ORQUESTRADOR_PADRAO,
    relatoriosLisa: [],
    configSync: CONFIG_SYNC_PADRAO,
    syncLog: [],
  };
}

function aplicarBackfill(data: DbSchema): DbSchema {
  // Backfill pra bancos criados antes desses campos existirem — mantém
  // compatibilidade com o mesmo comportamento que o db.json tinha.
  if (!Array.isArray(data.leadsAvaliacao)) data.leadsAvaliacao = [];
  if (!data.configAvaliacao) data.configAvaliacao = CONFIG_AVALIACAO_PADRAO;
  if (!data.configOrquestrador) data.configOrquestrador = CONFIG_ORQUESTRADOR_PADRAO;
  if (!Array.isArray(data.configOrquestrador.documentos)) data.configOrquestrador.documentos = [];
  if (!Array.isArray(data.relatoriosLisa)) data.relatoriosLisa = [];
  if (!data.configSync) data.configSync = CONFIG_SYNC_PADRAO;
  if (!data.configSync.loft) data.configSync.loft = CONFIG_SYNC_PADRAO.loft;
  if (!data.configSync.zap) data.configSync.zap = CONFIG_SYNC_PADRAO.zap;
  if (!Array.isArray(data.syncLog)) data.syncLog = [];
  return data;
}

let schemaGarantido = false;

async function garantirSchema(): Promise<void> {
  if (schemaGarantido) return;
  const db = getPool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      id SMALLINT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  schemaGarantido = true;
}

// Inicializar e garantir que a linha de estado existe (equivalente ao antigo
// initDb() que criava o arquivo db.json na primeira execução).
export async function initDb(): Promise<void> {
  await garantirSchema();
  const db = getPool();
  const existing = await db.query('SELECT 1 FROM app_state WHERE id = $1', [APP_STATE_ROW_ID]);
  if (existing.rowCount === 0) {
    const initialDb = buildInitialDb();
    await db.query('INSERT INTO app_state (id, data) VALUES ($1, $2)', [
      APP_STATE_ROW_ID,
      JSON.stringify(initialDb),
    ]);
  }
}

// Ler estado da aplicação
export async function readDb(): Promise<DbSchema> {
  await initDb();
  const db = getPool();
  const result = await db.query('SELECT data FROM app_state WHERE id = $1', [APP_STATE_ROW_ID]);
  const data = result.rows[0]?.data as DbSchema;
  return aplicarBackfill(data);
}

// Salvar estado da aplicação
export async function writeDb(data: DbSchema): Promise<void> {
  await garantirSchema();
  const db = getPool();
  await db.query(
    `INSERT INTO app_state (id, data, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
    [APP_STATE_ROW_ID, JSON.stringify(data)]
  );
}
