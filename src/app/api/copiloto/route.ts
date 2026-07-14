import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { readDb, writeDb, DbSchema, RelatorioLisa } from '@/lib/db';
import { codigoImovel } from '@/lib/mock-data';
import { verifySessionToken } from '@/lib/auth-service';

// Orquestrador IA de verdade: em vez de casar palavras-chave, monta um
// resumo real do estado atual do portfólio (contagens, exemplos concretos
// de imóveis com problema, KPIs) e manda isso como contexto pro Gemini
// junto da pergunta do usuário.
//
// A partir desta versão a Lisa usa function calling nativo do Gemini — ela
// não só responde texto, ela pode chamar ferramentas de verdade:
//   - gerar_relatorio        → salva um relatório estruturado (fica em /relatorios)
//   - pontuar_imovel         → devolve a pontuação detalhada e real de um imóvel
//   - navegar                → sugere ir pra outra seção do painel
//   - propor_criar_destaque  → PROPÕE ativar um destaque (não executa sozinha)
//   - propor_atualizar_status_lead → PROPÕE mudar status de um lead (não executa sozinha)
// As duas últimas nunca escrevem no banco por conta própria — só retornam
// uma proposta que o usuário precisa confirmar clicando num botão na UI,
// que aí sim chama o endpoint real (/api/destaques, /api/leads-avaliacao).

const MODEL = 'gemini-3.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const MAX_STEPS = 5; // teto de chamadas de ferramenta por pergunta, pra não rodar (e gastar) infinitamente

// Rotas reais do painel que o Orquestrador pode sugerir — mantido em sync
// manual com o Sidebar. Se um item for adicionado ao menu, adicionar aqui
// também pra IA saber que a seção existe.
const SECOES = [
  { rota: '/', nome: 'Visão Geral', descricao: 'KPIs gerais, farol de venda e locação, receita' },
  { rota: '/farol', nome: 'Farol de Oportunidade', descricao: 'Classificação de imóveis por potencial de venda/locação vs. preço de mercado' },
  { rota: '/inventario', nome: 'Inventário', descricao: 'Lista completa dos imóveis com filtros e ordenação' },
  { rota: '/qualidade', nome: 'Qualidade de Anúncios', descricao: 'Nota de qualidade por imóvel e critérios ausentes (fotos, descrição, endereço)' },
  { rota: '/receita', nome: 'Dashboard de Receita', descricao: 'Receita projetada e inferida de comissões de venda e locação' },
  { rota: '/destaques', nome: 'Gestão de Destaques', descricao: 'Fila de recomendação de destaques pagos por portal e histórico de decisões' },
  { rota: '/xml', nome: 'Motor de XML', descricao: 'Processamento e enriquecimento do feed XML' },
  { rota: '/avaliacao-admin', nome: 'Avaliação Online', descricao: 'Leads capturados pela calculadora pública de avaliação e configuração da landing' },
  { rota: '/relatorios', nome: 'Relatórios', descricao: 'Relatórios estruturados gerados pela Lisa, salvos pra conferência posterior' },
  { rota: '/configuracoes/lisa', nome: 'Configurações · Lisa', descricao: 'Instruções personalizadas e pesquisas de mercado (RAG) usadas pela Lisa — dentro de Configurações' },
];

