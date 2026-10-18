/**
 * Database connection singleton.
 * Uses a single postgres.js connection pool, reused across hot-reloads in dev.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL environment variable is not set. " +
    "Copy .env.example to .env.local and fill in your Supabase connection string."
  );
}

// Prevent multiple connections in Next.js dev hot-reload
const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined;
};

const conn = globalForDb.conn ?? postgres(connectionString, { max: 1 });

if (process.env.NODE_ENV !== "production") {
  globalForDb.conn = conn;
}

export const db = drizzle(conn, { schema });
export type DB = typeof db;
