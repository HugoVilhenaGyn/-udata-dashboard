'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import { LisaContextProvider } from '@/lib/lisa-context';
import LisaWidget from '@/components/lisa/LisaWidget';

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

  // O widget flutuante da Lisa (botão + painel de chat) fica disponível em
  // toda seção logada do painel — exceto na própria /copiloto, que já é o
  // chat completo (duplicar ali só atrapalharia).
  const mostrarWidgetLisa = pathname !== '/copiloto';

  return (
    <LisaContextProvider>
      <div
        className="page-wrapper"
        style={{ '--sidebar-width': collapsed ? '76px' : '260px' } as React.CSSProperties}
      >
        <Sidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
        <main className="main-content">
          {children}
        </main>
        {mostrarWidgetLisa && <LisaWidget />}
      </div>
    </LisaContextProvider>
  );
}