// Declaração das ferramentas no formato esperado pelo Gemini (OpenAPI-like,
// tipos em maiúsculo).
const TOOLS = [
  {
    functionDeclarations: [
      {
        name: 'gerar_relatorio',
        description:
          'Gera um relatório estruturado (título, resumo executivo e seções com texto e/ou tabelas) sobre um tema do portfólio, pra revisão posterior. Fica salvo na seção Relatórios do painel — não é só uma mensagem de chat. Use sempre que o usuário pedir "relatório", "resumo pra conferência", "me dê um relatório de X", ou quando uma análise ficar longa/complexa demais pra só texto corrido.',
        parameters: {
          type: 'OBJECT',
          properties: {
            titulo: { type: 'STRING', description: 'Título curto e específico do relatório' },
            tipo: { type: 'STRING', enum: ['qualidade', 'precificacao', 'oportunidade', 'destaques', 'geral'] },
            resumo: { type: 'STRING', description: 'Resumo executivo de 2-4 frases com os achados principais' },
            secoes: {
              type: 'ARRAY',
              description: 'Seções do relatório. Use "texto" para parágrafos e/ou "colunas"+"linhas" para tabelas (todas as células como texto, formate número/moeda já pronto pra leitura).',
              items: {
                type: 'OBJECT',
                properties: {
                  titulo: { type: 'STRING' },
                  texto: { type: 'STRING' },
                  colunas: { type: 'ARRAY', items: { type: 'STRING' } },
                  linhas: { type: 'ARRAY', items: { type: 'ARRAY', items: { type: 'STRING' } } },
                },
                required: ['titulo'],
              },
            },
          },
          required: ['titulo', 'tipo', 'resumo', 'secoes'],
        },
      },
      {
        name: 'pontuar_imovel',
        description:
          'Busca e devolve a pontuação e os dados detalhados e reais de um imóvel específico do portfólio (qualidade, critérios ausentes, preço vs. mercado, farol, portais). Use o código do imóvel antes de falar números específicos sobre ele.',
        parameters: {
          type: 'OBJECT',
          properties: { codigo: { type: 'STRING', description: 'Código do imóvel, ex: "5535"' } },
          required: ['codigo'],
        },
      },
      {
        name: 'navegar',
        description: 'Sugere ao usuário ir para uma seção específica do painel. Use como ação complementar, depois de já ter respondido de verdade — nunca como substituto de uma resposta.',
        parameters: {
          type: 'OBJECT',
          properties: {
            rota: { type: 'STRING', description: 'Caminho exato, ex: "/qualidade"' },
            label: { type: 'STRING', description: 'Texto curto de botão, ex: "Ver anúncios com qualidade baixa"' },
          },
          required: ['rota', 'label'],
        },
      },
      {
        name: 'propor_criar_destaque',
        description:
          'PROPÕE ativar um destaque pago para um imóvel em um portal — NÃO executa sozinha, apenas cria uma proposta que aparece pro usuário confirmar com um clique. Use quando identificar um imóvel de alto potencial (farol favorável, boa nota de qualidade) sem destaque ativo.',
        parameters: {
          type: 'OBJECT',
          properties: {
            codigo_imovel: { type: 'STRING' },
            portal: { type: 'STRING', enum: ['zap', 'vivareal', 'olx', 'portal62'] },
            tipo_destaque: { type: 'STRING', enum: ['destaque', 'destaque_premium', 'super_destaque'] },
            justificativa: { type: 'STRING', description: 'Por que esse imóvel merece destaque agora, com números reais' },
          },
          required: ['codigo_imovel', 'portal', 'tipo_destaque', 'justificativa'],
        },
      },
      {
        name: 'propor_atualizar_status_lead',
        description:
          'PROPÕE mudar o status de um lead da avaliação online — NÃO executa sozinha, apenas cria uma proposta que o usuário confirma com um clique.',
        parameters: {
          type: 'OBJECT',
          properties: {
            lead_id: { type: 'STRING' },
            novo_status: { type: 'STRING', enum: ['novo', 'em_atendimento', 'atendido'] },
            justificativa: { type: 'STRING' },
          },
          required: ['lead_id', 'novo_status', 'justificativa'],
        },
      },
      {
        name: 'propor_atualizar_preco',
        description:
          'PROPÕE um novo preço (venda ou aluguel) para um imóvel específico — NÃO executa sozinha, apenas cria uma proposta que o usuário confirma com um clique; se confirmada, o preço é gravado de verdade no imóvel (fica no histórico de preço dele). Use sempre que, numa conversa sobre precificação, você chegar a um valor concreto recomendado (não apenas discutir a média do bairro em abstrato) — não fique só descrevendo o número no texto, proponha a mudança de fato. ATENÇÃO: preco_novo NUNCA pode ser simplesmente o preco_sugerido_ia bruto do imóvel copiado sem ajuste — esse número é só um ponto de partida estatístico (baseado na média do segmento), não a recomendação final. Antes de propor, aplique o mesmo raciocínio de bairro nobre/condição do imóvel que você usa no texto (nota de qualidade, se é novo/bem apresentado, diferenciais, desvio-padrão do segmento) — o preco_novo proposto deve refletir esse ajuste, não o valor cru da ferramenta pontuar_imovel.',
        parameters: {
          type: 'OBJECT',
          properties: {
            codigo_imovel: { type: 'STRING', description: 'Código do imóvel, ex: "5535"' },
            preco_novo: { type: 'NUMBER', description: 'Novo valor de venda ou aluguel, em reais' },
            justificativa: { type: 'STRING', description: 'Por que esse valor — cite dados reais (média/desvio do bairro, nota de qualidade, diferenciais, comparáveis)' },
          },
          required: ['codigo_imovel', 'preco_novo', 'justificativa'],
        },
      },
      {
        name: 'propor_enriquecer_anuncio',
        description:
          'PROPÕE corrigir automaticamente os critérios de qualidade ausentes de um anúncio (endereço, fotos, descrição, vídeo etc., conforme o que já foi identificado via pontuar_imovel) e recalcular a nota de qualidade — NÃO executa sozinha, cria uma proposta que o usuário confirma com um clique. Use quando pontuar_imovel mostrar critérios ausentes relevantes pro contexto da conversa (ex: falta de endereço prejudicando a precificação, ou nota baixa competindo com bairro concorrido).',
        parameters: {
          type: 'OBJECT',
          properties: {
            codigo_imovel: { type: 'STRING' },
            justificativa: { type: 'STRING', description: 'Quais critérios estão ausentes e por que corrigir agora importa (ex: impacto no algoritmo de relevância dos portais, na nota, no farol)' },
          },
          required: ['codigo_imovel', 'justificativa'],
        },
      },
    ],
  },
];

