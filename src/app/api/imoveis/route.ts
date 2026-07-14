import { NextResponse } from 'next/server';
import { readDb } from '@/lib/db';

// Coleção completa de imóveis, direto do Postgres. Existia antes só o PATCH
// por id (src/app/api/imoveis/[id]/route.ts) — as telas de Farol, Qualidade
// e Inventário liam um snapshot estático compilado no build
// (src/lib/real-imoveis-data.json) em vez do banco, então um sync diário do
// Vista (ou um enriquecimento feito pela Lisa) nunca aparecia nessas telas
// sem um rebuild+redeploy manual. Este endpoint é o que destrava isso: as
// páginas passam a buscar aqui, então qualquer escrita real no banco
// (sync automático, PATCH da Lisa, decisão de destaque) fica visível na
// próxima vez que a tela carregar, sem precisar de deploy novo.
export async function GET() {
  try {
    const db = await readDb();
    return NextResponse.json({ success: true, data: db.imoveis });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
