'use client';

import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';

// /avaliacao é a landing page pública (fora do login, sem o app interno de
// gestão) — não faz sentido mostrar o sidebar do painel administrativo lá.
// /login e /acesso-negado também ficam fora do shell: são telas de "antes
// de entrar no sistema", não devem mostrar o menu do painel interno.
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isChromeless =
    pathname?.startsWith('/avaliacao') ||
    pathname === '/login' ||
    pathname === '/acesso-negado';

  if (isChromeless) {
    return <>{children}</>;
  }

  return (
    <div className="page-wrapper">
      <Sidebar />
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
