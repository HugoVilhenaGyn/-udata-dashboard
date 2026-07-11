'use client';

import { useState, useEffect, useRef } from 'react';
import Header from '@/components/layout/Header';
import { mockImoveis, mockPortais, mockRegrasEnriquecimento, formatCurrency } from '@/lib/mock-data';
import { Imovel } from '@/lib/types';
import {
  Send, Bot, User, Cpu, Sparkles, Building2, Lightbulb, Star, AlertTriangle, ArrowRight, CheckCircle2,
} from 'lucide-react';
import styles from './page.module.css';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  suggestedAction?: {
    label: string;
    actionType: 'adjust_prices' | 'enrich_xml' | 'optimize_highlights';
    details?: string;
  };
  tableData?: {
    headers: string[];
    rows: any[][];
  };
}

// CPL médio real: total gasto em orçamento dos portais ativos / total de
// leads que esses portais geraram no mês. Substitui o valor fixo que
// existia antes e não tinha relação nenhuma com os dados de mockPortais.
const portaisAtivos = mockPortais.filter(p => p.ativo && p.leads_mes > 0);
const gastoTotal = portaisAtivos.reduce((acc, p) => acc + p.orcamento_gasto, 0);
const leadsTotal = portaisAtivos.reduce((acc, p) => acc + p.leads_mes, 0);
const cplMedio = leadsTotal > 0 ? gastoTotal / leadsTotal : 0;

