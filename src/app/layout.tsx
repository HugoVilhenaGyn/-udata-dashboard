import type { Metadata } from 'next';
import './globals.css';
import AppShell from '@/components/layout/AppShell';

export const metadata: Metadata = {
  title: 'BrokerImobAI — Inteligência para o Mercado Imobiliário',
  description: 'Plataforma de automação e inteligência de dados para imobiliárias: Farol de Oportunidade, enriquecimento de XML, gestão de destaques e dashboard analítico.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
