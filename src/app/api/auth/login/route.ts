import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { readDb } from '@/lib/db';
import { signSessionToken } from '@/lib/auth-service';
import { checarLimite, registrarFalha, limparTentativas } from '@/lib/rate-limiter';

// Pega o IP real do visitante por trás do proxy Nginx do VPS — sem isso,
// req não tem um endereço confiável (o Nginx faz proxy_pass e o Node só
// veria o IP interno do proxy, igual pra todo mundo).
function ipDoVisitante(req: Request): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'ip-desconhecido';
}

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, message: 'Email e senha são obrigatórios.' },
        { status: 400 }
      );
    }

    const ip = ipDoVisitante(req);
    const emailNormalizado = String(email).toLowerCase().trim();

    // Duas chaves de bloqueio: por IP (freia um script tentando várias
    // senhas contra qualquer conta a partir da mesma origem) e por email
    // (freia um ataque distribuído por vários IPs mirando uma conta só).
    // Basta uma das duas estar bloqueada pra recusar a tentativa.
    const limiteIp = checarLimite(`ip:${ip}`);
    const limiteEmail = checarLimite(`email:${emailNormalizado}`);

    if (limiteIp.bloqueado || limiteEmail.bloqueado) {
      const retryAfter = Math.max(limiteIp.retryAfterSegundos || 0, limiteEmail.retryAfterSegundos || 0);
      const minutos = Math.ceil(retryAfter / 60);
      return NextResponse.json(
        {
          success: false,
          message: `Muitas tentativas de login sem sucesso. Tente novamente em ${minutos} minuto${minutos > 1 ? 's' : ''}.`,
        },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }

    const db = await readDb();
    const user = db.users.find(u => u.email.toLowerCase() === emailNormalizado);

    if (!user) {
      registrarFalha(`ip:${ip}`);
      registrarFalha(`email:${emailNormalizado}`);
      return NextResponse.json(
        { success: false, message: 'Credenciais inválidas. Verifique os dados inseridos.' },
        { status: 401 }
      );
    }

    const isMatch = bcrypt.compareSync(password, user.senhaHash);
    if (!isMatch) {
      registrarFalha(`ip:${ip}`);
      registrarFalha(`email:${emailNormalizado}`);
      return NextResponse.json(
        { success: false, message: 'Credenciais inválidas. Verifique os dados inseridos.' },
        { status: 401 }
      );
    }

    if (user.ativo === false) {
      return NextResponse.json(
        { success: false, message: 'Este usuário está desativado. Fale com um administrador.' },
        { status: 403 }
      );
    }

    // Login certo: zera o contador de falhas dessa origem e desse email,
    // pra não penalizar quem só errou a senha algumas vezes antes de acertar.
    limparTentativas(`ip:${ip}`);
    limparTentativas(`email:${emailNormalizado}`);

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
