import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { readDb } from '@/lib/db';
import { signSessionToken } from '@/lib/auth-service';

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: 'Email e senha são obrigatórios.' },
        { status: 400 }
      );
    }

    const db = readDb();
    const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Credenciais inválidas. Verifique os dados inseridos.' },
        { status: 401 }
      );
    }

    const isMatch = bcrypt.compareSync(password, user.senhaHash);
    if (!isMatch) {
      return NextResponse.json(
        { success: false, message: 'Credenciais inválidas. Verifique os dados inseridos.' },
        { status: 401 }
      );
    }

    // Criar token JWT de sessão
    const sessionToken = await signSessionToken({
      id: user.id,
      nome: user.nome,
      email: user.email,
      cargo: user.cargo,
      imobiliariaId: user.imobiliariaId,
      imobiliariaNome: user.imobiliariaNome,
    });

    const response = NextResponse.json({
      success: true,
      message: 'Autenticado com sucesso!',
      user: {
        nome: user.nome,
        email: user.email,
        cargo: user.cargo,
        imobiliariaNome: user.imobiliariaNome,
      },
    });

    // Definir cookie seguro httpOnly com duração de 24h
    response.cookies.set('udata_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 24 horas
      path: '/',
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: `Erro no servidor: ${error.message}` },
      { status: 500 }
    );
  }
}
