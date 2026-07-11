'use client';

import { useState, useMemo } from 'react';
import Header from '@/components/layout/Header';
import FarolBadge from '@/components/ui/FarolBadge';
import QualityBar from '@/components/ui/QualityBar';
import { mockImoveis, formatCurrency, formatNumber } from '@/lib/mock-data';
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
                <div className={styles.farolCardDesc}>{cfg.descriptionAluguel}</di