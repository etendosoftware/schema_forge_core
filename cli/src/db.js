import pg from 'pg';

export function createDbPool(config) {
  return new pg.Pool(config ?? {
    host: process.env.ETENDO_DB_HOST ?? 'localhost',
    port: parseInt(process.env.ETENDO_DB_PORT ?? '5432', 10),
    user: process.env.ETENDO_DB_USER ?? 'etendo',
    password: process.env.ETENDO_DB_PASSWORD ?? '',
    database: process.env.ETENDO_DB_NAME ?? 'etendo_dev',
    max: 5,
  });
}

export async function closePool(pool) {
  await pool.end();
}
