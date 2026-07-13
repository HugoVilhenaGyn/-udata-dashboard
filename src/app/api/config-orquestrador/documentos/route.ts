import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { readDb, writeDb, DocumentoRag } from '@/lib/db';
import { verifySessionToken } from '@/lib/auth-service';

// Documentos de pesquisa de mercado (Portal 62, Zap, DataZap etc.) que a
// equipe sobe pra Lisa usar como referência ao montar um estudo de mercado.
// Dois formatos de entrada aceitos:
// - texto puro (.txt/.csv/.md): o navegador já manda o texto extraído
//   (FileReader.readAsText), a gente só valida e corta um teto de tamanho.
// - PDF: o navegador manda o arquivo em base64 (FileReader.readAsDataURL),
//   e aqui no servidor extraímos o texto com pdf-parse antes de salvar —
//   sem essa extração, um PDF vira lixo binário no prompt da Lisa.
const CONTEUDO_MAX = 30000; // chars por documento — teto pra não estourar o prompt da Lisa
const TOTAL_DOCUMENTOS_MAX = 30;
const PDF_MAX_BYTES = 25 * 1024 * 1024; // 25MB — teto de upload

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
    const body = await req.json();
    const { nome, fonte, conteudo, conteudoBase64, formato } = body as {
      nome: string;
      fonte: string;
      conteudo?: string;
      conteudoBase64?: string; // PDF em base64 (sem o prefixo "data:...;base64,")
      formato?: 'texto' | 'pdf';
    };

    if (!nome) {
      return NextResponse.json({ success: false, message: 'Arquivo sem nome.' }, { status: 400 });
    }
    if (!['portal62', 'zap', 'outro'].includes(fonte)) {
      return NextResponse.json({ success: false, message: 'Fonte inválida.' }, { status: 400 });
    }

    let textoExtraido = '';

    if (formato === 'pdf') {
      if (!conteudoBase64) {
        return NextResponse.json({ success: false, message: 'PDF vazio.' }, { status: 400 });
      }
      const buffer = Buffer.from(conteudoBase64, 'base64');
      if (buffer.length > PDF_MAX_BYTES) {
        return NextResponse.json(
          { success: false, message: `PDF maior que ${(PDF_MAX_BYTES / (1024 * 1024)).toFixed(0)}MB.` },
          { status: 400 }
        );
      }
      try {
        // pdf-parse é CommonJS — import dinâmico evita puxar o pacote pro
        // bundle do cliente.
        const pdfParse = (await import('pdf-parse')).default;
        const data = await pdfParse(buffer);
        textoExtraido = (data.text || '').trim();
      } catch (err: any) {
        return NextResponse.json(
          { success: false, message: `Não consegui extrair texto desse PDF: ${err.message || 'erro desconhecido'}. Se for um PDF escaneado (imagem), o texto não é extraível automaticamente.` },
          { status: 400 }
        );
      }
      if (!textoExtraido) {
        return NextResponse.json(
          { success: false, message: 'Esse PDF não tem texto extraível (provavelmente é um scan/imagem). Copie o conteúdo relevante pra um .txt e suba de novo.' },
          { status: 400 }
        );
      }
    } else {
      textoExtraido = (conteudo || '').trim();
      if (!textoExtraido) {
        return NextResponse.json({ success: false, message: 'Arquivo vazio.' }, { status: 400 });
      }
    }

    const db = await readDb();
    if (db.configOrquestrador.documentos.length >= TOTAL_DOCUMENTOS_MAX) {
      return NextResponse.json(
        { success: false, message: `Limite de ${TOTAL_DOCUMENTOS_MAX} documentos atingido. Remova algum antigo antes de subir outro.` },
        { status: 400 }
      );
    }

    const doc: DocumentoRag = {
      id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      nome: nome.slice(0, 120),
      fonte: fonte as DocumentoRag['fonte'],
      conteudo: textoExtraido.slice(0, CONTEUDO_MAX),
      tamanho: textoExtraido.length,
      enviado_em: new Date().toISOString(),
      enviado_por: session.nome || session.email,
    };

    db.configOrquestrador.documentos.push(doc);
    await writeDb(db);

    return NextResponse.json({ success: true, data: doc });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ success: false, message: 'Não autenticado.' }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ success: false, message: 'id obrigatório.' }, { status: 400 });
  }

  const db = await readDb();
  db.configOrquestrador.documentos = db.configOrquestrador.documentos.filter(d => d.id !== id);
  await writeDb(db);

  return NextResponse.json({ success: true, data: db.configOrquestrador.documentos });
}
