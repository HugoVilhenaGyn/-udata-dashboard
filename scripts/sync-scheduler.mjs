// =============================================================
// Processo de agendamento da sincronização diária com o Vista CRM.
//
// Roda como um 4º processo PM2 (separado do Next.js), fica de pé o tempo
// todo, e a cada minuto confere se o horário atual bate com algum horário
// configurado em db.configSync (editável em Configurações > Sincronização)
// pra cada feed (loft/zap). Quando bate, dispara o script de sync
// correspondente como processo filho — o mesmo script que "Rodar agora"
// no Motor de XML chama manualmente, só que aqui com disparado_por =
// 'agendado'.
//
// Não usa cron/systemd timer pra manter tudo dentro do próprio app (mesma
// forma de configurar, mesmo lugar de deploy) e pra permitir mudar o
// horário pela UI sem precisar mexer no servidor.
//
// Uso: node scripts/sync-scheduler.mjs
// (registrado no PM2 como processo `sync-scheduler`, ver DEPLOY.md)
// =============================================================

import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { readDbPg } from './lib/pg-db.mjs';

const CONFIG_SYNC_PADRAO = {
  loft: { habilitado: false, horarios: [] },
  zap: { habilitado: false, horarios: [] },
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INTERVALO_MS = 60_000;

const SCRIPTS = {
  loft: 'sync-vista-full-feed.mjs',
  zap: 'sync-vista-zap-feed.mjs',
};

// Evita disparar duas vezes dentro do mesmo minuto (o poll roda a cada 60s
// mas não é garantido bater exatamente em cima do segundo 0) e evita
// sobrepor duas execuções do mesmo feed se uma sync anterior ainda estiver
// rodando.
const ultimoDisparoPorMinuto = new Map(); // feed -> "YYYY-MM-DDTHH:MM"
const emExecucao = new Set(); // feeds rodando agora

function horarioAtualBR() {
  // America/Sao_Paulo — mesma referência usada pelos horários configurados
  // na UI (não há troca de fuso horário nesse app, é tudo local do Brasil).
  const agora = new Date();
  const formatado = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(agora);
  return formatado; // "HH:MM"
}

function chaveDoMinuto() {
  return new Date().toISOString().slice(0, 16); // "YYYY-MM-DDTHH:MM"
}

function rodarFeed(feed) {
  if (emExecucao.has(feed)) {
    console.log(`[scheduler] ${feed}: já está rodando, pulando disparo agendado.`);
    return;
  }
  emExecucao.add(feed);
  console.log(`[scheduler] Disparando sync agendada: ${feed}`);
  const scriptPath = path.join(__dirname, SCRIPTS[feed]);
  const filho = spawn('node', [scriptPath], {
    env: { ...process.env, SYNC_TRIGGER: 'agendado' },
    stdio: 'inherit',
  });
  filho.on('close', codigo => {
    emExecucao.delete(feed);
    console.log(`[scheduler] ${feed} finalizou com código ${codigo}.`);
  });
  filho.on('error', err => {
    emExecucao.delete(feed);
    console.error(`[scheduler] Falha ao iniciar processo de ${feed}:`, err.message);
  });
}

async function verificar() {
  try {
    const db = await readDbPg();
    const config = db.configSync || CONFIG_SYNC_PADRAO;
    const horarioAtual = horarioAtualBR();
    const chave = chaveDoMinuto();

    for (const feed of ['loft', 'zap']) {
      const cfgFeed = config[feed];
      if (!cfgFeed || !cfgFeed.habilitado) continue;
      if (!Array.isArray(cfgFeed.horarios) || !cfgFeed.horarios.includes(horarioAtual)) continue;

      const chaveFeed = `${feed}:${chave}`;
      if (ultimoDisparoPorMinuto.get(feed) === chaveFeed) continue; // já disparado nesse minuto
      ultimoDisparoPorMinuto.set(feed, chaveFeed);
      rodarFeed(feed);
    }
  } catch (err) {
    console.error('[scheduler] Erro ao verificar agendamento:', err.message);
  }
}

console.log('[scheduler] Agendador de sincronização Vista CRM iniciado. Checando a cada 60s.');
verificar();
setInterval(verificar, INTERVALO_MS);
