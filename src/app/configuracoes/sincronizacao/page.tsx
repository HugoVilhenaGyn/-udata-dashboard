'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Save, Loader2, RefreshCw, Plus, X, ArrowUpRight } from 'lucide-react';
import styles from './page.module.css';

interface ConfigSyncFeed {
  habilitado: boolean;
  horarios: string[];
}

interface ConfigSync {
  loft: ConfigSyncFeed;
  zap: ConfigSyncFeed;
}

interface SyncLogEntry {
  id: string;
  feed: 'loft' | 'zap';
  disparado_por: 'agendado' | 'manual';
  executado_em: string;
  status: 'sucesso' | 'erro';
  duracao_ms?: number;
  total_no_feed?: number;
  total_alterados?: number;
  erro_mensagem?: string;
}

const FEED_LABEL: Record<'loft' | 'zap', string> = {
  loft: 'Loft (feed completo — Exibir no site)',
  zap: 'Zap / Grupo OLX (só imóveis "Publicar Zap")',
};

function FeedForm({
  feedKey, feed, onChange,
}: {
  feedKey: 'loft' | 'zap';
  feed: ConfigSyncFeed;
  onChange: (novo: ConfigSyncFeed) => void;
}) {
  const [novoHorario, setNovoHorario] = useState('06:00');

  const adicionarHorario = () => {
    if (feed.horarios.includes(novoHorario)) return;
    onChange({ ...feed, horarios: [...feed.horarios, novoHorario].sort() });
  };

  const removerHorario = (h: string) => {
    onChange({ ...feed, horarios: feed.horarios.filter(x => x !== h) });
  };

  return (
    <div className={styles.feedCard}>
      <div className={styles.feedHeader}>
        <div>
          <div className={styles.feedTitle}>{FEED_LABEL[feedKey]}</div>
          <div className={styles.feedSub}>
            {feed.habilitado ? 'Ativo — roda sozinho nos horários abaixo' : 'Desativado — só roda via "Rodar agora" no Motor de XML'}
          </div>
        </div>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={feed.habilitado}
            onChange={e => onChange({ ...feed, habilitado: e.target.checked })}
          />
          <span className={styles.toggleTrack}><span className={styles.toggleThumb} /></span>
        </label>
      </div>

      <div className={styles.horariosField}>
        <label>Horários de execução (Brasília)</label>
        <div className={styles.chips}>
          {feed.horarios.length === 0 && (
            <span className={styles.chipsEmpty}>Nenhum horário configurado.</span>
          )}
          {feed.horarios.map(h => (
            <span key={h} className={styles.chip}>
              {h}
              <button type="button" onClick={() => removerHorario(h)} aria-label={`Remover horário ${h}`}>
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
        <div className={styles.addHorario}>
          <input
            type="time"
            className="input"
            value={novoHorario}
            onChange={e => setNovoHorario(e.target.value)}
          />
          <button type="button" className="btn btn-secondary" onClick={adicionarHorario} style={{ gap: 6 }}>
            <Plus size={14} /> Adicionar horário
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ConfiguracoesSincronizacaoPage() {
  const [config, setConfig] = useState<ConfigSync | null>(null);
  const [logs, setLogs] = useState<SyncLogEntry[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/config-sync')
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          setConfig(json.data.config);
          setLogs(json.data.logs || []);
        }
      })
      .finally(() => setCarregando(false));
  }, []);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    setSalvando(true);
    try {
      const res = await fetch('/api/config-sync', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setConfig(json.data);
      setAviso('✅ Agendamento salvo. O processo de sincronização já passa a respeitar esses horários.');
    } catch (err: any) {
      setAviso(`⚠️ ${err.message || 'Erro ao salvar agendamento.'}`);
    } finally {
      setSalvando(false);
      setTimeout(() => setAviso(null), 4500);
    }
  };

  if (carregando) {
    return <div className="card"><Loader2 size={16} className={styles.spin} /> Carregando...</div>;
  }
  if (!config) {
    return <div className="card">Não foi possível carregar a configuração de sincronização.</div>;
  }

  return (
    <form onSubmit={salvar}>
      {aviso && <div className={styles.aviso}>{aviso}</div>}

      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className={styles.sectionHeader}>
          <div>
            <div className={styles.sectionTitle}>
              <RefreshCw size={15} style={{ marginRight: 6, verticalAlign: -2 }} />
              Agendamento da sincronização com o Vista CRM
            </div>
            <div className={styles.sectionSub}>
              Define quando os feeds Loft e Zap são buscados automaticamente e o portfólio é atualizado.
              Cada feed é independente — pode ligar um e deixar o outro manual.
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={salvando} style={{ gap: 6 }}>
            {salvando ? <Loader2 size={14} className={styles.spin} /> : <Save size={14} />}
            {salvando ? 'Salvando...' : 'Salvar agendamento'}
          </button>
        </div>

        <div className={styles.feedsGrid}>
          <FeedForm feedKey="loft" feed={config.loft} onChange={novo => setConfig({ ...config, loft: novo })} />
          <FeedForm feedKey="zap" feed={config.zap} onChange={novo => setConfig({ ...config, zap: novo })} />
        </div>
      </div>

      <div className="card">
        <div className={styles.sectionHeader}>
          <div>
            <div className={styles.sectionTitle}>Últimas execuções</div>
            <div className={styles.sectionSub}>
              Monitoramento ao vivo e o botão "Rodar agora" ficam na tela Motor de XML, em Operações — aqui é só o histórico recente.
            </div>
          </div>
          <Link href="/xml" className="btn btn-secondary" style={{ gap: 6 }}>
            Ir para Motor de XML <ArrowUpRight size={14} />
          </Link>
        </div>

        {logs.length === 0 ? (
          <div className={styles.chipsEmpty}>Nenhuma sincronização registrada ainda.</div>
        ) : (
          <div className={styles.logList}>
            {logs.slice(0, 10).map(l => (
              <div key={l.id} className={styles.logRow}>
                <span className={`${styles.logStatus} ${l.status === 'sucesso' ? styles.logOk : styles.logErr}`}>
                  {l.status === 'sucesso' ? '✓' : '✕'}
                </span>
                <span className={styles.logFeed}>{l.feed === 'loft' ? 'Loft' : 'Zap'}</span>
                <span className={styles.logMeta}>
                  {new Date(l.executado_em).toLocaleString('pt-BR')} · {l.disparado_por === 'manual' ? 'manual' : 'agendado'}
                  {l.status === 'sucesso'
                    ? ` · ${l.total_alterados ?? 0} alterados de ${l.total_no_feed ?? '?'}`
                    : ` · ${l.erro_mensagem || 'erro desconhecido'}`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </form>
  );
}
