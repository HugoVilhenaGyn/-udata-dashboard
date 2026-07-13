# BrokerImobAI

Dashboard de inteligência imobiliária construído para a **LOBO IMOVEIS**
(CRECI 4968 J GO, Goiânia). Next.js 16 (App Router), React 19, TypeScript.

Centraliza os 340 imóveis reais do CRM Vista, calcula qualidade de anúncio,
farol de oportunidade (venda e locação), destaques pagos por portal, receita
inferida e conta com a **Lisa**, um agente de IA (Gemini) com acesso real aos
dados do portfólio — gera relatórios, pontua imóveis e propõe ações (toda
ação que grava algo passa por confirmação manual antes de executar).

## Stack

- **Frontend/Backend**: Next.js 16 (App Router, Turbopack), React 19, TypeScript, CSS Modules
- **Auth**: JWT (`jose`) + bcryptjs, cookie de sessão httpOnly
- **Banco de dados**: Postgres (recomendado: [Supabase](https://supabase.com), plano gratuito cobre esse tamanho de app)
- **IA**: Gemini API (Google AI Studio) — function calling nativo
- **Deploy**: VPS da Hostinger com PM2 + Nginx (ver `DEPLOY.md`)

## Rodando localmente

```bash
npm install
cp .env.local.example .env.local   # preencha JWT_SECRET, DATABASE_URL, GEMINI_API_KEY
npm run db:migrate                 # só na primeira vez, importa src/data/db.json pro Postgres
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). Contas de teste (senha
`Lobo@2026`): `hugo.f.vilhena@gmail.com` (ADMIN), `atendimento@loboimoveis.imb.br`
(CORRETOR), `marketing@loboimoveis.imb.br` (MARKETING).

## Variáveis de ambiente

Ver `.env.local.example` para a lista completa e onde pegar cada valor
(`JWT_SECRET`, `DATABASE_URL`, `DATABASE_SSL`, `GEMINI_API_KEY`).

## Estrutura

- `src/app/` — páginas (App Router) e rotas de API (`src/app/api/*`)
- `src/lib/db.ts` — acesso ao Postgres (um único documento JSONB com todo o
  estado da aplicação — ver comentário no topo do arquivo pra entender a
  escolha de arquitetura)
- `src/lib/mock-data.ts` + `src/lib/real-imoveis-data.json` — dados reais dos
  340 imóveis (extraídos uma vez do feed XML do Vista) usados como estado
  inicial na primeira migração
- `src/lib/types.ts` — tipos compartilhados (`Imovel`, `Portal`, `Destaque`, etc.)
- `src/middleware.ts` + `src/lib/permissions.ts` — controle de acesso por
  cargo (ADMIN / CORRETOR / MARKETING), fonte única de verdade compartilhada
  entre o middleware (bloqueio real) e o Sidebar (esconder itens de menu)
- `scripts/sync-vista-full-feed.mjs` / `scripts/sync-vista-zap-feed.mjs` —
  sincronizam o Postgres com os feeds XML reais do CRM Vista
- `scripts/migrate-dbjson-to-postgres.mjs` — migração one-off do `db.json`
  legado pro Postgres

## Deploy

Ver **`DEPLOY.md`** para o passo a passo completo (provisionar Supabase,
subir num VPS com Docker + Nginx + SSL).

## Documentação adicional

- `CLAUDE.md` — contexto arquitetural pra continuidade de desenvolvimento
  (regras de negócio, decisões já tomadas, pendências conhecidas)
- `CHAMADO-VISTA-API.md` — chamado aberto com o Vista sobre acesso à API REST
