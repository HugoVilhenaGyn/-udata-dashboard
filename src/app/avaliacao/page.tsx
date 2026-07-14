'use client';

import { useState, useMemo, useEffect } from 'react';
import { mockImoveis, mockImobiliaria, avaliarImovel, formatCurrency, ResultadoAvaliacao } from '@/lib/mock-data';
import { ImovelFinalidade, ImovelTipo } from '@/lib/types';
import {
  Home, Building2, TrendingUp, CheckCircle2, Phone, Mail, User, MessageSquare, ArrowRight, Loader2,
} from 'lucide-react';
import styles from './page.module.css';

interface ConfigAvaliacao {
  ativo: boolean;
  telefoneContato: string;
  tituloHero: string;
  mensagemHero: string;
  mensagemIndisponivel: string;
}

const CONFIG_FALLBACK: ConfigAvaliacao = {
  ativo: true,
  telefoneContato: '62 3018.2500',
  tituloHero: 'Quanto vale o seu imóvel?',
  mensagemHero: 'Avaliação gratuita baseada em imóveis reais do nosso portfólio na sua região — preencha seus dados e o do imóvel para ver o resultado do estudo de mercado.',
  mensagemIndisponivel: 'A avaliação online está temporariamente indisponível. Fale direto com a gente pelo telefone abaixo.',
};

const TIPO_OPTIONS: { value: ImovelTipo; label: string }[] = [
  { value: 'apartamento', label: 'Apartamento' },
  { value: 'casa', label: 'Casa' },
  { value: 'cobertura', label: 'Cobertura' },
  { value: 'studio', label: 'Studio' },
  { value: 'flat', label: 'Flat' },
  { value: 'comercial', label: 'Comercial' },
  { value: 'terreno', label: 'Terreno' },
];

