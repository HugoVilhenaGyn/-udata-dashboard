'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';

const SIDEBAR_COLLAPSED_KEY = 'udata_sidebar_collapsed';

// /avaliacao é a landing page pública (fora do login, sem o app interno de
// gestão) — não faz sentido mostrar o sidebar do painel administrativo lá.
// /login e /acesso-negado também ficam fora do shell: são telas de "antes
// de entrar no sistema", não devem mostrar o menu do painel interno.
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Lê a preferência salva só depois de montar (evita mismatch de
  // hidratação — servidor sempre renderiza expandido).
  useEffect(() => {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (saved === '1') setCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
      return next;
    });
  };

  const isChromeless =
    pathname?.startsWith('/avaliacao') ||
    pathname === '/login' ||
    pathname === '/acesso-negado';

  if (isChromeless) {
    return <>{children}</>;
  }

  return (
    <div
      className="page-wrapper"
      style={{ '--sidebar-width': collapsed ? '76px' : '260px' } as React.CSSProperties}
    >
      <Sidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
