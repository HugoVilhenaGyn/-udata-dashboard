import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { readDb } from '@/lib/db';
import { verifySessionToken } from '@/lib/auth-service';
import { gerarLaudoPdfBuffer } from '@/lib/gerar-laudo-pdf';

// Baixa o PDF de um relatório da Lisa (com a identidade visual da Lobo
// Imóveis) de dentro do painel — protegido, só a equipe logada acessa.
// Para o link que vai direto pro proprietário sem login, ver
// /api/relatorios-publico/[id]/pdf.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get('udata_session')?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) {
    return NextResponse.json({ success: false, message: 'Não autenticado.' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const db = await readDb();
    const relatorio = db.relatoriosLisa.find(r => r.id === id);
    if (!relatorio) {
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
