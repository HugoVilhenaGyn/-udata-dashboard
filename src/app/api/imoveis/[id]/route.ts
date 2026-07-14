import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { readDb, writeDb } from '@/lib/db';
import { verifySessionToken } from '@/lib/auth-service';

// Endpoint de escrita real sobre um imóvel do portfólio. Criado pra dar à
// Lisa (Orquestrador IA) ações que de fato persistem no banco — antes disso,
// "Enriquecer automaticamente" (tela de Qualidade) e qualquer ajuste de
// preço discutido no chat não gravavam nada, só existiam em memória local
// do navegador. Duas ações suportadas (mesmo padrão propor->confirmar já
// usado por destaques e leads):
//
// - atualizar_preco: muda preco_atual, registra em historico_preco.
// - enriquecer_anuncio: marca critérios de qualidade ausentes como
//   presentes (mesmo cálculo que já existia client-side na tela de
//   Qualidade) e recalcula nota_qualidade — agora persistido de verdade.

async function getSession(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get('udata_session')?.value;
  return token ? verifySessionToken(token) : null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ success: false, message: 'Não autenticado.' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const { acao } = body as { acao: 'atualizar_preco' | 'enriquecer_anuncio' };

    const db = await readDb();
    const idx = db.imoveis.findIndex(i => i.id === id);
    if (idx === -1) {
      return NextResponse.json({ success: false, message: `Imóvel "${id}" não encontrado.` }, { status: 404 });
    }
    const imovel = db.imoveis[idx];

    if (acao === 'atualizar_preco') {
      const precoNovo = Number(body.preco_novo);
      if (!precoNovo || precoNovo <= 0) {
        return NextResponse.json({ success: false, message: 'preco_novo inválido.' }, { status: 400 });
      }
      const precoAntigo = imovel.preco_atual;
      imovel.historico_preco = [
        ...(imovel.historico_preco || []),
        { data: new Date().toISOString().split('T')[0], preco: precoNovo, motivo: body.motivo || 'Ajuste sugerido pela Lisa (Orquestrador IA)' },
      ];
      imovel.preco_atual = precoNovo;
      imovel.data_atualizacao = new Date().toISOString();
      db.imoveis[idx] = imovel;
      await writeDb(db);
      return NextResponse.json({
        success: true,
        data: { id: imovel.id, preco_antigo: precoAntigo, preco_novo: precoNovo },
      });
    }

    if (acao === 'enriquecer_anuncio') {
      const criteriosAntes = imovel.criterios_qualidade.filter(c => !c.presente).map(c => c.label);
      imovel.criterios_qualidade = imovel.criterios_qualidade.map(c =>
        c.presente ? c : { ...c, presente: true, pontos: c.peso, sugestao: undefined }
      );
      const notaAntes = imovel.nota_qualidade;
      const notaDepois = parseFloat(
        imovel.criterios_qualidade.reduce((acc, c) => acc + c.pontos, 0).toFixed(1)
      );
      imovel.nota_qualidade = notaDepois;
      if (!imovel.descricao_enriquecida) {
        imovel.descricao_enriquecida = imovel.descricao;
      }
      // Marca que esse imóvel teve os critérios corrigidos manualmente —
      // protege contra o próximo sync do Vista sobrescrever isso (ver
      // comentário do campo em src/lib/types.ts e a checagem nos scripts
      // scripts/sync-vista-*.mjs).
      imovel.enriquecido_manualmente_em = new Date().toISOString();
      imovel.data_atualizacao = new Date().toISOString();
      db.imoveis[idx] = imovel;
      await writeDb(db);
      return NextResponse.json({
        success: true,
        data: {
          id: imovel.id,
          nota_antes: notaAntes,
          nota_depois: notaDepois,
          criterios_corrigidos: criteriosAntes,
        },
      });
    }

    return NextResponse.json({ success: false, message: `Ação desconhecida: ${acao}` }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
