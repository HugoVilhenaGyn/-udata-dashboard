'use client';

import { useState } from 'react';
import Header from '@/components/layout/Header';
import FarolBadge from '@/components/ui/FarolBadge';
import QualityBar from '@/components/ui/QualityBar';
import { mockPortais, mockDestaques, mockImoveis, formatCurrency, formatNumber } from '@/lib/mock-data';
import { Destaque, Portal } from '@/lib/types';
import { Zap, TrendingUp, DollarSign, Eye, Users, Calendar, Target, Plus, Cpu } from 'lucide-react';
import styles from './page.module.css';

const portalColors: Record<string, string> = {
  olx: '#6a1faf', zap: '#ff5a00', vivareal: '#0066cc',
  chaves: '#e11d48', imovelweb: '#059669', meta: '#1877f2', google: '#ea4335',
};

function PortalCard({ portal, onAdicionar }: { portal: Portal; onAdicionar: (portal: Portal) => void }) {
  const color = portalColors[portal.slug] || '#6366f1';
  const pctBudget = (portal.orcamento_gasto / portal.orcamento_mensal) * 100;
  const pctDestaques = (portal.destaques_usados / (portal.destaques_disponiveis || 1)) * 100;

  return (
    <div className={styles.portalCard} style={{ borderColor: `${color}25` }}>
      <div className={styles.portalHeader}>
        <div className={styles.portalBadge} style={{ background: `${color}15`, border: `1px solid ${color}30` }}>
          <span style={{ color, fontWeight: 800, fontSize: '0.8rem' }}>{portal.nome.split(' ')[0].toUpperCase()}</span>
        </div>
        <div className={styles.portalStatus}>
          <span className={`badge ${portal.ativo ? 'badge-iminente' : 'badge-baixo'}`} style={{ fontSize: '0.65rem' }}>
            {portal.ativo ? '● Ativo' : '● Inativo'}
          </span>
          {portal.api_disponivel && (
            <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>API</span>
          )}
        </div>
      </div>

      <div className={styles.portalName}>{portal.nome}</div>
      <div className={styles.portalFormat}>{portal.formato_xml}</div>

      {typeof portal.nota_portal === 'number' && (
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '0.4rem 0 0.2rem' }}
          title={`Nota calculada com base em qualidade média (${portal.qualidade_media_portal}/10) e farol favorável (${portal.farol_favoravel_pct}%) dos imóveis reais que consideramos publicados neste portal. Atenção: a lista de QUAIS imóveis estão em cada portal é estimada — o CRM só nos deu um XML consolidado, sem informar por-imóvel os portais de destino.`}
        >
          <span style={{
            fontSize: '1.1rem', fontWeight: 800,
            color: portal.nota_portal >= 7 ? '#22c55e' : portal.nota_portal >= 5 ? '#f59e0b' : '#ef4444',
          }}>
            {portal.nota_portal.toFixed(1)}
          </span>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
            nota do portal · {portal.imoveis_publicados} anúncios (estimado)
          </span>
        </div>
      )}

      <div className={styles.portalMetrics}>
        <div className={styles.portalMetric}>
          <Eye size={11} color="var(--text-muted)" />
          <span>{formatNumber(portal.visualizacoes_mes)}</span>
          <span className={styles.metricLabel}>visualizações</span>
        </div>
        <div className={styles.portalMetric}>
          <Users size={11} color="var(--text-muted)" />
          <span>{formatNumber(portal.leads_mes)}</span>
          <span className={styles.metricLabel}>leads</span>
        </div>
      </div>

      {portal.custo_por_lead && portal.custo_por_lead > 0 && (
        <div className={styles.cpl}>
          CPL: <strong>R$ {portal.custo_por_lead.toFixed(2)}</strong>
        </div>
      )}

      {/* Budget */}
      {portal.orcamento_mensal > 0 && (
        <div className={styles.budgetBlock}>
          <div className={styles.budgetRow}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Orçamento</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              {formatCurrency(portal.orcamento_gasto)} / {formatCurrency(portal.orcamento_mensal)}
            </span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{
              width: `${Math.min(100, pctBudget)}%`,
              background: pctBudget > 90 ? '#ef4444' : pctBudget > 70 ? '#f59e0b' : color,
            }} />
          </div>
        </div>
      )}

      {/* Highlights */}
      {portal.destaques_disponiveis > 0 && (
        <div className={styles.budgetBlock}>
          <div className={styles.budgetRow}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Destaques</span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              {portal.destaques_usados}/{portal.destaques_disponiveis}
            </span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{
              width: `${Math.min(100, pctDestaques)}%`,
              background: pctDestaques > 90 ? '#ef4444' : '#f59e0b',
            }} />
          </div>
        </div>
      )}

      <button
        className="btn btn-secondary"
        style={{ width: '100%', justifyContent: 'center', marginTop: '0.75rem', fontSize: '0.78rem' }}
        onClick={() => onAdicionar(portal)}
      >
        <Plus size={13} /> Adicionar Destaque
      </button>
    </div>
  );
}