// Teto de segurança pra não estourar o contexto em nenhuma lista — bem
// acima do que qualquer categoria real chega a ter hoje (a maior é ~106).
const LISTA_MAX = 250;

function montarContexto(db: DbSchema) {
  const imoveis = db.imoveis;

  const porFinalidade = (fin: 'venda' | 'aluguel') => imoveis.filter(i => i.finalidade === fin);
  const venda = porFinalidade('venda');
  const aluguel = porFinalidade('aluguel');

  const notaMedia = (imoveis.reduce((a, i) => a + i.nota_qualidade, 0) / (imoveis.length || 1)).toFixed(1);
  const qualidadeCritica = imoveis.filter(i => i.nota_qualidade < 5.5);
  const comDesvio = imoveis
    .filter(i => !!i.preco_sugerido_ia && i.preco_sugerido_ia > 0)
    .map(i => ({ i, desvio: ((i.preco_atual - i.preco_sugerido_ia!) / i.preco_sugerido_ia!) * 100 }));
  const precoForaMercadoVenda = comDesvio.filter(x => x.desvio > 10 && x.i.finalidade === 'venda');
  const precoForaMercadoAluguel = comDesvio.filter(x => x.desvio > 10 && x.i.finalidade === 'aluguel');
  const semDestaqueAltoPotencial = imoveis.filter(
    i => i.status_farol === 'venda_iminente' && i.nota_qualidade >= 8 && !i.destaque_ativo
  );

  const lista = (arr: typeof imoveis) =>
    arr.slice(0, LISTA_MAX).map(i => ({
      codigo: codigoImovel(i.id_externo),
      titulo: i.titulo.slice(0, 60),
      bairro: i.bairro,
      finalidade: i.finalidade,
      preco_atual: i.preco_atual,
      preco_sugerido_ia: i.preco_sugerido_ia,
      nota_qualidade: i.nota_qualidade,
      status_farol: i.status_farol,
      destaque_ativo: i.destaque_ativo,
    }));

  const listaComDesvio = (arr: typeof comDesvio) =>
    arr.slice(0, LISTA_MAX).map(({ i, desvio }) => ({
      codigo: codigoImovel(i.id_externo),
      titulo: i.titulo.slice(0, 60),
      bairro: i.bairro,
      preco_atual: i.preco_atual,
      preco_sugerido_ia: i.preco_sugerido_ia,
      desvio_pct: Math.round(desvio),
      nota_qualidade: i.nota_qualidade,
      destaque_ativo: i.destaque_ativo,
    }));

  const base = imoveis.filter(i => i.preco_atual > 0 && i.area_util > 0 && !i.preco_suspeito);
  const segmentos = new Map<string, typeof imoveis>();
  for (const i of base) {
    const chave = `${i.finalidade}|${i.tipo}|${i.bairro.trim().toLowerCase()}`;
    if (!segmentos.has(chave)) segmentos.set(chave, []);
    segmentos.get(chave)!.push(i);
  }
  const estudoMercado = Array.from(segmentos.values())
    .filter(grupo => grupo.length >= 3)
    .map(grupo => {
      const precoM2Medio = grupo.reduce((acc, i) => acc + i.preco_atual / i.area_util, 0) / grupo.length;
      return {
        bairro: grupo[0].bairro,
        tipo: grupo[0].tipo,
        finalidade: grupo[0].finalidade,
        oferta_comparaveis: grupo.length,
        preco_m2_medio: Math.round(precoM2Medio),
        faixa_mercado_m2_min: Math.round(precoM2Medio * 0.9),
        faixa_mercado_m2_max: Math.round(precoM2Medio * 1.12),
        demanda_leads_semana: grupo.reduce((acc, i) => acc + i.metricas.leads_semana, 0),
        demanda_visualizacoes_semana: grupo.reduce((acc, i) => acc + i.metricas.visualizacoes_semana, 0),
      };
    })
    .sort((a, b) => b.oferta_comparaveis - a.oferta_comparaveis)
    .slice(0, LISTA_MAX);

  return {
    resumo: {
      total_imoveis: imoveis.length,
      venda: venda.length,
      aluguel: aluguel.length,
      nota_qualidade_media: notaMedia,
      qualidade_critica_count: qualidadeCritica.length,
      preco_fora_mercado_venda_count: precoForaMercadoVenda.length,
      preco_fora_mercado_aluguel_count: precoForaMercadoAluguel.length,
      alto_potencial_sem_destaque_count: semDestaqueAltoPotencial.length,
      destaques_ativos: db.destaques.filter(d => d.status === 'ativo').length,
      leads_avaliacao_novos: db.leadsAvaliacao.filter(l => l.status === 'novo').length,
    },
    lista_qualidade_critica: lista(qualidadeCritica),
    lista_preco_fora_mercado_venda: listaComDesvio(precoForaMercadoVenda),
    lista_preco_fora_mercado_aluguel: listaComDesvio(precoForaMercadoAluguel),
    lista_alto_potencial_sem_destaque: lista(semDestaqueAltoPotencial),
    estudo_mercado_por_segmento: estudoMercado,
    lista_imoveis_completa: base.slice(0, 400).map(i => ({
      codigo: codigoImovel(i.id_externo),
      titulo: i.titulo.slice(0, 60),
      bairro: i.bairro,
      tipo: i.tipo,
      finalidade: i.finalidade,
      area_util: i.area_util,
      preco_atual: i.preco_atual,
      preco_sugerido_ia: i.preco_sugerido_ia,
    })),
    // Leads da avaliação online, pra propor_atualizar_status_lead conseguir
    // referenciar um lead_id real.
    leads_avaliacao_recentes: db.leadsAvaliacao.slice(0, 40).map(l => ({
      id: l.id, nome: l.nome, finalidade: l.finalidade, bairro: l.bairro, status: l.status, criado_em: l.criado_em,
    })),
  };
}

