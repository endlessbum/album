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
} else if (process.env.NODE_ENV !== 'production') {
  // Non-prod fallback: allow app/tests to run with in-memory storage.
  pool = undefined as any;
  db = undefined as any;
} else {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export { pool, db };
