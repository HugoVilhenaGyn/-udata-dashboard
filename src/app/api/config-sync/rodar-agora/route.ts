import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { spawn } from 'child_process';
import path from 'path';
import { readDb } from '@/lib/db';
import { verifySessionToken } from '@/lib/auth-service';

// Dispara manualmente uma sincronização com o Vista CRM (botão "Rodar
// agora" na tela Motor de XML) — o mesmo script que o agendador
// (scripts/sync-scheduler.mjs) chama nos horários configurados, só que
// aqui com disparado_por = 'manual'. O script roda como processo filho e
// grava o próprio SyncLogEntry no Postgres (scripts/lib/pg-db.mjs); esta
// rota só espera ele terminar e devolve a entrada mais recente do
// histórico pra UI atualizar sem precisar de um segundo fetch.

async function getSession(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get('udata_session')?.value;
  return token ? verifySessionToken(token) : null;
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ success: false, message: 'Não autenticado.' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const feed = body.feed as 'loft' | 'zap';
    if (feed !== 'loft' && feed !== 'zap') {
      return NextResponse.json({ success: false, message: 'feed inválido — use "loft" ou "zap".' }, { status: 400 });
    }

    // Caminhos literais (não uma tabela indexada por variável) de propósito —
    // o tracer de build do Next.js (usado pra saber quais arquivos incluir no
    // deploy standalone) só resolve chamadas de child_process com um caminho
    // estático; uma expressão dinâmica tipo SCRIPTS[feed] falha o build com
    // "Module not found" mesmo sem nunca ser importada como módulo.
    const scriptPath = feed === 'loft'
      ? path.join(process.cwd(), 'scripts', 'sync-vista-full-feed.mjs')
      : path.join(process.cwd(), 'scripts', 'sync-vista-zap-feed.mjs');
    const resultado = await new Promise<{ codigo: number | null; saida: string }>((resolve) => {
      const filho = spawn('node', [scriptPath], {
        env: { ...process.env, SYNC_TRIGGER: 'manual' },
        timeout: 120_000,
      });
      let saida = '';
      filho.stdout.on('data', d => { saida += d.toString(); });
      filho.stderr.on('data', d => { saida += d.toString(); });
      filho.on('close', codigo => resolve({ codigo, saida }));
      filho.on('error', err => resolve({ codigo: -1, saida: String(err) }));
    });

    // O script grava seu próprio SyncLogEntry no Postgres — só relemos o
    // mais recente pra devolver na resposta.
    const db = await readDb();
    const ultimaEntrada = [...(db.syncLog || [])]
      .filter(l => l.feed === feed)
      .sort((a, b) => (a.executado_em < b.executado_em ? 1 : -1))[0] || null;

    return NextResponse.json({
      success: resultado.codigo === 0,
      data: { entrada: ultimaEntrada, saida_processo: resultado.saida.slice(-4000) },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
