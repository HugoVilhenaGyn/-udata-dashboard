'use client';

import { useState, useMemo } from 'react';
import Header from '@/components/layout/Header';
import FarolBadge from '@/components/ui/FarolBadge';
import QualityBar from '@/components/ui/QualityBar';
import { mockImoveis, formatCurrency, formatNumber, codigoImovel } from '@/lib/mock-data';
import { FarolStatus, ImovelTipo, ImovelFinalidade } from '@/lib/types';
import {
  Lightbulb, TrendingUp, Clock, TrendingDown, Filter, Eye, Users, ArrowUpRight, ChevronRight,
} from 'lucide-react';
import styles from './page.module.css';

// Venda e locação usam o mesmo indicador de liquidez, mas com rótulos e
// descrições diferentes — "Venda Iminente" não faz sentido para um imóvel
// de aluguel. O cálculo em si (preço vs. média de mercado do mesmo segmento
// finalidade+tipo) já respeita essa separação na geração dos dados.
const FAROL_CONFIG = {
  venda_iminente: {
    label: 'Venda Iminente',
    description: 'Preço competitivo + boa liquidez de mercado. Alta probabilidade de conversão.',
    labelAluguel: 'Locação Iminente',
    descriptionAluguel: 'Aluguel competitivo em relação a imóveis similares. Alta probabilidade de fechamento rápido.',
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.08)',
    border: 'rgba(34,197,94,0.2)',
    icon: TrendingUp,
  },
  venda_potencial: {
    label: 'Venda Potencial',
    description: 'Preço dentro do mercado, liquidez média. Potencial de venda com ajustes.',
    labelAluguel: 'Locação Potencial',
    descriptionAluguel: 'Aluguel dentro da média do bairro/tipo. Potencial de locação com pequenos ajustes.',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.2)',
    icon: Clock,
  },
  baixo_potencial: {
    label: 'Baixo Potencial',
    description: 'Preço acima do mercado ou baixa liquidez. Recomenda-se revisão de preço.',
    labelAluguel: 'Baixo Potencial (Locação)',
    descriptionAluguel: 'Aluguel acima da média de imóveis similares. Recomenda-se revisão de valor.',
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.08)',
    border: 'rgba(239,68,68,0.2)',
    icon: TrendingDown,
  },
};