export default function AvaliacaoPage() {
  const bairros = useMemo(
    () => Array.from(new Set(mockImoveis.map(i => i.bairro))).sort((a, b) => a.localeCompare(b)),
    []
  );

  const [finalidade, setFinalidade] = useState<ImovelFinalidade>('venda');
  const [tipo, setTipo] = useState<ImovelTipo>('apartamento');
  const [bairro, setBairro] = useState('');
  const [areaUtil, setAreaUtil] = useState('');
  const [quartos, setQuartos] = useState('');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [mensagem, setMensagem] = useState('');

  const [resultado, setResultado] = useState<ResultadoAvaliacao | null>(null);
  const [semResultado, setSemResultado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState('');

  const [config, setConfig] = useState<ConfigAvaliacao>(CONFIG_FALLBACK);
  useEffect(() => {
    fetch('/api/config-avaliacao')
      .then(r => r.json())
      .then(j => { if (j.success) setConfig(j.data); })
      .catch(() => { /* mantém CONFIG_FALLBACK */ });
  }, []);

  const precisaoLabel = {
    bairro: 'imóveis reais no mesmo bairro e tipo',
    tipo: 'imóveis reais do mesmo tipo (amostra do bairro era pequena)',
    geral: 'imóveis reais do nosso portfólio (amostra local era pequena)',
  };

  const avaliarEEnviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroEnvio('');

    const area = parseFloat(areaUtil);
    const r = avaliarImovel({ finalidade, tipo, bairro, area_util: area });
    setSemResultado(!r);
    setEnviando(true);

    try {
      const res = await fetch('/api/leads-avaliacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome, telefone, email, mensagem,
          finalidade, tipo, bairro,
          area_util: area,
          quartos: parseInt(quartos || '0', 10),
          valor_estimado: r?.valorEstimado || 0,
          valor_min: r?.valorMin || 0,
          valor_max: r?.valorMax || 0,
          comparaveis_usados: r?.comparaveisUsados || 0,
        }),
      });
      const json = await res.json();
      if (!r) {
        // Sem comparáveis suficientes: o lead já foi salvo (é o que importa
        // pro corretor seguir), mas não mostramos um número calculado.
        setResultado(null);
        return;
      }
      if (!json.success) throw new Error(json.message || 'Erro ao enviar.');
      setResultado(r);
    } catch (err: any) {
      setErroEnvio(err.message || 'Não foi possível calcular sua avaliação agora. Tente novamente em instantes.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className={styles.page}>
      {/* HERO */}
      <div className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.brand}>
            <div className={styles.brandIcon}><Home size={18} /></div>
            <span>{mockImobiliaria.nome}</span>
          </div>
          <h1 className={styles.heroTitle}>{config.tituloHero}</h1>
          <p className={styles.heroSubtitle}>{config.mensagemHero}</p>
        </div>
      </div>

      <div className={styles.container}>
        {!config.ativo && (
          <div className={styles.card}>
            <div className={styles.successBox}>
              <Phone size={28} color="#818cf8" />
              <h2>Fale com a gente</h2>
              <p>{config.mensagemIndisponivel}</p>
              <p style={{ fontWeight: 700, color: '#f1f5f9', marginTop: 8 }}>{config.telefoneContato}</p>
            </div>
          </div>
        )}

        {config.ativo && !resultado && (
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Conte sobre você e o imóvel</h2>
            <form onSubmit={avaliarEEnviar} className={styles.form}>
              <div className={styles.toggleRow}>
                <button
                  type="button"
                  className={`${styles.toggleBtn} ${finalidade === 'venda' ? styles.toggleActive : ''}`}
                  onClick={() => setFinalidade('venda')}
                >
                  Quero vender
                </button>
                <button
                  type="button"
                  className={`${styles.toggleBtn} ${finalidade === 'aluguel' ? styles.toggleActive : ''}`}
                  onClick={() => setFinalidade('aluguel')}
                >
                  Quero alugar
                </button>
              </div>

              <div className={styles.fieldGrid}>
                <div className={styles.field}>
                  <label>Tipo de imóvel</label>
                  <select value={tipo} onChange={e => setTipo(e.target.value as ImovelTipo)}>
                    {TIPO_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>

                <div className={styles.field}>
                  <label>Bairro *</label>
                  <input
                    list="bairros-lista"
                    value={bairro}
                    onChange={e => setBairro(e.target.value)}
                    placeholder="Ex: Setor Bueno"
                    required
                  />
                  <datalist id="bairros-lista">
                    {bairros.map(b => <option key={b} value={b} />)}
                  </datalist>
                </div>

                <div className={styles.field}>
                  <label>Área útil (m²) *</label>
                  <input
                    type="number"
                    min={1}
                    value={areaUtil}
                    onChange={e => setAreaUtil(e.target.value)}
                    placeholder="Ex: 75"
                    required
                  />
                </div>

                <div className={styles.field}>
                  <label>Quartos (opcional)</label>
                  <input
                    type="number"
                    min={0}
                    value={quartos}
                    onChange={e => setQuartos(e.target.value)}
                    placeholder="Ex: 3"
                  />
                </div>
              </div>

              <div className={styles.divider}>Seus dados de contato</div>
              <p className={styles.dividerNote}>
                Precisamos disso pra liberar o resultado do estudo de mercado e um corretor poder te
                explicar a avaliação com mais detalhe.
              </p>

              <div className={styles.fieldGrid}>
                <div className={styles.field}>
                  <label><User size={12} /> Nome *</label>
                  <input value={nome} onChange={e => setNome(e.target.value)} required />
                </div>
                <div className={styles.field}>
                  <label><Phone size={12} /> Telefone / WhatsApp *</label>
                  <input value={telefone} onChange={e => setTelefone(e.target.value)} required placeholder="(62) 99999-9999" />
                </div>
                <div className={styles.field}>
                  <label><Mail size={12} /> E-mail (opcional)</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
                  <label><MessageSquare size={12} /> Mensagem (opcional)</label>
                  <input value={mensagem} onChange={e => setMensagem(e.target.value)} placeholder="Algum detalhe que queira contar sobre o imóvel?" />
                </div>
              </div>

              {semResultado && (
                <div className={styles.warningBox}>
                  Ainda não temos imóveis reais suficientes nesse segmento pra calcular uma estimativa confiável.
                  Seus dados foram registrados — um corretor faz a avaliação pessoalmente e te retorna.
                </div>
              )}
              {erroEnvio && <div className={styles.warningBox}>{erroEnvio}</div>}

              <button type="submit" className={styles.submitBtn} disabled={enviando}>
                {enviando ? <><Loader2 size={16} className={styles.spin} /> Calculando...</> : <>Ver minha avaliação <ArrowRight size={16} /></>}
              </button>
            </form>
          </div>
        )}

        {resultado && (
          <div className={styles.card}>
            <div className={styles.successBox}>
              <CheckCircle2 size={28} color="#22c55e" />
              <h2>Obrigado, {nome.split(' ')[0]}!</h2>
              <p>Aqui está sua avaliação. Um corretor da {mockImobiliaria.nome} também vai entrar em contato para uma análise completa.</p>
            </div>

            <div className={styles.resultBox}>
              <div className={styles.resultValue}>{formatCurrency(resultado.valorEstimado)}</div>
              <div className={styles.resultRange}>
                Faixa de mercado: {formatCurrency(resultado.valorMin)} — {formatCurrency(resultado.valorMax)}
              </div>
              <div className={styles.resultMeta}>
                <TrendingUp size={13} />
                Baseado em {resultado.comparaveisUsados} {precisaoLabel[resultado.precisao]}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <Building2 size={14} />
        <span>{mockImobiliaria.nome} · CRECI 4968 J GO · {config.telefoneContato}</span>
      </div>
    </div>
  );
}
