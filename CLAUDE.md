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
reage mal a dado fabricado ou identidade fictícia (ex: login demo fake já
foi removido e substituído pela identidade real dele).

## Arquitetura

- **Auth**: JWT via `jose` (`src/lib/auth-service.ts`), cookie `udata_session`,
  bcryptjs. 3 contas reais em `src/data/db.json`: Hugo Vilhena (ADMIN),
  Equipe Comercial (CORRETOR), Equipe Marketing (MARKETING).
- **"Banco de dados"**: arquivo `src/data/db.json` (schema em `src/lib/db.ts`,
  função `readDb()`/`writeDb()`). Tem 340 imóveis reais extraídos do CRM Vista.
- **Middleware** (`src/middleware.ts`): controle de rota por cargo. `/api/*`
  é sempre bypassado (bug crítico já corrigido). `/avaliacao*` é rota pública.
- **Tipos**: `src/lib/types.ts` — `Imovel`, `Destaque`, `Portal`, etc.

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
  tem um webhook ativo entregando leads em tempo real dentro do Vista
  (confirmado via log "Últimos leads enviados" e via leads reais aparecendo
  no Kanban de Negócios do Vista).
- **Sincronização automática**: `scripts/sync-vista-full-feed.mjs` (catálogo
  completo) e `scripts/sync-vista-zap-feed.mjs` (só o publicado no Zap)
  atualizam `db.json` direto do feed XML real do Vista. Rodar com
  `npm run sync:vista`. Precisa rodar na máquina do Hugo (tem internet real);
  não funciona em ambientes com proxy restrito. Gera relatório em
  `src/data/sync-vista-log.json`.

## Features principais

- **Farol de Oportunidade, Inventário, Qualidade de Anúncios, Destaques,
  Motor de XML, Dashboard de Receita**: núcleo original, todos com dados
  reais dos 340 imóveis (não mock).
- **Avaliação Online** (`/avaliacao` pública + `/avaliacao-admin` protegida):
  calculadora de avaliação de venda/locação baseada em comparáveis reais do
  portfólio (`avaliarImovel()` em `mock-data.ts`). Captura de lead é
  obrigatória ANTES de mostrar o resultado (decisão explícita do Hugo).
  Admin gerencia leads recebidos e configura textos/ativação da landing.
- **Orquestrador IA** (`/copiloto`): chat com regras de palavra-chave, não é
  um agente real ainda. Botões de "Ação Recomendada" são cosméticos (não
  persistem mudança real) — sinalizado ao Hugo, não corrigido ainda.

## Pendências conhecidas (não resolvidas ainda)

- Botões cosméticos do Orquestrador IA (não persistem).
- Estatística fixa "+47 este mês" de Erros XML Corrigidos no Copiloto.
- Validação real de XSD (`xml.vivareal.com/vrsync.xsd`) no Motor de XML —
  Hugo pediu para adiar ("não, agora não").
- Task Scheduler do Windows para rodar `npm run sync:vista` automaticamente
  ainda não foi configurado (passo a passo já foi passado ao Hugo).

## Cuidado com dados sensíveis

Os links de feed XML do Vista (`scripts/sync-vista-*.mjs`) e qualquer
webhook do Canal Pro contêm tokens — tratar como senha, nunca expor fora
do projeto do Hugo.

## Como continuar

Ler este arquivo primeiro. Depois, `git log --oneline -20` para ver o
histórico recente de commits e `src/data/sync-vista-log.json` (se existir)
para ver a última sincronização com o Vista.
