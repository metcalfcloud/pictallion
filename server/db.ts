import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

const dbType = process.env.DB_TYPE || 'postgres';

if (dbType === 'sqlite') {
  // Placeholder for SQLite config
  throw new Error("SQLite support not yet implemented. Set DB_TYPE=postgres for Postgres.");
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });
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