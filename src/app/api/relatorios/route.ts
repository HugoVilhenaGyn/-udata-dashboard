import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { readDb } from '@/lib/db';
import { verifySessionToken } from '@/lib/auth-service';

// Relatórios gerados pela Lisa (ferramenta gerar_relatorio, chamada dentro
// de /api/copiloto). Essa rota é só leitura — a escrita acontece no próprio
// endpoint do copiloto, direto no servidor, no momento em que o modelo
// decide gerar o relatório.

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get('udata_session')?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    return NextResponse.json({ success: false, message: 'Não autenticado.' }, { status: 401 });
  }

  const db = await readDb();
  const ordenados = [...db.relatoriosLisa].sort(
    (a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime()
  );
  return NextResponse.json({ success: true, data: ordenados });
}
