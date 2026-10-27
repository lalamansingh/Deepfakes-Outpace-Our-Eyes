/**
 * Database access. Production uses PostgreSQL through DATABASE_URL (postgres-js).
 * Without DATABASE_URL we run an embedded PostgreSQL (PGlite) so the app works
 * with zero setup: persisted in PGLITE_DIR (default .data/pglite), or in memory
 * when PGLITE_DIR=memory:// (tests). Both speak the same Postgres dialect and
 * share one schema and one set of migrations.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;
/** A transaction handle has the same query API as the database itself. */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const MIGRATIONS = path.join(process.cwd(), "drizzle");

type Handle = { db: Db; ready: Promise<void>; close: () => Promise<void> };

function open(): Handle {
  const url = process.env.DATABASE_URL;
  if (url) {
    const client = postgres(url, { max: Number(process.env.DATABASE_POOL_SIZE ?? 10), prepare: false });
    const db = drizzlePostgres(client, { schema });
    const ready =
      process.env.AUTO_MIGRATE === "true" ? migratePostgres(db, { migrationsFolder: MIGRATIONS }) : Promise.resolve();
    return { db, ready, close: () => client.end() };
  }
  const dir = process.env.PGLITE_DIR ?? ".data/pglite";
  const inMemory = dir === "memory://";
  // PGlite creates its own folder but not missing parents.
  if (!inMemory) mkdirSync(path.dirname(path.resolve(dir)), { recursive: true });
  const client = new PGlite(inMemory ? undefined : path.resolve(dir));
  const pglite = drizzlePglite(client, { schema });
  // Embedded mode always migrates on boot: there is no separate DB to prepare.
  const ready = migratePglite(pglite, { migrationsFolder: MIGRATIONS });
  return { db: pglite as unknown as Db, ready, close: () => client.close() };
}

const globalForDb = globalThis as unknown as { __rrDb?: Handle };

/** Returns the shared database, migrated and ready. Safe to call from any request. */
export async function getDb(): Promise<Db> {
  const handle = (globalForDb.__rrDb ??= open());
  try {
    await handle.ready;
  } catch (err) {
    // Do not cache a failed connection: the next request tries again.
    if (globalForDb.__rrDb === handle) globalForDb.__rrDb = undefined;
    await handle.close().catch(() => undefined);
    throw err;
  }
  return handle.db;
}

/** Closes the shared connection (scripts and tests). */
export async function closeDb(): Promise<void> {
  const handle = globalForDb.__rrDb;
  globalForDb.__rrDb = undefined;
  if (handle) await handle.close();
}

export { schema };
