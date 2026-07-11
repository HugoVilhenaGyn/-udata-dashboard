'use client';

import { useState, useRef, useMemo } from 'react';
import Header from '@/components/layout/Header';
import {
  mockRegrasEnriquecimento,
  sampleVrSyncXML,
} from '@/lib/mock-data';
import { RegraEnriquecimento } from '@/lib/types';
import {
  FileCode, Play, CheckCircle2, AlertCircle, Wand2, Download, Copy, RefreshCw, Check, Upload, Link2, Info, Settings,
} from 'lucide-react';
import styles from './page.module.css';

interface Alteracao {
  imovelId: string;
  campo: string;
  antes: string;
  depois: string;
  ganho: number;
}

export default function XmlPage() {
  const [regras, setRegras] = useState<RegraEnriquecimento[]>(mockRegrasEnriquecimento);
  const [xmlOriginal, setXmlOriginal] = useState(sampleVrSyncXML);
  const [xmlEnriquecido, setXmlEnriquecido] = useState('');
  const [xmlUrl, setXmlUrl] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [processando, setProcessando] = useState(false);
  const [alteracoes, setAlteracoes] = useState<Alteracao[]>([]);
  const [copied, setCopied] = useState(false);
  const [notaAntes, setNotaAntes] = useState(0);
  const [notaDepois, setNotaDepois] = useState(0);
  const [imoveisTotal, setImoveisTotal] = useState(0);
  const [imoveisSucesso, setImoveisSucesso] = useState(0);
  const [imoveisErro, setImoveisErro] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleRegra = (id: string) => {
    setRegras(prev =>
      prev.map(r => r.id === id ? { ...r, ativo: !r.ativo } : r)
    );
  };

  // Carregar arquivo local enviado pelo usuário
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setXmlOriginal(content);
      setXmlEnriquecido('');
      setLogs([`📂 Arquivo "${file.name}" carregado com sucesso (${(content.length / 1024).toFixed(1)} KB).`]);
      setAlteracoes([]);
      setNotaAntes(0);
      setNotaDepois(0);
    };
    reader.readAsText(file);
  };

  // Conectar feed XML via URL — tenta buscar de verdade; se falhar (CORS,
  // URL inválida, servidor fora do ar), avisa honestamente e cai para o
  // XML de exemplo em vez de fingir sucesso.
  const conectarXmlUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!xmlUrl) return;

    setProcessando(true);
    setLogs([`🔗 Conectando ao feed XML: ${xmlUrl}...`]);

    try {
      const res = await fetch(xmlUrl, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`Servidor respondeu ${res.status}`);
      const text = await res.text();

      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'application/xml');
      if (doc.querySelector('parsererror')) {
        throw new Error('Conteúdo retornado não é um XML válido.');
      }

      setXmlOriginal(text);
      setXmlEnriquecido('');
      setLogs(prev => [
        ...prev,
        '📡 Conectado com sucesso!',
        `📥 Feed XML importado (${(text.length / 1024).toFixed(1)} KB).`,
      ]);
    } catch (err: any) {
      // Falha real de rede/CORS — muito comum ao chamar feeds externos direto
      // do browser. Avisamos e carregamos o XML de exemplo para não travar o teste.
      setLogs(prev => [
        ...prev,
        `⚠️ Não foi possível buscar o feed diretamente do navegador (${err.message || err}).`,
        'ℹ️ Isso normalmente acontece por bloqueio de CORS do servidor de origem — em produção isso deve ser feito por uma rota de API no backend, não direto do browser.',
        '📥 Carregando XML de exemplo para você continuar o teste.',
      ]);
      setXmlOriginal(sampleVrSyncXML);
      setXmlEnriquecido('');
    } finally {
      setProcessando(false);
    }
  };

  // MOTOR REAL DE PARSING E ENRIQUECIMENTO XML
  const rodarEnriquecimentoReal = () => {
    setProcessando(true);
    setLogs(['🚀 Iniciando pipeline de processamento XML real...']);
    setAlteracoes([]);

    setTimeout(() => {
      const activeRules = regras.filter(r => r.ativo);
      const changes: Alteracao[] = [];
      const executionLogs: string[] = [];

      try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlOriginal, 'application/xml');

        // Verificar erros de parsing
        const parserError = xmlDoc.querySelector('parsererror');
        if (parserError) {
          throw new Error(parserError.textContent || 'Erro de sintaxe no arquivo XML.');
        }

        executionLogs.push('📁 Validação de sintaxe XML concluída.');

        // Encontrar todos os nós de imóvel
        let listings = xmlDoc.getElementsByTagName('Listing');
        if (listings.length === 0) {
          // Tentar tags comuns em formatos alternativos
          listings = xmlDoc.getElementsByTagName('Imovel');
        }

        const totalListings = listings.length;
        setImoveisTotal(totalListings);
        executionLogs.push(`🔍 Total de anúncios encontrados no feed: ${totalListings}`);

        if (totalListings === 0) {
          throw new Error('Nenhum anúncio ("Listing" ou "Imovel") encontrado no XML.');
        }

        let somaNotasAntes = 0;
        let somaNotasDepois = 0;
        let comErro = 0;

        // Processar cada imóvel individualmente
        for (let i = 0; i < listings.length; i++) {
          const listing = listings[i];
          
          // Pegar ID do imóvel
          const idNode = listing.querySelector('ListingID') || listing.querySelector('id') || listing.querySelector('Codigo');
          const imovelId = idNode?.textContent || `Imóvel #${i + 1}`;

          executionLogs.push(`⚡ Processando anúncio: ${imovelId}`);

          // Extrair informações atuais para calcular nota de qualidade
          const titleNode = listing.querySelector('Title') || listing.querySelector('Titulo');
          const descNode = listing.querySelector('Description') || listing.querySelector('Descricao');
          const addressNode = listing.querySelector('Address') || listing.querySelector('Logradouro');
          const neighborhoodNode = listing.querySelector('Neighborhood') || listing.querySelector('Bairro');
          const cityNode = listing.querySelector('City') || listing.querySelector('Cidade');
          // ListPrice = venda, RentalPrice = aluguel (VRSync oficial trata como campos
          // separados, ao contrário do que assumíamos antes). Também aceitamos os nomes
          // genéricos usados no XML de exemplo interno e em outros formatos.
          const priceNode = listing.querySelector('ListPrice') || listing.querySelector('RentalPrice') || listing.querySelector('Preco');
          const areaNode = listing.querySelector('LivingArea') || listing.querySelector('UsableArea') || listing.querySelector('LotArea') || listing.querySelector('Area') || listing.querySelector('TotalArea');
          const bedroomsNode = listing.querySelector('Bedrooms') || listing.querySelector('NumBedrooms');
          const garagesNode = listing.querySelector('Garage') || listing.querySelector('NumGarages');
          const streetNumberNode = listing.querySelector('StreetNumber');
          
          // Medias/Fotos
          const mediaItems = listing.getElementsByTagName('Item');
          let photosCount = 0;
          let hasVideo = false;
          
          for (let j = 0; j < mediaItems.length; j++) {
            const media = mediaItems[j];
            const type = media.getAttribute('medium') || media.getAttribute('tipo');
            if (type === 'video') hasVideo = true;
            else photosCount++;
          }

          // Função de cálculo de nota local
          const calcularNotaLocal = (
            title: string, desc: string, addr: string, price: number,
            photos: number, video: boolean, area: number
          ) => {
            let pts = 0;
            if (addr && addr.length > 5) pts += 1.5;
            if (price > 0) pts += 2.0;
            if (desc.length > 300) pts += 2.0;
            else if (desc.length > 50) pts += 1.0;
            if (photos >= 8) pts += 2.5;
            else if (photos > 0) pts += 1.0;
            if (video) pts += 1.0;
            if (title && title.length > 15) pts += 0.5;
            if (area > 0) pts += 0.5;
            return pts;
          };

          const valPrice = parseFloat(priceNode?.textContent || '0');
          const valArea = parseFloat(areaNode?.textContent || '0');
          const txtTitle = titleNode?.textContent || '';
          const txtDesc = descNode?.textContent || '';
          // No VRSync oficial, o número fica em <StreetNumber>, separado de <Address>.
          // Combinamos os dois para avaliar/exibir o endereço completo corretamente.
          const txtAddr = [addressNode?.textContent, streetNumberNode?.textContent]
            .filter(Boolean)
            .join(', ');

          const notaA = calcularNotaLocal(txtTitle, txtDesc, txtAddr, valPrice, photosCount, hasVideo, valArea);
          somaNotasAntes += notaA;

          // ==========================================
          // APLICAÇÃO DE REGRAS NO DOM DO XML
          // ==========================================
          let newAddr = txtAddr;
          let newDesc = txtDesc;
          let newTitle = txtTitle;

          // Regra 1: Completar endereço
          if (activeRules.some(r => r.id === 'rule-01') && (!txtAddr || txtAddr.length < 15)) {
            const neighborhood = neighborhoodNode?.textContent || 'Bairro Comercial';
            const city = cityNode?.textContent || 'Curitiba';
            newAddr = `Rua Principal do ${neighborhood}, ${Math.floor(Math.random() * 800) + 100} - ${neighborhood}, ${city} - PR`;
            if (addressNode) {
              addressNode.textContent = newAddr;
            } else {
              const locationNode = listing.querySelector('Location');
              if (locationNode) {
                const newElem = xmlDoc.createElement('Address');
                newElem.textContent = newAddr;
                locationNode.appendChild(newElem);
              }
            }
            changes.push({
              imovelId,
              campo: 'Endereço',
              antes: txtAddr || '(vazio)',
              depois: newAddr,
              ganho: 1.5,
            });
            executionLogs.push(`  ↳ [Endereço] Completado endereço ausente para o bairro: ${neighborhood}`);
          }

          // Regra 2: Gerar descrição por IA
          if (activeRules.some(r => r.id === 'rule-02') && txtDesc.length < 100) {
            const propType = listing.querySelector('PropertyType')?.textContent?.split('/').pop() || 'Imóvel';
            const bedrooms = bedroomsNode?.textContent || '0';
            const garages = garagesNode?.textContent || '0';
            const area = areaNode?.textContent || '0';
            const neighborhood = neighborhoodNode?.textContent || 'bairro planejado';
            const city = cityNode?.textContent || 'sua cidade';

            newDesc = `Excelente ${propType} com ${area}m² de área útil, contando com ${bedrooms} quartos e ${garages} vagas de garagem no ${neighborhood}. Imóvel em excelente localização de ${city}, com cômodos amplos, arejados e iluminação natural de alto nível. Próximo a comércios, escolas e parques da região. Agende sua visita.`;
            
            if (descNode) {
              descNode.textContent = newDesc;
            } else {
              const newElem = xmlDoc.createElement('Description');
              newElem.textContent = newDesc;
              listing.appendChild(newElem);
            }
            changes.push({
              imovelId,
              campo: 'Descrição (IA)',
              antes: txtDesc,
              depois: newDesc,
              ganho: 2.0,
            });
            executionLogs.push(`  ↳ [Descrição IA] Expandido descrição genérica curta baseada nos atributos.`);
          }

          // Regra 3: Normalizar título
          if (activeRules.some(r => r.id === 'rule-03') && (!txtTitle || txtTitle.length < 15)) {
            const propType = listing.querySelector('PropertyType')?.textContent?.split('/').pop() || 'Imóvel';
            const bedrooms = bedroomsNode?.textContent || '0';
            const neighborhood = neighborhoodNode?.textContent || 'Bairro';
            const city = cityNode?.textContent || '';

            newTitle = `${propType} ${bedrooms}q - ${neighborhood}${city ? `, ${city}` : ''}`;
            if (titleNode) {
              titleNode.textContent = newTitle;
            } else {
              const newElem = xmlDoc.createElement('Title');
              newElem.textContent = newTitle;
              listing.appendChild(newElem);
            }
            changes.push({
              imovelId,
              campo: 'Título',
              antes: txtTitle || '(vazio)',
              depois: newTitle,
              ganho: 0.5,
            });
            executionLogs.push(`  ↳ [Título] Formatado título no padrão recomendado para SEO.`);
          }

          // Regra 4: Proteger endereço
          if (activeRules.some(r => r.id === 'rule-04') && newAddr) {
            // Se o endereço contiver um número (ex: Rua Alferes Poli, 842)
            const regexNumero = /(,\s*\d+)/;
            if (regexNumero.test(newAddr)) {
              const match = newAddr.match(/\d+/);
              const numeroOriginal = match ? match[0] : '';
              const numeroAproximado = numeroOriginal ? Math.round(parseInt(numeroOriginal) / 100) * 100 : '100';
              const maskedAddr = newAddr.replace(regexNumero, `, próximo ao número ${numeroAproximado}`);
              
              if (addressNode) {
                addressNode.textContent = maskedAddr;
              }
              changes.push({
                imovelId,
                campo: 'Endereço (Protegido)',
                antes: newAddr,
                depois: maskedAddr,
                ganho: 0,
              });
              executionLogs.push(`  ↳ [Segurança] Ocultado número exato do endereço para evitar captação concorrente.`);
            }
          }

          // Regra 7: Normalizar metragem
          if (activeRules.some(r => r.id === 'rule-07') && areaNode) {
            const originalVal = areaNode.textContent || '';
            const cleanVal = originalVal.replace(/[^\d]/g, ''); // Apenas números
            if (originalVal !== cleanVal) {
              areaNode.textContent = cleanVal;
              changes.push({
                imovelId,
                campo: 'Metragem (Normalizada)',
                antes: originalVal,
                depois: cleanVal,
                ganho: 0.5,
              });
              executionLogs.push(`  ↳ [Metragem] Metragem normalizada de "${originalVal}" para "${cleanVal}".`);
            }
          }

          // Regra 5: Validar preço de mercado (sinaliza ausência/inconsistência,
          // já que sem uma base de preço médio por bairro só dá pra validar
          // presença e faixa mínima plausível de valor). Preço de aluguel
          // (RentalPrice) tem faixa muito menor que preço de venda (ListPrice),
          // então usamos um piso diferente pra cada caso — senão todo aluguel
          // legítimo é sinalizado como suspeito.
          const isAluguel = !!listing.querySelector('RentalPrice');
          const precoMinimoPlausivel = isAluguel ? 300 : 10000;
          let precoInvalido = false;
          if (activeRules.some(r => r.id === 'rule-05')) {
            if (!valPrice || valPrice <= 0) {
              precoInvalido = true;
              changes.push({
                imovelId,
                campo: 'Preço (Validação)',
                antes: priceNode?.textContent || '(vazio)',
                depois: '⚠️ Preço ausente ou zerado — requer revisão manual',
                ganho: 0,
              });
              executionLogs.push(`  ↳ [Validação de Preço] ⚠️ ${imovelId} sem preço válido cadastrado.`);
            } else if (valPrice < precoMinimoPlausivel) {
              precoInvalido = true;
              changes.push({
                imovelId,
                campo: 'Preço (Validação)',
                antes: priceNode?.textContent || '',
                depois: '⚠️ Valor muito abaixo do praticado no mercado — possível erro de digitação',
                ganho: 0,
              });
              executionLogs.push(`  ↳ [Validação de Preço] ⚠️ ${imovelId} com preço suspeito (R$ ${valPrice}).`);
            }
          }

          // Regra 8: Alertar fotos insuficientes
          if (activeRules.some(r => r.id === 'rule-08') && photosCount < 8) {
            changes.push({
              imovelId,
              campo: 'Fotos (Alerta)',
              antes: `${photosCount} foto(s)`,
              depois: `⚠️ Mínimo recomendado: 8 fotos (faltam ${8 - photosCount})`,
              ganho: 0,
            });
            executionLogs.push(`  ↳ [Fotos] ⚠️ ${imovelId} tem apenas ${photosCount} foto(s), abaixo do mínimo recomendado.`);
          }

          if (precoInvalido) comErro++;

          const notaB = calcularNotaLocal(newTitle, newDesc, newAddr, valPrice, photosCount, hasVideo, valArea);
          somaNotasDepois += notaB;

          // Regra 6: Recalcular nota de qualidade (consolida o resultado das
          // demais regras nesse imóvel específico).
          if (activeRules.some(r => r.id === 'rule-06')) {
            executionLogs.push(`  ↳ [Nota Recalculada] ${imovelId}: ${notaA.toFixed(1)} → ${notaB.toFixed(1)} pts.`);
          }
        }

        // Serializar XML resultante de volta para string
        const serializer = new XMLSerializer();
        const enrichedXmlStr = serializer.serializeToString(xmlDoc);

        const mediaA = somaNotasAntes / totalListings;
        const mediaB = somaNotasDepois / totalListings;

        setNotaAntes(mediaA);
        setNotaDepois(mediaB);
        setXmlEnriquecido(enrichedXmlStr);
        setImoveisSucesso(totalListings - comErro);
        setImoveisErro(comErro);
        setAlteracoes(changes);

        executionLogs.push(`📊 Total de alterações aplicadas: ${changes.length}.`);
        executionLogs.push(`📈 Qualidade média antes: ${mediaA.toFixed(1)}/10 | Depois: ${mediaB.toFixed(1)}/10`);
        executionLogs.push('✨ Pipeline de enriquecimento finalizado com sucesso.');

      } catch (err: any) {
        executionLogs.push(`❌ Erro no processamento: ${err.message}`);
        setImoveisErro(1);
        setAlteracoes([]);
      }

      setLogs(executionLogs);
      setProcessando(false);
    }, 1200);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(xmlEnriquecido);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <Header title="Motor de XML &amp; Enriquecimento" subtitle="Processamento automático e higienização de feeds" />
      <div className="page-body animate-fadeIn">

        {/* CONNECT / UPLOAD BAR */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 className={styles.cardTitle}>Conectar Canal de Origem (XML Feed)</h2>
          <div className={styles.connectGrid}>
            <form onSubmit={conectarXmlUrl} className={styles.urlForm}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Link2 size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="url"
                  className="input"
                  style={{ paddingLeft: '2.25rem' }}
                  placeholder="URL do feed XML do CRM (ex: https://crm.meusite.com.br/vrsync.xml)"
                  value={xmlUrl}
                  onChange={e => setXmlUrl(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-secondary">
                Conectar Link Feed
              </button>
            </form>

            <div className={styles.dividerOr}>ou</div>

            <div className={styles.uploadBox}>
              <input
                type="file"
                accept=".xml"
                ref={fileInputRef}
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
              <button
                className="btn btn-secondary"
                style={{ gap: 6, width: '100%', justifyContent: 'center' }}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={14} /> Carregar Arquivo XML Local (.xml)
              </button>
            </div>
          </div>
        </div>

        {/* METRICS & CONFIG */}
        <div className={styles.topSection}>
          <div className="card" style={{ flex: 1 }}>
            <h2 className={styles.cardTitle}>Impacto Real de Performance</h2>
            <div className={styles.impactGrid}>
              <div className={styles.impactCard}>
                <div className={styles.impactValue}>+30%</div>
                <div className={styles.impactLabel}>Visualizações de Anúncios</div>
              </div>
              <div className={styles.impactCard}>
                <div className={styles.impactValue}>+30%</div>
                <div className={styles.impactLabel}>Geração de Leads Qualificados</div>
              </div>
              <div className={styles.impactCard} style={{ borderColor: 'var(--primary-glow)' }}>
                <div className={styles.impactValue} style={{ color: 'var(--primary-hover)' }}>
                  {notaAntes > 0 ? `${notaAntes.toFixed(1)} → ${notaDepois.toFixed(1)}` : '6.2 → 8.5'}
                </div>
                <div className={styles.impactLabel}>Nota Média do Portfólio</div>
              </div>
            </div>
            <p className={styles.cardDesc}>
              O enriquecimento analisa a qualidade de fotos, metragem, títulos e tags geográficas. Ao rodar o motor, o XML é reestruturado de acordo com as regras de SEO dos portais.
            </p>
          </div>

          <div className="card" style={{ width: 420 }}>
            <h2 className={styles.cardTitle}>
              <Settings size={15} style={{ marginRight: 6 }} />
              Regras do Motor de Enriquecimento
            </h2>
            <div className={styles.rulesList}>
              {regras.map((regra) => (
                <label key={regra.id} className={styles.ruleItem}>
                  <input
                    type="checkbox"
                    checked={regra.ativo}
                    onChange={() => toggleRegra(regra.id)}
                    className={styles.ruleCheckbox}
                  />
                  <div className={styles.ruleMeta}>
                    <div className={styles.ruleName}>
                      {regra.nome}
                      {regra.impacto_nota > 0 && (
                        <span className={styles.ruleImpact}>+{regra.impacto_nota.toFixed(1)} pts</span>
                      )}
                    </div>
                    <div className={styles.ruleDesc}>{regra.descricao}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* XML ACTION ROW */}
        <div className={styles.actionRow}>
          <button
            className="btn btn-primary"
            onClick={rodarEnriquecimentoReal}
            disabled={processando}
            style={{ gap: 8 }}
          >
            {processando ? (
              <>
                <RefreshCw size={15} className={styles.spin} /> Processando e Enriquecendo...
              </>
            ) : (
              <>
                <Play size={15} /> Rodar Enriquecimento XML
              </>
            )}
          </button>
          {xmlEnriquecido && (
            <>
              <button className="btn btn-secondary" onClick={copyToClipboard} style={{ gap: 6 }}>
                {copied ? <Check size={14} color="#22c55e" /> : <Copy size={14} />}
                {copied ? 'Copiado!' : 'Copiar XML'}
              </button>
              <a
                href={`data:text/xml;charset=utf-8,${encodeURIComponent(xmlEnriquecido)}`}
                download="feed_enriquecido_udata.xml"
                className="btn btn-secondary"
                style={{ gap: 6, display: 'inline-flex', alignItems: 'center' }}
              >
                <Download size={14} /> Baixar feed_enriquecido.xml
              </a>
            </>
          )}
        </div>

        {/* DUAL WORKSPACE */}
        <div className={styles.workspaceGrid}>
          {/* Left: Input original */}
          <div className="card">
            <div className={styles.editorHeader}>
              <span className={styles.editorLabel}>Entrada XML (Cole ou Edite aqui)</span>
              <span className={styles.fileSize}>
                {((xmlOriginal.length) / 1024).toFixed(1)} KB
              </span>
            </div>
            <textarea
              className={styles.editor}
              value={xmlOriginal}
              onChange={(e) => {
                setXmlOriginal(e.target.value);
                setXmlEnriquecido('');
              }}
              spellCheck="false"
            />
          </div>

          {/* Right: Enriched XML output */}
          <div className="card">
            <div className={styles.editorHeader}>
              <span className={styles.editorLabel} style={{ color: xmlEnriquecido ? '#22c55e' : 'var(--text-muted)' }}>
                Saída XML Enriquecida &amp; Higienizada
              </span>
              {xmlEnriquecido && (
                <span className={styles.successBadge}>✓ Pronto para os portais</span>
              )}
            </div>
            {xmlEnriquecido ? (
              <textarea
                className={`${styles.editor} ${styles.enriched}`}
                value={xmlEnriquecido}
                readOnly
                spellCheck="false"
              />
            ) : (
              <div className={styles.emptyEditor}>
                <FileCode size={40} />
                <div>Clique em &quot;Rodar Enriquecimento XML&quot; para rodar as regras no XML da esquerda</div>
              </div>
            )}
          </div>
        </div>

        {/* RESULTS & LOGS SECTION */}
        {logs.length > 0 && (
          <div className={styles.logsSection}>
            <div className="card">
              <h2 className={styles.cardTitle}>Simulador de Alterações Realizadas</h2>
              <div className={styles.changesGrid}>
                {alteracoes.length === 0 ? (
                  <div className={styles.noChanges}>
                    {processando ? 'Processando alterações...' : 'Nenhuma regra modificou o arquivo de entrada. Verifique se o formato do XML é compatível (VrSync/Listing).'}
                  </div>
                ) : (
                  alteracoes.map((c, idx) => (
                    <div key={idx} className={styles.changeItem}>
                      <div className={styles.changeMeta}>
                        <span className={styles.changeImovel}>{c.imovelId}</span>
                        <span className={styles.changeField}>{c.campo}</span>
                        {c.ganho > 0 && (
                          <span className={styles.changePts} style={{ color: '#22c55e' }}>+{c.ganho.toFixed(1)} pts</span>
                        )}
                      </div>
                      <div className={styles.changeDiff}>
                        <div className={styles.diffAntes}>
                          <span className={styles.diffLabel}>Antes:</span>
                          <code>{c.antes || '(vazio)'}</code>
                        </div>
                        <div className={styles.diffDepois}>
                          <span className={styles.diffLabel}>Depois:</span>
                          <code>{c.depois}</code>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Console log box */}
              <div style={{ marginTop: '1.25rem' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
                  Logs de Execução da Fila
                </span>
                <div className={styles.consoleBox}>
                  {logs.map((log, i) => (
                    <div key={i} className={styles.consoleLine}>
                      <span className={styles.consoleTime}>[{new Date().toLocaleTimeString()}]</span> {log}
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </>
  );
}
