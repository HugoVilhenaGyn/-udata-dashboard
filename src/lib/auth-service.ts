import { SignJWT, jwtVerify } from 'jose';

// Em produção o JWT_SECRET DEVE vir de variável de ambiente (.env.local,
// nunca commitado). Só usamos um fallback fraco em desenvolvimento para não
// travar quem está rodando `npm run dev` sem configurar nada ainda.
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error(
    'JWT_SECRET não configurado. Defina a variável de ambiente JWT_SECRET antes de rodar em produção.'
  );
}

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'dev-only-insecure-secret-do-not-use-in-production'
);

export interface UserSession {
  id: string;
  nome: string;
  email: string;
  cargo: 'ADMIN' | 'CORRETOR' | 'MARKETING';
  imobiliariaId: string;
  imobiliariaNome: string;
}

// Criar token JWT assinado para o usuário logado
export async function signSessionToken(session: UserSession): Promise<string> {
  return new