'use client';

import { useState, useEffect, useRef } from 'react';
import { Save, Loader2, Brain, Upload, FileText, Trash2 } from 'lucide-react';
import styles from './page.module.css';

interface DocumentoRag {
  id: string;
  nome: string;
  fonte: 'portal62' | 'zap' | 'outro';
  tamanho: number;
  enviado_em: string;
  enviado_por?: string;
}

interface ConfigOrquestrador {
  instrucoes: string;
  documentos: DocumentoRag[];
  atualizado_em?: string;
  atualizado_por?: string;
}

const FONTE_LABEL: Record<DocumentoRag['fonte'], string> = {
  portal62: 'Portal 62',
  zap: 'Zap Imóveis',
  outro: 'Outra fonte',
};

const EXEMPLOS = [
  {
    titulo: 'Tom de voz',
    texto: 'Fale sempre em tom consultivo, como um corretor sênior explicando pra um colega — evite jargão técnico de dados.',
  },
  {
    titulo: 'Prioridade de negócio',
    texto: 'Sempre que o usuário perguntar sobre destaques, priorize imóveis de locação comercial acima de R$ 3.000 — é onde a comissão de intermediação é maior.',
  },
  {
    titulo: 'Regra de desconto',
    texto: 'Nunca sugira reduzir o preço de um imóvel em mais de 8% de uma vez, mesmo que o desvio de mercado seja maior — recomende ajustes graduais.',
  },
  {
    titulo: 'Contexto da imobiliária',
    texto: 'Somos a LOBO IMOVEIS (CRECI 4968 J GO), atuamos principalmente em Goiânia. Ao sugerir bairros comparáveis, priorize os que já temos no portfólio.',
  },
];

