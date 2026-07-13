'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Header from '@/components/layout/Header';
import { Settings2, Brain } from 'lucide-react';
import styles from './layout.module.css';

interface SessionInfo {
  cargo: string;
}

// A aba "Lisa" (instruções de treinamento + upload de pesquisas de mercado)
// só aparece pra ADMIN — o middleware já bloqueia a navegação direta pra
// quem não é admin, isso aqui é só pra não mostrar uma aba que vai dar
// acesso negado.
export default function ConfiguracoesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [cargo, setCargo] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => (res.ok ? res.json() : null))
      .then(data => setCargo(data?.data?.cargo || null))
      .catch(() => setCargo(null));
  }, []);

  const tabs = [
    { href: '/configuracoes/geral', label: 'Geral', icon: Settings2, visivel: true },
    { href: '/configuracoes/lisa', label: 'Lisa', icon: Brain, visivel: cargo === 'ADMIN' },
  ];

  return (
    <>
      <Header title="Configurações" subtitle="Conta, imobiliária e configuração da Lisa (Orquestrador IA)" />
      <div className="page-body animate-fadeIn">
        <div className={styles.tabs}>
          {tabs.filter(t => t.visivel).map(({ href, label, icon: Icon }) => {
            const ativo = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link key={href} href={href} className={`${styles.tab} ${ativo ? styles.tabActive : ''}`}>
                <Icon size={14} />
                {label}
              </Link>
            );
          })}
        </div>
        {children}
      </div>
    </>
  );
}