// --- Execução das ferramentas ---

function executarPontuarImovel(args: any, db: DbSchema) {
  const codigo = String(args?.codigo || '').trim();
  const imovel = db.imoveis.find(i => codigoImovel(i.id_externo) === codigo || i.id_externo === codigo);
  if (!imovel) return { erro: `Imóvel com código "${codigo}" não encontrado no portfólio.` };

  const desvio = imovel.preco_sugerido_ia && imovel.preco_sugerido_ia > 0
    ? Math.round(((imovel.preco_atual - imovel.preco_sugerido_ia) / imovel.preco_sugerido_ia) * 100)
    : null;

  return {
    codigo: codigoImovel(imovel.id_externo),
    titulo: imovel.titulo,
    bairro: imovel.bairro,
    finalidade: imovel.finalidade,
    nota_qualidade: imovel.nota_qualidade,
    criterios_qualidade: imovel.criterios_qualidade.map(c => ({
      id: c.id, label: c.label, presente: c.presente, sugestao: c.sugestao || null,
    })),
    preco_atual: imovel.preco_atual,
    preco_sugerido_ia: imovel.preco_sugerido_ia ?? null,
    desvio_preco_pct: desvio,
    status_farol: imovel.status_farol,
    destaque_ativo: imovel.destaque_ativo,
    portais_publicados: imovel.portais_publicados,
  };
}

