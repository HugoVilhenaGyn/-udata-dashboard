// Alternativa ao Docker: rodar direto no VPS com PM2 (sem container).
// Uso (depois de "npm ci && npm run build" e configurar as variáveis de
// ambiente do servidor — ver DEPLOY.md):
//   pm2 start ecosystem.config.js
//   pm2 save && pm2 startup   (pra sobreviver a reboot do servidor)
//
// Porta 3002 de propósito: esse VPS já tem outra aplicação (não gerenciada
// por PM2) ocupando a 3001 (a que hoje responde por imobai.net.br) — 3000
// também está ocupada. O BrokerImobAI assume o domínio raiz imobai.net.br
// via Nginx (proxy_pass pra 3002) e a app antiga passa a responder só por
// crm.imobai.net.br — ver DEPLOY.md. Se 3002 também já estiver em uso,
// troque aqui e no bloco Nginx.
module.exports = {
  apps: [
    {
      name: 'broker-imob-ai',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        PORT: 3002,
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
    },
  ],
};
