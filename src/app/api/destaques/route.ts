import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { readDb, writeDb } from '@/lib/db';
import { verifySessionToken } from '@/lib/auth-service';
import { Destaque } from '@/lib/types';

// Registro persistente das decisões de destaque tomadas no painel de
// Gestão de Destaques. Isso NÃO ativa nada nos portais de verdade (essa
// ativação continua sendo manual, no Canal Pro / painel de cada portal) —
// é o histórico de "quem decidiu destacar o quê, quando e por quem",
// que antes só existia enquanto a aba ficava aberta.

export async function GET() {
  try {
    const db = await readDb();
    return NextResponse.json({ success: true, data: db.destaques });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('udata_session')?.value;
    const session = token ? await verifySessionToken(token) : null;

    const body = await req.json();
    const { imovel, portal, tipo_destaque = 'destaque', custo = 120, score_ia = 0 } = body;

    if (!imovel || !imovel.id || !portal) {
      return NextResponse.json(
        { success: false, message: 'imovel e portal são obrigatórios.' },
        { status: 400 }
      );
    }

    const novo: Destaque = {
      id: `destaque-${Date.now()}`,
      imovel_id: imovel.id,
      imovel: {
        titulo: imovel.titulo,
        bairro: imovel.bairro,
        preco_atual: imovel.preco_atual,
        tipo: imovel.tipo,
        status_farol: imovel.status_farol,
        nota_qualidade: imovel.nota_qualidade,
        finalidade: imovel.finalidade,
      },
      portal,
      tipo_destaque,
      data_inicio: new Date().toISOString().split('T')[0],
      data_fim: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
      custo,
      leads_gerados: 0,
      visualizacoes_geradas: 0,
      roi_estimado: 0,
      status: 'ativo',
      score_ia,
      criado_por: session?.nome || 'Usuário não identificado',
      criado_em: new Date().toISOString(),
    };

    const db = await readDb();
    db.destaques = [novo, ...db.destaques];
    await writeDb(db);

    return NextResponse.json({ success: true, data: novo });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