function executarProporCriarDestaque(args: any, db: DbSchema) {
  const codigo = String(args?.codigo_imovel || '').trim();
  const imovel = db.imoveis.find(i => codigoImovel(i.id_externo) === codigo || i.id_externo === codigo);
  if (!imovel) return { erro: `Imóvel "${codigo}" não encontrado — não é possível propor destaque.` };

  const portaisValidos = ['olx', 'zap', 'vivareal', 'portal62'];
  const portal = portaisValidos.includes(args?.portal) ? args.portal : 'zap';
  const tiposValidos = ['destaque', 'destaque_premium', 'super_destaque'];
  const tipo_destaque = tiposValidos.includes(args?.tipo_destaque) ? args.tipo_destaque : 'destaque';

  return {
    imovel: {
      id: imovel.id,
      titulo: imovel.titulo,
      bairro: imovel.bairro,
      preco_atual: imovel.preco_atual,
      tipo: imovel.tipo,
      status_farol: imovel.status_farol,
      nota_qualidade: imovel.nota_qualidade,
      finalidade: imovel.finalidade,
    },
    codigo: codigoImovel(imovel.id_externo),
    portal,
    tipo_destaque,
    justificativa: String(args?.justificativa || ''),
  };
}

function executarProporAtualizarPreco(args: any, db: DbSchema) {
  const codigo = String(args?.codigo_imovel || '').trim();
  const imovel = db.imoveis.find(i => codigoImovel(i.id_externo) === codigo || i.id_externo === codigo);
  if (!imovel) return { erro: `Imóvel "${codigo}" não encontrado — não é possível propor preço.` };

  const preco_novo = Number(args?.preco_novo);
  if (!preco_novo || preco_novo <= 0) return { erro: 'preco_novo inválido.' };

  return {
    id: imovel.id,
    codigo: codigoImovel(imovel.id_externo),
    titulo: imovel.titulo,
    bairro: imovel.bairro,
    finalidade: imovel.finalidade,
    preco_atual: imovel.preco_atual,
    preco_novo,
    justificativa: String(args?.justificativa || ''),
  };
}

function executarProporEnriquecerAnuncio(args: any, db: DbSchema) {
  const codigo = String(args?.codigo_imovel || '').trim();
  const imovel = db.imoveis.find(i => codigoImovel(i.id_externo) === codigo || i.id_externo === codigo);
  if (!imovel) return { erro: `Imóvel "${codigo}" não encontrado — não é possível propor enriquecimento.` };

  const criteriosAusentes = imovel.criterios_qualidade.filter(c => !c.presente);
  if (criteriosAusentes.length === 0) {
    return { erro: `O imóvel ${codigo} já tem todos os critérios de qualidade presentes — não há o que enriquecer.` };
  }

  return {
    id: imovel.id,
    codigo: codigoImovel(imovel.id_externo),
    titulo: imovel.titulo,
    nota_qualidade_atual: imovel.nota_qualidade,
    criterios_ausentes: criteriosAusentes.map(c => c.label),
    justificativa: String(args?.justificativa || ''),
  };
}

