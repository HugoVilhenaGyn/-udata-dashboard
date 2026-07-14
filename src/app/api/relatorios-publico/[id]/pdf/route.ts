import { NextRequest, NextResponse } from 'next/server';
import { readDb } from '@/lib/db';
import { gerarLaudoPdfBuffer } from '@/lib/gerar-laudo-pdf';

// Versão pública (sem login) do PDF de um relatório de estudo de mercado —
// pensada pra ser enviada direto pro WhatsApp/e-mail do proprietário, que
// não tem acesso ao painel. Só serve relatórios do tipo "precificacao"
// (estudo de mercado/avaliação) — os demais tipos (qualidade, destaques,
// geral) são análises internas do portfólio e não devem ficar públicas. O
// id do relatório é um identificador longo e aleatório (não sequencial),
// então só quem tem o link recebido da equipe consegue acessar.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = await readDb();
    const relatorio = db.relatoriosLisa.find(r => r.id === id);

    if (!relatorio || relatorio.tipo !== 'precificacao') {
      return NextResponse.json({ success: false, message: 'Relatório não encontrado.' }, { status: 404 });
    }

    const buffer = await gerarLaudoPdfBuffer(relatorio);
    const nomeArquivo = `${relatorio.titulo.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').slice(0, 80)}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${nomeArquivo}"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
