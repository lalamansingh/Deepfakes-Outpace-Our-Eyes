/**
 * Applies database migrations. Production: DATABASE_URL=postgres://… npm run db:migrate
 * (embedded PGlite migrates itself on startup).
 */
import path from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { closeDb, getDb } from "../src/db/client";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    await getDb(); // PGlite: opening the database runs the migrations
    await closeDb();
    console.log("Embedded database migrated");
    return;
  }
  const client = postgres(url, { max: 1 });
  await migrate(drizzle(client), { migrationsFolder: path.join(process.cwd(), "drizzle") });
  await client.end();
  console.log("PostgreSQL migrated");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
