// Motor de Enriquecimento XML — execução REAL (não simulada), fora do navegador.
// Replica fielmente as 8 regras implementadas em src/app/xml/page.tsx (UDATA)
// e roda contra o feed real e completo da LOBO IMOVEIS (340 imóveis, Loft CRM).

const fs = require('fs');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');

const INPUT = process.argv[2];
const OUTPUT_XML = process.argv[3];
const OUTPUT_REPORT = process.argv[4];

if (!INPUT || !OUTPUT_XML || !OUTPUT_REPORT) {
  console.error('Uso: node enrich-real.js <entrada.xml> <saida.xml> <relatorio.json>');
  process.exit(1);
}

// querySelector('Tag') simplificado -> primeiro descendente com essa tag,
// equivalente ao que o código original usa (só seletores de tag simples).
function q1(el, name) {
  if (!el) return null;
  const list = el.getElementsByTagName(name);
  return list.length ? list[0] : null;
}
function q1any(el, names) {
  for (const n of names) {
    const found = q1(el, n);
    if (found) return found;
  }
  return null;
}
function text(node) {
  return node && node.textContent != null ? node.textContent : '';
}

const xmlOriginal = fs.readFileSync(INPUT, 'utf-8');

// Regras (espelham mockRegrasEnriquecimento — todas ativas por padrão no app)
const activeRuleIds = new Set([
  'rule-01', 'rule-02', 'rule-03', 'rule-04',
  'rule-05', 'rule-06', 'rule-07', 'rule-08',
]);

const changes = [];
const executionLogs = [];
let errorsParsing = null;

const parser = new DOMParser({
  onError: (level, msg) => {
    if (level === 'error' || level === 'fatalError') errorsParsing = msg;
  },
});
const xmlDoc = parser.parseFromString(xmlOriginal, 'application/xml');

if (errorsParsing) {
  console.error('❌ Erro de sintaxe XML:', errorsParsing);
  process.exit(1);
}

executionLogs.push('📁 Validação de sintaxe XML concluída.');

let listings = xmlDoc.getElementsByTagName('Listing');
if (listings.length === 0) {
  listings = xmlDoc.getElementsByTagName('Imovel');
}
const totalListings = listings.length;
executionLogs.push(`🔍 Total de anúncios encontrados no feed: ${totalListings}`);

if (totalListings === 0) {
  console.error('Nenhum anúncio ("Listing" ou "Imovel") encontrado no XML.');
  process.exit(1);
}

function calcularNotaLocal(title, desc, addr, price, photos, video, area) {
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
}

let somaNotasAntes = 0;
let somaNotasDepois = 0;
let comErro = 0;
let semPreco = 0;
let precoSuspeito = 0;
let fotosInsuficientes = 0;

const listingsArr = [];
for (let i = 0; i < listings.length; i++) listingsArr.push(listings[i]);

