// Загружаем переменные окружения
import "./config";

import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

let pool: Pool | undefined;
let db: any;

if (process.env.DATABASE_URL) {
  console.warn(`🔗 Connecting to database with URL: ${process.env.DATABASE_URL.substring(0, 50)}...`);
  // Supabase/most managed Postgres require TLS; disable CA verification for simplicity
  pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } as any });
  db = drizzle({ client: pool, schema });
  console.warn('✅ Database connection pool created');
} else {
  // No DATABASE_URL: disable DB integration gracefully in any env
  const env = process.env.NODE_ENV || 'development';
  console.warn(`⚠️ DATABASE_URL is not set (NODE_ENV=${env}). Running without Postgres; falling back to in-memory storage where applicable.`);
  pool = undefined as any;
  db = undefined as any;
}

export { pool, db };
