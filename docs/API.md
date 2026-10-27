# API reference

All request bodies and response types are defined in `src/lib/contracts.ts` — import them, never redeclare them.
All endpoints return JSON. Errors always have the shape `ApiError`:
`{ "error": { "code": "validation_error" | "unauthorized" | "forbidden" | "not_found" | "conflict" | "rate_limited" | "internal", "message": string, "details"?: unknown } }`
with a matching HTTP status (400, 401, 403, 404, 409, 429, 500).

Mutating requests (POST/PUT/PATCH/DELETE) must be same-origin (the server rejects a foreign `Origin` header). Use `fetch` with relative URLs; cookies are sent automatically.

## Player (anonymous, cookie `rr_player`)

| Method & path | Body | Response | Notes |
|---|---|---|---|
| `POST /api/session` | – | `PlayerDTO` | Creates the anonymous player on first visit, otherwise returns the current one. Call once on app load. |
| `GET /api/me` | – | `PlayerDTO` | 401 if no session yet. |
| `POST /api/rounds` | `{ kind?: RoundKind }` (default `"daily"`) | `RoundDTO` | `daily` is idempotent per UTC day: returns today's round (with answers so far) if it exists. `practice` and `spot` resume the player's unfinished round from the last 2 days, otherwise start a new one. `spot` rounds carry `puzzles` (4 grids of 4 items, exactly one odd item each — which one is never sent before the pick). `assessment_pre` / `assessment_post` use the fixed sets A / B and can be taken once each (409 if already completed). |
| `GET /api/rounds/:id` | – | `RoundDTO` | Resume a round. 404 if it belongs to someone else. |
| `POST /api/rounds/:id/answers` | `AnswerInput` | `AnswerResultDTO` | Reveals label, points, clues and source. 409 if the item was already answered in this round; 400 if the item is not part of the round. |
| `POST /api/rounds/:id/complete` | – | `RoundSummaryDTO` | Only after every item is answered (400 otherwise). Idempotent. Updates streak for daily rounds. |
| `POST /api/rounds/:id/picks` | `SpotPickInput` (`{ puzzle, itemId, confidence, responseMs }`) | `SpotResultDTO` | Spot rounds (`kind: "spot"`) only: pick the odd one out of a puzzle. Reveals every item's label and the odd item's clues. 409 if the puzzle was already answered. |
| `POST /api/classrooms/join` | `{ code, nickname }` | `PlayerDTO` | Joins a teacher's class. 404 for an unknown code. |
| `GET /api/credits` | – | `{ credits: { author: string; license: string; licenseUrl: string \| null; sourceUrl: string }[] }` | Attribution list for the credits page (no labels). |

Scoring (for UI copy): a correct answer earns `confidence` points (50–100); a wrong answer costs `confidence − 50` points (0 to −50). So being honest about uncertainty pays.

Media: `mediaUrl` is a same-origin path (e.g. `/media/items/x.jpg` or `/api/media/<key>`); use it directly in `<img>`/`<audio>`/`<video>`.

Clue regions: `{x, y, w, h}` are fractions of the media's width/height — position overlays with percentages over the rendered image.

## Staff auth (cookie `rr_staff`)

| Method & path | Body | Response |
|---|---|---|
| `POST /api/auth/register` | `{ email, password (≥10 chars), name }` | `StaffDTO` (role `teacher`, signed in) |
| `POST /api/auth/login` | `{ email, password }` | `StaffDTO` |
| `POST /api/auth/logout` | – | `{ ok: true }` |
| `GET /api/auth/me` | – | `StaffDTO` or 401 |

The first admin is created by `npm run db:seed` from `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

## Teacher (role teacher or admin)

| Method & path | Body | Response |
|---|---|---|
| `GET /api/classrooms` | – | `{ classrooms: ClassroomDTO[] }` (own classes) |
| `POST /api/classrooms` | `{ name }` | `ClassroomDTO` |
| `GET /api/classrooms/:id/dashboard` | – | `ClassDashboardDTO` (403 if not the owner, admins may view all) |

## Admin (role admin)

| Method & path | Body | Response |
|---|---|---|
| `GET /api/admin/stats` | – | `AdminStatsDTO` |
| `GET /api/admin/items?status=&label=&review=&q=` | – | `{ items: AdminItemDTO[] }` |
| `POST /api/admin/items` | `ItemInput` | `AdminItemDTO` (409 on duplicate slug) |
| `GET /api/admin/items/:id` | – | `AdminItemDTO` |
| `PATCH /api/admin/items/:id` | `Partial<ItemInput>` (if `clues` is present it replaces all clues) | `AdminItemDTO` |
| `DELETE /api/admin/items/:id` | – | `{ ok: true }` (archives; items with answers are never hard-deleted) |
| `POST /api/admin/uploads` | `multipart/form-data` field `file` (jpeg/png/webp ≤ 8 MB, mp3/m4a/ogg/wav ≤ 15 MB, mp4/webm ≤ 40 MB) | `{ url, mediaType, width, height }` (width/height null for audio/video) |
