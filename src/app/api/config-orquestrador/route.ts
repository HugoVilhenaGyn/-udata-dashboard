import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { readDb, writeDb, CONFIG_ORQUESTRADOR_PADRAO } from '@/lib/db';
import { verifySessionToken } from '@/lib/auth-service';

// GET e PUT são protegidos — são as instruções internas de treinamento da
// Lisa, não fazem sentido fora do painel logado.

async function getSession(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get('udata_session')?.value;
  return token ? verifySessionToken(token) : null;
}

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ success: false, message: 'Não autenticado.' }, { status: 401 });
  }
  const db = await readDb();
  return NextResponse.json({ success: true, data: db.configOrquestrador || CONFIG_ORQUESTRADOR_PADRAO });
}

export async function PUT(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ success: false, message: 'Não autenticado.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const db = await readDb();
    db.configOrquestrador = {
      ...db.configOrquestrador,
      instrucoes: typeof body.instrucoes === 'string' ? body.instrucoes.slice(0, 8000) : db.configOrquestrador.instrucoes,
      atualizado_em: new Date().toISOString(),
      atualizado_por: session.nome || session.email,
    };
    await writeDb(db);
    return NextResponse.json({ success: true, data: db.configOrquestrador });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
