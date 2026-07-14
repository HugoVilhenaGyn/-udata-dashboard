'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bot, Send, X, Sparkles, ArrowRight, CheckCircle2, XCircle, Loader2, AlertCircle, FileText, Zap, MapPin,
} from 'lucide-react';
import { useLisaContextValue } from '@/lib/lisa-context';
import styles from './LisaWidget.module.css';

// Botão flutuante da Lisa, disponível em toda seção logada do painel (ver
// AppShell.tsx). É a versão "de bolso" do chat completo em /copiloto:
// mesma API (/api/copiloto), mesmas ações reais com confirmação, mas sem
// sair da tela onde o usuário está — e com o contexto automático da tela
// atual (useLisaScreenContext, registrado por cada página) incluído em
// toda pergunta, então a Lisa já sabe onde o usuário está e o que ele está
// vendo sem precisar reexplicar.

interface RelatorioLisa {
  id: string;
  titulo: string;
  resumo: string;
}

type PropostaAcao =
  | { tipo: 'criar_destaque'; payload: { imovel: { titulo: string; bairro: string; preco_atual: number }; portal: string; tipo_destaque: string; justificativa: string } }
  | { tipo: 'atualizar_status_lead'; payload: { lead_id: string; lead_nome: string; status_atual: string; novo_status: string; justificativa: string } }
  | { tipo: 'atualizar_preco'; payload: { id: string; titulo: string; bairro: string; preco_atual: number; preco_novo: number; justificativa: string } }
  | { tipo: 'enriquecer_anuncio'; payload: { id: string; titulo: string; nota_qualidade_atual: number; criterios_ausentes: string[]; justificativa: string } };

type PropostaStatus = 'pendente' | 'confirmando' | 'confirmado' | 'descartado' | 'erro';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  erro?: boolean;
  rotaSugerida?: string | null;
  rotaLabel?: string | null;
  relatorio?: RelatorioLisa | null;
  propostaAcao?: PropostaAcao | null;
  propostaStatus?: PropostaStatus;
}

const STATUS_LEAD_LABEL: Record<string, string> = {
  novo: 'Novo',
  em_atendimento: 'Em atendimento',
  atendido: 'Atendido',
};

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

