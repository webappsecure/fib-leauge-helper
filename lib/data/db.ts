import { mkdirSync } from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "./schema";

const DATABASE_FILE = path.join(process.cwd(), "local-data", "fib-league.db");
const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");

export async function openDatabase(filePath: string) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const database = drizzle(createClient({ url: `file:${filePath}` }), {
    schema,
  });
  await migrate(database, { migrationsFolder: MIGRATIONS_FOLDER });
  return database;
}

export type Database = Awaited<ReturnType<typeof openDatabase>>;

let appDatabase: Promise<Database> | undefined;

export function getDatabase(): Promise<Database> {
  // A failed open is not cached, so a later request can retry.
  appDatabase ??= openDatabase(DATABASE_FILE).catch((error) => {
    appDatabase = undefined;
    throw error;
  });
  return appDatabase;
}
