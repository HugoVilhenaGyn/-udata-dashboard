# BrokerImobAI — Contexto do Projeto

Dashboard de inteligência imobiliária para a **LOBO IMOVEIS** (CRECI 4968 J GO),
de propriedade de **Hugo Vilhena** (hugo.f.vilhena@gmail.com). Construído em
Next.js 16 (App Router, Turbopack), React 19, TypeScript, CSS Modules.

Repositório: https://github.com/HugoVilhenaGyn/-udata-dashboard
Pasta local: `C:\Anti-Gravity\NivusClone\udata-dashboard`

## Regra de ouro

Todo dado "real" no app vem de fontes reais verificadas (CRM Vista/Loft,
Canal Pro do Grupo ZAP/OLX) — nunca inventar números. Sempre que possível,
provar a origem do dado antes de exibi-lo. Hugo testa tudo pessoalmente e
reage mal a dado fabricado ou identidade fictícia.

## Arquitetura

- **Auth**: JWT via `jose` (`src/lib/auth-service.ts`), cookie `udata_session`,
  bcryptjs. 3 contas reais: Hugo Vilhena (ADMIN), Equipe Comercial
  (CORRETOR), Equipe Marketing (MARKETING).
- **Banco de dados**: **Postgres (Supabase)**, acessado via `src/lib/db.ts`
  (`readDb()`/`writeDb()`, ambos assíncronos). Todo o estado da aplicação
  vive numa única linha JSONB (tabela `app_state`) — decisão deliberada pra
  não ter que normalizar 15+ entidades em tabelas relacionais numa migração
  só, mantendo a mesma forma de uso que as rotas de API já tinham quando o
  "banco" era um arquivo `db.json`. `scripts/lib/pg-db.mjs` espelha o mesmo
  acesso pra scripts Node fora do Next.js (sync do Vista, migração).
  Tem 340 imóveis reais extraídos do CRM Vista como estado inicial (importado
  via `npm run db:migrate`, que lê o `src/data/db.json` legado uma única vez).
- **Middleware** (`src/middleware.ts`) + **`src/lib/permissions.ts`**:
  controle de rota por cargo — fonte única de verdade (`ROLE_PERMISSIONS`)
  compartilhada entre o middleware (bloqueio real de navegação) e o Sidebar
  (esconder itens de menu que o cargo não acessa). `/api/*` é sempre
  bypassado no middleware (cada rota de API cuida da própria autenticação).
  `/avaliacao*` é pública (landing de avaliação online pro visitante do site).
- **Tipos**: `src/lib/types.ts` — `Imovel`, `Destaque`, `Portal`, `PortalSlug`, etc.
- **Deploy**: VPS da Hostinger (PM2 + Nginx + Certbot, sem Docker — Hugo já
  tem o VPS contratado), Postgres no Supabase. Ver `DEPLOY.md` pro passo a
  passo completo. Repo também tem Dockerfile/docker-compose prontos caso
  decida usar Docker no futuro, mas não são o caminho principal.

## Portais reais contratados (não simular outros)

Só dois canais têm assinatura ativa hoje:
- **Grupo OLX** — um único feed VRSync que cobre ZAP, OLX e VivaReal
  (`portais_publicados` com os slugs `zap`, `olx`, `vivareal`).
- **Portal 62** (portal local de Goiânia) — slug `portal62`, feed próprio.

Chaves na Mão, ImovelWeb, Meta Ads e Google Ads **não têm assinatura ativa**
— existem como registros inativos (`ativo: false`, orçamento zerado) só pra
não quebrar telas que referenciam esses slugs, mas não contam em nenhum KPI
de "portais ativos". Antes de adicionar qualquer portal novo aos KPIs/telas,
confirmar com o Hugo se é assinatura real.

## Integrações reais confirmadas (não simuladas)

- **Canal Pro** (canalpro.grupozap.com): painel do Grupo ZAP/OLX. Dados
  puxados manualmente via navegador logado (não há API de leitura pública do
  Grupo OLX) — nota de qualidade do portal, leads, relatório de integração.
  Ver `canalProSnapshot` em `src/lib/mock-data.ts`.
- **CRM Vista/Loft** (crmx.novovista.com.br/vista): sistema real onde ficam
  os 340 imóveis. Em Portais → Zap e Portais → Loft tem os links XML reais
  que o Grupo OLX consome automaticamente a cada ~12h (feed "Loft" é o
  catálogo completo ~327 imóveis; feed "Zap" é só o subconjunto marcado
  "Publicar Zap", ~40 imóveis).
