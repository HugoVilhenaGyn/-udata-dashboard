import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { readDb, writeDb, LeadAvaliacao } from '@/lib/db';
import { verifySessionToken } from '@/lib/auth-service';
import { processarMensagemLisa } from '@/app/api/copiloto/route';

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
      estudo_mercado_status: 'gerando',
    };

    const db = await readDb();
    db.leadsAvaliacao = [novo, ...db.leadsAvaliacao];
    await writeDb(db);

    // Dispara o estudo de mercado da Lisa em background, sem bloquear a
    // resposta ao visitante (ele não precisa esperar o Gemini rodar pra ver
    // a confirmação de que o pedido foi recebido). O corretor vê o
    // resultado aparecer sozinho em /avaliacao-admin quando terminar.
    gerarEstudoMercadoAutomatico(novo).catch(() => {});

    return NextResponse.json({ success: true, data: novo });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// Roda a mesma pergunta que o botão manual "Pedir à Lisa" fazia antes, só
// que automaticamente assim que o lead chega — pega os dados que o próprio
// visitante preencheu na calculadora (bairro, tipo, área, finalidade) e usa
// a ferramenta comparaveis_portfolio_por_segmento (comparáveis reais do
// portfólio) pra montar uma faixa de valor de referência antes mesmo do
// corretor abrir a tela. Esse é o estudo de mercado da Calculadora Online
// — usa dados reais do portfólio próprio e, se houver, pesquisas de
// mercado externas cadastradas pela equipe.
async function gerarEstudoMercadoAutomatico(lead: LeadAvaliacao) {
  const finalidadeTxt = lead.finalidade === 'venda' ? 'venda' : 'locação';
  const mensagemLisa = `Gere um relatório de estudo de mercado para embasar o atendimento do lead "${lead.nome}", que pediu uma avaliação de ${finalidadeTxt} de um imóvel do tipo "${lead.tipo}" no bairro "${lead.bairro}", com aproximadamente ${lead.area_util}m²${lead.quartos ? ` e ${lead.quartos} quartos` : ''}. Use comparaveis_portfolio_por_segmento e comparáveis reais do portfólio nesse bairro/tipo/finalidade pra justificar uma faixa de valor de referência, cite a oferta e demanda reais (quantos comparáveis, leads e visualizações da semana nesse segmento) e feche com uma recomendação prática de precificação pro corretor levar pra conversa com esse cliente. O título do relatório precisa começar exatamente com "Estudo de Mercado — Lead".`;

  let status: 'pronto' | 'erro' = 'erro';
  let relatorioId: string | undefined;

  try {
    const resultado = await processarMensagemLisa({
      mensagem: mensagemLisa,
      contextoTela: { secao: 'Calculadora Online (automático)', detalhe: `Lead: ${lead.nome} — ${finalidadeTxt} de ${lead.tipo} em ${lead.bairro}` },
      autor: 'Lisa (automático ao receber lead)',
    });

    if (resultado.success && resultado.data.relatorio?.id) {
      status = 'pronto';
      relatorioId = resultado.data.relatorio.id;
    }
  } catch {
    status = 'erro';
  }

  try {
    const db = await readDb();
    const idx = db.leadsAvaliacao.findIndex(l => l.id === lead.id);
    if (idx !== -1) {
      db.leadsAvaliacao[idx] = {
        ...db.leadsAvaliacao[idx],
        estudo_mercado_status: status,
        estudo_mercado_relatorio_id: relatorioId,
      };
      await writeDb(db);
    }
  } catch {
    // Se nem isso der certo, o lead fica marcado 'gerando' pra sempre —
    // aceitável nesse cenário raro; o corretor pode acionar manualmente.
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
