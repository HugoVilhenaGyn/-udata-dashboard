# Deploy — BrokerImobAI

Arquitetura de produção: **VPS da Hostinger** (o mesmo que já roda outra
aplicação em `imobai.net.br`) com PM2 + Nginx (sem Docker) e **Postgres
gerenciado no Supabase** como banco de dados.

**Troca de domínio decidida**: o BrokerImobAI assume o domínio principal
`imobai.net.br`. A aplicação que já roda lá hoje **não é apagada** — só
passa a responder por `crm.imobai.net.br`.

## 0. Antes de tudo: mapear o que já existe no VPS

Esse passo é o que evita derrubar a aplicação atual sem querer.

```bash
pm2 list                      # a app atual usa PM2? qual o nome/porta dela?
ss -tlnp | grep LISTEN        # todas as portas em escuta no servidor
ls /etc/nginx/sites-enabled/  # arquivo(s) de config Nginx já existentes
cat /etc/nginx/sites-enabled/*   # veja o server_name e a porta/raiz que a app atual usa hoje
```

Anote: qual arquivo de config Nginx responde por `imobai.net.br` hoje, e em
qual porta/pasta a aplicação atual está servindo. Vai precisar disso no
passo 5.

O BrokerImobAI vai rodar na **porta 3001** (já configurado em
`ecosystem.config.js`) — confirme no `ss -tlnp` acima que 3001 está livre;
se não estiver, troque a porta lá e no passo 6.

## 1. Criar o banco (Supabase)

1. Crie uma conta em [supabase.com](https://supabase.com) e um novo projeto
   (região mais perto do VPS — São Paulo/`sa-east-1` se disponível).
2. Anote a senha do banco definida na criação do projeto.
3. Em **Project Settings → Database → Connection string**, copie a URI no
   modo **Session** (porta 5432):
   ```
   postgresql://postgres:[SUA-SENHA]@db.xxxxxxxxxxxx.supabase.co:5432/postgres
   ```
   Esse é o valor de `DATABASE_URL`. Projeto novo e isolado — não
   compartilha nada com o banco da aplicação atual (se ela usar banco).
4. Não precisa criar tabela — a aplicação cria `app_state` sozinha na
   primeira execução.

## 2. DNS: liberar o subdomínio pra aplicação atual

No hPanel, em **Domínios → imobai.net.br → DNS**, crie:

```
Tipo: A
Nome: crm
Aponta para: <IP do seu VPS>   (o mesmo IP de sempre)
```

`imobai.net.br` (raiz) já aponta pro VPS — não precisa mexer no DNS dele.
Confirme a propagação do subdomínio antes do passo 5:

```bash
dig crm.imobai.net.br +short
```

## 3. Acessar o VPS

```bash
ssh root@SEU_IP
```

(ou hPanel → VPS → Browser terminal)

Confirme Node/Nginx instalados (devem estar, já que a app atual roda lá):

```bash
node -v && nginx -v
```

## 4. Clonar o BrokerImobAI e configurar variáveis

Em um diretório **separado** da aplicação existente:

```bash
git clone https://github.com/HugoVilhenaGyn/-udata-dashboard.git broker-imob-ai
cd broker-imob-ai/udata-dashboard
cp .env.local.example .env
nano .env
```

Preencha: `JWT_SECRET` (gere com `openssl rand -base64 48`), `DATABASE_URL`
(do passo 1), `GEMINI_API_KEY` (Google AI Studio).

```bash
export $(grep -v '^#' .env | xargs)
npm ci
npm run db:migrate    # importa os 340 imóveis reais etc. pro Supabase — só uma vez
npm run build
```

## 5. Subir o BrokerImobAI com PM2 (porta 3001) — sem tocar na app atual ainda

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 status   # confirme "broker-imob-ai" online, sem derrubar o processo da app antiga
```

Nesse ponto as duas aplicações estão rodando ao mesmo tempo no servidor
(porta antiga + porta 3001), só o Nginx ainda não foi trocado — nada mudou
pro visitante ainda.

## 6. Migrar a config do Nginx (o passo que faz a troca de verdade)

Edite o arquivo que você identificou no passo 0 (o que responde por
`imobai.net.br` hoje) e **troque o `server_name`** dele pra
`crm.imobai.net.br`, mantendo o `proxy_pass`/raiz que já
tinha (a aplicação antiga continua servindo do mesmo jeito, só muda o nome
que aponta pra ela):

```bash
nano /etc/nginx/sites-available/<arquivo-da-app-atual>
# troque: server_name imobai.net.br;
# por:    server_name crm.imobai.net.br;
```

Crie o novo `/etc/nginx/sites-available/broker-imob-ai` pro domínio raiz:

```nginx
server {
    listen 80;
    server_name imobai.net.br www.imobai.net.br;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/broker-imob-ai /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

`nginx -t` **precisa** passar sem erro antes do reload — se der erro de
`server_name` duplicado, confirme que editou o `server_name` da app antiga
mesmo (passo anterior) antes de criar o novo bloco.

## 7. Certificados SSL

O certificado antigo de `imobai.net.br` era emitido pra app anterior —
depois da troca de `server_name`, ele passa a valer pro subdomínio. Emita
certificados novos pros dois nomes:

```bash
certbot --nginx -d imobai.net.br -d www.imobai.net.br
certbot --nginx -d crm.imobai.net.br
```

Depois disso: `https://imobai.net.br` → BrokerImobAI,
`https://crm.imobai.net.br` → aplicação anterior, cada um com
certificado próprio renovando automaticamente.

## 8. Atualizações futuras

```bash
cd broker-imob-ai/udata-dashboard
git pull
npm ci
npm run build
pm2 restart broker-imob-ai
```

## Sincronização com o Vista (feeds XML)

```bash
crontab -e
0 6,18 * * * cd /root/broker-imob-ai/udata-dashboard && \
  export $(grep -v '^#' .env | xargs) && npm run sync:vista >> /var/log/sync-vista.log 2>&1
```

## Troubleshooting

- **Quero testar antes de trocar o Nginx de verdade**: acesse
  `http://SEU_IP:3001` direto (sem domínio) pra conferir que o BrokerImobAI
  está de pé antes de fazer o passo 6.
- **Porta 3001 já em uso**: troque em `ecosystem.config.js` e no
  `proxy_pass` do passo 6.
- **"DATABASE_URL não configurada"**: falta preencher `.env` ou exportar as
  variáveis (`export $(grep -v '^#' .env | xargs)`).
- **Certbot falha em `crm.imobai.net.br`**: confirme
  propagação do DNS (`dig crm.imobai.net.br +short`) e que a
  porta 80 está liberada (`ufw status`).
- **A aplicação antiga parou depois da troca**: confira se o `proxy_pass`/
  raiz dentro do `server_name crm.imobai.net.br...` ficou igual ao original
  — só o `server_name` deveria ter mudado, o resto do bloco é o mesmo de
  antes.
- **`pm2 startup` não persiste após reiniciar o VPS**: confirme `pm2 save`
  depois do `pm2 start`, e que rodou o comando que `pm2 startup` imprimiu.

## Sobre o Docker

Este repositório também tem um `Dockerfile`/`docker-compose.yml` prontos,
caso decida usar Docker no futuro — mas não são necessários pra esse fluxo.
