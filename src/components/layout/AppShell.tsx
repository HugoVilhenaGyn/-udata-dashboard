'use client';

import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';

// /avaliacao é a landing page pública (fora do login, sem o app interno de
// gestão) — não faz sentido mostrar o sidebar do painel administrativo lá.
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublicLanding = pathname?.startsWith('/avaliacao');

  if (isPublicLanding) {
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
