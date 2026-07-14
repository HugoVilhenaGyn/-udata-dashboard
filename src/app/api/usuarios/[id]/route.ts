import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { readDb, writeDb, User } from '@/lib/db';
import { verifySessionToken } from '@/lib/auth-service';

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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ success: false, message: 'Não autenticado.' }, { status: 401 });
  }
  if (session.cargo !== 'ADMIN') {
    return NextResponse.json({ success: false, message: 'Só administradores podem editar usuários.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const db = await readDb();
    const usuario = db.users.find(u => u.id === id);
    if (!usuario) {
      return NextResponse.json({ success: false, message: 'Usuário não encontrado.' }, { status: 404 });
    }

    // Trava de segurança: não deixa desativar o próprio usuário logado nem
    // remover o cargo ADMIN do último admin — pra ninguém se trancar fora
    // do painel sem querer.
    const totalAdminsAtivos = db.users.filter(u => u.cargo === 'ADMIN' && u.ativo && u.id !== usuario.id).length;

    if (body.nome !== undefined) {
      const nome = String(body.nome).trim();
      if (!nome) return NextResponse.json({ success: false, message: 'Nome não pode ficar vazio.' }, { status: 400 });
      usuario.nome = nome;
    }

    if (body.cargo !== undefined) {
      if (!CARGOS_VALIDOS.includes(body.cargo)) {
        return NextResponse.json({ success: false, message: 'Cargo inválido.' }, { status: 400 });
      }
      if (usuario.cargo === 'ADMIN' && body.cargo !== 'ADMIN' && totalAdminsAtivos === 0) {
        return NextResponse.json({ success: false, message: 'Não é possível remover o último administrador ativo.' }, { status: 400 });
      }
      usuario.cargo = body.cargo;
    }

    if (body.ativo !== undefined) {
      const novoAtivo = Boolean(body.ativo);
      if (!novoAtivo) {
        if (usuario.id === session.id) {
          return NextResponse.json({ success: false, message: 'Você não pode desativar o próprio usuário.' }, { status: 400 });
        }
        if (usuario.cargo === 'ADMIN' && totalAdminsAtivos === 0) {
          return NextResponse.json({ success: false, message: 'Não é possível desativar o último administrador ativo.' }, { status: 400 });
        }
      }
      usuario.ativo = novoAtivo;
    }

    if (body.senha !== undefined) {
      const senha = String(body.senha);
      if (senha.length < 8) {
        return NextResponse.json({ success: false, message: 'A senha precisa ter pelo menos 8 caracteres.' }, { status: 400 });
      }
      usuario.senhaHash = bcrypt.hashSync(senha, bcrypt.genSaltSync(10));
    }

    await writeDb(db);
    return NextResponse.json({ success: true, data: semSenha(usuario) });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ success: false, message: 'Não autenticado.' }, { status: 401 });
  }
  if (session.cargo !== 'ADMIN') {
    return NextResponse.json({ success: false, message: 'Só administradores podem excluir usuários.' }, { status: 403 });
  }
  if (id === session.id) {
    return NextResponse.json({ success: false, message: 'Você não pode excluir o próprio usuário.' }, { status: 400 });
  }

  const db = await readDb();
  const usuario = db.users.find(u => u.id === id);
  if (!usuario) {
    return NextResponse.json({ success: false, message: 'Usuário não encontrado.' }, { status: 404 });
  }
  const totalAdminsRestantes = db.users.filter(u => u.cargo === 'ADMIN' && u.ativo && u.id !== id).length;
  if (usuario.cargo === 'ADMIN' && usuario.ativo && totalAdminsRestantes === 0) {
    return NextResponse.json({ success: false, message: 'Não é possível excluir o último administrador ativo.' }, { status: 400 });
  }

  db.users = db.users.filter(u => u.id !== id);
  await writeDb(db);
  return NextResponse.json({ success: true });
}
