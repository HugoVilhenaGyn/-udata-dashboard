'use client';

import Header from '@/components/layout/Header';
import {
  receitaVendaPorFarol, receitaLocacaoPorFarol, receitaLocacaoIntermediacaoPorFarol, receitaResumo,
  receitaVendaPorTipo, receitaLocacaoCombinadaPorTipo, imoveisComPrecoSuspeito,
  formatCurrency,
} from '@/lib/mock-data';
import { FarolStatus } from '@/lib/types';
import { TrendingUp, DollarSign, Home, KeyRound, Building2, AlertTriangle, Handshake } from 'lucide-react';
import styles from './page.module.css';

const farolLabels: Record<FarolStatus, string> = {
  venda_iminente: 'Alta liquidez',
  venda_potencial: 'Liquidez média',
  baixo_potencial: 'Baixa liquidez',
};
const farolColors: Record<FarolStatus, string> = {
  venda_iminente: '#22c55e',
  venda_potencial: '#f59e0b',
  baixo_potencial: '#ef4444',
};

function FarolBreakdown({ segmentos, comissaoPct, recorrente }: {
  segmentos: typeof receitaVendaPorFarol;
  comissaoPct: number;
  recorrente: boolean;
}) {
  const totalPotencial = segmentos.reduce((acc, s) => acc + s.comissaoPotencial, 0);
  return (
    <div className={styles.farolBreakdown}>
      {segmentos.map(s => (
        <div key={s.status} className={styles.farolRow}>
          <div className={styles.farolRowHeader}>
            <span className={styles.farolDot} style={{ background: farolColors[s.status] }} />
            <span className={styles.farolRowLabel}>{farolLabels[s.status]}</span>
            <span className={styles.farolRowCount}>{s.count} imóveis</span>
          </div>
          <div className="progress-track" style={{ marginTop: 4, marginBottom: 4 }}>
            <div className="progress-fill" style={{
              width: totalPotencial > 0 ? `${(s.comissaoPotencial / totalPotencial) * 100}%` : '0%',
              background: farolColors[s.status],
            }} />
          </div>
          <div className={styles.farolRowValues}>
            <span>Valor em carteira: <strong>{formatCurrency(s.valorTotal)}</strong></span>
            <span>
              Comissão ({comissaoPct >= 1 ? `${comissaoPct.toFixed(0)}x aluguel` : `${(comissaoPct * 100).toFixed(0)}%`}{recorrente ? '/mês' : ''}):{' '}
              <strong style={{ color: '#22c55e' }}>{formatCurrency(s.comissaoPotencial)}</strong>
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ReceitaPage() {
  const totalPontualLocacao = receitaResumo.comissaoInferidaIntermediacaoLocacao;
  const totalPontual = receitaResumo.comissaoInferidaVenda + totalPontualLocacao;

  return (
    <>
      <Header
        title="Dashboard de Receita"
        subtitle="Três receitas, sempre separadas: comissão de venda (única), intermediação de locação — o 1º aluguel (única) e taxa de administração (recorrente/mês)"
      />
      <div className="page-body animate-fadeIn">

        {imoveisComPrecoSuspeito.length > 0 && (
          <div className="card" style={{
            marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: 10,
            borderColor: 'rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.06)',
          }}>
            <AlertTriangle size={16} color="#f59e0b" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <strong style={{ color: '#f59e0b' }}>{imoveisComPrecoSuspeito.length} imóveis</strong> têm preço muito fora do padrão do segmento (provável erro de cadastro no CRM, ex: valor de venda no campo de aluguel) e foram <strong>excluídos</strong> destes cálculos de receita. Veja o alerta ⚠ no Inventário para revisar cada um.
            </span>
          </div>
        )}

        {/* RESUMO PONTUAL x RECORRENTE */}
        <div className="card" style={{ marginBottom: '1.25rem', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Receita pontual inferida (venda + 1º aluguel)</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>{formatCurrency(totalPontual)}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Receita recorrente inferida (administração/mês)</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#a855f7' }}>{formatCurrency(receitaResumo.comissaoInferidaLocacaoMensal)}/mês</div>
          </div>
        </div>

        {/* KPI CARDS */}
        <div className={styles.kpiGrid}>
          <div className={`card ${styles.kpiCard}`}>
            <div className={styles.kpiHeader}>
              <span className={styles.kpiLabel}>Comissão Venda (inferida)</span>
              <div className={styles.kpiIcon} style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)' }}>
                <TrendingUp size={16} color="#6366f1" />
              </div>
            </div>
            <div className={styles.kpiValue}>{formatCurrency(receitaResumo.comissaoInferidaVenda)}</div>
            <div className={styles.kpiSub}>{(receitaResumo.comissaoVendaPct * 100).toFixed(0)}% · única · {receitaResumo.qtdVenda} imóveis à venda</div>
          </div>

          <div className={`card ${styles.kpiCard}`}>
            <div className={styles.kpiHeader}>
              <span className={styles.kpiLabel}>Intermediação Locação (inferida)</span>
              <div className={styles.kpiIcon} style={{ background: 'rgba(236,72,153,0.12)', border: '1px solid rgba(236,72,153,0.3)' }}>
                <Handshake size={16} color="#ec4899" />
              </div>
            </div>
            <div className={styles.kpiValue}>{formatCurrency(receitaResumo.comissaoInferidaIntermediacaoLocacao)}</div>
            <div className={styles.kpiSub}>1x o 1º aluguel · única · {receitaResumo.qtdLocacao} imóveis alugados</div>
          </div>

          <div className={`card ${styles.kpiCard}`}>
            <div className={styles.kpiHeader}>
              <span className={styles.kpiLabel}>Administração Locação (inferida)</span>
              <div className={styles.kpiIcon} style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)' }}>
                <KeyRound size={16} color="#a855f7" />
              </div>
            </div>
            <div className={styles.kpiValue}>{formatCurrency(receitaResumo.comissaoInferidaLocacaoMensal)}/mês</div>
            <div className={styles.kpiSub}>{(receitaResumo.comissaoLocacaoPct * 100).toFixed(0)}%/mês · recorrente</div>
          </div>

          <div className={`card ${styles.kpiCard}`}>
            <div className={styles.kpiHeader}>
              <span className={styles.kpiLabel}>Ticket Médio — Venda</span>
              <div className={styles.kpiIcon} style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)' }}>
                <Home size={16} color="#6366f1" />
              </div>
            </div>
            <div className={styles.kpiValue}>{formatCurrency(receitaResumo.ticketMedioVenda)}</div>
            <div className={styles.kpiSub}>Valor em carteira: {formatCurrency(receitaResumo.valorTotalPortfolioVenda)}</div>
          </div>

          <div className={`card ${styles.kpiCard}`}>
            <div className={styles.kpiHeader}>
              <span className={styles.kpiLabel}>Ticket Médio — Locação</span>
              <div className={styles.kpiIcon} style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.3)' }}>
                <Building2 size={16} color="#a855f7" />
              </div>
            </div>
            <div className={styles.kpiValue}>{formatCurrency(receitaResumo.ticketMedioLocacao)}/mês</div>
            <div className={styles.kpiSub}>Total de alugueis/mês: {formatCurrency(receitaResumo.valorTotalAlugueisMes)}</div>
          </div>

          <div className={`card ${styles.kpiCard}`}>
            <div className={styles.kpiHeader}>
              <span className={styles.kpiLabel}>Comissão Potencial — Venda</span>
              <div className={styles.kpiIcon} style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)' }}>
                <DollarSign size={16} color="#22c55e" />
              </div>
            </div>
            <div className={styles.kpiValue} style={{ color: '#22c55e' }}>{formatCurrency(receitaResumo.comissaoPotencialVenda)}</div>
            <div className={styles.kpiSub}>Se todas as vendas fechassem (cenário otimista)</div>
          </div>
        </div>

        {/* BREAKDOWN VENDA x LOCAÇÃO (INTERMEDIAÇÃO) x LOCAÇÃO (ADMINISTRAÇÃO) */}
        <div className={styles.topSection} style={{ display: 'flex', gap: '1.25rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <div className="card" style={{ flex: 1, minWidth: 280 }}>
            <h2 style={{ fontSize: '0.925rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
              Venda — comissão por liquidez (única)
            </h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Comissão de {(receitaResumo.comissaoVendaPct * 100).toFixed(0)}% paga uma única vez quando a venda fecha.
            </p>
            <FarolBreakdown segmentos={receitaVendaPorFarol} comissaoPct={receitaResumo.comissaoVendaPct} recorrente={false} />
          </div>

          <div className="card" style={{ flex: 1, minWidth: 280 }}>
            <h2 style={{ fontSize: '0.925rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
              Locação — intermediação, o &quot;1º aluguel&quot; (única)
            </h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Comissão única equivalente a 1 aluguel, cobrada ao fechar um novo contrato de locação.
            </p>
            <FarolBreakdown segmentos={receitaLocacaoIntermediacaoPorFarol} comissaoPct={receitaResumo.comissaoIntermediacaoLocacaoPct} recorrente={false} />
          </div>

          <div className="card" style={{ flex: 1, minWidth: 280 }}>
            <h2 style={{ fontSize: '0.925rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
              Locação — taxa de administração (recorrente/mês)
            </h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Taxa de {(receitaResumo.comissaoLocacaoPct * 100).toFixed(0)}% cobrada todo mês enquanto o contrato já ativo continuar.
            </p>
            <FarolBreakdown segmentos={receitaLocacaoPorFarol} comissaoPct={receitaResumo.comissaoLocacaoPct} recorrente />
          </div>
        </div>

        {/* BY TIPO — VENDA */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '0.925rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1rem' }}>
            Receita Estimada por Tipo — Venda (comissão {(receitaResumo.comissaoVendaPct * 100).toFixed(0)}%)
          </h2>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Qtd. Imóveis</th>
                  <th>Ticket Médio</th>
                  <th>Receita Estimada</th>
                  <th>Participação</th>
                </tr>
              </thead>
              <tbody>
                {receitaVendaPorTipo.map((row) => {
                  const totalReceita = receitaVendaPorTipo.reduce((acc, r) => acc + r.receita_estimada, 0);
                  const pct = totalReceita > 0 ? (row.receita_estimada / totalReceita) * 100 : 0;
                  return (
                    <tr key={row.tipo}>
                      <td className="td-primary" style={{ textTransform: 'capitalize' }}>{row.tipo}</td>
                      <td>{row.count}</td>
                      <td style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(row.ticket_medio)}</td>
                      <td style={{ color: '#22c55e', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        {formatCurrency(row.receita_estimada)}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="progress-track" style={{ width: 80 }}>
                            <div className="progress-fill" style={{ width: `${pct}%`, background: '#6366f1' }} />
                          </div>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{pct.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* BY TIPO — LOCAÇÃO (intermediação + administração juntas) */}
        <div className="card">
          <h2 style={{ fontSize: '0.925rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1rem' }}>
            Receita Estimada por Tipo — Locação (intermediação única + administração {(receitaResumo.comissaoLocacaoPct * 100).toFixed(0)}%/mês)
          </h2>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Qtd. Imóveis</th>
                  <th>Ticket Médio (aluguel/mês)</th>
                  <th>Intermediação (única)</th>
                  <th>Administração (mês)</th>
                </tr>
              </thead>
              <tbody>
                {receitaLocacaoCombinadaPorTipo.map((row) => (
                  <tr key={row.tipo}>
                    <td className="td-primary" style={{ textTransform: 'capitalize' }}>{row.tipo}</td>
                    <td>{row.count}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(row.ticket_medio)}</td>
                    <td style={{ color: '#ec4899', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrency(row.receita_intermediacao)}
                    </td>
                    <td style={{ color: '#a855f7', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrency(row.receita_administracao_mes)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </>
  );
}
