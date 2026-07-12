'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/layout/Header';
import { formatCurrency } from '@/lib/mock-data';
import {
  Users, Clock, CheckCircle2, TrendingUp, Save, ExternalLink, Loader2,
} from 'lucide-react';
import styles from './page.module.css';

interface LeadAvaliacao {
  id: string;
  nome: string;
  telefone: string;
  email: string;
  finalidade: 'venda' | 'aluguel';
  tipo: string;
  bairro: string;
  area_util: number;
  quartos: number;
  mensagem?: string;
  valor_estimado: number;
  comparaveis_usados: number;
  criado_em: string;
  status: 'novo' | 'em_atendimento' | 'atendido';
}

interface ConfigAvaliacao {
  ativo: boolean;
  telefoneContato: string;
  tituloHero: string;
  mensagemHero: string;
  mensagemIndisponivel: string;
}

const STATUS_LABEL: Record<string, string> = {
  novo: 'Novo',
  em_atendimento: 'Em atendimento',
  atendido: 'Atendido',
};

const STATUS_COLOR: Record<string, string> = {
  novo: '#f59e0b',
  em_atendimento: '#6366f1',
  atendido: '#22c55e',
};

export default function AvaliacaoAdminPage() {
  const [leads, setLeads] = useState<LeadAvaliacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [config, setConfig] = useState<ConfigAvaliacao | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/leads-avaliacao').then(r => r.json()),
      fetch('/api/config-avaliacao').then(r => r.json()),
    ]).then(([leadsJson, configJson]) => {
      if (leadsJson.success) setLeads(leadsJson.data);
      if (configJson.success) setConfig(configJson.data);
    }).finally(() => setCarregando(false));
  }, []);

  const atualizarStatus = async (id: string, status: string) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status: status as LeadAvaliacao['status'] } : l));
    try {
      const res = await fetch('/api/leads-avaliacao', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
    } catch {
      setAviso('⚠️ Não foi possível salvar essa mudança de status. Tente de novo.');
      setTimeout(() => setAviso(null), 4000);
    }
  };

  const salvarConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    setSalvando(true);
    try {
      const res = await fetch('/api/config-avaliacao', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setAviso('✅ Configurações da landing page salvas.');
    } catch (err: any) {
      setAviso(`⚠️ ${err.message || 'Erro ao salvar configurações.'}`);
    } finally {
      setSalvando(false);
      setTimeout(() => setAviso(null), 4000);
    }
  };

  const total = leads.length;
  const novos = leads.filter(l => l.status === 'novo').length;
  const emAtendimento = leads.filter(l => l.status === 'em_atendimento').length;
  const atendidos = leads.filter(l => l.status === 'atendido').length;
  const taxaAtendimento = total > 0 ? Math.round((atendidos / total) * 100) : 0;

  return (
    <>
      <Header title="Avaliação Online" subtitle="Configuração da landing page pública e leads capturados pela calculadora" />
      <div className="page-body animate-fadeIn">

        <div style={{ marginBottom: '1.25rem' }}>
          <a href="/avaliacao" target="_blank" rel="noopener noreferrer" className={styles.previewLink}>
            <ExternalLink size={13} /> Ver landing page pública (/avaliacao)
          </a>
        </div>

        {aviso && (
          <div className={styles.aviso}>{aviso}</div>
        )}

        {/* KPIs */}
        <div className={styles.kpiRow}>
          <div className={`card ${styles.kpiMini}`}>
            <Users size={16} color="#6366f1" />
            <div>
              <div className={styles.kpiVal}>{total}</div>
              <div className={styles.kpiLbl}>Total de leads</div>
            </div>
          </div>
          <div className={`card ${styles.kpiMini}`}>
            <Clock size={16} color="#f59e0b" />
            <div>
              <div className={styles.kpiVal}>{novos}</div>
              <div className={styles.kpiLbl}>Novos (aguardando)</div>
            </div>
          </div>
          <div className={`card ${styles.kpiMini}`}>
            <TrendingUp size={16} color="#6366f1" />
            <div>
              <div className={styles.kpiVal}>{emAtendimento}</div>
              <div className={styles.kpiLbl}>Em atendimento</div>
            </div>
          </div>
          <div className={`card ${styles.kpiMini}`}>
            <CheckCircle2 size={16} color="#22c55e" />
            <div>
              <div className={styles.kpiVal}>{atendidos}</div>
              <div className={styles.kpiLbl}>Atendidos ({taxaAtendimento}%)</div>
            </div>
          </div>
        </div>

        {/* CONFIG DA LANDING */}
        {config && (
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Configuração da Landing Page</h2>
            </div>
            <form onSubmit={salvarConfig} className={styles.configForm}>
              <label className={styles.toggleField}>
                <input
                  type="checkbox"
                  checked={config.ativo}
                  onChange={e => setConfig({ ...config, ativo: e.target.checked })}
                />
                <span>Calculadora ativa (visitantes conseguem usar /avaliacao)</span>
              </label>

              <div className={styles.field}>
                <label>Telefone de contato exibido na landing</label>
                <input
                  value={config.telefoneContato}
                  onChange={e => setConfig({ ...config, telefoneContato: e.target.value })}
                />
              </div>

              <div className={styles.field}>
                <label>Título principal (hero)</label>
                <input
                  value={config.tituloHero}
                  onChange={e => setConfig({ ...config, tituloHero: e.target.value })}
                />
              </div>

              <div className={styles.field}>
                <label>Texto de apoio (hero)</label>
                <textarea
                  value={config.mensagemHero}
                  onChange={e => setConfig({ ...config, mensagemHero: e.target.value })}
                  rows={2}
                />
              </div>

              <div className={styles.field}>
                <label>Mensagem quando a calculadora estiver desativada</label>
                <textarea
                  value={config.mensagemIndisponivel}
                  onChange={e => setConfig({ ...config, mensagemIndisponivel: e.target.value })}
                  rows={2}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ gap: 6, alignSelf: 'flex-start' }} disabled={salvando}>
                {salvando ? <Loader2 size={14} className={styles.spin} /> : <Save size={14} />}
                Salvar configurações
              </button>
            </form>
          </div>
        )}

        {/* LEADS */}
        <div className="card">
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Leads da Calculadora</h2>
            <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>{total} no total</span>
          </div>

          {carregando ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Carregando...</div>
          ) : leads.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Nenhum lead recebido ainda. Assim que alguém preencher a calculadora em /avaliacao, aparece aqui.
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Contato</th>
                    <th>Imóvel</th>
                    <th>Avaliação</th>
                    <th>Recebido em</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map(lead => (
                    <tr key={lead.id}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '0.8rem' }}>{lead.nome}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{lead.telefone}{lead.email ? ` · ${lead.email}` : ''}</div>
                        {lead.mensagem && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>&quot;{lead.mensagem}&quot;</div>}
                      </td>
                      <td style={{ fontSize: '0.8rem' }}>
                        {lead.finalidade === 'venda' ? 'Venda' : 'Locação'} · {lead.tipo}
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{lead.bairro} · {lead.area_util}m²</div>
                      </td>
                      <td style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                        {lead.valor_estimado > 0 ? formatCurrency(lead.valor_estimado) : '—'}
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                          {lead.comparaveis_usados > 0 ? `${lead.comparaveis_usados} comparáveis` : 'sem estimativa'}
                        </div>
                      </td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {new Date(lead.criado_em).toLocaleString('pt-BR')}
                      </td>
                      <td>
                        <select
                          value={lead.status}
                          onChange={e => atualizarStatus(lead.id, e.target.value)}
                          className={styles.statusSelect}
                          style={{ borderColor: `${STATUS_COLOR[lead.status]}50`, color: STATUS_COLOR[lead.status] }}
                        >
                          {Object.entries(STATUS_LABEL).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
