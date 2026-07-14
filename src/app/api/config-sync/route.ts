import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { readDb, writeDb, CONFIG_SYNC_PADRAO } from '@/lib/db';
import { verifySessionToken } from '@/lib/auth-service';

// Configuração de agendamento da sincronização diária com o Vista CRM
// (feeds Loft e Zap) + histórico recente de execuções. GET devolve os dois
// juntos pra alimentar tanto a aba "Sincronização" em Configurações (edição
// dos horários) quanto o painel operacional na tela Motor de XML (só
// leitura do histórico) sem precisar de duas chamadas.

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
  const logsOrdenados = [...(db.syncLog || [])]
    .sort((a, b) => (a.executado_em < b.executado_em ? 1 : -1))
    .slice(0, 30);
  return NextResponse.json({
    success: true,
    data: { config: db.configSync || CONFIG_SYNC_PADRAO, logs: logsOrdenados },
  });
}

export async function PUT(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ success: false, message: 'Não autenticado.' }, { status: 401 });
  }
  if (session.cargo !== 'ADMIN') {
    return NextResponse.json({ success: false, message: 'Só administradores podem configurar a sincronização.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const db = await readDb();
    const atual = db.configSync || CONFIG_SYNC_PADRAO;

    const validarFeed = (feed: any, padrao: typeof atual.loft) => {
      if (!feed || typeof feed !== 'object') return padrao;
      const horarios = Array.isArray(feed.horarios)
        ? feed.horarios.filter((h: any) => typeof h === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(h))
        : padrao.horarios;
      return {
        habilitado: typeof feed.habilitado === 'boolean' ? feed.habilitado : padrao.habilitado,
        horarios: horarios.length > 0 ? horarios : padrao.horarios,
      };
    };

    db.configSync = {
      loft: validarFeed(body.loft, atual.loft),
      zap: validarFeed(body.zap, atual.zap),
    };
    await writeDb(db);
    return NextResponse.json({ success: true, data: db.configSync });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
