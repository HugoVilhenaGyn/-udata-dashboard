import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { readDb, writeDb, User } from '@/lib/db';
import { verifySessionToken } from '@/lib/auth-service';

// Painel de Usuários (Configurações > Usuários) — CRUD de acesso à
// plataforma. Só ADMIN pode ver/gerenciar. Nunca devolve senhaHash nas
// respostas.

async function getSession(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get('udata_session')?.value;
  return token ? verifySessionToken(token) : null;
}

function semSenha(u: User) {
  const { senhaHash, ...resto } = u;
  return resto;
}

const CARGOS_VALIDOS = ['ADMIN', 'CORRETOR', 'MARKETING'];

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ success: false, message: 'Não autenticado.' }, { status: 401 });
  }
  if (session.cargo !== 'ADMIN') {
    return NextResponse.json({ success: false, message: 'Só administradores podem gerenciar usuários.' }, { status: 403 });
  }

  const db = await readDb();
  const usuarios = (db.users || []).map(semSenha);
  return NextResponse.json({ success: true, data: usuarios });
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ success: false, message: 'Não autenticado.' }, { status: 401 });
  }
  if (session.cargo !== 'ADMIN') {
    return NextResponse.json({ success: false, message: 'Só administradores podem criar usuários.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const nome = String(body.nome || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const senha = String(body.senha || '');
    const cargo = String(body.cargo || '');

    if (!nome || !email || !senha) {
      return NextResponse.json({ success: false, message: 'Nome, email e senha são obrigatórios.' }, { status: 400 });
    }
    if (!CARGOS_VALIDOS.includes(cargo)) {
      return NextResponse.json({ success: false, message: 'Cargo inválido.' }, { status: 400 });
    }
    if (senha.length < 8) {
      return NextResponse.json({ success: false, message: 'A senha precisa ter pelo menos 8 caracteres.' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ success: false, message: 'Email inválido.' }, { status: 400 });
    }

    const db = await readDb();
    if (db.users.some(u => u.email.toLowerCase() === email)) {
      return NextResponse.json({ success: false, message: 'Já existe um usuário com esse email.' }, { status: 409 });
    }

    const senhaHash = bcrypt.hashSync(senha, bcrypt.genSaltSync(10));
    const novoUsuario: User = {
      id: `usr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      nome,
      email,
      senhaHash,
      cargo: cargo as User['cargo'],
      imobiliariaId: session.imobiliariaId,
      imobiliariaNome: session.imobiliariaNome,
      ativo: true,
      criado_em: new Date().toISOString(),
    };

    db.users.push(novoUsuario);
    await writeDb(db);

    return NextResponse.json({ success: true, data: semSenha(novoUsuario) }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
