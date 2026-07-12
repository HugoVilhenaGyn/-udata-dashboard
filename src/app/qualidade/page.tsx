'use client';

import { useState, useMemo } from 'react';
import Header from '@/components/layout/Header';
import QualityBar from '@/components/ui/QualityBar';
import FarolBadge from '@/components/ui/FarolBadge';
import { mockImoveis, formatCurrency, qualidadeColor, codigoImovel } from '@/lib/mock-data';
import { Imovel, CriterioQualidade } from '@/lib/types';
import {
  Star, CheckCircle2, XCircle, AlertCircle, ChevronDown, ChevronUp, Wand2, MapPin,
  DollarSign, FileText, Image, Video, Tag, Ruler,
} from 'lucide-react';
import styles from './page.module.css';

const criterioIcons: Record<string, any> = {
  endereco: MapPin, preco: DollarSign, descricao: FileText,
  fotos: Image, video: Video, titulo: Tag, area: Ruler,
};

function CriterioRow({ c }: { c: CriterioQualidade }) {
  const Icon = criterioIcons[c.id] || Star;
  return (
    <div className={`${styles.criterioRow} ${!c.presente ? styles.criterioMissing : ''}`}>
      <div className={styles.criterioIcon}>
        {c.presente
          ? <CheckCircle2 size={14} color="#22c55e" />
          : <XCircle size={14} color="#ef4444" />}
      </div>
      <div className={styles.criterioInfo}>
        <div className={styles.criterioLabel}>
          <Icon size={12} />
          {c.label}
        </div>
        {c.sugestao && <div className={styles.criterioSugestao}>💡 {c.sugestao}</div>}
      </div>
      <div className={styles.criterioPontos} style={{ color: c.presente ? '#22c55e' : '#ef4444' }}>
        +{c.peso.toFixed(1)} pts
      </div>
    </div>
  );
}

