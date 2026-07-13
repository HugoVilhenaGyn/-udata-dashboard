// =============================================================
// Acesso ao Postgres (Supabase) pra scripts Node fora do Next.js
// (sync do Vista, migração). Espelha a mesma tabela app_state (JSONB)
// que src/lib/db.ts usa dentro da aplicação — um único documento com
// todo o estado (imóveis, portais, destaques, etc). Ver DEPLOY.md.
// =============================================================

import pg from 'pg';

const { Pool } = pg;

let pool = null;

function getPool() {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL não configurada. Exporte a variável antes de rodar o script (ver DEPLOY.md).');
  }
  pool = new Pool({
    connectionString,
    ssl: process.env.DATABASE_SSL === 'false' ? undefined : { rejectUnauthorized: false },
    max: 2,
  });
  return pool;
}

const APP_STATE_ROW_ID = 1;

export async function garantirSchema() {
  const db = getPool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      id SMALLINT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

export async function readDbPg() {
  await garantirSchema();
  const db = getPool();
  const result = await db.query('SELECT data FROM app_state WHERE id = $1', [APP_STATE_ROW_ID]);
  if (result.rowCount === 0) {
    throw new Error('app_state está vazio — rode "npm run db:migrate" primeiro pra importar o db.json existente.');
  }
  return result.rows[0].data;
}

export async function writeDbPg(data) {
  await garantirSchema();
  const db = getPool();
  await db.query(
    `INSERT INTO app_state (id, data, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
    [APP_STATE_ROW_ID, JSON.stringify(data)]
  );
}

export async function fecharPool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
