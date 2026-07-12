import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { readDb, writeDb, CONFIG_AVALIACAO_PADRAO } from '@/lib/db';
import { verifySessionToken } from '@/lib/auth-service';

// GET é público — a própria landing /avaliacao consulta isso pra saber se
// deve mostrar o formulário ou a mensagem de indisponibilidade, e pra
// pegar telefone/textos configurados. PUT é protegido (só a equipe loga
// e ajusta).

export async function GET() {
  const db = readDb();
  return NextResponse.json({ success: true, data: db.configAvaliacao || CONFIG_AVALIACAO_PADRAO });
}

export async function PUT(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get('udata_session')?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    return NextResponse.json({ success: false, message: 'Não autenticado.' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const db = readDb();
    db.configAvaliacao = {
      ativo: typeof body.ativo === 'boolean' ? body.ativo : db.configAvaliacao.ativo,
      telefoneContato: body.telefoneContato ?? db.configAvaliacao.telefoneContato,
      tituloHero: body.tituloHero ?? db.configAvaliacao.tituloHero,
      mensagemHero: body.mensagemHero ?? db.configAvaliacao.mensagemHero,
      mensagemIndisponivel: body.mensagemIndisponivel ?? db.configAvaliacao.mensagemIndisponivel,
    };
    writeDb(db);
    return NextResponse.json({ success: true, data: db.configAvaliacao });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
