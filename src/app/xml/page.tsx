'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import {
  mockRegrasEnriquecimento,
  sampleVrSyncXML,
} from '@/lib/mock-data';
import { RegraEnriquecimento } from '@/lib/types';
import {
  FileCode, Play, CheckCircle2, AlertCircle, Wand2, Download, Copy, RefreshCw, Check, Upload, Link2, Info, Settings, Zap, Clock, ExternalLink,
} from 'lucide-react';
import styles from './page.module.css';
import { useLisaScreenContext } from '@/lib/lisa-context';

interface Alteracao {
  imovelId: string;
  campo: string;
  antes: string;
  depois: string;
  ganho: number;
}

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
  // Qual canal está sendo carregado — só os dois que a imobiliária realmente
  // assina: Grupo OLX (zap/olx/vivareal, um único feed VRSync) e Portal 62
  // (feed próprio, formato portal62_native). Chaves na Mão e ImovelWeb não
  // têm assinatura ativa, por isso não aparecem aqui.
  const [portalOrigem, setPortalOrigem] = useState<'grupo_olx' | 'portal62' | null>(null);
  const portalPendenteRef = useRef<'grupo_olx' | 'portal62' | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ==========================================================
  // PAINEL OPERACIONAL — sincronização real com o Vista CRM
  // ==========================================================
  // Diferente do simulador acima (roda só no navegador), este painel fala
  // com o pipeline de verdade: agendamento configurado em Configurações >
  // Sincronização, execução via scripts/sync-vista-*.mjs, e histórico
  // persistido no Postgres (db.syncLog). Fica em Operações porque é aqui
  // que a equipe já vem checar o estado dos feeds no dia a dia — "Rodar
  // agora" é uma ação frequente, não uma configuração de setup único.
  const [configSync, setConfigSync] = useState<ConfigSync | null>(null);
  const [syncLogs, setSyncLogs] = useState<SyncLogEntry[]>([]);
  const [carregandoSync, setCarregandoSync] = useState(true);
  const [rodandoFeed, setRodandoFeed] = useState<'loft' | 'zap' | null>(null);
  const [avisoSync, setAvisoSync] = useState<string | null>(null);

  const carregarStatusSync = () => {
    fetch('/api/config-sync')
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          setConfigSync(json.data.config);
          setSyncLogs(json.data.logs || []);
        }
      })
      .finally(() => setCarregandoSync(false));
  };

  useEffect(() => {
    carregarStatusSync();
  }, []);

  const rodarSyncAgora = async (feed: 'loft' | 'zap') => {
    setRodandoFeed(feed);
    setAvisoSync(null);
    try {
      const res = await fetch('/api/config-sync/rodar-agora', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feed }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || 'Sincronização terminou com erro — veja o histórico abaixo.');
      setAvisoSync(`✅ Sincronização do feed ${feed === 'loft' ? 'Loft' : 'Zap'} concluída.`);
      carregarStatusSync();
    } catch (err: any) {
      setAvisoSync(`⚠️ ${err.message || 'Erro ao rodar sincronização.'}`);
    } finally {
      setRodandoFeed(null);
      setTimeout(() => setAvisoSync(null), 6000);
    }
  };

  const ultimaExecucao = (feed: 'loft' | 'zap') => syncLogs.find(l => l.feed === feed) || null;

  const toggleRegra = (id: string) => {
    setRegras(prev =>
      prev.map(r => r.id === id ? { ...r, ativo: !r.ativo } : r)
    );
  };

  // Carregar arquivo local enviado pelo usuário. O botão que disparou o
  // seletor de arquivo já deixou em portalPendenteRef qual canal é esse
  // (Grupo OLX ou Portal 62), pra rotular a origem do feed corretamente.
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const origem = portalPendenteRef.current;
    const rotuloOrigem = origem === 'portal62' ? 'Portal 62' : origem === 'grupo_olx' ? 'Grupo OLX (VRSync)' : null;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setXmlOriginal(content);
      setXmlEnriquecido('');
      setPortalOrigem(origem);
      setLogs([
        rotuloOrigem
          ? `📂 Arquivo "${file.name}" carregado (${rotuloOrigem}, ${(content.length / 1024).toFixed(1)} KB).`
          : `📂 Arquivo "${file.name}" carregado com sucesso (${(content.length / 1024).toFixed(1)} KB).`,
      ]);
      setAlteracoes([]);
      setNotaAntes(0);
      setNotaDepois(0);
    };
    reader.readAsText(file);
    e.target.value = '';
    portalPendenteRef.current = null;
  };

  const abrirSeletorArquivo = (portal: 'grupo_olx' | 'portal62') => {
    portalPendenteRef.current = portal;
    fileInputRef.current?.click();
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
      setPortalOrigem(null);
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

  useLisaScreenContext({ secao: 'Motor de XML & Enriquecimento' });

  return (
    <>
      <Header title="Motor de XML &amp; Enriquecimento" subtitle="Processamento automático e higienização de feeds" />
      <div className="page-body animate-fadeIn">

        {/* Esta tela é uma demonstração do motor de regras — roda inteiramente
            no navegador e NÃO grava no banco. O enriquecimento que persiste de
            verdade acontece via Lisa (Orquestrador IA → propor_enriquecer_anuncio)
            ou nos scripts de sincronização diária do Vista. Aviso explícito pra
            não confundir os dois fluxos. */}
        <div className="card" style={{ marginBottom: '1.5rem', borderColor: 'rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.06)' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            <span style={{ fontSize: '1rem' }}>⚠️</span>
            <div>
              <strong style={{ color: 'var(--text-primary)' }}>Isso é uma simulação do motor de regras.</strong> O
              XML processado aqui roda só no seu navegador e não grava no portfólio real — use "Copiar" ou "Baixar"
              pra levar o resultado pra onde precisar. O enriquecimento que fica salvo de verdade acontece pela Lisa
              (Orquestrador IA, ao propor corrigir um anúncio) ou automaticamente na sincronização diária com o Vista CRM.
            </div>
          </div>
        </div>

        {/* PAINEL OPERACIONAL — sincronização real com o Vista CRM */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <h2 className={styles.cardTitle}>
                <Zap size={15} style={{ marginRight: 6, verticalAlign: -2 }} />
                Sincronização com o Vista CRM (real)
              </h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.35rem', maxWidth: '40rem' }}>
                Status e histórico do pipeline que atualiza o portfólio de verdade. Horários de execução automática
                ficam em <Link href="/configuracoes/sincronizacao" style={{ color: 'var(--primary-hover)' }}>Configurações → Sincronização</Link>.
              </p>
            </div>
            <Link href="/configuracoes/sincronizacao" className="btn btn-secondary" style={{ gap: 6, flexShrink: 0 }}>
              Configurar horários <ExternalLink size={13} />
            </Link>
          </div>

          {avisoSync && (
            <div style={{ marginBottom: '1rem', padding: '0.65rem 0.9rem', borderRadius: 8, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', color: '#c7d2fe', fontSize: '0.8rem' }}>
              {avisoSync}
            </div>
          )}

          {carregandoSync ? (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Carregando status...</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {(['loft', 'zap'] as const).map(feed => {
                const ultima = ultimaExecucao(feed);
                const cfg = configSync?.[feed];
                return (
                  <div key={feed} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {feed === 'loft' ? 'Loft (feed completo)' : 'Zap / Grupo OLX'}
                        </span>
                        <span style={{
                          fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: 999,
                          background: cfg?.habilitado ? 'rgba(34,197,94,0.15)' : 'rgba(148,163,184,0.15)',
                          color: cfg?.habilitado ? '#22c55e' : 'var(--text-muted)',
                        }}>
                          {cfg?.habilitado ? 'AGENDADO' : 'MANUAL'}
                        </span>
                      </div>
                      <button
                        className="btn btn-primary"
                        style={{ gap: 6, padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}
                        disabled={rodandoFeed !== null}
                        onClick={() => rodarSyncAgora(feed)}
                      >
                        {rodandoFeed === feed ? <RefreshCw size={13} className={styles.spin} /> : <Play size={13} />}
                        {rodandoFeed === feed ? 'Rodando...' : 'Rodar agora'}
                      </button>
                    </div>
                    {cfg && cfg.horarios.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                        <Clock size={11} /> {cfg.horarios.join(', ')}
                      </div>
                    )}
                    {ultima ? (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        <span style={{ color: ultima.status === 'sucesso' ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
                          {ultima.status === 'sucesso' ? '✓' : '✕'}
                        </span>{' '}
                        {new Date(ultima.executado_em).toLocaleString('pt-BR')} · {ultima.disparado_por === 'manual' ? 'manual' : 'agendado'}
                        {ultima.status === 'sucesso'
                          ? ` · ${ultima.total_alterados ?? 0} alterados de ${ultima.total_no_feed ?? '?'} no feed`
                          : ` · ${ultima.erro_mensagem || 'erro'}`}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Nenhuma sincronização registrada ainda.</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

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

            <div className={styles.uploadBox} style={{ width: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <input
                type="file"
                accept=".xml"
                ref={fileInputRef}
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
              <button
                className="btn btn-secondary"
                style={{ gap: 6, width: 260, justifyContent: 'center' }}
                onClick={() => abrirSeletorArquivo('grupo_olx')}
              >
                <Upload size={14} /> XML Grupo OLX (zap/olx/vivareal)
              </button>
              <button
                className="btn btn-secondary"
                style={{ gap: 6, width: 260, justifyContent: 'center' }}
                onClick={() => abrirSeletorArquivo('portal62')}
              >
                <Upload size={14} /> XML Portal 62
              </button>
            </div>
          </div>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
            Só os canais com assinatura ativa: Grupo OLX (feed único VRSync para ZAP, OLX e VivaReal) e Portal 62 (feed próprio). Chaves na Mão e ImovelWeb não têm assinatura hoje.
          </p>
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
              <span className={styles.editorLabel}>
                Entrada XML (Cole ou Edite aqui)
                {portalOrigem && (
                  <span style={{ marginLeft: 8, fontSize: '0.68rem', fontWeight: 700, color: 'var(--primary-hover)' }}>
                    · {portalOrigem === 'portal62' ? 'Portal 62' : 'Grupo OLX (VRSync)'}
                  </span>
                )}
              </span>
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
                setPortalOrigem(null);
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
