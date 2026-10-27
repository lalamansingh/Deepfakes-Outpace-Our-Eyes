/**
 * Seeds the database:
 * - an admin account from ADMIN_EMAIL / ADMIN_PASSWORD (created once, never overwritten)
 * - the content library from content/seed/items.json (new slugs are inserted;
 *   pass --update to also refresh existing items from the file)
 * Usage: npm run db:seed [-- --update]
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { itemInputSchema, registerSchema } from "../src/lib/contracts";
import { closeDb, getDb, schema } from "../src/db/client";
import { hashPassword } from "../src/lib/server/auth";
import { createItem, updateItem } from "../src/lib/server/items";

async function main() {
  const db = await getDb();
  const update = process.argv.includes("--update");

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (email && password) {
    const admin = registerSchema.parse({ email, password, name: process.env.ADMIN_NAME ?? "Administrator" });
    const [existing] = await db.select().from(schema.staffUsers).where(eq(schema.staffUsers.email, admin.email)).limit(1);
    if (existing) {
      console.log(`admin ${admin.email} already exists`);
    } else {
      await db.insert(schema.staffUsers).values({ email: admin.email, name: admin.name, role: "admin", passwordHash: await hashPassword(admin.password) });
      console.log(`created admin ${admin.email}`);
    }
  } else {
    console.log("ADMIN_EMAIL / ADMIN_PASSWORD not set: skipping admin account");
  }

  const file = path.join(process.cwd(), "content/seed/items.json");
  if (!existsSync(file)) {
    console.log("content/seed/items.json not found: skipping content");
  } else {
    const list = z.array(itemInputSchema).parse(JSON.parse(readFileSync(file, "utf8")));
    let created = 0;
    let updated = 0;
    for (const input of list) {
      const [existing] = await db.select({ id: schema.items.id }).from(schema.items).where(eq(schema.items.slug, input.slug)).limit(1);
      if (!existing) {
        await createItem(db, input);
        created++;
      } else if (update) {
        await updateItem(db, existing.id, input);
        updated++;
      }
    }
    console.log(`content: ${list.length} in file, ${created} created, ${updated} updated`);
  }
  await closeDb();
}

main().catch(async (err) => {
  console.error(err);
  await closeDb();
  process.exit(1);
});
