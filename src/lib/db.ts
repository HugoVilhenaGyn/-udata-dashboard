import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { mockImoveis, mockPortais, mockDestaques, mockRevenueData } from './mock-data';

const DB_DIR = path.join(process.cwd(), 'src', 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

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

export interface DbSchema {
  users: User[];
  imoveis: typeof mockImoveis;
  portais: typeof mockPortais;
  destaques: typeof mockDestaques;
  revenue: typeof mockRevenueData;
  leadsAvaliacao: LeadAvaliacao[];
  configAvaliacao: ConfigAvaliacao;
}

// Inicializar e garantir que o banco existe
export function initDb() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    // Criar senhas iniciais usando bcryptjs
    const salt = bcrypt.genSaltSync(10);
    
    const users: User[] = [
      {
        id: 'usr-hugo',
        nome: 'Hugo Vilhena',
        email: 'hugo.f.vilhena@gmail.com',
        senhaHash: bcrypt.hashSync('Lobo@2026', salt),
        cargo: 'ADMIN',
        imobiliariaId: 'imob-001',
        imobiliariaNome: 'LOBO IMOVEIS',
      },
      {
        id: 'usr-comercial',
        nome: 'Equipe Comercial',
        email: 'atendimento@loboimoveis.imb.br',
        senhaHash: bcrypt.hashSync('Lobo@2026', salt),
        cargo: 'CORRETOR',
        imobiliariaId: 'imob-001',
        imobiliariaNome: 'LOBO IMOVEIS',
      },
      {
        id: 'usr-marketing',
        nome: 'Equipe Marketing',
        email: 'marketing@loboimoveis.imb.br',
        senhaHash: bcrypt.hashSync('Lobo@2026', salt),
        cargo: 'MARKETING',
        imobiliariaId: 'imob-001',
        imobiliariaNome: 'LOBO IMOVEIS',
      },
    ];

    const initialDb: DbSchema = {
      users,
      imoveis: mockImoveis,
      portais: mockPortais,
      destaques: mockDestaques,
      revenue: mockRevenueData,
      leadsAvaliacao: [],
      configAvaliacao: CONFIG_AVALIACAO_PADRAO,
    };

    fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2), 'utf-8');
  }
}

// Ler banco de dados
export function readDb(): DbSchema {
  initDb();
  const raw = fs.readFileSync(DB_FILE, 'utf-8');
  const data = JSON.parse(raw);
  // Backfill pra bancos criados antes desses campos existirem.
  if (!Array.isArray(data.leadsAvaliacao)) data.leadsAvaliacao = [];
  if (!data.configAvaliacao) data.configAvaliacao = CONFIG_AVALIACAO_PADRAO;
  return data;
}

// Salvar no banco
export function writeDb(data: DbSchema) {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
}
