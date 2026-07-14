'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/layout/Header';
import { mockImoveis, mockPortais, formatCurrency } from '@/lib/mock-data';
import {
  Send, Bot, User, Cpu, Sparkles, ArrowRight, AlertCircle, FileText,
  CheckCircle2, XCircle, Loader2, Zap,
} from 'lucide-react';
import styles from './page.module.css';

interface RelatorioSecao {
  titulo: string;
  texto?: string;
  colunas?: string[];
  linhas?: string[][];
}

interface RelatorioLisa {
  id: string;
  titulo: string;
  tipo: string;
  resumo: string;
  secoes: RelatorioSecao[];
}

interface PropostaCriarDestaque {
  tipo: 'criar_destaque';
  payload: {
    imovel: { id: string; titulo: string; bairro: string; preco_atual: number; tipo: string; status_farol: string; nota_qualidade: number; finalidade: string };
    codigo: string;
    portal: string;
    tipo_destaque: string;
    justificativa: string;
  };
}

interface PropostaAtualizarLead {
  tipo: 'atualizar_status_lead';
  payload: { lead_id: string; lead_nome: string; status_atual: string; novo_status: string; justificativa: string };
}

interface PropostaAtualizarPreco {
  tipo: 'atualizar_preco';
  payload: {
    id: string;
    codigo: string;
    titulo: string;
    bairro: string;
    finalidade: string;
    preco_atual: number;
    preco_novo: number;
    justificativa: string;
  };
}

interface PropostaEnriquecerAnuncio {
  tipo: 'enriquecer_anuncio';
  payload: {
    id: string;
    codigo: string;
    titulo: string;
    nota_qualidade_atual: number;
    criterios_ausentes: string[];
    justificativa: string;
  };
}

type PropostaAcao = PropostaCriarDestaque | PropostaAtualizarLead | PropostaAtualizarPreco | PropostaEnriquecerAnuncio;

type PropostaStatus = 'pendente' | 'confirmando' | 'confirmado' | 'descartado' | 'erro';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  rotaSugerida?: string | null;
  rotaLabel?: string | null;
  erro?: boolean;
  relatorio?: RelatorioLisa | null;
  propostaAcao?: PropostaAcao | null;
  propostaStatus?: PropostaStatus;
}

const STATUS_LEAD_LABEL: Record<string, string> = {
  novo: 'Novo',
  em_atendimento: 'Em atendimento',
  atendido: 'Atendido',
};

// CPL médio real: total gasto em orçamento dos portais ativos / total de
// leads que esses portais geraram no mês. Substitui o valor fixo que
// existia antes e não tinha relação nenhuma com os dados de mockPortais.
const portaisAtivos = mockPortais.filter(p => p.ativo && p.leads_mes > 0);
const gastoTotal = portaisAtivos.reduce((acc, p) => acc + p.orcamento_gasto, 0);
const leadsTotal = portaisAtivos.reduce((acc, p) => acc + p.leads_mes, 0);
const cplMedio = leadsTotal > 0 ? gastoTotal / leadsTotal : 0;