export default function FarolPage() {
  const [selectedStatus, setSelectedStatus] = useState<FarolStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [tipoFilter, setTipoFilter] = useState<ImovelTipo | 'all'>('all');
  // Venda e locação têm faixas de preço muito diferentes (ex: aluguel de
  // R$ 1.500 vs venda de R$ 500.000) — misturar as duas sem distinção
  // deixaria a clusterização de preço × liquidez sem sentido. Antes o
  // padrão era mostrar só "Venda" e a Locação ficava escondida atrás de um
  // toggle — os dois farois (venda e locação) agora ficam sempre visíveis
  // ao mesmo tempo, cada um com seus 3 cards reais, sem precisar alternar.
  const [finalidadeFilter, setFinalidadeFilter] = useState<ImovelFinalidade | 'all'>('all');

  const imoveisVenda = useMemo(() => mockImoveis.filter(i => i.finalidade === 'venda'), []);
  const imoveisLocacao = useMemo(() => mockImoveis.filter(i => i.finalidade === 'aluguel'), []);

  const countsVenda = useMemo(() => ({
    venda_iminente: imoveisVenda.filter(i => i.status_farol === 'venda_iminente').length,
    venda_potencial: imoveisVenda.filter(i => i.status_farol === 'venda_potencial').length,
    baixo_potencial: imoveisVenda.filter(i => i.status_farol === 'baixo_potencial').length,
  }), [imoveisVenda]);

  const countsLocacao = useMemo(() => ({
    venda_iminente: imoveisLocacao.filter(i => i.status_farol === 'venda_iminente').length,
    venda_potencial: imoveisLocacao.filter(i => i.status_farol === 'venda_potencial').length,
    baixo_potencial: imoveisLocacao.filter(i => i.status_farol === 'baixo_potencial').length,
  }), [imoveisLocacao]);

  const escopo = useMemo(() => (
    finalidadeFilter === 'all' ? mockImoveis : mockImoveis.filter(i => i.finalidade === finalidadeFilter)
  ), [finalidadeFilter]);

  // Clica em um card do Farol de Venda ou de Locação: filtra a grade abaixo
  // por aquela finalidade + status específicos, de forma explícita.
  const selecionarCard = (finalidade: ImovelFinalidade, status: FarolStatus) => {
    const jaSelecionado = finalidadeFilter === finalidade && selectedStatus === status;
    setFinalidadeFilter(jaSelecionado ? 'all' : finalidade);
    setSelectedStatus(jaSelecionado ? 'all' : status);
  };

  const filtered = useMemo(() => {
    return escopo.filter(i => {
      if (selectedStatus !== 'all' && i.status_farol !== selectedStatus) return false;
      if (tipoFilter !== 'all' && i.tipo !== tipoFilter) return false;
      if (search && !i.titulo.toLowerCase().includes(search.toLowerCase()) &&
          !i.bairro.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [escopo, selectedStatus, search, tipoFilter]);

  return (
    <>
      <Header
        title="Farol de Oportunidade"
        subtitle="Clusterização por preço × liquidez de mercado"
      />
      <div className="page-body animate-fadeIn">

        {/* FAROL DE VENDA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.75rem' }}>
          <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>Farol de Venda</h2>
          <span className="badge badge-primary" style={{ fontSize: '0.68rem' }}>{imoveisVenda.length} imóveis à venda</span>
        </div>
        <div className={styles.farolCards}>
          {(['venda_iminente', 'venda_potencial', 'baixo_potencial'] as FarolStatus[]).map((status) => {
            const cfg = FAROL_CONFIG[status];
            const Icon = cfg.icon;
            const isSelected = finalidadeFilter === 'venda' && selectedStatus === status;
            return (
              <button
                key={status}
                className={`${styles.farolCard} ${isSelected ? styles.farolCardSelected : ''}`}
                style={{
                  borderColor: isSelected ? cfg.color : undefined,
                  background: isSelected ? cfg.bg : undefined,
                }}
                onClick={() => selecionarCard('venda', status)}
              >
                <div className={styles.farolCardHeader}>
                  <div className={styles.farolCardIcon} style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                    <Icon size={18} color={cfg.color} />
                  </div>
                  <span className={styles.farolCardCount} style={{ color: cfg.color }}>
                    {countsVenda[status]}
                  </span>
                </div>
                <div className={styles.farolCardTitle} style={{ color: cfg.color }}>{cfg.label}</div>
                <div className={styles.farolCardDesc}>{cfg.description}</div>
                <div className={styles.farolCardPct}>
                  {imoveisVenda.length > 0 ? ((countsVenda[status] / imoveisVenda.length) * 100).toFixed(0) : 0}% do portfólio à venda
                </div>
              </button>
            );
          })}
        </div>

        {/* FAROL DE LOCAÇÃO */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '1.5rem 0 0.75rem' }}>
          <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>Farol de Locação</h2>
          <span className="badge badge-primary" style={{ fontSize: '0.68rem' }}>{imoveisLocacao.length} imóveis para locação</span>
        </div>
        <div className={styles.farolCards}>
          {(['venda_iminente', 'venda_potencial', 'baixo_potencial'] as FarolStatus[]).map((status) => {
            const cfg = FAROL_CONFIG[status];
            const Icon = cfg.icon;
            const isSelected = finalidadeFilter === 'aluguel' && selectedStatus === status;
            return (
              <button
                key={status}
                className={`${styles.farolCard} ${isSelected ? styles.farolCardSelected : ''}`}
                style={{
                  borderColor: isSelected ? cfg.color : undefined,
                  background: isSelected ? cfg.bg : undefined,
                }}
                onClick={() => selecionarCard('aluguel', status)}
              >
                <div className={styles.farolCardHeader}>
                  <div className={styles.farolCardIcon} style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                    <Icon size={18} color={cfg.color} />
                  </div>
                  <span className={styles.farolCardCount} style={{ color: cfg.color }}>
                    {countsLocacao[status]}
                  </span>
                </div>
                <div className={styles.farolCardTitle} style={{ color: cfg.color }}>{cfg.labelAluguel}</div>
                <div className={styles.farolCardDesc}>{cfg.descriptionAluguel}</div>
                <div className={styles.farolCardPct}>
                  {imoveisLocacao.length > 0 ? ((countsLocacao[status] / imoveisLocacao.length) * 100).toFixed(0) : 0}% do portfólio de locação
                </div>
              </button>
            );
          })}
        </div>

        {/* FILTERS */}
        <div className={styles.filters}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
            <Filter size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Buscar por título ou bairro..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input"
              style={{ paddingLeft: '2rem' }}
            />
          </div>
          <div className={styles.filterBtns} style={{ display: 'flex', gap: 6 }}>
            {([
              { v: 'venda', label: 'Venda' },
              { v: 'aluguel', label: 'Locação' },
              { v: 'all', label: 'Todos' },
            ] as { v: ImovelFinalidade | 'all'; label: string }[]).map(opt => (
              <button
                key={opt.v}
                className={`btn ${finalidadeFilter === opt.v ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.8rem' }}
                onClick={() => setFinalidadeFilter(opt.v)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <select
            value={tipoFilter}
            onChange={e => setTipoFilter(e.target.value as any)}
            className="select"
            style={{ width: 160 }}
          >
            <option value="all">Todos os tipos</option>
            <option value="apartamento">Apartamento</option>
            <option value="casa">Casa</option>
            <option value="studio">Studio</option>
            <option value="cobertura">Cobertura</option>
            <option value="comercial">Comercial</option>
          </select>
          <span className={styles.resultCount}>{filtered.length} imóveis</span>
        </div>

        {/* PROPERTY GRID */}
        <div className={`${styles.propertyGrid} stagger`}>
          {filtered.map((imovel) => {
            const cfg = FAROL_CONFIG[imovel.status_farol];
            const diff = imovel.preco_sugerido_ia
              ? ((imovel.preco_atual - imovel.preco_sugerido_ia) / imovel.preco_sugerido_ia) * 100
              : 0;

            return (
              <div
                key={imovel.id}
                className={styles.propertyCard}
                style={{ borderColor: `${cfg.color}25` }}
              >
                {/* Foto */}
                <div className={styles.cardPhoto}>
                  <img src={imovel.fotos[0]} alt={imovel.titulo} className={styles.cardImg} />
                  <div className={styles.cardOverlay}>
                    <FarolBadge status={imovel.status_farol} finalidade={imovel.finalidade} size="sm" />
                    {imovel.destaque_ativo && (
                      <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>⚡ Destaque</span>
                    )}
                  </div>
                  <span className={styles.cardCode}>{codigoImovel(imovel.id_externo)}</span>
                </div>

                {/* Info */}
                <div className={styles.cardBody}>
                  <div className={styles.cardTitle}>{imovel.titulo}</div>
                  <div className={styles.cardBairro}>{imovel.bairro} · {imovel.area_util}m²</div>

                  {/* Price comparison */}
                  <div className={styles.priceRow}>
                    <div>
                      <div className={styles.priceLabel}>
                        {imovel.finalidade === 'aluguel' ? 'Aluguel/mês' : 'Preço atual'}
                      </div>
                      <div className={styles.priceValue}>{formatCurrency(imovel.preco_atual)}</div>
                    </div>
                    {imovel.preco_sugerido_ia && (
                      <div style={{ textAlign: 'right' }}>
                        <div className={styles.priceLabel}>Sugerido IA</div>
                        <div className={styles.priceSugerido}>{formatCurrency(imovel.preco_sugerido_ia)}</div>
                      </div>
                    )}
                  </div>

                  {/* Price diff badge */}
                  {Math.abs(diff) > 1 && (
                    <div className={styles.priceDiff} style={{
                      color: diff > 10 ? '#ef4444' : diff > 0 ? '#f59e0b' : '#22c55e',
                      background: diff > 10 ? 'rgba(239,68,68,0.08)' : diff > 0 ? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.08)',
                    }}>
                      {diff > 0 ? '▲' : '▼'} {Math.abs(diff).toFixed(1)}% vs. média de {imovel.finalidade === 'aluguel' ? 'locação' : 'venda'} do segmento
                    </div>
                  )}

                  {/* Metrics */}
                  <div className={styles.metricsRow}>
                    <div className={styles.metric}>
                      <Eye size={12} />
                      <span>{formatNumber(imovel.metricas.visualizacoes_semana)}</span>
                    </div>
                    <div className={styles.metric}>
                      <Users size={12} />
                      <span>{imovel.metricas.leads_semana} leads</span>
                    </div>
                    <div className={styles.metric}>
                      <Clock size={12} />
                      <span>{imovel.metricas.dias_no_mercado}d</span>
                    </div>
                  </div>

                  {/* Quality */}
                  <QualityBar score={imovel.nota_qualidade} size="sm" />
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </>
  );
}
