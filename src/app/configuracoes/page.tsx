'use client';

import { useEffect, useState } from 'react';
import Header from '@/components/layout/Header';
import { mockImobiliaria } from '@/lib/mock-data';
import { Building2, Shield, Bell, Sliders } from 'lucide-react';

interface SessionInfo {
  nome: string;
  email: string;
  cargo: string;
}

export default function ConfiguracoesPage() {
  const [session, setSession] = useState<SessionInfo | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => (res.ok ? res.json() : null))
      .then(data => setSession(data?.data || null))
      .catch(() => setSession(null));
  }, []);

  return (
    <>
      <Header title="Configurações" subtitle="Dados da conta e preferências da imobiliária" />
      <div className="page-body animate-fadeIn">
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '0.925rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={16} color="#6366f1" /> Sua conta
          </h2>
          {session ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', fontSize: '0.85rem' }}>
              <div><span style={{ color: 'var(--text-muted)' }}>Nome</span><div>{session.nome}</div></div>
              <div><span style={{ color: 'var(--text-muted)' }}>E-mail</span><div>{session.email}</div></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Cargo</span><div>{session.cargo}</div></div>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Não foi possível carregar os dados da sessão.</p>
          )}
        </div>

        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '0.925rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Building2 size={16} color="#6366f1" /> Imobiliária
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', fontSize: '0.85rem' }}>
            <div><span style={{ color: 'var(--text-muted)' }}>Nome</span><div>{mockImobiliaria.nome}</div></div>
            <div><span style={{ color: 'var(--text-muted)' }}>CNPJ</span><div>{mockImobiliaria.cnpj}</div></div>
            <div><span style={{ color: 'var(--text-muted)' }}>Plano</span><div style={{ textTransform: 'capitalize' }}>{mockImobiliaria.plano}</div></div>
          </div>
        </div>

        <div className="card">
          <h2 style={{ fontSize: '0.925rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sliders size={16} color="#6366f1" /> Regras de enriquecimento (padrão)
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Cadência de republicação</span>
              <span>{mockImobiliaria.config.cadencia_republicacao_horas}h</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Proteger endereço</span>
              <span>{mockImobiliaria.config.proteger_endereco ? 'Ativado' : 'Desativado'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Gerar descrição automática</span>
              <span>{mockImobiliaria.config.gerar_descricao_auto ? 'Ativado' : 'Desativado'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Score mínimo p/ destaque</span>
              <span>{mockImobiliaria.config.score_minimo_destaque}</span>
            </div>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '1rem' }}>
            Essas configurações ainda são somente leitura (dados mockados). Edição real entra quando o backend de persistência for implementado.
          </p>
        </div>
      </div>
    </>
  );
}
