'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import { formatCurrency, codigoImovel } from '@/lib/mock-data';
import { useImoveis } from '@/lib/use-imoveis';
import { Imovel } from '@/lib/types';
import { Search, Sparkles, FileText, Loader2, Download, Link2, Check } from 'lucide-react';
import { useLisaScreenContext } from '@/lib/lisa-context';
import styles from './page.module.css';

interface RelatorioResumo {
  id: string;
  titulo: string;
  tipo: string;
  criado_em: string;
}

// Marcador usado no título do relatório pra poder filtrar depois o
// histórico de informativos pedidos por essa tela (ver gerarInformativo
// abaixo). Não existe uma coluna dedicada pra isso no schema — o próprio
// texto do título carrega o código do imóvel. Os informativos automáticos
// de lead usam um prefixo diferente ("Informativo do Imóvel — Lead"), de
// propósito, pra não aparecerem misturados nesse histórico por imóvel.
const PREFIXO_TITULO = 'Informativo do Imóvel — Cód.';

export default function InformativoImovelPage() {
  const { imoveis } = useImoveis();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<Record<string, 'carregando' | 'pronto' | 'erro'>>({});
  const [relatorioIdPorImovel, setRelatorioIdPorImovel] = useState<Record<string, string>>({});
  const [historico, setHistorico] = useState<RelatorioResumo[]>([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(true);
  const [aviso, setAviso] = useState<string | null>(null);
  const [linkCopiadoId, setLinkCopiadoId] = useState<string | null>(null);

  const copiarLinkPublico = (relatorioId: string) => {
    const url = `${window.location.origin}/api/relatorios-publico/${relatorioId}/pdf`;
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopiadoId(relatorioId);
      setTimeout(() => setLinkCopiadoId(null), 2500);
    });
  };

  useLisaScreenContext({ secao: 'Informativo do Imóvel' });

  useEffect(() => {
    fetch('/api/relatorios').then(r => r.json()).then(json => {
      if (json.success) {
        setHistorico(
          (json.data as RelatorioResumo[]).filter((r: RelatorioResumo) => r.titulo.startsWith(PREFIXO_TITULO)).slice(0, 30)
        );
      }
    }).finally(() => setCarregandoHistorico(false));
  }, []);

  const filtrados = useMemo(() => {
    const termo = search.trim().toLowerCase();
    if (!termo) return imoveis.slice(0, 30);
    return imoveis.filter(i =>
      i.titulo.toLowerCase().includes(termo) ||
      i.bairro.toLowerCase().includes(termo) ||
      codigoImovel(i.id_externo).toLowerCase().includes(termo)
    ).slice(0, 30);
  }, [imoveis, search]);

  const gerarInformativo = async (imovel: Imovel) => {
    setStatus(prev => ({ ...prev, [imovel.id]: 'carregando' }));
    try {
      const finalidadeTxt = imovel.finalidade === 'venda' ? 'venda' : 'locação';
      const codigo = codigoImovel(imovel.id_externo);
      const mensagem = `Gere um informativo do imóvel de código ${codigo} da nossa própria carteira (precificação com base no próprio portfólio + diagnóstico de qualidade do anúncio, não uma pesquisa de mercado externa) — "${imovel.titulo}", no bairro "${imovel.bairro}", tipo "${imovel.tipo}", ${imovel.area_util}m²${imovel.quartos ? `, ${imovel.quartos} quartos` : ''}, atualmente anunciado por ${formatCurrency(imovel.preco_atual)} para ${finalidadeTxt}. Use comparaveis_portfolio_por_segmento e comparáveis reais do portfólio nesse bairro/tipo/finalidade pra avaliar se o preço atual desse imóvel está alinhado, abaixo ou acima do próprio portfólio, cite a oferta e demanda reais (quantos comparáveis, leads e visualizações da semana nesse segmento) e feche com uma recomendação prática — manter, reduzir ou reforçar a divulgação. O título do relatório precisa começar exatamente com "${PREFIXO_TITULO} ${codigo}".`;

      const res = await fetch('/api/copiloto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensagem,
          contextoTela: { secao: 'Informativo do Imóvel', detalhe: `Imóvel ${codigo} — ${imovel.titulo}` },
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);

      if (json.data.relatorio?.id) {
        setRelatorioIdPorImovel(prev => ({ ...prev, [imovel.id]: json.data.relatorio.id }));
        setStatus(prev => ({ ...prev, [imovel.id]: 'pronto' }));
        setHistorico(prev => [
          { id: json.data.relatorio.id, titulo: json.data.relatorio.titulo, tipo: json.data.relatorio.tipo, criado_em: new Date().toISOString() },
          ...prev,
        ]);
      } else {
        setStatus(prev => ({ ...prev, [imovel.id]: 'erro' }));
        setAviso('⚠️ A Lisa respondeu, mas não gerou um relatório estruturado dessa vez. Tente novamente.');
        setTimeout(() => setAviso(null), 5000);
      }
    } catch (err: any) {
      setStatus(prev => ({ ...prev, [imovel.id]: 'erro' }));
      setAviso(`⚠️ ${err.message || 'Erro ao pedir o informativo à Lisa.'}`);
      setTimeout(() => setAviso(null), 5000);
    }
  };

  return (
    <>
      <Header
        title="Informativo do Imóvel"
        subtitle="Selecione qualquer imóvel da carteira e peça à Lisa um informativo de precificação (com base no próprio portfólio) e diagnóstico de qualidade do anúncio"
      />

      {aviso && <div className={styles.aviso}>{aviso}</div>}

      <div className={styles.buscaWrap}>
        <Search size={16} className={styles.buscaIcon} />
        <input
          type="text"
          placeholder="Buscar por código, título ou bairro..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={styles.buscaInput}
        />
      </div>

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Imóvel</th>
                <th>Bairro</th>
                <th>Preço atual</th>
                <th>Informativo do Imóvel (Lisa)</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(imovel => {
                const codigo = codigoImovel(imovel.id_externo);
                const st = status[imovel.id];
                const relatorioId = relatorioIdPorImovel[imovel.id];
                return (
                  <tr key={imovel.id}>
                    <td style={{ fontSize: '0.8rem' }}>
                      <div style={{ fontWeight: 600 }}>#{codigo} · {imovel.tipo}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{imovel.titulo}</div>
                    </td>
                    <td style={{ fontSize: '0.8rem' }}>
                      {imovel.bairro}
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {imovel.finalidade === 'venda' ? 'Venda' : 'Locação'} · {imovel.area_util}m²
                      </div>
                    </td>
                    <td style={{ fontSize: '0.82rem', fontWeight: 700 }}>{formatCurrency(imovel.preco_atual)}</td>
                    <td style={{ fontSize: '0.78rem' }}>
                      {st === 'carregando' ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--text-muted)' }}>
                          <Loader2 size={12} className={styles.spin} /> Gerando...
                        </span>
                      ) : st === 'pronto' && relatorioId ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <Link
                            href={`/relatorios?id=${relatorioId}`}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#22c55e', fontWeight: 600, textDecoration: 'none' }}
                          >
                            <FileText size={12} /> Ver relatório
                          </Link>
                          <a
                            href={`/api/relatorios/${relatorioId}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Baixar PDF com a identidade visual da Lobo Imóveis"
                            style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-muted)' }}
                          >
                            <Download size={13} />
                          </a>
                          <button
                            onClick={() => copiarLinkPublico(relatorioId)}
                            title="Copiar link do PDF pra mandar direto pro proprietário"
                            style={{ display: 'inline-flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', color: linkCopiadoId === relatorioId ? '#22c55e' : 'var(--text-muted)' }}
                          >
                            {linkCopiadoId === relatorioId ? <Check size={13} /> : <Link2 size={13} />}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => gerarInformativo(imovel)}
                          className="btn btn-secondary"
                          style={{ fontSize: '0.72rem', gap: 5, padding: '0.35rem 0.6rem' }}
                        >
                          <Sparkles size={12} /> {st === 'erro' ? 'Tentar de novo' : 'Gerar informativo'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    Nenhum imóvel encontrado pra &quot;{search}&quot;.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Informativos já pedidos</h2>
      </div>

      <div className="card">
        {carregandoHistorico ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>Carregando...</div>
        ) : historico.length === 0 ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Nenhum informativo de imóvel pedido ainda.
          </div>
        ) : (
          <div className={styles.historicoLista}>
            {historico.map(r => (
              <Link key={r.id} href={`/relatorios?id=${r.id}`} className={styles.historicoItem}>
                <FileText size={14} />
                <span>{r.titulo}</span>
                <span className={styles.historicoData}>{new Date(r.criado_em).toLocaleDateString('pt-BR')}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
