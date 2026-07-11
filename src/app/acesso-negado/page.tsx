'use client';

import Link from 'next/link';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import styles from './page.module.css';

export default function AcessoNegadoPage() {
  return (
    <div className={styles.container}>
      <div className={styles.glow} />

      <div className={styles.card}>
        <div className={styles.iconWrap}>
          <ShieldAlert size={48} color="var(--farol-baixo)" />
        </div>

        <h1 className={styles.title}>Acesso Restrito</h1>
        <p className={styles.desc}>
          O seu nível de acesso não permite visualizar esta página ou módulo do sistema.
        </p>

        <div className={styles.permissionsNote}>
          <strong>Nota de Permissão:</strong> Determinados dashboards, faturamento e configurações de integração de XMLs são restritos aos cargos de nível Administrativo.
        </div>

        <div className={styles.actions}>
          <Link href="/" className="btn btn-primary" style={{ gap: 8 }}>
            <ArrowLeft size={16} /> Voltar para Visão Geral
          </Link>
          <button
            onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST' });
              window.location.href = '/login';
            }}
            className="btn btn-secondary"
          >
            Trocar de Conta
          </button>
        </div>
      </div>
    </div>
  );
}
