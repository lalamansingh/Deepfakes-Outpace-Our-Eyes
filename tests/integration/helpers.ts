import { NextRequest } from "next/server";
import type { ItemInput, Label } from "@/lib/contracts";
import { getDb, schema } from "@/db/client";
import { hashPassword } from "@/lib/server/auth";
import { createItem } from "@/lib/server/items";

type Handler = (req: NextRequest, ctx: { params: Promise<unknown> }) => Promise<Response>;

/** A tiny browser: keeps cookies between calls to route handlers. */
export class Client {
  cookies = new Map<string, string>();
  constructor(
    public origin = "http://localhost:3000",
    public ip = "10.0.0.1",
  ) {}

  async call<T = unknown>(
    handler: Handler,
    method: string,
    path: string,
    opts: { body?: unknown; params?: Record<string, string>; headers?: Record<string, string>; raw?: BodyInit } = {},
  ): Promise<{ status: number; body: T; headers: Headers }> {
    const headers = new Headers({ host: "localhost:3000", "x-forwarded-for": this.ip, ...opts.headers });
    if (opts.body !== undefined) headers.set("content-type", "application/json");
    if (this.cookies.size) headers.set("cookie", [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; "));
    if (method !== "GET" && !headers.has("origin")) headers.set("origin", this.origin);
    const req = new NextRequest(new URL(path, "http://localhost:3000"), {
      method,
      headers,
      body: opts.raw ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    });
    const res = await handler(req, { params: Promise.resolve(opts.params ?? {}) });
    for (const c of res.headers.getSetCookie()) {
      const [pair, ...attrs] = c.split(";");
      const idx = pair.indexOf("=");
      const name = pair.slice(0, idx).trim();
      const value = pair.slice(idx + 1).trim();
      if (!value || attrs.some((a) => /max-age=0/i.test(a.trim()))) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    const text = await res.text();
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      /* binary or plain responses stay as text */
    }
    return { status: res.status, body: body as T, headers: res.headers };
  }
}

const CATEGORIES = ["portrait", "animal", "landscape", "food", "architecture", "object", "scene"] as const;
const KINDS = ["lighting", "anatomy", "texture", "text", "geometry", "background"] as const;

export function itemFixture(i: number, overrides: Partial<ItemInput> = {}): ItemInput {
  const label: Label = i % 2 === 0 ? "real" : "ai";
  return {
    slug: `fixture-item-${i}`,
    mediaType: "image",
    mediaUrl: `/media/items/fixture-${i}.jpg`,
    width: 1024,
    height: 768,
    label,
    category: CATEGORIES[i % CATEGORIES.length],
    sourceName: "Wikimedia Commons",
    sourceUrl: `https://commons.wikimedia.org/wiki/File:Fixture_${i}.jpg`,
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    attribution: `Author ${i}`,
    generator: label === "ai" ? "Stable Diffusion XL" : null,
    provenanceNote: "Fixture item used in automated tests only.",
    assessmentSet: null,
    status: "published",
    reviewStatus: "reviewed",
    clues: [
      { kind: KINDS[i % KINDS.length], title: "Look at the light", explanation: "The shadows fall in two different directions.", region: { x: 0.1, y: 0.1, w: 0.3, h: 0.3 } },
      { kind: "source", title: "Check the source", explanation: "Who published this first, and can you trace it?", region: null },
    ],
    ...overrides,
  };
}

/** Creates `n` playable items plus assessment sets A and B (4 real + 4 AI each). */
export async function seedLibrary(n = 24) {
  const db = await getDb();
  for (let i = 0; i < n; i++) await createItem(db, itemFixture(i));
  for (const set of ["A", "B"] as const) {
    for (let i = 0; i < 8; i++) {
      await createItem(db, itemFixture(1000 + (set === "A" ? 0 : 100) + i, { assessmentSet: set, slug: `assess-${set}-${i}` }));
    }
  }
}

export async function createStaff(email: string, password: string, role: "teacher" | "admin") {
  const db = await getDb();
  const [u] = await db
    .insert(schema.staffUsers)
    .values({ email, name: role === "admin" ? "Admin" : "Teacher", role, passwordHash: await hashPassword(password) })
    .returning();
  return u;
}