export default function CopilotoPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: `Olá! Sou a Inteligência de Orquestração da UDATA. Analisei todo o seu inventário de imóveis (${mockImoveis.length} anúncios), os canais de feeds XML e as regras de precificação. \n\nComo posso ajudar você a otimizar a performance comercial do seu portfólio hoje?`,
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

  const processQuery = (query: string) => {
    setIsTyping(true);
    const qLower = query.toLowerCase();

    setTimeout(() => {
      let responseText = '';
      let action: Message['suggestedAction'] = undefined;
      let table: Message['tableData'] = undefined;

      // 1. QUERY: Preço acima do mercado / fora do preço / Batel
      if (qLower.includes('preco') || qLower.includes('preço') || qLower.includes('batel') || qLower.includes('fora')) {
        const batelOut = mockImoveis.filter(i => {
          const diff = i.preco_sugerido_ia ? ((i.preco_atual - i.preco_sugerido_ia) / i.preco_sugerido_ia) * 100 : 0;
          return diff > 10 && (qLower.includes('batel') ? i.bairro.toLowerCase() === 'batel' : true);
        });

        responseText = `Encontrei **${batelOut.length} imóveis** com preço acima do sugerido pela IA (desvio > 10% do mercado regional). Isso prejudica diretamente a nota de qualidade e a velocidade de venda nos portais. Veja os casos mais críticos:`;
        
        table = {
          headers: ['Código', 'Título', 'Bairro', 'Preço Atual', 'Sugerido IA', 'Desvio'],
          rows: batelOut.slice(0, 5).map(i => {
            const desvio = i.preco_sugerido_ia ? ((i.preco_atual - i.preco_sugerido_ia) / i.preco_sugerido_ia) * 100 : 0;
            return [
              i.id_externo,
              i.titulo.slice(0, 20) + '...',
              i.bairro,
              formatCurrency(i.preco_atual),
              formatCurrency(i.preco_sugerido_ia || 0),
              `+${desvio.toFixed(1)}%`
            ];
          })
        };

        action = {
          label: 'Ajustar preços sugeridos pela IA',
          actionType: 'adjust_prices',
          details: 'Alinha automaticamente os preços do feed XML com a calculadora de mercado da IA.'
        };
      } 
      // 2. QUERY: Qualidade / Enriquecimento / XML
      else if (qLower.includes('qualidade') || qLower.includes('xml') || qLower.includes('anuncio') || qLower.includes('anúncio')) {
        const ruins = mockImoveis.filter(i => i.nota_qualidade < 5.5);
        responseText = `Estudei o feed XML. Atualmente, há **${ruins.length} anúncios** com Nota de Qualidade crítica (abaixo de 5.5). Os principais problemas encontrados foram:\n\n1. Ausência de endereço completo (CEP/Número).\n2. Descrições com menos de 100 caracteres.\n3. Falta de mídias (menos de 8 fotos).\n\nPodemos rodar o motor para gerar descrições enriquecidas e normalizar os títulos automaticamente.`;
        
        table = {
          headers: ['Código', 'Título', 'Bairro', 'Nota', 'Critérios Ausentes'],
          rows: ruins.slice(0, 5).map(i => {
            const ausentes = i.criterios_qualidade.filter(c => !c.presente).map(c => c.label).slice(0, 2).join(', ');
            return [
              i.id_externo,
              i.titulo.slice(0, 22) + '...',
              i.bairro,
              `${i.nota_qualidade}/10`,
              ausentes || 'Fotos insuficientes'
            ];
          })
        };

        action = {
          label: 'Rodar Enriquecimento XML IA',
          actionType: 'enrich_xml',
          details: 'Eleva a nota de qualidade resolvendo automaticamente endereços, metragens e descrições.'
        };
      }
      // 3. QUERY: Destaques / Investimento / ROI
      else if (qLower.includes('destaque') || qLower.includes('roi') || qLower.includes('investir') || qLower.includes('portal')) {
        const topFarol = mockImoveis.filter(i => i.status_farol === 'venda_iminente' && i.nota_qualidade >= 8 && !i.destaque_ativo);
        responseText = `Analisei o ROI dos canais. O ZAP e OLX estão com maior taxa de conversão (média de 3.2x de ROI). Identifiquei **${topFarol.length} imóveis "Venda Iminente"** com nota de qualidade excelente que ainda **não possuem destaques ativos**. Alocar o orçamento restante neles trará o maior retorno em leads.`;
        
        table = {
          headers: ['Código', 'Título', 'Bairro', 'Preço', 'Nota Qualidade', 'ROI Estimado'],
          rows: topFarol.slice(0, 5).map(i => [
            i.id_externo,
            i.titulo.slice(0, 20) + '...',
            i.bairro,
            formatCurrency(i.preco_atual),
            `${i.nota_qualidade}/10`,
            '~4.8x ROI'
          ])
        };

        action = {
          label: 'Distribuir Destaques por IA',
          actionType: 'optimize_highlights',
          details: 'Prioriza alocação de destaques pagos nos 5 imóveis de maior liquidez e qualidade.'
        };
      }
      // 4. QUERY: Padrão de saudação/geral
      else {
        responseText = `Entendido. Executei uma análise geral no banco de dados e nos feeds:\n\n- **Preço**: 18 imóveis estão com desvio de preço regional superior a 15%.\n- **Qualidade**: Nota média do feed XML está em **7.6/10**.\n- **Destaques**: Sobram 35 destaques disponíveis no ZAP/OLX para alocação inteligente.\n\nExperimente me pedir: "Quais imóveis precisam de enriquecimento de XML?" ou "Quais estão com preço fora de mercado?" para realizarmos as alterações.`;
      }

      setMessages(prev => [
        ...prev,
        {
          id: String(Date.now()),
          sender: 'ai',
          text: responseText,
          timestamp: new Date().toLocaleTimeString().slice(0, 5),
          suggestedAction: action,
          tableData: table,
        },
      ]);
      setIsTyping(false);
    }, 1200);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userText = inputValue;
    setMessages(prev => [
      ...prev,
      {
        id: String(Date.now()),
        sender: 'user',
        text: userText,
        timestamp: new Date().toLocaleTimeString().slice(0, 5),
      },
    ]);
    setInputValue('');

    processQuery(userText);
  };

  // Tratar ação sugerida
  const handleExecuteAction = (actionType: string) => {
    setIsTyping(true);
    setTimeout(() => {
      let resultText = '';
      if (actionType === 'adjust_prices') {
        resultText = '✅ **Ajuste Concluído!** Alterei os preços do feed XML para os 5 imóveis do Batel identificados. Eles foram atualizados no banco de dados e replicados para a carga VrSync.';
      } else if (actionType === 'enrich_xml') {
        resultText = '✨ **Enriquecimento Concluído!** Rodamos o processamento das regras do motor XML. O endereço e metragens foram normalizados e as descrições vazias foram geradas por IA. Nota geral subiu de **6.2 para 8.5**!';
      } else if (actionType === 'optimize_highlights') {
        resultText = '⚡ **Otimização Concluída!** Alocamos 5 destaques premium no ZAP/OLX para os imóveis de alta liquidez recomendados. Acompanhe a projeção de leads na aba de Destaques.';
      }

      setMessages(prev => [
        ...prev,
        {
          id: String(Date.now()),
          sender: 'ai',
          text: resultText,
          timestamp: new Date().toLocaleTimeString().slice(0, 5),
        },
      ]);
      setIsTyping(false);
    }, 1500);
  };

  return (
    <>
      <Header
        title="Orquestrador IA"
        subtitle="Agente inteligente de auditoria e orquestração do portfólio"
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
                <div className={styles.agentName}>Orquestrador UDATA</div>
                <div className={styles.agentStatusText}>Online · Estudando XML</div>
              </div>
            </div>

            <div className={styles.statsSection}>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Anúncios Analisados</span>
                <span className={styles.statVal}>{mockImoveis.length}</span>
              </div>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>Erros XML Corrigidos</span>
                <span className={styles.statVal} style={{ color: '#22c55e' }}>+47 este mês</span>
              </div>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>CPL Médio via IA</span>
                <span className={styles.statVal}>{formatCurrency(cplMedio)}</span>
              </div>
            </div>

            <div className={styles.suggestionsTitle}>Perguntas sugeridas:</div>
            <div className={styles.suggestionsList}>
              <button onClick={() => { setInputValue('Quais imóveis estão com preço muito acima do sugerido?'); }} className={styles.suggestionBtn}>
                🔍 Imóveis fora do preço
              </button>
              <button onClick={() => { setInputValue('Quais anúncios estão com qualidade baixa no XML?'); }} className={styles.suggestionBtn}>
                📊 Anúncios com nota baixa
              </button>
              <button onClick={() => { setInputValue('Onde devo alocar meus destaques para maior ROI?'); }} className={styles.suggestionBtn}>
                ⚡ Sugestão de destaques IA
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
                    <div className={styles.messageText}>{msg.text}</div>
                    
                    {/* Render table results if present */}
                    {msg.tableData && (
                      <div className={styles.tableWrap}>
                        <table className={styles.chatTable}>
                          <thead>
                            <tr>
                              {msg.tableData.headers.map((h, i) => <th key={i}>{h}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {msg.tableData.rows.map((row, idx) => (
                              <tr key={idx}>
                                {row.map((cell, cidx) => <td key={cidx}>{cell}</td>)}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Action buttons suggested by AI */}
                    {msg.suggestedAction && (
                      <div className={styles.actionCard}>
                        <div className={styles.actionMeta}>
                          <Sparkles size={13} color="var(--farol-potencial)" />
                          <span>Ação Recomendada por IA</span>
                        </div>
                        <div className={styles.actionDetails}>{msg.suggestedAction.details}</div>
                        <button
                          onClick={() => handleExecuteAction(msg.suggestedAction!.actionType)}
                          className="btn btn-primary"
                          style={{ fontSize: '0.78rem', gap: 6, marginTop: '0.5rem' }}
                        >
                          {msg.suggestedAction.label} <ArrowRight size={13} />
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
                placeholder="Pergunte ao Orquestrador IA sobre preços, qualidade ou alocação do XML..."
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
