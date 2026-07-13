// Alternativa ao Docker: rodar direto no VPS com PM2 (sem container).
// Uso (depois de "npm ci && npm run build" e configurar as variáveis de
// ambiente do servidor — ver DEPLOY.md):
//   pm2 start ecosystem.config.js
//   pm2 save && pm2 startup   (pra sobreviver a reboot do servidor)
//
// Porta 3001 (não 3000) de propósito: esse VPS já tem outra aplicação
// rodando em imobai.net.br, o BrokerImobAI convive num subdomínio
// (painel.imobai.net.br) — ver DEPLOY.md. Se 3001 também já estiver em
// uso por outra coisa nesse servidor, troque aqui e no bloco Nginx.
module.exports = {
  apps: [
    {
      name: 'broker-imob-ai',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
    },
  ],
};