listingsArr.forEach((listing, i) => {
  const idNode = q1any(listing, ['ListingID', 'id', 'Codigo']);
  const imovelId = text(idNode) || `Imóvel #${i + 1}`;

  const titleNode = q1any(listing, ['Title', 'Titulo']);
  const descNode = q1any(listing, ['Description', 'Descricao']);
  const addressNode = q1any(listing, ['Address', 'Logradouro']);
  const neighborhoodNode = q1any(listing, ['Neighborhood', 'Bairro']);
  const cityNode = q1any(listing, ['City', 'Cidade']);
  const priceNode = q1any(listing, ['ListPrice', 'RentalPrice', 'Preco']);
  const areaNode = q1any(listing, ['LivingArea', 'UsableArea', 'LotArea', 'Area', 'TotalArea']);
  const bedroomsNode = q1any(listing, ['Bedrooms', 'NumBedrooms']);
  const garagesNode = q1any(listing, ['Garage', 'NumGarages']);
  const streetNumberNode = q1(listing, 'StreetNumber');

  const mediaItems = listing.getElementsByTagName('Item');
  let photosCount = 0;
  let hasVideo = false;
  for (let j = 0; j < mediaItems.length; j++) {
    const media = mediaItems[j];
    const type = media.getAttribute('medium') || media.getAttribute('tipo');
    if (type === 'video') hasVideo = true;
    else photosCount++;
  }

  const valPrice = parseFloat(text(priceNode) || '0');
  const valArea = parseFloat(text(areaNode) || '0');
  const txtTitle = text(titleNode);
  const txtDesc = text(descNode);
  const txtAddr = [text(addressNode), text(streetNumberNode)].filter(Boolean).join(', ');

  const notaA = calcularNotaLocal(txtTitle, txtDesc, txtAddr, valPrice, photosCount, hasVideo, valArea);
  somaNotasAntes += notaA;

  let newAddr = txtAddr;
  let newDesc = txtDesc;
  let newTitle = txtTitle;

  // Regra 1: Completar endereço
  if (activeRuleIds.has('rule-01') && (!txtAddr || txtAddr.length < 15)) {
    const neighborhood = text(neighborhoodNode) || 'Bairro Comercial';
    const city = text(cityNode) || 'Curitiba';
    newAddr = `Rua Principal do ${neighborhood}, ${Math.floor(Math.random() * 800) + 100} - ${neighborhood}, ${city} - PR`;
    if (addressNode) {
      addressNode.textContent = newAddr;
    } else {
      const locationNode = q1(listing, 'Location');
      if (locationNode) {
        const newElem = xmlDoc.createElement('Address');
        newElem.textContent = newAddr;
        locationNode.appendChild(newElem);
      }
    }
    changes.push({ imovelId, campo: 'Endereço', antes: txtAddr || '(vazio)', depois: newAddr, ganho: 1.5 });
    executionLogs.push(`  ↳ [Endereço] Completado endereço ausente para o bairro: ${neighborhood}`);
  }

  // Regra 2: Gerar descrição por IA
  if (activeRuleIds.has('rule-02') && txtDesc.length < 100) {
    const propTypeNode = q1(listing, 'PropertyType');
    const propType = (text(propTypeNode).split('/').pop() || 'Imóvel').trim() || 'Imóvel';
    const bedrooms = text(bedroomsNode) || '0';
    const garages = text(garagesNode) || '0';
    const area = text(areaNode) || '0';
    const neighborhood = text(neighborhoodNode) || 'bairro planejado';
    const city = text(cityNode) || 'sua cidade';

    newDesc = `Excelente ${propType} com ${area}m² de área útil, contando com ${bedrooms} quartos e ${garages} vagas de garagem no ${neighborhood}. Imóvel em excelente localização de ${city}, com cômodos amplos, arejados e iluminação natural de alto nível. Próximo a comércios, escolas e parques da região. Agende sua visita.`;

    if (descNode) {
      descNode.textContent = newDesc;
    } else {
      const newElem = xmlDoc.createElement('Description');
      newElem.textContent = newDesc;
      listing.appendChild(newElem);
    }
    changes.push({ imovelId, campo: 'Descrição (IA)', antes: txtDesc, depois: newDesc, ganho: 2.0 });
    executionLogs.push(`  ↳ [Descrição IA] Expandido descrição genérica curta baseada nos atributos.`);
  }

  // Regra 3: Normalizar título
  if (activeRuleIds.has('rule-03') && (!txtTitle || txtTitle.length < 15)) {
    const propTypeNode = q1(listing, 'PropertyType');
    const propType = (text(propTypeNode).split('/').pop() || 'Imóvel').trim() || 'Imóvel';
    const bedrooms = text(bedroomsNode) || '0';
    const neighborhood = text(neighborhoodNode) || 'Bairro';
    const city = text(cityNode);

    newTitle = `${propType} ${bedrooms}q - ${neighborhood}${city ? `, ${city}` : ''}`;
    if (titleNode) {
      titleNode.textContent = newTitle;
    } else {
      const newElem = xmlDoc.createElement('Title');
      newElem.textContent = newTitle;
      listing.appendChild(newElem);
    }
    changes.push({ imovelId, campo: 'Título', antes: txtTitle || '(vazio)', depois: newTitle, ganho: 0.5 });
    executionLogs.push(`  ↳ [Título] Formatado título no padrão recomendado para SEO.`);
  }

  // Regra 4: Proteger endereço
  if (activeRuleIds.has('rule-04') && newAddr) {
    const regexNumero = /(,\s*\d+)/;
    if (regexNumero.test(newAddr)) {
      const match = newAddr.match(/\d+/);
      const numeroOriginal = match ? match[0] : '';
      const numeroAproximado = numeroOriginal ? Math.round(parseInt(numeroOriginal) / 100) * 100 : '100';
      const maskedAddr = newAddr.replace(regexNumero, `, próximo ao número ${numeroAproximado}`);
      if (addressNode) {
        addressNode.textContent = maskedAddr;
      }
      changes.push({ imovelId, campo: 'Endereço (Protegido)', antes: newAddr, depois: maskedAddr, ganho: 0 });
      executionLogs.push(`  ↳ [Segurança] Ocultado número exato do endereço para evitar captação concorrente.`);
    }
  }

  // Regra 7: Normalizar metragem
  if (activeRuleIds.has('rule-07') && areaNode) {
    const originalVal = text(areaNode) || '';
    const cleanVal = originalVal.replace(/[^\d]/g, '');
    if (originalVal !== cleanVal) {
      areaNode.textContent = cleanVal;
      changes.push({ imovelId, campo: 'Metragem (Normalizada)', antes: originalVal, depois: cleanVal, ganho: 0.5 });
      executionLogs.push(`  ↳ [Metragem] Metragem normalizada de "${originalVal}" para "${cleanVal}".`);
    }
  }

  // Regra 5: Validar preço de mercado
  const isAluguel = !!q1(listing, 'RentalPrice');
  const precoMinimoPlausivel = isAluguel ? 300 : 10000;
  let precoInvalido = false;
  if (activeRuleIds.has('rule-05')) {
    if (!valPrice || valPrice <= 0) {
      precoInvalido = true;
      semPreco++;
      changes.push({ imovelId, campo: 'Preço (Validação)', antes: text(priceNode) || '(vazio)', depois: '⚠️ Preço ausente ou zerado — requer revisão manual', ganho: 0 });
      executionLogs.push(`  ↳ [Validação de Preço] ⚠️ ${imovelId} sem preço válido cadastrado.`);
    } else if (valPrice < precoMinimoPlausivel) {
      precoInvalido = true;
      precoSuspeito++;
      changes.push({ imovelId, campo: 'Preço (Validação)', antes: text(priceNode), depois: '⚠️ Valor muito abaixo do praticado no mercado — possível erro de digitação', ganho: 0 });
      executionLogs.push(`  ↳ [Validação de Preço] ⚠️ ${imovelId} com preço suspeito (R$ ${valPrice}).`);
    }
  }

  // Regra 8: Alertar fotos insuficientes
  if (activeRuleIds.has('rule-08') && photosCount < 8) {
    fotosInsuficientes++;
    changes.push({ imovelId, campo: 'Fotos (Alerta)', antes: `${photosCount} foto(s)`, depois: `⚠️ Mínimo recomendado: 8 fotos (faltam ${8 - photosCount})`, ganho: 0 });
    executionLogs.push(`  ↳ [Fotos] ⚠️ ${imovelId} tem apenas ${photosCount} foto(s), abaixo do mínimo recomendado.`);
  }

  if (precoInvalido) comErro++;

  const notaB = calcularNotaLocal(newTitle, newDesc, newAddr, valPrice, photosCount, hasVideo, valArea);
  somaNotasDepois += notaB;

  if (activeRuleIds.has('rule-06')) {
    executionLogs.push(`  ↳ [Nota Recalculada] ${imovelId}: ${notaA.toFixed(1)} → ${notaB.toFixed(1)} pts.`);
  }
});

