
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import * as schema from "@shared/schema";

const databasePath = resolve(process.env.SQLITE_DATABASE_PATH || "./data/oma-designer.db");
mkdirSync(dirname(databasePath), { recursive: true });

export const sqlite = new Database(databasePath);
sqlite.pragma("journal_mode = WAL");
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS lenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    oma_content TEXT NOT NULL,
    parsed_metadata TEXT,
    created_at INTEGER
  )
`);

export const db = drizzle(sqlite, { schema });