export default function CopilotoPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: `Oi! Sou a Lisa, o Orquestrador IA da BrokerImobAI. Tenho acesso em tempo real ao seu portfólio (${mockImoveis.length} imóveis), qualidade de anúncios, farol de oportunidade, destaques e leads da avaliação online.\n\nPergunta o que quiser — posso te levar direto pra seção certa do painel também.`,
      timestamp: new Date().toLocaleTimeString().slice(0, 5),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const processQuery = async (query: string, historicoAtual: Message[]) => {
    setIsTyping(true);
    try {
      const historico = historicoAtual
        .filter(m => m.id !== 'welcome')
        .map(m => ({ role: m.sender === 'user' ? 'user' as const : 'model' as const, texto: m.text }));

      const res = await fetch('/api/copiloto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensagem: query, historico }),
      });
      const json = await res.json();

      if (!json.success) throw new Error(json.message || 'Erro ao consultar a IA.');

      setMessages(prev => [
        ...prev,
        {
          id: String(Date.now()),
          sender: 'ai',
          text: json.data.resposta,
          timestamp: new Date().toLocaleTimeString().slice(0, 5),
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
        {
          id: String(Date.now()),
          sender: 'ai',
          text: `Não consegui falar com a IA agora: ${err.message || 'erro desconhecido'}. Confere se a chave do Gemini está configurada certo e tenta de novo.`,
          timestamp: new Date().toLocaleTimeString().slice(0, 5),
          erro: true,
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const confirmarProposta = async (msgId: string, proposta: PropostaAcao) => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, propostaStatus: 'confirmando' } : m));
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
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, propostaStatus: 'confirmado' } : m));
    } catch {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, propostaStatus: 'erro' } : m));
    }
  };

  const descartarProposta = (msgId: string) => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, propostaStatus: 'descartado' } : m));
  };

  const enviarPergunta = (texto: string) => {
    if (!texto.trim() || isTyping) return;

    const novaMensagem: Message = {
      id: String(Date.now()),
      sender: 'user',
      text: texto,
      timestamp: new Date().toLocaleTimeString().slice(0, 5),
    };
    const historicoAtual = [...messages, novaMensagem];
    setMessages(historicoAtual);
    setInputValue('');

    processQuery(texto, historicoAtual);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    enviarPergunta(inputValue);
  };

  return (
    <>
      <Header
        title="Lisa · Orquestrador IA"
        subtitle="Agente com Gemini, dados reais do painel e navegação entre seções"
      />
      <div className="page-body animate-fadeIn">
        <div className={styles.copilotContainer}>
          
          {/* Sidebar de status rápido do Agente */}
          <div className={styles.agentStatusCard}>
            <div className={styles.agentHeader}>
              <div className={styles.agentPulseWrap}>
                <div className={styles.agentPulse} />
                <Cpu size={20} color="var(--primary-hover)" />
              </div>
              <div>
                <div className={styles.agentName}>Lisa · Orquestrador IA</div>
                <div className={styles.agentStatusText}>Online · Gemini + dados reais do painel</div>
              </div>
            </div>

            <div className={styles.statsSection}>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Imóveis no portfólio</span>
                <span className={styles.statVal}>{mockImoveis.length}</span>
              </div>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>CPL Médio via IA</span>
                <span className={styles.statVal}>{formatCurrency(cplMedio)}</span>
              </div>
            </div>

            <div className={styles.suggestionsTitle}>Perguntas sugeridas:</div>
            <div className={styles.suggestionsList}>
              <button onClick={() => enviarPergunta('Quais imóveis estão com preço muito acima do sugerido?')} disabled={isTyping} className={styles.suggestionBtn}>
                🔍 Imóveis fora do preço
              </button>
              <button onClick={() => enviarPergunta('Quais anúncios estão com qualidade baixa?')} disabled={isTyping} className={styles.suggestionBtn}>
                📊 Anúncios com nota baixa
              </button>
              <button onClick={() => enviarPergunta('Onde devo alocar meus destaques para maior ROI?')} disabled={isTyping} className={styles.suggestionBtn}>
                ⚡ Sugestão de destaques IA
              </button>
              <button onClick={() => enviarPergunta('Como está o farol de venda hoje?')} disabled={isTyping} className={styles.suggestionBtn}>
                🏠 Farol de venda
              </button>
              <button onClick={() => enviarPergunta('Como está o farol de locação hoje?')} disabled={isTyping} className={styles.suggestionBtn}>
                🔑 Farol de locação
              </button>
              <button onClick={() => enviarPergunta('Gera um relatório de qualidade dos anúncios com nota crítica.')} disabled={isTyping} className={styles.suggestionBtn}>
                📄 Gerar relatório de qualidade
              </button>
            </div>
          </div>

          {/* Chat Container */}
          <div className={styles.chatWrapper}>
            <div className={styles.chatMessages}>
              {messages.map((msg) => (
                <div key={msg.id} className={`${styles.messageRow} ${msg.sender === 'user' ? styles.messageUser : styles.messageAi}`}>
                  <div className={styles.messageAvatar}>
                    {msg.sender === 'ai' ? <Bot size={16} /> : <User size={16} />}
                  </div>
                  <div className={styles.messageContent}>
                    <div className={styles.messageText} style={msg.erro ? { color: 'var(--farol-baixo, #ef4444)' } : undefined}>
                      {msg.erro && <AlertCircle size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: -2 }} />}
                      {msg.text}
                    </div>

                    {/* Relatório estruturado gerado pela Lisa — salvo em /relatorios */}
                    {msg.relatorio && (
                      <div className={styles.actionCard}>
                        <div className={styles.actionMeta}>
                          <FileText size={13} color="var(--farol-potencial)" />
                          <span>Relatório gerado</span>
                        </div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, marginTop: 4 }}>{msg.relatorio.titulo}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.5 }}>{msg.relatorio.resumo}</div>
                        <button
                          onClick={() => router.push(`/relatorios?id=${msg.relatorio!.id}`)}
                          className="btn btn-primary"
                          style={{ fontSize: '0.78rem', gap: 6, marginTop: '0.6rem' }}
                        >
                          Ver relatório completo <ArrowRight size={13} />
                        </button>
                      </div>
                    )}

                    {/* Proposta de ação — nunca executa sozinha, só com confirmação */}
                    {msg.propostaAcao && (
                      <div className={styles.actionCard}>
                        <div className={styles.actionMeta}>
                          <Zap size={13} color="var(--farol-potencial)" />
                          <span>Ação proposta — precisa da sua confirmação</span>
                        </div>

                        {msg.propostaAcao.tipo === 'criar_destaque' && (
                          <div style={{ fontSize: '0.8rem', marginTop: 4 }}>
                            <div style={{ fontWeight: 700 }}>{msg.propostaAcao.payload.imovel.titulo}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 2 }}>
                              {msg.propostaAcao.payload.imovel.bairro} · {formatCurrency(msg.propostaAcao.payload.imovel.preco_atual)} · Destaque em {msg.propostaAcao.payload.portal.toUpperCase()} ({msg.propostaAcao.payload.tipo_destaque.replace('_', ' ')})
                            </div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.76rem', marginTop: 4, lineHeight: 1.5 }}>{msg.propostaAcao.payload.justificativa}</div>
                          </div>
                        )}
                        {msg.propostaAcao.tipo === 'atualizar_status_lead' && (
                          <div style={{ fontSize: '0.8rem', marginTop: 4 }}>
                            <div style={{ fontWeight: 700 }}>{msg.propostaAcao.payload.lead_nome}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 2 }}>
                              {STATUS_LEAD_LABEL[msg.propostaAcao.payload.status_atual] || msg.propostaAcao.payload.status_atual} → {STATUS_LEAD_LABEL[msg.propostaAcao.payload.novo_status] || msg.propostaAcao.payload.novo_status}
                            </div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.76rem', marginTop: 4, lineHeight: 1.5 }}>{msg.propostaAcao.payload.justificativa}</div>
                          </div>
                        )}
                        {msg.propostaAcao.tipo === 'atualizar_preco' && (
                          <div style={{ fontSize: '0.8rem', marginTop: 4 }}>
                            <div style={{ fontWeight: 700 }}>{msg.propostaAcao.payload.titulo}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 2 }}>
                              {msg.propostaAcao.payload.bairro} · {formatCurrency(msg.propostaAcao.payload.preco_atual)} → {formatCurrency(msg.propostaAcao.payload.preco_novo)}
                            </div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.76rem', marginTop: 4, lineHeight: 1.5 }}>{msg.propostaAcao.payload.justificativa}</div>
                          </div>
                        )}
                        {msg.propostaAcao.tipo === 'enriquecer_anuncio' && (
                          <div style={{ fontSize: '0.8rem', marginTop: 4 }}>
                            <div style={{ fontWeight: 700 }}>{msg.propostaAcao.payload.titulo}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 2 }}>
                              Nota atual {msg.propostaAcao.payload.nota_qualidade_atual} · corrigir: {msg.propostaAcao.payload.criterios_ausentes.join(', ')}
                            </div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.76rem', marginTop: 4, lineHeight: 1.5 }}>{msg.propostaAcao.payload.justificativa}</div>
                          </div>
                        )}

                        {(!msg.propostaStatus || msg.propostaStatus === 'pendente') && (
                          <div style={{ display: 'flex', gap: 8, marginTop: '0.6rem' }}>
                            <button
                              onClick={() => confirmarProposta(msg.id, msg.propostaAcao!)}
                              className="btn btn-primary"
                              style={{ fontSize: '0.78rem', gap: 6 }}
                            >
                              <CheckCircle2 size={13} /> Confirmar
                            </button>
                            <button
                              onClick={() => descartarProposta(msg.id)}
                              className="btn"
                              style={{ fontSize: '0.78rem', gap: 6 }}
                            >
                              <XCircle size={13} /> Descartar
                            </button>
                          </div>
                        )}
                        {msg.propostaStatus === 'confirmando' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: '0.6rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            <Loader2 size={13} className={styles.spin} /> Aplicando...
                          </div>
                        )}
                        {msg.propostaStatus === 'confirmado' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: '0.6rem', fontSize: '0.78rem', color: 'var(--farol-iminente, #22c55e)' }}>
                            <CheckCircle2 size={13} /> Ação aplicada.
                          </div>
                        )}
                        {msg.propostaStatus === 'descartado' && (
                          <div style={{ marginTop: '0.6rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>Descartado.</div>
                        )}
                        {msg.propostaStatus === 'erro' && (
                          <div style={{ marginTop: '0.6rem', fontSize: '0.78rem', color: 'var(--farol-baixo, #ef4444)' }}>Não consegui aplicar. Tenta de novo pela tela correspondente.</div>
                        )}
                      </div>
                    )}

                    {/* Navegação real sugerida pela IA — leva de verdade pra seção */}
                    {msg.rotaSugerida && (
                      <div className={styles.actionCard}>
                        <div className={styles.actionMeta}>
                          <Sparkles size={13} color="var(--farol-potencial)" />
                          <span>Seção relacionada</span>
                        </div>
                        <button
                          onClick={() => router.push(msg.rotaSugerida!)}
                          className="btn btn-primary"
                          style={{ fontSize: '0.78rem', gap: 6, marginTop: '0.5rem' }}
                        >
                          {msg.rotaLabel || 'Ver seção'} <ArrowRight size={13} />
                        </button>
                      </div>
                    )}

                    <div className={styles.messageTime}>{msg.timestamp}</div>
                  </div>
                </div>
              ))}
              
              {isTyping && (
                <div className={`${styles.messageRow} ${styles.messageAi}`}>
                  <div className={styles.messageAvatar}>
                    <Bot size={16} />
                  </div>
                  <div className={styles.messageContent}>
                    <div className={styles.typingIndicator}>
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleSend} className={styles.chatInputRow}>
              <input
                type="text"
                className="input"
                placeholder="Pergunte à Lisa sobre preços, qualidade, farol, destaques ou leads..."
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                disabled={isTyping}
              />
              <button type="submit" className="btn btn-primary" disabled={isTyping || !inputValue.trim()}>
                <Send size={15} />
              </button>
            </form>
          </div>

        </div>
      </div>
    </>
  );
}