const serializer = new XMLSerializer();
const enrichedXmlStr = serializer.serializeToString(xmlDoc);

const mediaA = somaNotasAntes / totalListings;
const mediaB = somaNotasDepois / totalListings;

executionLogs.push(`📊 Total de alterações aplicadas: ${changes.length}.`);
executionLogs.push(`📈 Qualidade média antes: ${mediaA.toFixed(1)}/10 | Depois: ${mediaB.toFixed(1)}/10`);
executionLogs.push('✨ Pipeline de enriquecimento finalizado com sucesso.');

fs.writeFileSync(OUTPUT_XML, enrichedXmlStr, 'utf-8');

const changesByField = {};
for (const c of changes) {
  changesByField[c.campo] = (changesByField[c.campo] || 0) + 1;
}

const report = {
  arquivo_entrada: INPUT,
  data_execucao: new Date().toISOString(),
  total_imoveis: totalListings,
  imoveis_com_erro_preco: comErro,
  imoveis_ok: totalListings - comErro,
  sem_preco: semPreco,
  preco_suspeito: precoSuspeito,
  fotos_insuficientes: fotosInsuficientes,
  total_alteracoes: changes.length,
  alteracoes_por_campo: changesByField,
  nota_media_antes: Number(mediaA.toFixed(2)),
  nota_media_depois: Number(mediaB.toFixed(2)),
  ganho_percentual_nota: Number((((mediaB - mediaA) / mediaA) * 100).toFixed(1)),
  amostra_alteracoes: changes.slice(0, 15),
  tamanho_entrada_bytes: Buffer.byteLength(xmlOriginal, 'utf-8'),
  tamanho_saida_bytes: Buffer.byteLength(enrichedXmlStr, 'utf-8'),
};

fs.writeFileSync(OUTPUT_REPORT, JSON.stringify(report, null, 2), 'utf-8');

console.log(executionLogs.join('\n'));
console.log('\n=== RELATÓRIO FINAL ===');
console.log(JSON.stringify(report, null, 2));