export default function QualidadePage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'critico' | 'ok'>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  // Cópia local editável dos imóveis — o "Enriquecer automaticamente" atualiza
  // esse estado (mockImoveis é compartilhado entre páginas e não deve ser mutado).
  const [imoveis, setImoveis] = useState<Imovel[]>(mockImoveis);
  const [enriquecendo, setEnriquecendo] = useState<string | null>(null);

  const enriquecerImovel = (id: string) => {
    setEnriquecendo(id);
    setTimeout(() => {
      setImoveis(prev => prev.map(imovel => {
        if (imovel.id !== id) return imovel;
        const novosCriterios = imovel.criterios_qualidade.map(c =>
          c.presente ? c : { ...c, presente: true, pontos: c.peso, sugestao: undefined }
        );
        const novaNota = parseFloat(novosCriterios.reduce((acc, c) => acc + c.pontos, 0).toFixed(1));
        return {
          ...imovel,
          criterios_qualidade: novosCriterios,
          nota_qualidade: novaNota,
          descricao_enriquecida: imovel.descricao_enriquecida || imovel.descricao,
        };
      }));
      setEnriquecendo(null);
    }, 900);
  };

  const filtered = useMemo(() => {
    let items = [...imoveis].sort((a, b) => a.nota_qualidade - b.nota_qualidade);
    if (filter === 'critico') items = items.filter(i => i.nota_qualidade < 6);
    if (filter === 'ok') items = items.filter(i => i.nota_qualidade >= 8);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(i => i.titulo.toLowerCase().includes(q) || i.bairro.toLowerCase().includes(q));
    }
    return items;
  }, [search, filter, imoveis]);

  // Distribution
  const excellent = imoveis.filter(i => i.nota_qualidade >= 8.5).length;
  const good = imoveis.filter(i => i.nota_qualidade >= 7 && i.nota_qualidade < 8.5).length;
  const average = imoveis.filter(i => i.nota_qualidade >= 5 && i.nota_qualidade < 7).length;
  const poor = imoveis.filter(i => i.nota_qualidade < 5).length;
  const total = imoveis.length;

  return (
    <>
      <Header title="Qualidade de Anúncios" subtitle="Análise e enriquecimento por critério" />
      <div className="page-body animate-fadeIn">

        {/* DISTRIBUTION */}
        <div className={styles.distributionGrid}>
          {[
            { label: 'Excelente', count: excellent, color: '#22c55e', range: '8.5–10' },
            { label: 'Bom', count: good, color: '#84cc16', range: '7–8.4' },
            { label: 'Regular', count: average, color: '#f59e0b', range: '5–6.9' },
            { label: 'Crítico', count: poor, color: '#ef4444', range: '0–4.9' },
          ].map(({ label, count, color, range }) => (
            <div key={label} className={styles.distCard} style={{ borderColor: `${color}30` }}>
              <div className={styles.distCount} style={{ color }}>{count}</div>
              <div className={styles.distLabel}>{label}</div>
              <div className={styles.distRange}>{range} pts · {((count / total) * 100).toFixed(0)}%</div>
              <div className="progress-track" style={{ marginTop: 8 }}>
                <div className="progress-fill" style={{ width: `${(count / total) * 100}%`, background: color }} />
              </div>
            </div>
          ))}
        </div>

        {/* FILTERS */}
        <div className={styles.filterRow}>
          <input
            className="input" style={{ maxWidth: 300 }}
            placeholder="Buscar imóvel..."
            value={search} onChange={e => setSearch(e.target.value)}
          />
          <div className={styles.filterBtns}>
            {(['all', 'critico', 'ok'] as const).map(f => (
              <button
                key={f}
                className={`btn ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilter(f)}
                style={{ fontSize: '0.8rem' }}
              >
                {f === 'all' ? 'Todos' : f === 'critico' ? '🔴 Críticos' : '✅ Excelentes'}
              </button>
            ))}
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: 'auto' }}>{filtered.length} imóveis</span>
        </div>

        {/* IMOVEL LIST */}
        <div className={styles.imovelList}>
          {filtered.map((imovel) => {
            const isOpen = expanded === imovel.id;
            const missing = imovel.criterios_qualidade.filter(c => !c.presente);
            const ganho_potencial = missing.reduce((acc, c) => acc + c.peso, 0);

            return (
              <div key={imovel.id} className={styles.imovelCard}>
                {/* Header */}
                <button
                  className={styles.imovelHeader}
                  onClick={() => setExpanded(isOpen ? null : imovel.id)}
                >
                  <div className={styles.imovelThumb}>
                    <img src={imovel.fotos[0]} alt="" />
                  </div>

                  <div className={styles.imovelMeta}>
                    <div className={styles.imovelTitle}>
                      {imovel.titulo}
                      <span style={{ marginLeft: 8, fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {codigoImovel(imovel.id_externo)}
                      </span>
                    </div>
                    <div className={styles.imovelSub}>
                      {imovel.bairro} · {formatCurrency(imovel.preco_atual)}
                      {imovel.finalidade === 'aluguel' ? '/mês' : ''}
                      {imovel.preco_suspeito && (
                        <span style={{ color: '#f59e0b', marginLeft: 6 }} data-tooltip="Preço fora do padrão do segmento — possível erro de cadastro no CRM">
                          ⚠ preço a revisar
                        </span>
                      )}
                    </div>
                  </div>

                  <FarolBadge status={imovel.status_farol} finalidade={imovel.finalidade} size="sm" />

                  <div className={styles.scoreBlock}>
                    <span className={styles.scoreNum} style={{ color: qualidadeColor(imovel.nota_qualidade) }}>
                      {imovel.nota_qualidade.toFixed(1)}
                    </span>
                    <span className={styles.scoreDen}>/10</span>
                  </div>

                  <div className={styles.barBlock}>
                    <QualityBar score={imovel.nota_qualidade} size="md" />
                  </div>

                  {missing.length > 0 && (
                    <div className={styles.gainBadge}>
                      <Wand2 size={11} />
                      +{ganho_potencial.toFixed(1)} pts possíveis
                    </div>
                  )}

                  <div className={styles.criterioSummary}>
                    {imovel.criterios_qualidade.map(c => (
                      <span
                        key={c.id}
                        className={styles.criterioMiniDot}
                        style={{ background: c.presente ? '#22c55e' : '#ef4444' }}
                        title={c.label}
                      />
                    ))}
                  </div>

                  {isOpen ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
                </button>

                {/* Expanded criterios */}
                {isOpen && (
                  <div className={styles.criteriosList}>
                    <div className={styles.criteriosGrid}>
                      {imovel.criterios_qualidade.map(c => <CriterioRow key={c.id} c={c} />)}
                    </div>

                    {missing.length > 0 && (
                      <div className={styles.enrichAction}>
                        <div className={styles.enrichInfo}>
                          <AlertCircle size={14} color="#f59e0b" />
                          <span>{missing.length} critérios faltando · potencial de +{ganho_potencial.toFixed(1)} pontos na nota</span>
                        </div>
                        <button
                          className="btn btn-primary"
                          style={{ fontSize: '0.8rem' }}
                          disabled={enriquecendo === imovel.id}
                          onClick={() => enriquecerImovel(imovel.id)}
                        >
                          <Wand2 size={13} />
                          {enriquecendo === imovel.id ? 'Enriquecendo...' : 'Enriquecer automaticamente'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </>
  );
}