export default function LisaWidget() {
  const router = useRouter();
  const { contexto } = useLisaContextValue();
  const [aberto, setAberto] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (aberto) chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, aberto]);

  const enviarPergunta = async (texto: string) => {
    if (!texto.trim() || isTyping) return;
    const userMsg: Message = { id: String(Date.now()), sender: 'user', text: texto };
    const historicoAtual = [...messages, userMsg];
    setMessages(historicoAtual);
    setInputValue('');
    setIsTyping(true);

    try {
      const historico = historicoAtual.map(m => ({ role: m.sender === 'user' ? ('user' as const) : ('model' as const), texto: m.text }));
      const res = await fetch('/api/copiloto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensagem: texto, historico, contextoTela: contexto || undefined }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Erro ao consultar a IA.');

      setMessages(prev => [
        ...prev,
        {
          id: String(Date.now() + 1),
          sender: 'ai',
          text: json.data.resposta,
          rotaSugerida: json.data.rota_sugerida || null,
          rotaLabel: json.data.rota_label || null,
          relatorio: json.data.relatorio || null,
          propostaAcao: json.data.proposta_acao || null,
          propostaStatus: json.data.proposta_acao ? 'pendente' : undefined,
        },
      ]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        { id: String(Date.now() + 1), sender: 'ai', text: `Não consegui responder agora: ${err.message || 'erro desconhecido'}.`, erro: true },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const confirmarProposta = async (msgId: string, proposta: PropostaAcao) => {
    setMessages(prev => prev.map(m => (m.id === msgId ? { ...m, propostaStatus: 'confirmando' } : m)));
    try {
      if (proposta.tipo === 'criar_destaque') {
        const { imovel, portal, tipo_destaque } = proposta.payload;
        const res = await fetch('/api/destaques', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imovel, portal, tipo_destaque, score_ia: 0 }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.message);
      } else if (proposta.tipo === 'atualizar_status_lead') {
        const { lead_id, novo_status } = proposta.payload;
        const res = await fetch('/api/leads-avaliacao', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: lead_id, status: novo_status }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.message);
      } else if (proposta.tipo === 'atualizar_preco') {
        const { id, preco_novo, justificativa } = proposta.payload;
        const res = await fetch(`/api/imoveis/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ acao: 'atualizar_preco', preco_novo, motivo: justificativa }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.message);
      } else if (proposta.tipo === 'enriquecer_anuncio') {
        const { id } = proposta.payload;
        const res = await fetch(`/api/imoveis/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ acao: 'enriquecer_anuncio' }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.message);
      }
      setMessages(prev => prev.map(m => (m.id === msgId ? { ...m, propostaStatus: 'confirmado' } : m)));
    } catch {
      setMessages(prev => prev.map(m => (m.id === msgId ? { ...m, propostaStatus: 'erro' } : m)));
    }
  };

  const descartarProposta = (msgId: string) => {
    setMessages(prev => prev.map(m => (m.id === msgId ? { ...m, propostaStatus: 'descartado' } : m)));
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    enviarPergunta(inputValue);
  };

  const irParaChatCompleto = () => {
    setAberto(false);
    router.push('/copiloto');
  };

  return (
    <>
      <button
        className={styles.fab}
        onClick={() => setAberto(v => !v)}
        aria-label="Falar com a Lisa"
        title="Falar com a Lisa"
      >
        {aberto ? <X size={22} /> : <Bot size={22} />}
      </button>

      {aberto && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div className={styles.panelHeaderLeft}>
              <div className={styles.avatarPulseWrap}>
                <div className={styles.avatarPulse} />
                <Bot size={17} />
              </div>
              <div>
                <div className={styles.panelTitle}>Lisa · Orquestrador IA</div>
                {contexto ? (
                  <div className={styles.contextChip}>
                    <MapPin size={10} /> {contexto.secao}
                  </div>
                ) : (
                  <div className={styles.panelSubtitle}>Pergunte sobre qualquer tela</div>
                )}
              </div>
            </div>
            <button className={styles.closeBtn} onClick={() => setAberto(false)} aria-label="Fechar">
              <X size={16} />
            </button>
          </div>

          <div className={styles.panelBody}>
            {messages.length === 0 && (
              <div className={styles.emptyState}>
                <Sparkles size={22} color="var(--primary-hover)" />
                <p>
                  {contexto
                    ? <>Posso te ajudar com o que você está vendo em <strong>{contexto.secao}</strong> agora — ou qualquer outra coisa do painel.</>
                    : 'Pergunte sobre preços, qualidade, farol, destaques ou leads — de qualquer tela.'}
                </p>
              </div>
            )}

            {messages.map(msg => (
              <div key={msg.id} className={`${styles.messageRow} ${msg.sender === 'user' ? styles.messageUser : styles.messageAi}`}>
                <div className={styles.messageText} style={msg.erro ? { color: '#ef4444' } : undefined}>
                  {msg.erro && <AlertCircle size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: -1 }} />}
                  {msg.text}
                </div>

                {msg.relatorio && (
                  <div className={styles.actionCard}>
                    <div className={styles.actionMeta}><FileText size={12} color="var(--farol-potencial)" /><span>Relatório gerado</span></div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, marginTop: 3 }}>{msg.relatorio.titulo}</div>
                    <button onClick={() => { setAberto(false); router.push(`/relatorios?id=${msg.relatorio!.id}`); }} className="btn btn-primary" style={{ fontSize: '0.74rem', gap: 5, marginTop: '0.5rem' }}>
                      Ver relatório <ArrowRight size={12} />
                    </button>
                  </div>
                )}

                {msg.propostaAcao && (
                  <div className={styles.actionCard}>
                    <div className={styles.actionMeta}><Zap size={12} color="var(--farol-potencial)" /><span>Ação proposta</span></div>

                    {msg.propostaAcao.tipo === 'criar_destaque' && (
                      <div className={styles.actionDetail}>
                        <div className={styles.actionDetailTitle}>{msg.propostaAcao.payload.imovel.titulo}</div>
                        <div className={styles.actionDetailMeta}>{msg.propostaAcao.payload.imovel.bairro} · {formatCurrency(msg.propostaAcao.payload.imovel.preco_atual)} · {msg.propostaAcao.payload.portal.toUpperCase()}</div>
                        <div className={styles.actionDetailJust}>{msg.propostaAcao.payload.justificativa}</div>
                      </div>
                    )}
                    {msg.propostaAcao.tipo === 'atualizar_status_lead' && (
                      <div className={styles.actionDetail}>
                        <div className={styles.actionDetailTitle}>{msg.propostaAcao.payload.lead_nome}</div>
                        <div className={styles.actionDetailMeta}>{STATUS_LEAD_LABEL[msg.propostaAcao.payload.status_atual] || msg.propostaAcao.payload.status_atual} → {STATUS_LEAD_LABEL[msg.propostaAcao.payload.novo_status] || msg.propostaAcao.payload.novo_status}</div>
                        <div className={styles.actionDetailJust}>{msg.propostaAcao.payload.justificativa}</div>
                      </div>
                    )}
                    {msg.propostaAcao.tipo === 'atualizar_preco' && (
                      <div className={styles.actionDetail}>
                        <div className={styles.actionDetailTitle}>{msg.propostaAcao.payload.titulo}</div>
                        <div className={styles.actionDetailMeta}>{msg.propostaAcao.payload.bairro} · {formatCurrency(msg.propostaAcao.payload.preco_atual)} → {formatCurrency(msg.propostaAcao.payload.preco_novo)}</div>
                        <div className={styles.actionDetailJust}>{msg.propostaAcao.payload.justificativa}</div>
                      </div>
                    )}
                    {msg.propostaAcao.tipo === 'enriquecer_anuncio' && (
                      <div className={styles.actionDetail}>
                        <div className={styles.actionDetailTitle}>{msg.propostaAcao.payload.titulo}</div>
                        <div className={styles.actionDetailMeta}>Nota atual {msg.propostaAcao.payload.nota_qualidade_atual} · corrigir: {msg.propostaAcao.payload.criterios_ausentes.join(', ')}</div>
                        <div className={styles.actionDetailJust}>{msg.propostaAcao.payload.justificativa}</div>
                      </div>
                    )}

                    {(!msg.propostaStatus || msg.propostaStatus === 'pendente') && (
                      <div style={{ display: 'flex', gap: 6, marginTop: '0.5rem' }}>
                        <button onClick={() => confirmarProposta(msg.id, msg.propostaAcao!)} className="btn btn-primary" style={{ fontSize: '0.72rem', gap: 4 }}>
                          <CheckCircle2 size={12} /> Confirmar
                        </button>
                        <button onClick={() => descartarProposta(msg.id)} className="btn" style={{ fontSize: '0.72rem', gap: 4 }}>
                          <XCircle size={12} /> Descartar
                        </button>
                      </div>
                    )}
                    {msg.propostaStatus === 'confirmando' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: '0.5rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        <Loader2 size={12} className={styles.spin} /> Aplicando...
                      </div>
                    )}
                    {msg.propostaStatus === 'confirmado' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: '0.5rem', fontSize: '0.72rem', color: '#22c55e' }}>
                        <CheckCircle2 size={12} /> Ação aplicada.
                      </div>
                    )}
                    {msg.propostaStatus === 'descartado' && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>Descartado.</div>
                    )}
                    {msg.propostaStatus === 'erro' && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: '#ef4444' }}>Não consegui aplicar. Tenta pela tela correspondente.</div>
                    )}
                  </div>
                )}

                {msg.rotaSugerida && (
                  <div className={styles.actionCard}>
                    <div className={styles.actionMeta}><Sparkles size={12} color="var(--farol-potencial)" /><span>Seção relacionada</span></div>
                    <button onClick={() => { setAberto(false); router.push(msg.rotaSugerida!); }} className="btn btn-primary" style={{ fontSize: '0.74rem', gap: 5, marginTop: '0.4rem' }}>
                      {msg.rotaLabel || 'Ver seção'} <ArrowRight size={12} />
                    </button>
                  </div>
                )}
              </div>
            ))}

            {isTyping && (
              <div className={`${styles.messageRow} ${styles.messageAi}`}>
                <div className={styles.typingIndicator}><span /><span /><span /></div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className={styles.panelFooter}>
            <button className={styles.fullChatLink} onClick={irParaChatCompleto}>
              Abrir chat completo <ArrowRight size={11} />
            </button>
            <form onSubmit={handleSend} className={styles.inputRow}>
              <input
                type="text"
                className="input"
                placeholder="Pergunte à Lisa..."
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                disabled={isTyping}
              />
              <button type="submit" className="btn btn-primary" disabled={isTyping || !inputValue.trim()} style={{ padding: '0.5rem 0.7rem' }}>
                <Send size={14} />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