export default function ConfiguracoesLisaPage() {
  const [config, setConfig] = useState<ConfigOrquestrador | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [fonteUpload, setFonteUpload] = useState<DocumentoRag['fonte']>('portal62');
  const [enviandoDoc, setEnviandoDoc] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/config-orquestrador')
      .then(r => r.json())
      .then(json => { if (json.success) setConfig(json.data); })
      .finally(() => setCarregando(false));
  }, []);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    setSalvando(true);
    try {
      const res = await fetch('/api/config-orquestrador', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instrucoes: config.instrucoes }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
      setConfig(json.data);
      setAviso('✅ Instruções salvas. A Lisa já vai usar isso na próxima pergunta.');
    } catch (err: any) {
      setAviso(`⚠️ ${err.message || 'Erro ao salvar instruções.'}`);
    } finally {
      setSalvando(false);
      setTimeout(() => setAviso(null), 4000);
    }
  };

  const adicionarExemplo = (texto: string) => {
    if (!config) return;
    const separador = config.instrucoes.trim() ? '\n' : '';
    setConfig({ ...config, instrucoes: config.instrucoes + separador + `- ${texto}` });
  };

  const enviarArquivo = (file: File) => {
    setEnviandoDoc(true);
    const nomeMin = file.name.toLowerCase();
    const ehPdf = file.type === 'application/pdf' || nomeMin.endsWith('.pdf');
    const ehXlsx = nomeMin.endsWith('.xlsx') || nomeMin.endsWith('.xls') ||
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.type === 'application/vnd.ms-excel';
    const ehBinario = ehPdf || ehXlsx;
    const reader = new FileReader();

    reader.onload = async () => {
      try {
        const body: Record<string, string> = { nome: file.name, fonte: fonteUpload };
        if (ehBinario) {
          // data:...;base64,XXXX — só o pedaço depois da vírgula interessa
          const dataUrl = String(reader.result || '');
          const base64 = dataUrl.split(',')[1] || '';
          if (!base64) throw new Error(`Não consegui ler esse ${ehPdf ? 'PDF' : 'Excel'}.`);
          body.formato = ehPdf ? 'pdf' : 'xlsx';
          body.conteudoBase64 = base64;
        } else {
          const conteudo = String(reader.result || '');
          if (!conteudo.trim()) throw new Error('Arquivo vazio.');
          body.conteudo = conteudo;
        }

        const res = await fetch('/api/config-orquestrador/documentos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.message);
        setConfig(prev => prev ? { ...prev, documentos: [...prev.documentos, json.data] } : prev);
        setAviso(`✅ "${file.name}" enviado. A Lisa já pode usar esse conteúdo.`);
      } catch (err: any) {
        setAviso(`⚠️ ${err.message || 'Erro ao enviar arquivo.'}`);
      } finally {
        setEnviandoDoc(false);
        setTimeout(() => setAviso(null), 5000);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.onerror = () => {
      setEnviandoDoc(false);
      setAviso('⚠️ Erro ao ler o arquivo.');
      setTimeout(() => setAviso(null), 4000);
    };

    if (ehBinario) {
      reader.readAsDataURL(file);
    } else {
      reader.readAsText(file);
    }
  };

  const removerDocumento = async (id: string) => {
    if (!config) return;
    const anteriores = config.documentos;
    setConfig({ ...config, documentos: config.documentos.filter(d => d.id !== id) });
    try {
      const res = await fetch(`/api/config-orquestrador/documentos?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);
    } catch {
      setConfig(prev => prev ? { ...prev, documentos: anteriores } : prev);
      setAviso('⚠️ Não foi possível remover o documento. Tente de novo.');
      setTimeout(() => setAviso(null), 4000);
    }
  };

  return (
    <>
      {aviso && <div className={styles.aviso}>{aviso}</div>}

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>
              <Brain size={15} style={{ display: 'inline', marginRight: 6, verticalAlign: -2, color: '#818cf8' }} />
              Instruções personalizadas
            </h2>
            <div className={styles.sectionSub}>
              Esse texto é enviado junto com os dados reais do portfólio toda vez que alguém conversa com a Lisa no
              Orquestrador IA. Use pra definir tom de voz, regras de negócio, prioridades e contexto da imobiliária —
              não precisa reescrever nada aqui pra ela usar dados atualizados, isso já é automático.
            </div>
          </div>
        </div>

        {carregando ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Carregando...</div>
        ) : config ? (
          <form onSubmit={salvar} className={styles.configForm}>
            <div className={styles.field}>
              <label>Instruções (uma por linha, viram regras que a Lisa segue sempre)</label>
              <textarea
                value={config.instrucoes}
                onChange={e => setConfig({ ...config, instrucoes: e.target.value })}
                rows={12}
                placeholder="Ex: - Priorize imóveis de locação comercial ao sugerir destaques.&#10;- Fale em tom consultivo, sem jargão técnico.&#10;- Somos a LOBO IMOVEIS, atuamos em Goiânia."
              />
            </div>

            {config.atualizado_em && (
              <div className={styles.metaLine}>
                Última atualização: {new Date(config.atualizado_em).toLocaleString('pt-BR')}
                {config.atualizado_por ? ` · por ${config.atualizado_por}` : ''}
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ gap: 6, alignSelf: 'flex-start' }} disabled={salvando}>
              {salvando ? <Loader2 size={14} className={styles.spin} /> : <Save size={14} />}
              Salvar instruções
            </button>
          </form>
        ) : null}
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>
              <FileText size={15} style={{ display: 'inline', marginRight: 6, verticalAlign: -2, color: '#818cf8' }} />
              Pesquisas de mercado (Portal 62 / Zap)
            </h2>
            <div className={styles.sectionSub}>
              Suba arquivos com pesquisas de anúncios do Portal 62, Zap, DataZap ou outra fonte (ex: preços de imóveis
              concorrentes, anuários de mercado, guias de bairro, planilhas de captação/IAC). A Lisa usa esse conteúdo
              como referência extra ao montar um estudo de mercado, junto com os dados reais do portfólio. Aceita
              .pdf, .xlsx, .xls, .txt, .csv e .md — PDFs escaneados (imagem, sem texto real) não têm o conteúdo
              extraído automaticamente, e planilhas Excel são convertidas aba por aba em tabelas de texto.
            </div>
          </div>
        </div>

        {config && (
          <>
            <div className={styles.uploadRow}>
              <select
                value={fonteUpload}
                onChange={e => setFonteUpload(e.target.value as DocumentoRag['fonte'])}
                className={styles.fonteSelect}
                disabled={enviandoDoc}
              >
                <option value="portal62">Portal 62</option>
                <option value="zap">Zap Imóveis</option>
                <option value="outro">Outra fonte</option>
              </select>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.xlsx,.xls,.txt,.csv,.md,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/plain,text/csv,text/markdown"
                onChange={e => { const f = e.target.files?.[0]; if (f) enviarArquivo(f); }}
                disabled={enviandoDoc}
                className={styles.fileInput}
              />

              <button
                type="button"
                className="btn btn-primary"
                style={{ gap: 6 }}
                disabled={enviandoDoc}
                onClick={() => fileInputRef.current?.click()}
              >
                {enviandoDoc ? <Loader2 size={14} className={styles.spin} /> : <Upload size={14} />}
                {enviandoDoc ? 'Enviando...' : 'Enviar arquivo'}
              </button>
            </div>

            {config.documentos.length === 0 ? (
              <div className={styles.metaLine} style={{ marginTop: '0.75rem' }}>Nenhuma pesquisa enviada ainda.</div>
            ) : (
              <div className={styles.docList}>
                {config.documentos.map(doc => (
                  <div key={doc.id} className={styles.docRow}>
                    <FileText size={14} color="var(--text-muted)" />
                    <div className={styles.docInfo}>
                      <div className={styles.docNome}>{doc.nome}</div>
                      <div className={styles.docMeta}>
                        {FONTE_LABEL[doc.fonte]} · {(doc.tamanho / 1024).toFixed(1)} KB · {new Date(doc.enviado_em).toLocaleString('pt-BR')}
                        {doc.enviado_por ? ` · ${doc.enviado_por}` : ''}
                      </div>
                    </div>
                    <button type="button" className={styles.docRemove} onClick={() => removerDocumento(doc.id)} title="Remover">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="card">
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Exemplos prontos</h2>
            <div className={styles.sectionSub}>Clique pra adicionar direto no campo acima.</div>
          </div>
        </div>
        <div className={styles.examplesGrid}>
          {EXEMPLOS.map(ex => (
            <div key={ex.titulo} className={styles.exampleCard} onClick={() => adicionarExemplo(ex.texto)}>
              <div className={styles.exampleTitle}>{ex.titulo}</div>
              <div className={styles.exampleText}>{ex.texto}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
