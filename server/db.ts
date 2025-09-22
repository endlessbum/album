// Загружаем переменные окружения
import "./config";

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

let pool: Pool | undefined;
let db: any;

if (process.env.DATABASE_URL) {
  console.warn(`🔗 Connecting to database with URL: ${process.env.DATABASE_URL.substring(0, 50)}...`);
  pool = new Pool({ connectionString: process.env.DATABASE_URL });
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
