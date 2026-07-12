'use client';

import { useState, useMemo } from 'react';
import Header from '@/components/layout/Header';
import FarolBadge from '@/components/ui/FarolBadge';
import QualityBar from '@/components/ui/QualityBar';
import { mockImoveis, formatCurrency, formatNumber, codigoImovel } from '@/lib/mock-data';
import { FarolStatus, ImovelTipo } from '@/lib/types';
import {
  Search, SlidersHorizontal, Download, Eye, Users, Calendar, ChevronUp, ChevronDown, Star, AlertTriangle,
} from 'lucide-react';
import styles from './page.module.css';

type SortField = 'nota_qualidade' | 'preco_atual' | 'dias_no_mercado' | 'leads_semana';
type SortDir = 'asc' | 'desc';

const portalColors: Record<string, string> = {
  olx: '#6a1faf', zap: '#ff5a00', vivareal: '#0066cc',
  chaves: '#e11d48', imovelweb: '#059669', meta: '#1877f2',
};

export default function InventarioPage() {
  const [search, setSearch] = useState('');
  const [farolFilter, setFarolFilter] = useState<FarolStatus | 'all'>('all');
  const [tipoFilter, setTipoFilter] = useState<ImovelTipo | 'all'>('all');
  const [sortField, setSortField] = useState<SortField>('nota_qualidade');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const PER_PAGE = 20;

  const exportarXML = (imoveis: typeof mockImoveis) => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ListingDataFeed>
  <Header>
    <Provider>BrokerImobAI</Provider>
    <ListingCount>${imoveis.length}</ListingCount>
    <Timestamp>${new Date().toISOString()}</Timestamp>
  </Header>
  <Listings>
${imoveis.map(i => `    <Listing>
      <ListingID>${i.id_externo}</ListingID>
      <Title>${i.titulo}</Title>
      <BusinessType>${i.finalidade === 'venda' ? 'For Sale' : 'For Rent'}</BusinessType>
      <Location>
        <Address>${i.endereco}</Address>
        <City>${i.cidade}</City>
        <State>${i.uf}</State>
        <Neighborhood>${i.bairro}</Neighborhood>
      </Location>
      <Details>
        <PropertyType>Residential/${i.tipo}</PropertyType>
        <NumBedrooms>${i.quartos}</NumBedrooms>
        <NumBathrooms>${i.banheiros}</NumBathrooms>
        <NumGarages>${i.vagas}</NumGarages>
        <Area>
          <UsableArea>${i.area_util}</UsableArea>
        </Area>
      </Details>
      <ListPrice currency="BRL">${i.preco_atual}</ListPrice>
      <Description>${i.descricao.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</Description>
    </Listing>`).join('\n')}
  </Listings>
</ListingDataFeed>`;

    const blob = new Blob([xml], { type: 'text/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventario_udata_${new Date().toISOString().split('T')[0]}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = useMemo(() => {
    let items = [...mockImoveis];
    if (farolFilter !== 'all') items = items.filter(i => i.status_farol === farolFilter);
    if (tipoFilter !== 'all') items = items.filter(i => i.tipo === tipoFilter);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(i =>
        i.titulo.toLowerCase().includes(q) ||
        i.bairro.toLowerCase().includes(q) ||
        i.id_externo.toLowerCase().includes(q)
      );
    }
    items.sort((a, b) => {
      let va: number, vb: number;
      if (sortField === 'nota_qualidade') { va = a.nota_qualidade; vb = b.nota_qualidade; }
      else if (sortField === 'preco_atual') { va = a.preco_atual; vb = b.preco_atual; }
      else if (sortField === 'dias_no_mercado') { va = a.metricas.dias_no_mercado; vb = b.metricas.dias_no_mercado; }
      else { va = a.metricas.leads_semana; vb = b.metricas.leads_semana; }
      return sortDir === 'asc' ? va - vb : vb - va;
    });
    return items;
  }, [search, farolFilter, tipoFilter, sortField, sortDir]);

  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>↕</span>;
    return sortDir === 'desc' ? <ChevronDown size={12} color="#6366f1" /> : <ChevronUp size={12} color="#6366f1" />;
  }

  return (
    <>
      <Header title="Inventário" subtitle={`${mockImoveis.length} imóveis no portfólio`} />
      <div className="page-body animate-fadeIn">

        {/* FILTERS */}
        <div className={styles.filterBar}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="input" style={{ paddingLeft: '2rem' }}
              placeholder="Buscar imóvel, bairro, código CRM..."
              value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>

          <select className="select" style={{ width: 150 }} value={farolFilter}
            onChange={e => { setFarolFilter(e.target.value as any); setPage(1); }}>
            <option value="all">Todos os Farois</option>
            <option value="venda_iminente">Venda Iminente</option>
            <option value="venda_potencial">Venda Potencial</option>
            <option value="baixo_potencial">Baixo Potencial</option>
          </select>

          <select className="select" style={{ width: 140 }} value={tipoFilter}
            onChange={e => { setTipoFilter(e.target.value as any); setPage(1); }}>
            <option value="all">Todos os tipos</option>
            <option value="apartamento">Apartamento</option>
            <option value="casa">Casa</option>
            <option value="studio">Studio</option>
            <option value="cobertura">Cobertura</option>
            <option value="comercial">Comercial</option>
          </select>

          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: 'auto' }}>
            {filtered.length} resultados
          </span>
          <button className="btn btn-secondary" style={{ gap: 6 }} onClick={() => exportarXML(filtered)}>
            <Download size={14} /> Exportar XML
          </button>
        </div>

        {/* TABLE */}
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Código / Imóvel</th>
                <th>Bairro</th>
                <th>Tipo</th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('preco_atual')}>
                  <span className={styles.sortable}>Preço <SortIcon field="preco_atual" /></span>
                </th>
                <th>Farol</th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('nota_qualidade')}>
                  <span className={styles.sortable}>Qualidade <SortIcon field="nota_qualidade" /></span>
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('leads_semana')}>
                  <span className={styles.sortable}>Leads/sem <SortIcon field="leads_semana" /></span>
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('dias_no_mercado')}>
                  <span className={styles.sortable}>Dias mercado <SortIcon field="dias_no_mercado" /></span>
                </th>
                <th data-tooltip="Estimado — o CRM não informa em quais portais cada imóvel está publicado; só temos um feed XML consolidado, sem feeds separados por portal.">
                  Portais (estimado)
                </th>
                <th>Destaque</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((imovel) => (
                <tr key={imovel.id}>
                  <td>
                    <div className={styles.imovelCell}>
                      <div className={styles.imovelThumb}>
                        <img src={imovel.fotos[0]} alt="" />
                      </div>
                      <div>
                        <div className="td-primary" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {imovel.titulo}
                        </div>
                        <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-primary)' }}>{codigoImovel(imovel.id_externo)}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontSize: '0.8rem' }}>{imovel.bairro}</td>
                  <td style={{ fontSize: '0.78rem' }}>
                    <div style={{ textTransform: 'capitalize' }}>{imovel.tipo}</div>
                    <div style={{ fontSize: '0.68rem', color: imovel.finalidade === 'aluguel' ? '#f59e0b' : 'var(--text-muted)' }}>
                      {imovel.finalidade === 'aluguel' ? 'Locação' : 'Venda'}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {formatCurrency(imovel.preco_atual)}{imovel.finalidade === 'aluguel' ? '/mês' : ''}
                      {imovel.preco_suspeito && (
                        <AlertTriangle size={12} color="#f59e0b" data-tooltip="Preço muito fora do padrão do segmento — possível erro de cadastro no CRM. Excluído dos cálculos de receita." />
                      )}
                    </div>
                    {imovel.preco_suspeito ? (
                      <div style={{ fontSize: '0.68rem', color: '#f59e0b' }}>
                        ⚠ Revisar no CRM
                      </div>
                    ) : imovel.preco_sugerido_ia && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--primary-hover)' }}>
                        IA: {formatCurrency(imovel.preco_sugerido_ia)}{imovel.finalidade === 'aluguel' ? '/mês' : ''}
                      </div>
                    )}
                  </td>
                  <td><FarolBadge status={imovel.status_farol} finalidade={imovel.finalidade} size="sm" /></td>
                  <td style={{ minWidth: 120 }}>
                    <QualityBar score={imovel.nota_qualidade} size="sm" />
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Users size={12} color="var(--text-muted)" />
                      <span style={{ fontSize: '0.8rem' }}>{imovel.metricas.leads_semana}</span>
                    </div>
                  </td>
                  <td style={{ fontSize: '0.8rem' }}>{imovel.metricas.dias_no_mercado}d</td>
                  <td>
                    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                      {imovel.portais_publicados.map(p => (
                        <span key={p} style={{
                          background: `${portalColors[p]}22`,
                          color: portalColors[p] || 'var(--text-muted)',
                          border: `1px solid ${portalColors[p]}44`,
                          borderRadius: 4,
                          padding: '1px 6px',
                          fontSize: '0.65rem',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                        }}>{p}</span>
                      ))}
                    </div>
                  </td>
                  <td>
                    {imovel.destaque_ativo ? (
                      <span style={{ color: '#fb923c', fontSize: '0.75rem', fontWeight: 600 }}>⚡ Ativo</span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        <div className={styles.pagination}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Página {page} de {totalPages} · {filtered.length} imóveis
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="btn btn-secondary" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              ← Anterior
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pg = page <= 3 ? i + 1 : page - 2 + i;
              if (pg > totalPages) return null;
              return (
                <button
                  key={pg}
                  className={`btn ${pg === page ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setPage(pg)}
                  style={{ minWidth: 36 }}
                >{pg}</button>
              );
            })}
            <button className="btn btn-secondary" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              Próximo →
            </button>
          </div>
        </div>

      </div>
    </>
  );
}