export default function DestaquesPage() {
  const [destaques, setDestaques] = useState<Destaque[]>(mockDestaques);
  const [otimizando, setOtimizando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const totalBudget = mockPortais.reduce((acc, p) => acc + p.orcamento_mensal, 0);
  const totalGasto = mockPortais.reduce((acc, p) => acc + p.orcamento_gasto, 0);
  // "Leads via destaques" precisa somar SÓ os leads dos imóveis destacados
  // (d.leads_gerados) — antes somava o total de leads de TODOS os portais,
  // o que não tem relação com o desempenho dos destaques em si.
  const totalLeads = destaques.reduce((acc, d) => acc + d.leads_gerados, 0);
  const totalDestaques = destaques.length;

  const destaquesByType = {
    super_destaque: destaques.filter(d => d.tipo_destaque === 'super_destaque'),
    destaque_premium: destaques.filter(d => d.tipo_destaque === 'destaque_premium'),
    destaque: destaques.filter(d => d.tipo_destaque === 'destaque'),
  };

  // Adiciona um destaque real para o melhor imóvel elegível ainda sem
  // destaque ativo naquele portal (maior nota de qualidade primeiro).
  const adicionarDestaque = (portal: Portal) => {
    const jaDestacados = new Set(destaques.map(d => d.imovel_id));
    const candidato = [...mockImoveis]
      .filter(i => i.portais_publicados.includes(portal.slug) && !jaDestacados.has(i.id))
      .sort((a, b) => b.nota_qualidade - a.nota_qualidade)[0];

    if (!candidato) {
      setAviso(`Nenhum imóvel elegível encontrado para destacar em ${portal.nome} (todos já possuem destaque ativo).`);
      setTimeout(() => setAviso(null), 4000);
      return;
    }

    const novo: Destaque = {
      id: `destaque-${Date.now()}`,
      imovel_id: candidato.id,
      imovel: {
        titulo: candidato.titulo,
        bairro: candidato.bairro,
        preco_atual: candidato.preco_atual,
        tipo: candidato.tipo,
        status_farol: candidato.status_farol,
        nota_qualidade: candidato.nota_qualidade,
      },
      portal: portal.slug,
      tipo_destaque: 'destaque',
      data_inicio: new Date().toISOString().split('T')[0],
      data_fim: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
      custo: 120,
      leads_gerados: 0,
      visualizacoes_geradas: 0,
      roi_estimado: 0,
      status: 'ativo',
      score_ia: Math.round(candidato.nota_qualidade * 10),
    };

    setDestaques(prev => [novo, ...prev]);
    setAviso(`✅ Destaque criado para "${candidato.titulo}" em ${portal.nome}.`);
    setTimeout(() => setAviso(null), 4000);
  };

  // Recalcula o score_ia de cada destaque com base em nota de qualidade e
  // ROI atual, e reordena a fila de prioridade — simula uma repriorização
  // feita pela IA de alocação.
  const otimizarComIA = () => {
    setOtimizando(true);
    setTimeout(() => {
      setDestaques(prev => {
        const recalculado = prev.map(d => ({
          ...d,
          score_ia: Math.min(99, Math.round(d.imovel.nota_qualidade * 7 + d.roi_estimado * 3)),
        }));
        return recalculado.sort((a, b) => b.score_ia - a.score_ia);
      });
      setOtimizando(false);
      setAviso('🧠 Alocação otimizada: destaques reordenados por score de prioridade da IA.');
      setTimeout(() => setAviso(null), 4000);
    }, 1000);
  };

  return (
    <>
      <Header title="Gestão de Destaques" subtitle="Alocação inteligente via IA por portal" />
      <div className="page-body animate-fadeIn">

        {/* AVISO DE FONTE DE DADOS */}
        <div className="card" style={{
          marginBottom: '1.25rem', borderColor: 'rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.06)',
          fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5,
        }}>
          <strong style={{ color: 'var(--text-primary)' }}>De onde vem o "destaque ativo":</strong> do campo{' '}
          <code style={{ background: 'rgba(0,0,0,0.25)', padding: '1px 5px', borderRadius: 4 }}>PublicationType</code>{' '}
          do XML do CRM (Vista) — é o próprio CRM reportando qual anúncio está configurado como destaque na origem.
          Hoje, dos 340 imóveis reais, apenas <strong>1</strong> está marcado como <code style={{ background: 'rgba(0,0,0,0.25)', padding: '1px 5px', borderRadius: 4 }}>PREMIUM</code>{' '}
          — os outros 339 estão em <code style={{ background: 'rgba(0,0,0,0.25)', padding: '1px 5px', borderRadius: 4 }}>STANDARD</code>.
          O XML é só leitura (CRM → portal): a compra/alocação real de destaque acontece no painel de anunciante de
          cada portal (ZAP, VivaReal, OLX etc.) ou via API paga deles, que ainda não está integrada aqui. Métricas de
          visualizações/leads/CPL por portal abaixo continuam sendo estimativas, não dados reais de API.
          <br /><br />
          <strong style={{ color: 'var(--text-primary)' }}>Sobre "em quais portais cada imóvel está":</strong> o
          feed do Vista que temos é único e consolidado — não existe, por enquanto, um feed separado por portal (ZAP,
          VivaReal, OLX) que diga exatamente quais imóveis foram enviados a cada um. Por isso <code style={{ background: 'rgba(0,0,0,0.25)', padding: '1px 5px', borderRadius: 4 }}>portais_publicados</code>{' '}
          e a "nota do portal" abaixo usam uma distribuição estimada, não a real. Se você conseguir os links/feeds
          individuais por portal no painel do Vista, isso vira 100% real.
        </div>

        {/* KPIs */}
        <div className={styles.kpiRow}>
          <div className={`card ${styles.kpiMini}`}>
            <Zap size={16} color="#fb923c" />
            <div>
              <div className={styles.kpiVal}>{totalDestaques}</div>
              <div className={styles.kpiLbl}>Destaques Ativos</div>
            </div>
          </div>
          <div className={`card ${styles.kpiMini}`}>
            <DollarSign size={16} color="#6366f1" />
            <div>
              <div className={styles.kpiVal}>{formatCurrency(totalGasto)}</div>
              <div className={styles.kpiLbl}>Investido / {formatCurrency(totalBudget)} total</div>
            </div>
          </div>
          <div className={`card ${styles.kpiMini}`}>
            <Users size={16} color="#22c55e" />
            <div>
              <div className={styles.kpiVal}>{formatNumber(totalLeads)}</div>
              <div className={styles.kpiLbl}>Leads via destaques</div>
            </div>
          </div>
          <div className={`card ${styles.kpiMini}`}>
            <TrendingUp size={16} color="#a78bfa" />
            <div>
              <div className={styles.kpiVal}>
                {(destaques.reduce((acc, d) => acc + d.roi_estimado, 0) / (destaques.length || 1)).toFixed(1)}x
              </div>
              <div className={styles.kpiLbl}>ROI médio estimado</div>
            </div>
          </div>
          <div className={`card ${styles.kpiMini}`} style={{ borderColor: 'rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.05)' }}>
            <Cpu size={16} color="#6366f1" />
            <div>
              <div className={styles.kpiVal} style={{ color: '#818cf8' }}>IA ativa</div>
              <div className={styles.kpiLbl}>Alocação automática</div>
            </div>
          </div>
        </div>

        {aviso && (
          <div className="card" style={{ marginBottom: '1rem', borderColor: 'rgba(99,102,241,0.35)', background: 'rgba(99,102,241,0.06)', fontSize: '0.82rem' }}>
            {aviso}
          </div>
        )}

        {/* PORTAL CARDS */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
            <h2 style={{ fontSize: '0.925rem', fontWeight: 600, color: 'var(--text-primary)' }}>Portais Integrados</h2>
            <button className="btn btn-primary" style={{ fontSize: '0.78rem' }} disabled={otimizando} onClick={otimizarComIA}>
              <Cpu size={13} /> {otimizando ? 'Otimizando...' : 'Otimizar com IA'}
            </button>
          </div>
          <div className={styles.portaisGrid}>
            {mockPortais.map(p => <PortalCard key={p.slug} portal={p} onAdicionar={adicionarDestaque} />)}
          </div>
        </div>

        {/* ACTIVE HIGHLIGHTS — grade completa, separada por nível */}
        {([
          { key: 'super_destaque', label: '⭐ Super Destaque', color: '#fb923c', desc: 'Topo da busca, maior visibilidade — reservado para os imóveis de maior score de prioridade.' },
          { key: 'destaque_premium', label: '✦ Destaque Premium', color: '#a78bfa', desc: 'Posição privilegiada, um nível abaixo do Super Destaque.' },
          { key: 'destaque', label: '▸ Destaque', color: 'var(--text-secondary)', desc: 'Destaque padrão — sinalizado nos resultados de busca dos portais.' },
        ] as { key: keyof typeof destaquesByType; label: string; color: string; desc: string }[]).map(tier => {
          const lista = [...destaquesByType[tier.key]].sort((a, b) => b.score_ia - a.score_ia);
          if (lista.length === 0) return null;
          return (
            <div className="card" key={tier.key} style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <h2 style={{ fontSize: '0.925rem', fontWeight: 600, color: tier.color }}>
                  {tier.label}
                </h2>
                <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>{lista.length} imóveis</span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>{tier.desc}</p>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Imóvel</th>
                      <th>Portal</th>
                      <th>Farol</th>
                      <th>Qualidade</th>
                      <th>Score IA</th>
                      <th>Leads</th>
                      <th>Visualizações</th>
                      <th>ROI</th>
                      <th>Custo</th>
                      <th>Validade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lista.map((dest) => (
                      <tr key={dest.id}>
                        <td>
                          <div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {dest.imovel.titulo}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                              {dest.imovel.bairro} · {formatCurrency(dest.imovel.preco_atual)}{dest.imovel.finalidade === 'aluguel' ? '/mês' : ''}
                            </div>
                          </div>
                        </td>
                        <td>
                          <span style={{
                            background: `${portalColors[dest.portal] || '#6366f1'}20`,
                            color: portalColors[dest.portal] || '#6366f1',
                            border: `1px solid ${portalColors[dest.portal] || '#6366f1'}40`,
                            borderRadius: 4,
                            padding: '2px 6px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                          }}>
                            {dest.portal}
                          </span>
                        </td>
                        <td><FarolBadge status={dest.imovel.status_farol} finalidade={dest.imovel.finalidade} size="sm" showDot={false} /></td>
                        <td style={{ minWidth: 100 }}>
                          <QualityBar score={dest.imovel.nota_qualidade} size="sm" showLabel={false} />
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <div className="progress-track" style={{ width: 36 }}>
                              <div className="progress-fill" style={{
                                width: `${dest.score_ia}%`,
                                background: dest.score_ia >= 80 ? '#22c55e' : '#f59e0b',
                              }} />
                            </div>
                            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: dest.score_ia >= 80 ? '#22c55e' : '#f59e0b' }}>
                              {dest.score_ia}
                            </span>
                          </div>
                        </td>
                        <td style={{ fontWeight: 600, color: '#22c55e' }}>{dest.leads_gerados}</td>
                        <td style={{ fontVariantNumeric: 'tabular-nums' }}>{formatNumber(dest.visualizacoes_geradas)}</td>
                        <td>
                          <span style={{
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            color: dest.roi_estimado >= 3 ? '#22c55e' : dest.roi_estimado >= 1.5 ? '#f59e0b' : '#ef4444',
                          }}>
                            {dest.roi_estimado.toFixed(1)}x
                          </span>
                        </td>
                        <td style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(dest.custo)}</td>
                        <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          até {dest.data_fim}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}

      </div>
    </>
  );
}
