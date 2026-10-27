# Real or Rendered?

A 5-minute daily game that trains people to spot AI-generated images, voices and videos.
Built for the **Sopra Steria International Student Challenge 2026–2027** (cognitive stream:
*understanding and detecting digital risks*).

Players see a media item, decide **Real** or **Rendered** (AI-made) and say how sure they are.
The game then reveals the clues they missed (highlighted on the image), where the item comes from,
and — at the end of the round — how well their confidence matched their accuracy.

## What's inside

| Part | Where | What it does |
|---|---|---|
| Player app | `/`, `/play`, `/practice`, `/progress`, `/join` | Anonymous play, daily rounds, practice, clue reveal, calibration feedback, streaks, class join |
| Teacher dashboard | `/teacher` | Classes with join codes, class accuracy over time, hardest clue types, pre/post assessment, students table |
| Admin content studio | `/admin` | Upload media, label it, draw clue regions, record source and licence, review and publish |
| API | `src/app/api/**` | Typed, validated JSON API ([docs/API.md](docs/API.md)) |
| Learning engine | `src/lib/server/engine.ts` | Elo ratings per clue kind, adaptive item selection, spaced review, scoring, Brier/calibration, streaks |

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS 4 · Drizzle ORM ·
PostgreSQL (embedded PGlite locally) · zod · jose (JWT sessions) · bcrypt · sharp · Vitest · Playwright.

## Run it locally

Requirements: Node.js 20.9+ (22 recommended). Nothing else — the database is embedded.

```bash
npm install
cp .env.example .env.local          # optional locally; set ADMIN_EMAIL / ADMIN_PASSWORD
npm run db:seed                     # creates the admin account and loads the content library
npm run dev                         # http://localhost:3000
```

- Player app: <http://localhost:3000>
- Staff sign-in: <http://localhost:3000/staff/login> (the admin from your `.env.local`, or register as a teacher)

> `npm run db:seed` reads `ADMIN_EMAIL` and `ADMIN_PASSWORD` from the environment. With `.env.local`
> run it as `npx dotenv -e .env.local -- npm run db:seed`, or simply:
> `ADMIN_EMAIL=you@school.org ADMIN_PASSWORD='a-long-password' npm run db:seed`

Local data lives in `.data/` (database and uploads). Delete the folder to start fresh.

## Quality checks

```bash
npm run check            # typecheck + lint + unit & integration tests
npm test -- --coverage   # coverage report (server code)
npm run content:validate # content library: schema, files, balance, assessment sets
npm run build            # production build
npm run test:e2e         # end-to-end tests in a real browser (after `npm run build`; starts the app on a fresh database)
```

CI runs all of these on every push and pull request (`.github/workflows/ci.yml`).

## How it stays trustworthy

- **The answer key never leaves the server before you answer.** Round responses carry only media;
  labels, clues and sources are returned by the answer endpoint. Uploaded images are re-encoded,
  which strips EXIF metadata that could give the answer away.
- **Every content item records its provenance**: source URL, licence, author and the evidence for
  its label (`provenanceNote`). The starter library comes from Wikimedia Commons; see
  [content/CONTENT_SOURCES.md](content/CONTENT_SOURCES.md). Clues were drafted with AI and are
  marked *needs review* until your team checks them in the studio.
- **Correcting a label re-scores past answers** so statistics stay truthful.
- **Privacy by design:** players are anonymous (a signed cookie, no account, no tracking, no ads).
  Teachers see nicknames only.

## Security

Signed httpOnly SameSite cookies (HS256 JWT) · bcrypt (cost 12) with timing-safe login ·
role checks on every staff endpoint (re-read from the database) · zod validation on every input ·
same-origin checks on all writes · per-IP/per-user rate limits · strict Content-Security-Policy and
security headers · upload type detection by file bytes, size limits, metadata stripping ·
database CHECK and unique constraints as a second line of defence.

## Project layout

```
src/
  app/            pages (player, staff) and API routes
  components/     ui.tsx (shared), player/, staff/
  db/             schema.ts, client.ts (PostgreSQL or embedded PGlite)
  lib/contracts.ts  shared API types and zod schemas
  lib/server/     engine, rounds, players, classrooms, items, storage, auth, http, rate-limit
drizzle/          SQL migrations
content/seed/     starter content library (items.json) — media in public/media/items/
scripts/          migrate, seed, validate-content
tests/            unit, integration (API against a real Postgres engine), e2e (Playwright)
docs/             API.md, DEPLOY.md
```

## Deploying

See [docs/DEPLOY.md](docs/DEPLOY.md) — Vercel + Neon, or Docker on any server.
