import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/layout/Sidebar';

export const metadata: Metadata = {
  title: 'UDATA — Inteligência para o Mercado Imobiliário',
  description: 'Plataforma de automação e inteligência de dados para imobiliárias: Farol de Oportunidade, enriquecimento de XML, gestão de destaques e dashboard analítico.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <div className="page-wrapper">
          <Sidebar />
          <main className="main-content">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
