import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import ws from "ws";
import * as schema from "@shared/schema";
import { Pool, neonConfig } from '@neondatabase/serverless';

neonConfig.webSocketConstructor = ws;

const dbType = process.env.DB_TYPE || 'sqlite';

let db;
if (dbType === 'sqlite') {
  // Use local SQLite file for self-contained desktop app
  const sqlitePath = process.env.SQLITE_PATH || 'data/pictallion.db';
  const sqlite = new Database(sqlitePath);
  db = drizzleSqlite(sqlite, { schema });
} else {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database?",
    );
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzleNeon({ client: pool, schema });
}

export { db };
import {
  users,
  mediaAssets,
  fileVersions,
  assetHistory,
  collections,
  collectionPhotos,
  people,
  faces,
  settings,
  events,
  globalTagLibrary
} from "@shared/schema";