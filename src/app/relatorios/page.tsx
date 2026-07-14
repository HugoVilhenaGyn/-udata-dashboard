'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/layout/Header';
import { FileText, ClipboardList, Download, Link2, Check } from 'lucide-react';
import styles from './page.module.css';
import { useLisaScreenContext } from '@/lib/lisa-context';

interface RelatorioSecao {
  titulo: string;
  texto?: string;
  colunas?: string[];
  linhas?: string[][];
}

interface RelatorioLisa {
  id: string;
  titulo: string;
  tipo: 'qualidade' | 'precificacao' | 'oportunidade' | 'destaques' | 'geral';
  resumo: string;
  secoes: RelatorioSecao[];
  pergunta_origem: string;
  criado_em: string;
  criado_por?: string;
}

const TIPO_LABEL: Record<RelatorioLisa['tipo'], string> = {
  qualidade: 'Qualidade',
  precificacao: 'Precificação',
  oportunidade: 'Oportunidade',
  destaques: 'Destaques',
  geral: 'Geral',
};

export default function RelatoriosPage() {
  return (
    <Suspense fallback={null}>
      <RelatoriosPageContent />
    </Suspense>
  );
}

// useSearchParams() precisa estar dentro de um Suspense boundary pro Next
// conseguir gerar a página estaticamente no build — sem isso o build
// quebra com "should be wrapped in a suspense boundary".
function RelatoriosPageContent() {
  const searchParams = useSearchParams();
  const idNaUrl = searchParams.get('id');
  const [relatorios, setRelatorios] = useState<RelatorioLisa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(idNaUrl);
  const [linkCopiadoId, setLinkCopiadoId] = useState<string | null>(null);

  const copiarLinkPublico = (id: string) => {
    const url = `${window.location.origin}/api/relatorios-publico/${id}/pdf`;
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopiadoId(id);
      setTimeout(() => setLinkCopiadoId(null), 2500);
    });
  };

  useEffect(() => {
    fetch('/api/relatorios')
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          setRelatorios(json.data);
          const existeNaUrl = idNaUrl && json.data.some((r: RelatorioLisa) => r.id === idNaUrl);
          if (existeNaUrl) setSelecionadoId(idNaUrl);
          else if (json.data.length > 0) setSelecionadoId(json.data[0].id);
        }
      })
      .finally(() => setCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selecionado = relatorios.find(r => r.id === selecionadoId) || null;

  useLisaScreenContext({ secao: 'Relatórios', detalhe: selecionadoId ? `Relatório aberto: ${selecionadoId}` : undefined });

  return (
    <>
      <Header
        title="Relatórios"
        subtitle="Relatórios estruturados gerados pela Lisa, salvos para conferência"
      />
      <div className="page-body animate-fadeIn">
        {carregando ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Carregando...</div>
        ) : relatorios.length === 0 ? (
          <div className="card">
            <div className={styles.emptyState}>
              <ClipboardList size={28} style={{ marginBottom: 10, opacity: 0.5 }} />
              <div>Nenhum relatório gerado ainda.</div>
              <div style={{ marginTop: 4 }}>
                Peça pra Lisa, no Orquestrador IA, algo como &quot;me dê um relatório de qualidade dos anúncios&quot; —
                os relatórios que ela gerar aparecem aqui.
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.layout}>
            <div className={`card ${styles.listCard}`}>
              {relatorios.map(r => (
                <button
                  key={r.id}
                  className={`${styles.listItem} ${r.id === selecionadoId ? styles.listItemActive : ''}`}
                  onClick={() => setSelecionadoId(r.id)}
                >
                  <div className={styles.listItemTitulo}>{r.titulo}</div>
                  <div className={styles.listItemMeta}>
                    <span className={styles.tipoBadge}>{TIPO_LABEL[r.tipo]}</span>
                    <span>{new Date(r.criado_em).toLocaleDateString('pt-BR')}</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="card">
              {selecionado && (
                <>
                  <div className={styles.detailHeader}>
                    <div>
                      <div className={styles.detailTitulo}>{selecionado.titulo}</div>
                      <div className={styles.detailMeta}>
                        {new Date(selecionado.criado_em).toLocaleString('pt-BR')}
                        {selecionado.criado_por ? ` · gerado por ${selecionado.criado_por}` : ''}
                        {' · pergunta original: '}&quot;{selecionado.pergunta_origem}&quot;
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <span className={styles.tipoBadge}>{TIPO_LABEL[selecionado.tipo]}</span>
                      <a
                        href={`/api/relatorios/${selecionado.id}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary"
                        style={{ fontSize: '0.72rem', gap: 5, padding: '0.35rem 0.6rem' }}
                        title="Baixar PDF com a identidade visual da Lobo Imóveis"
                      >
                        <Download size={12} /> Baixar PDF
                      </a>
                      {selecionado.tipo === 'precificacao' && (
                        <button
                          onClick={() => copiarLinkPublico(selecionado.id)}
                          className="btn btn-secondary"
                          style={{ fontSize: '0.72rem', gap: 5, padding: '0.35rem 0.6rem' }}
                          title="Copiar link do PDF pra mandar direto pro proprietário (sem precisar logar)"
                        >
                          {linkCopiadoId === selecionado.id ? <Check size={12} /> : <Link2 size={12} />}
                          {linkCopiadoId === selecionado.id ? 'Link copiado!' : 'Link pro proprietário'}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className={styles.resumoBox}>
                    <FileText size={13} style={{ display: 'inline', marginRight: 6, verticalAlign: -2, color: '#818cf8' }} />
                    {selecionado.resumo}
                  </div>

                  {selecionado.secoes.map((secao, idx) => (
                    <div key={idx} className={styles.secao}>
                      <div className={styles.secaoTitulo}>{secao.titulo}</div>
                      {secao.texto && <div className={styles.secaoTexto}>{secao.texto}</div>}
                      {secao.colunas && secao.colunas.length > 0 && secao.linhas && (
                        <div className="table-container">
                          <table className="table">
                            <thead>
                              <tr>
                                {secao.colunas.map((c, ci) => <th key={ci}>{c}</th>)}
                              </tr>
                            </thead>
                            <tbody>
                              {secao.linhas.map((linha, li) => (
                                <tr key={li}>
                                  {linha.map((cel, ci) => <td key={ci} style={{ fontSize: '0.8rem' }}>{cel}</td>)}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
