import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { readDb, writeDb, LeadAvaliacao } from '@/lib/db';
import { verifySessionToken } from '@/lib/auth-service';

// GET é protegido (só a equipe logada vê os leads capturados na landing
// pública). POST é público de propósito — é o visitante do site, sem
// login, preenchendo a calculadora de avaliação.

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('udata_session')?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    return NextResponse.json({ success: false, message: 'Não autenticado.' }, { status: 401 });
  }

  const db = await readDb();
  return NextResponse.json({ success: true, data: db.leadsAvaliacao });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      nome, telefone, email, finalidade, tipo, bairro, area_util, quartos,
      mensagem, valor_estimado, valor_min, valor_max, comparaveis_usados,
    } = body;

    if (!nome || !telefone || !finalidade || !tipo || !bairro || !area_util) {
      return NextResponse.json(
        { success: false, message: 'Preencha nome, telefone e os dados do imóvel.' },
        { status: 400 }
      );
    }

    const novo: LeadAvaliacao = {
      id: `avaliacao-${Date.now()}`,
      nome, telefone, email: email || '',
      finalidade, tipo, bairro,
      area_util: Number(area_util) || 0,
      quartos: Number(quartos) || 0,
      mensagem: mensagem || undefined,
      valor_estimado: Number(valor_estimado) || 0,
      valor_min: Number(valor_min) || 0,
      valor_max: Number(valor_max) || 0,
      comparaveis_usados: Number(comparaveis_usados) || 0,
      criado_em: new Date().toISOString(),
      status: 'novo',
    };

    const db = await readDb();
    db.leadsAvaliacao = [novo, ...db.leadsAvaliacao];
    await writeDb(db);

    return NextResponse.json({ success: true, data: novo });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// Atualiza o status de acompanhamento de um lead (novo → em_atendimento →
// atendido). Protegido — só a equipe logada mexe nisso.
export async function PATCH(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get('udata_session')?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    return NextResponse.json({ success: false, message: 'Não autenticado.' }, { status: 401 });
  }

  try {
    const { id, status } = await req.json();
    const validos = ['novo', 'em_atendimento', 'atendido'];
    if (!id || !validos.includes(status)) {
      return NextResponse.json({ success: false, message: 'id e status válido são obrigatórios.' }, { status: 400 });
    }

    const db = await readDb();
    const idx = db.leadsAvaliacao.findIndex(l => l.id === id);
    if (idx === -1) {
      return NextResponse.json({ success: false, message: 'Lead não encontrado.' }, { status: 404 });
    }

    db.leadsAvaliacao[idx] = { ...db.leadsAvaliacao[idx], status };
    await writeDb(db);

    return NextResponse.json({ success: true, data: db.leadsAvaliacao[idx] });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
