'use client';

import Header from '@/components/layout/Header';
import KpiCard from '@/components/ui/KpiCard';
import FarolPieChart from '@/components/charts/FarolPieChart';
import LeadsChart from '@/components/charts/LeadsChart';
import RevenueChart from '@/components/charts/RevenueChart';
import FarolBadge from '@/components/ui/FarolBadge';
import QualityBar from '@/components/ui/QualityBar';
import {
  mockKPIs, mockImoveis, mockWeeklyMetrics, mockRevenueData, mockCargasXML,
  mockImobiliaria, receitaResumo, formatCurrency, formatNumber,
} from '@/lib/mock-data';
import {
  Building2, Users, Eye, TrendingUp, Star, FileCode2, Zap, AlertCircle, CheckCircle2, Clock, KeyRound, Handshake,
} from 'lucide-react';
import styles from './page.module.css';

export default function HomePage() {
  const topImoveis = [...mockImoveis]
    .sort((a, b) => b.nota_qualidade - a.nota_qualidade)
    .slice(0, 6);

  const imoveisAlerta = [...mockImoveis]
    .filter(i => i.nota_qualidade < 5)
    .slice(0, 5);

  return (
    <>
      <Header
        title="Visão Geral"
        subtitle={`${mockImobiliaria.nome} · Julho 2026`}
      />
      <div className="page-body animate-fadeIn">

        {/* KPI GRID */}
        <div className="kpi-grid stagger">
          <KpiCard
            title="Total de Imóveis"
            value={formatNumber(mockKPIs.total_imoveis)}
            change={4.2}
            icon={Building2}
            iconColor="#6366f1"
          />
          <KpiCard
            title="Leads no Mês"
            value={formatNumber(mockKPIs.leads_mes)}
            change={12.8}
            icon={Users}
            iconColor="#22c55e"
          />
          <KpiCard
            title="Visualizações"
            value={formatNumber(mockKPIs.visualizacoes_mes)}
            change={8.3}
            icon={Eye}
            iconColor="#f59e0b"
          />
          <KpiCard
            title="Comissão Venda (inferida)"
            value={formatCurrency(receitaResumo.comissaoInferidaVenda)}
            change={6.1}
            icon={TrendingUp}
            iconColor="#a78bfa"
            accent
            subtitle={`5% sobre ${receitaResumo.qtdVenda} imóveis à venda, ponderado pela liquidez de cada um`}
          />
          <KpiCard
            title="Intermediação Locação (inferida)"
            value={formatCurrency(receitaResumo.comissaoInferidaIntermediacaoLocacao)}
            icon={Handshake}
            iconColor="#ec4899"
            subtitle={`1x o 1º aluguel sobre ${receitaResumo.qtdLocacao} imóveis — receita única, ao fechar o contrato`}
          />
          <KpiCard
            title="Taxa Locação (inferida/mês)"
            value={`${formatCurrency(receitaResumo.comissaoInferidaLocacaoMensal)}/mês`}
            icon={KeyRound}
            iconColor="#a855f7"
            subtitle={`10%/mês sobre ${receitaResumo.qtdLocacao} imóveis alugados — receita recorrente, não pontual`}
          />
          <KpiCard
            title="Nota Média Anúncios"
            value={`${mockKPIs.nota_qualidade_media}/10`}
            change={5.4}
            icon={Star}
            iconColor="#fbbf24"
            subtitle={`${mockImoveis.filter(i => i.nota_qualidade >= 8.5).length} imóveis com nota excelente`}
          />
          <KpiCard
            title="XMLs Processados"
            value={formatNumber(mockKPIs.xml_processados_mes)}
            icon={FileCode2}
            iconColor="#34d399"
            subtitle="Este mês · 6 portais"
          />
          <KpiCard
            title="Destaques Ativos"
            value={formatNumber(mockKPIs.imoveis_com_destaque)}
            icon={Zap}
            iconColor="#fb923c"
            subtitle={`${mockKPIs.portais_ativos} portais ativos`}
          />
          <KpiCard
            title="Venda Iminente"
            value={formatNumber(mockKPIs.imoveis_venda_iminente)}
            change={9.5}
            icon={TrendingUp}
            iconColor="#22c55e"
            subtitle={`${((mockKPIs.imoveis_venda_iminente / mockKPIs.total_imoveis) * 100).toFixed(0)}% do portfólio`}
          />
        </div>

        {/* CHARTS ROW */}
        <div className={styles.chartsGrid}>
          <div className="card">
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Leads &amp; Visualizações</h2>
              <span className={styles.badge}>Últimas 7 semanas</span>
            </div>
            <LeadsChart data={mockWeeklyMetrics} />
          </div>

          <div className="card">
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Farol de Oportunidade (Venda)</h2>
              <span className={styles.badge}>
                {mockKPIs.imoveis_venda_iminente + mockKPIs.imoveis_venda_potencial + mockKPIs.imoveis_baixo_potencial} imóveis à venda
              </span>
            </div>
            <FarolPieChart kpis={mockKPIs} />
            <div className={styles.farolStats}>
              <div className={styles.farolStat}>
                <span className={styles.farolDot} style={{ background: '#22c55e' }} />
                <span className={styles.farolLabel}>Venda Iminente</span>
                <span className={styles.farolValue}>{mockKPIs.imoveis_venda_iminente}</span>
              </div>
              <div className={styles.farolStat}>
                <span className={styles.farolDot} style={{ background: '#f59e0b' }} />
                <span className={styles.farolLabel}>Venda Potencial</span>
                <span className={styles.farolValue}>{mockKPIs.imoveis_venda_potencial}</span>
              </div>
              <div className={styles.farolStat}>
                <span className={styles.farolDot} style={{ background: '#ef4444' }} />
                <span className={styles.farolLabel}>Baixo Potencial</span>
                <span className={styles.farolValue}>{mockKPIs.imoveis_baixo_potencial}</span>
              </div>
            </div>
          </div>
        </div>

        {/* REVENUE CHART */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Receita Projetada vs. Inferida</h2>
            <span className={styles.badge}>Jan–Jul 2026</span>
          </div>
          <RevenueChart data={mockRevenueData} />
        </div>

        {/* BOTTOM ROW */}
        <div className={styles.bottomGrid}>
          {/* Top imóveis por qualidade */}
          <div className="card">
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Top Imóveis por Qualidade</h2>
            </div>
            <div className={styles.imovelList}>
              {topImoveis.map((imovel) => (
                <div key={imovel.id} className={styles.imovelRow}>
                  <div className={styles.imovelInfo}>
                    <span className={styles.imovelTitulo}>{imovel.titulo}</span>
                    <span className={styles.imovelBairro}>
                      {imovel.bairro} · {formatCurrency(imovel.preco_atual)}{imovel.finalidade === 'aluguel' ? '/mês' : ''}
                    </span>
                  </div>
                  <div className={styles.imovelQuality}>
                    <FarolBadge status={imovel.status_farol} finalidade={imovel.finalidade} size="sm" />
                    <QualityBar score={imovel.nota_qualidade} size="sm" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Alertas de qualidade */}
          <div className="card">
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Alertas de Qualidade</h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--farol-baixo)' }}>{imoveisAlerta.length} imóveis críticos</span>
            </div>
            <div className={styles.alertList}>
              {imoveisAlerta.map((imovel) => (
                <div key={imovel.id} className={styles.alertRow}>
                  <AlertCircle size={14} color="#ef4444" style={{ flexShrink: 0 }} />
                  <div className={styles.alertInfo}>
                    <span className={styles.alertTitulo}>{imovel.titulo}</span>
                    <span className={styles.alertSub}>
                      {imovel.criterios_qualidade.filter(c => !c.presente).map(c => c.label).join(', ')}
                    </span>
                  </div>
                  <span style={{ color: '#ef4444', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0 }}>
                    {imovel.nota_qualidade.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>

            {/* XML Status */}
            <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
              <div className={styles.sectionHeader} style={{ marginBottom: '0.625rem' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Cargas XML recentes</span>
              </div>
              {mockCargasXML.map((carga) => (
                <div key={carga.id} className={styles.cargaRow}>
                  {carga.status === 'concluido' ? (
                    <CheckCircle2 size={13} color="#22c55e" />
                  ) : carga.status === 'processando' ? (
                    <Clock size={13} color="#f59e0b" />
                  ) : (
                    <AlertCircle size={13} color="#ef4444" />
                  )}
                  <span className={styles.cargaPortal}>{carga.portal.toUpperCase()}</span>
                  <span className={styles.cargaInfo}>{carga.imoveis_processados}/{carga.imoveis_total} imóveis</span>
                  <span className={styles.cargaStatus} style={{
                    color: carga.status === 'concluido' ? '#22c55e' : carga.status === 'processando' ? '#f59e0b' : '#ef4444',
                  }}>
                    {carga.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
