// =============================================================
// Migração única: lê o src/data/db.json atual (340 imóveis reais, users,
// destaques, config da Lisa etc — tudo que já existe hoje) e grava como
// estado inicial no Postgres (Supabase). Depois disso, db.json deixa de
// ser lido pela aplicação — fica só como o "snapshot" da migração.
//
// Uso:
//   DATABASE_URL="postgresql://..." npm run db:migrate
//
// É seguro rodar mais de uma vez: se o Postgres já tiver dados, o script
// pergunta antes de sobrescrever (a não ser que passe --force).
// =============================================================

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { readDbPg, writeDbPg, garantirSchema, fecharPool } from './lib/pg-db.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_JSON_PATH = path.join(__dirname, '..', 'src', 'data', 'db.json');

async function confirmar(pergunta) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const resposta = await new Promise(resolve => rl.question(pergunta, resolve));
  rl.close();
  return /^s(im)?$/i.test(resposta.trim());
}

async function main() {
  if (!fs.existsSync(DB_JSON_PATH)) {
    throw new Error(`Não encontrei ${DB_JSON_PATH}. Nada pra migrar.`);
  }

  const dbJson = JSON.parse(fs.readFileSync(DB_JSON_PATH, 'utf-8'));
  console.log(`Lido db.json: ${dbJson.imoveis?.length ?? 0} imóveis, ${dbJson.users?.length ?? 0} usuários, ${dbJson.destaques?.length ?? 0} destaques, ${dbJson.leadsAvaliacao?.length ?? 0} leads de avaliação, ${dbJson.relatoriosLisa?.length ?? 0} relatórios da Lisa.`);

  await garantirSchema();

  const forceFlag = process.argv.includes('--force');
  let jaExiste = false;
  try {
    await readDbPg();
    jaExiste = true;
  } catch {
    jaExiste = false;
  }

  if (jaExiste && !forceFlag) {
    const ok = await confirmar('Já existe estado no Postgres. Isso vai SOBRESCREVER com o conteúdo do db.json. Continuar? (s/N) ');
    if (!ok) {
      console.log('Cancelado.');
      await fecharPool();
      return;
    }
  }

  await writeDbPg(dbJson);
  console.log('\n✅ Migração concluída — estado gravado em Postgres (tabela app_state).');
  console.log('A partir de agora a aplicação lê/grava do Postgres, não mais do db.json.');
  await fecharPool();
}

main().catch(err => {
  console.error('Erro na migração:', err.message);
  process.exit(1);
});