function executarProporAtualizarStatusLead(args: any, db: DbSchema) {
  const lead = db.leadsAvaliacao.find(l => l.id === args?.lead_id);
  if (!lead) return { erro: `Lead "${args?.lead_id}" não encontrado.` };

  const validos = ['novo', 'em_atendimento', 'atendido'];
  const novo_status = validos.includes(args?.novo_status) ? args.novo_status : 'em_atendimento';

  return {
    lead_id: lead.id,
    lead_nome: lead.nome,
    status_atual: lead.status,
    novo_status,
    justificativa: String(args?.justificativa || ''),
  };
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, message: 'GEMINI_API_KEY não configurada no servidor.' },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { mensagem, historico } = body as {
      mensagem: string;
      historico?: { role: 'user' | 'model'; texto: string }[];
    };

    if (!mensagem || !mensagem.trim()) {
      return NextResponse.json({ success: false, message: 'Mensagem vazia.' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const token = cookieStore.get('udata_session')?.value;
    const session = token ? await verifySessionToken(token) : null;
    const autor = session?.nome || session?.email || 'Lisa (usuário não identificado)';

    const db = await readDb();
    const contexto = montarContexto(db);
    const instrucoesTreinamento = db.configOrquestrador?.instrucoes?.trim();
    const documentosRag = db.configOrquestrador?.documentos || [];

    const DOC_TRUNC = 16000;
    const docsParaPrompt = documentosRag.slice(-5);
    const blocoDocumentos = docsParaPrompt.length
      ? docsParaPrompt.map(d =>
          `--- Documento: "${d.nome}" (fonte: ${d.fonte === 'portal62' ? 'Portal 62' : d.fonte === 'zap' ? 'Zap Imóveis' : 'outra fonte'}, enviado em ${d.enviado_em.slice(0, 10)}) ---\n${d.conteudo.slice(0, DOC_TRUNC)}`
        ).join('\n\n')
      : '';

    const systemInstruction = `Você é a Lisa, o Orquestrador IA da BrokerImobAI — assistente de um painel de gestão \
imobiliária real, da imobiliária LOBO IMOVEIS. Você NÃO é um chatbot de suporte que só aponta pra outra tela: você é \
o próprio Farol de Oportunidade e o próprio motor de análise, com FERRAMENTAS de verdade pra pontuar imóveis, gerar \
relatórios estruturados e propor ações — não fica só na conversa.

DADOS ATUAIS DO PORTFÓLIO (JSON):
${JSON.stringify(contexto, null, 2)}

SEÇÕES DISPONÍVEIS NO PAINEL:
${SECOES.map(s => `- ${s.rota} — ${s.nome}: ${s.descricao}`).join('\n')}
${instrucoesTreinamento ? `\nINSTRUÇÕES PERSONALIZADAS DA EQUIPE (seguir sempre, têm prioridade sobre o estilo padrão abaixo):\n${instrucoesTreinamento}\n` : ''}
${blocoDocumentos ? `\nPESQUISAS DE MERCADO ENVIADAS PELA EQUIPE (dados externos reais — use como referência de mercado além do portfólio, citando o documento de origem):\n${blocoDocumentos}\n` : ''}
FERRAMENTAS DISPONÍVEIS E QUANDO USAR:
- pontuar_imovel: sempre que for falar números específicos de UM imóvel (nota, critérios, desvio de preço), chame essa ferramenta pelo código em vez de confiar só no resumo — ela traz o detalhe completo e real.
- gerar_relatorio: quando o usuário pedir "relatório", "resumo pra conferência", "documento", ou quando a análise tiver várias partes/tabelas — gera algo salvo, revisável depois, não só uma mensagem de chat.
- navegar: sugestão complementar de seção, depois de já ter respondido de verdade.
- propor_criar_destaque / propor_atualizar_status_lead / propor_atualizar_preco / propor_enriquecer_anuncio: quando identificar uma ação de negócio concreta a fazer (ativar destaque em imóvel de alto potencial, avançar status de um lead, mudar o preço de um imóvel, corrigir critérios de qualidade ausentes) — SEMPRE proponha, NUNCA diga que "já fez"; a ação só acontece se o usuário confirmar na tela. Isso é o que diferencia você de um chatbot que só comenta números: quando a conversa chega numa recomendação concreta e acionável, transforme em proposta de verdade, não deixe só no texto.

Regras:
- Responda sempre em português do Brasil, direto e objetivo, sem enrolação.
- Baseie suas respostas SOMENTE nos dados fornecidos (contexto + resultado das ferramentas). Se não souber algo, diga isso claramente — nunca invente números.
- Quando o usuário pedir uma lista, contagem ou análise de imóveis, responda com a lista completa e real usando os dados de "lista_*" — enumere cada item. NUNCA substitua a resposta por um redirecionamento genérico quando os dados já estão disponíveis.
- Para estudo de mercado (oferta/demanda/precificação), use "estudo_mercado_por_segmento" (portfólio próprio, real) e os documentos de pesquisa enviados (mercado externo) — sempre deixando claro qual é a fonte de cada número.
- Seja específico: cite códigos de imóveis reais, nunca fale em termos vagos tipo "vários imóveis".
- Depois de usar uma ferramenta, sempre feche com uma resposta em texto explicando o resultado pro usuário — nunca deixe a última mensagem ser só a chamada da ferramenta.
- Nunca use notação LaTeX ou matemática (tipo "$\\text{m}^2$" ou "\\frac{}{}"). Escreva direto em texto normal: "m²", "R$/m²", "28%". O chat não renderiza LaTeX, então isso aparece quebrado pro usuário.
- Nunca cite o nome técnico de uma ferramenta/função (ex: "navegar", "propor_criar_destaque", "pontuar_imovel") na resposta pro usuário — descreva a ação em linguagem natural (ex: "posso te levar pra tela de Farol de Oportunidade" em vez de "usar a ferramenta navegar").
- Toda vez que citar um percentual calculado (variação, redução, desconto), refaça a conta mentalmente antes de responder: percentual de redução = (valor_antigo − valor_novo) / valor_antigo × 100, e o resultado NUNCA pode passar de 100% (não dá pra reduzir um preço em mais de 100%). Exemplo obrigatório de referência: reduzir de R$4.200 para R$1.680 é uma queda de 60% — NÃO 150% (cálculo: (4200-1680)/4200 = 0,60 = 60%). Se a sua conta der um número acima de 100% numa redução de preço, ela está errada — refaça antes de responder. Se dois números derivados de você mesma não baterem entre si, prefira omitir o percentual a citar um valor errado.
- A média de R$/m² de um bairro (seja do portfólio ou de pesquisa externa) é só UM parâmetro de referência, nunca um teto rígido — principalmente em bairros nobres/alto padrão (ex: Setor Marista, Jardim Goiás, Setor Bueno). Antes de recomendar "baixar pro preço médio", considere: (1) o imóvel é novo ou reformado? (2) tem boa apresentação (fotos de qualidade, poucos critérios de qualidade faltando)? (3) tem diferenciais (vista, andar alto, lazer completo, vaga extra)? Se sim, o preço justo pode ficar ACIMA da média do bairro — cite o desvio-padrão/faixa de preços do segmento quando os dados permitirem, não só a média isolada, e diga explicitamente que a nota de qualidade e as fotos do anúncio são um parâmetro de ajuste sobre a média, não o contrário.
- Você é o orquestrador de ação do painel, não só um consultor de texto: sempre que uma análise (precificação, qualidade, destaque, lead) chegar a uma recomendação específica e executável, feche a resposta chamando a ferramenta de proposta correspondente (propor_atualizar_preco, propor_enriquecer_anuncio, propor_criar_destaque ou propor_atualizar_status_lead) — em vez de só escrever "recomendo mudar o preço para R$X" ou "vale corrigir o endereço", proponha a mudança de fato pra o usuário confirmar com um clique. Só decida NÃO propor quando a análise for genuinamente exploratória (o usuário só pediu contexto/comparação) ou quando faltar dado suficiente pra uma recomendação concreta.`;

    let contents: any[] = [
      ...(historico || []).map(h => ({ role: h.role, parts: [{ text: h.texto }] })),
      { role: 'user', parts: [{ text: mensagem }] },
    ];

    let finalText = '';
    let relatorioGerado: RelatorioLisa | null = null;
    let propostaAcao: { tipo: 'criar_destaque' | 'atualizar_status_lead' | 'atualizar_preco' | 'enriquecer_anuncio'; payload: any } | null = null;
    let rotaSugerida: string | null = null;
    let rotaLabel: string | null = null;

    for (let step = 0; step < MAX_STEPS; step++) {
      const geminiRes = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents,
          systemInstruction: { parts: [{ text: systemInstruction }] },
          tools: TOOLS,
        }),
      });

      if (!geminiRes.ok) {
        const errText = await geminiRes.text();
        return NextResponse.json(
          { success: false, message: `Erro na API do Gemini: ${geminiRes.status} ${errText.slice(0, 300)}` },
          { status: 502 }
        );
      }

      const geminiJson = await geminiRes.json();
      const candidateParts: any[] = geminiJson?.candidates?.[0]?.content?.parts || [];
      const functionCalls = candidateParts.filter(p => p.functionCall);

      if (functionCalls.length === 0) {
        finalText = candidateParts.map(p => p.text || '').join('');
        break;
      }

      contents.push({ role: 'model', parts: candidateParts });

      const responseParts = await Promise.all(functionCalls.map(async (part) => {
        const { name, args } = part.functionCall;
        let resultado: any;

        switch (name) {
          case 'gerar_relatorio': {
            const secoes = Array.isArray(args?.secoes) ? args.secoes.map((s: any) => ({
              titulo: String(s?.titulo || '').slice(0, 200),
              texto: s?.texto ? String(s.texto).slice(0, 4000) : undefined,
              colunas: Array.isArray(s?.colunas) ? s.colunas.map((c: any) => String(c)) : undefined,
              linhas: Array.isArray(s?.linhas)
                ? s.linhas.map((l: any) => (Array.isArray(l) ? l.map((c: any) => String(c)) : []))
                : undefined,
            })) : [];
            const tiposValidos = ['qualidade', 'precificacao', 'oportunidade', 'destaques', 'geral'];
            relatorioGerado = {
              id: `rel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              titulo: String(args?.titulo || 'Relatório').slice(0, 200),
              tipo: tiposValidos.includes(args?.tipo) ? args.tipo : 'geral',
              resumo: String(args?.resumo || '').slice(0, 1000),
              secoes,
              pergunta_origem: mensagem,
              criado_em: new Date().toISOString(),
              criado_por: autor,
            };
            db.relatoriosLisa = [relatorioGerado, ...db.relatoriosLisa].slice(0, 200);
            await writeDb(db);
            resultado = { relatorio_id: relatorioGerado.id, salvo: true };
            break;
          }
          case 'pontuar_imovel':
            resultado = executarPontuarImovel(args, db);
            break;
          case 'navegar':
            rotaSugerida = args?.rota || null;
            rotaLabel = args?.label || null;
            resultado = { ok: true };
            break;
          case 'propor_criar_destaque': {
            const proposta = executarProporCriarDestaque(args, db);
            if (!proposta.erro) {
              propostaAcao = { tipo: 'criar_destaque', payload: proposta };
              resultado = { recebido: true, aguardando_confirmacao_usuario: true };
            } else {
              resultado = proposta;
            }
            break;
          }
          case 'propor_atualizar_status_lead': {
            const proposta = executarProporAtualizarStatusLead(args, db);
            if (!proposta.erro) {
              propostaAcao = { tipo: 'atualizar_status_lead', payload: proposta };
              resultado = { recebido: true, aguardando_confirmacao_usuario: true };
            } else {
              resultado = proposta;
            }
            break;
          }
          case 'propor_atualizar_preco': {
            const proposta = executarProporAtualizarPreco(args, db);
            if (!proposta.erro) {
              propostaAcao = { tipo: 'atualizar_preco', payload: proposta };
              resultado = { recebido: true, aguardando_confirmacao_usuario: true };
            } else {
              resultado = proposta;
            }
            break;
          }
          case 'propor_enriquecer_anuncio': {
            const proposta = executarProporEnriquecerAnuncio(args, db);
            if (!proposta.erro) {
              propostaAcao = { tipo: 'enriquecer_anuncio', payload: proposta };
              resultado = { recebido: true, aguardando_confirmacao_usuario: true };
            } else {
              resultado = proposta;
            }
            break;
          }
          default:
            resultado = { erro: `Ferramenta desconhecida: ${name}` };
        }

        return { functionResponse: { name, response: resultado } };
      }));

      contents.push({ role: 'user', parts: responseParts });
    }

    if (!finalText) {
      finalText = 'Não consegui concluir essa análise agora (muitos passos necessários). Tenta reformular a pergunta de um jeito mais direto.';
    }

    return NextResponse.json({
      success: true,
      data: {
        resposta: finalText,
        rota_sugerida: rotaSugerida,
        rota_label: rotaLabel,
        relatorio: relatorioGerado,
        proposta_acao: propostaAcao,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
