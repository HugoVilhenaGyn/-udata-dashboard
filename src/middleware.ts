import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionToken } from './lib/auth-service';
import { ROLE_PERMISSIONS } from './lib/permissions';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Ignorar arquivos estáticos, assets, favicon e chamadas de API. Rotas de
  // API não fazem parte do ROLE_PERMISSIONS (são endpoints, não páginas) —
  // sem isso, QUALQUER chamada a /api/* (mesmo do Admin) era redirecionada
  // para /acesso-negado pelo bloco de permissão abaixo, retornando HTML no
  // lugar do JSON esperado. Cada rota de API cuida da própria autenticação.
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/') ||
    pathname.includes('.') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // /avaliacao é a landing page pública de avaliação de venda/locação —
  // fica fora do login de propósito, é pra visitante do site, não pra
  // equipe da imobiliária.
  if (pathname === '/avaliacao' || pathname.startsWith('/avaliacao/')) {
    return NextResponse.next();
  }

  const token = req.cookies.get('udata_session')?.value;

  // Se não estiver logado e tentar acessar qualquer rota privada
  if (!token && pathname !== '/login' && pathname !== '/acesso-negado') {
    const loginUrl = new URL('/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  // Se estiver logado e tentar ir para /login
  if (token && pathname === '/login') {
    const homeUrl = new URL('/', req.url);
    return NextResponse.redirect(homeUrl);
  }

  // Se estiver logado, verificar permissões do cargo
  if (token && pathname !== '/login' && pathname !== '/acesso-negado') {
    const session = await verifySessionToken(token);

    // Se o token for inválido
    if (!session) {
      const loginUrl = new URL('/login', req.url);
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete('udata_session');
      return response;
    }

    const cargo = session.cargo;
    const allowedRoutes = ROLE_PERMISSIONS[cargo] || ['/'];

    // Se tentar acessar uma rota que não está na lista de permissão do cargo
    const isAllowed = allowedRoutes.some(
      route => pathname === route || pathname.startsWith(`${route}/`)
    );

    if (!isAllowed) {
      const accessDeniedUrl = new URL('/acesso-negado', req.url);
      return NextResponse.redirect(accessDeniedUrl);
    }
  }

  return NextResponse.next();
}

// Configurações do matcher para rodar nas rotas principais
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