- **Webhook de leads**: Canal Pro → Configurações → Integrações → Leads já
  tem um webhook ativo entregando leads em tempo real dentro do Vista.
- **Sincronização automática**: `scripts/sync-vista-full-feed.mjs` (catálogo
  completo) e `scripts/sync-vista-zap-feed.mjs` (só o publicado no Zap)
  atualizam o Postgres direto do feed XML real do Vista. Rodar com
  `npm run sync:vista`. Depois do deploy no VPS, agendar via cron (ver
  `DEPLOY.md`) — não depende mais de rodar na máquina do Hugo.
- **Chamado aberto com o Vista** sobre acesso à API REST — ver
  `CHAMADO-VISTA-API.md`.

## Lisa (Orquestrador IA) — `/copiloto`

Agente real com **function calling nativo do Gemini** (`gemini-3.5-flash`),
não é mais chat com regras de palavra-chave. Endpoint: `src/app/api/copiloto/route.ts`.

- **Ferramentas disponíveis**: `pontuar_imovel`, `gerar_relatorio` (salva em
  `relatoriosLisa`, navegável em `/relatorios`), `navegar`,
  `propor_criar_destaque`, `propor_atualizar_status_lead`.
- **Segurança por design (decisão explícita do Hugo)**: ferramentas de
  leitura/análise executam sozinhas; qualquer ação que grava dado real
  (`propor_criar_destaque`, `propor_atualizar_status_lead`) **nunca** escreve
  direto — só devolve uma proposta que aparece na tela como card de
  confirmação. Só um clique do usuário aciona o endpoint real de escrita
  (`/api/destaques` POST, `/api/leads-avaliacao` PATCH).
- **Contexto**: `montarContexto()` manda pro modelo listas completas (não
  amostras de 5 itens) — a Lisa deve responder com dados reais, nunca
  redirecionar genericamente pra outra tela quando a resposta já está
  disponível ali.
- **Treinamento** (`/configuracoes/lisa`, só ADMIN): instruções de texto
  livre + upload de documentos RAG (texto ou PDF via `pdf-parse`) — pesquisas
  de mercado externas (ex: Anuário DataZap, Guia 62imóveis) que a Lisa cruza
  com o portfólio real ao montar um estudo de mercado.
- **Códigos de imóvel**: sempre exibir via `codigoImovel()` (remove prefixo
  "LOFT-" do `id_externo`) — nunca o `id_externo` cru.

## Configurações (`/configuracoes`)

Hub com abas: **Geral** (todos os cargos) e **Lisa** (só ADMIN — treinamento
é configuração sensível, não operacional). Rota antiga
`/orquestrador-treinamento` faz redirect pra `/configuracoes/lisa`.

## Features principais

- **Farol de Oportunidade, Inventário, Qualidade de Anúncios, Destaques,
  Motor de XML, Dashboard de Receita, Visão Geral**: dados reais dos 340
  imóveis. Visão Geral mostra Farol de Venda e Locação lado a lado, mais
  Destaques Ativos real (XML premium + criados no painel, deduplicados).
- **Motor de XML**: upload separado por canal — "Grupo OLX" e "Portal 62"
  (só os dois com assinatura ativa).
- **Avaliação Online** (`/avaliacao` pública + `/avaliacao-admin` protegida):
  calculadora baseada em comparáveis reais do portfólio. Captura de lead
  obrigatória antes de mostrar o resultado.
- **Relatórios** (`/relatorios`): relatórios estruturados gerados pela Lisa,
  persistentes e navegáveis (não somem quando a conversa do chat rola).

## Pendências conhecidas (não resolvidas ainda)

- Validação real de XSD (`xml.vivareal.com/vrsync.xsd`) no Motor de XML —
  Hugo pediu para adiar.
- Task Scheduler / cron pra rodar `npm run sync:vista` automaticamente ainda
  não configurado no VPS de produção (só documentado em `DEPLOY.md`).
- Deploy em produção (VPS + Supabase) ainda não executado de fato — código e
  documentação prontos, falta o Hugo provisionar o Supabase e o VPS e rodar
  o passo a passo de `DEPLOY.md`.

## Cuidado com dados sensíveis

Os links de feed XML do Vista (`scripts/sync-vista-*.mjs`), a `DATABASE_URL`
do Postgres e qualquer webhook do Canal Pro contêm credenciais — tratar como
senha, nunca commitar (tudo isso fica em `.env`/`.env.local`, já no
`.gitignore`).

## Como continuar

Ler este arquivo primeiro. Depois, `git log --oneline -20` para ver o
histórico recente de commits e `src/data/sync-vista-log.json` (se existir)
para ver a última sincronização com o Vista.
