# Deploying Real or Rendered?

Two supported paths. Both need the same three things:

1. **A PostgreSQL database** (`DATABASE_URL`).
2. **A session secret** (`SESSION_SECRET`, at least 32 random characters: `openssl rand -base64 48`).
3. **An admin account**, created once with `npm run db:seed`.

---

## Option A — Vercel + Neon (managed, free tiers available)

Accounts you need: GitHub, [Vercel](https://vercel.com), [Neon](https://neon.tech) (Postgres), and
for admin uploads in production, [Cloudflare R2](https://developers.cloudflare.com/r2/) (or any S3-compatible bucket).

1. **Push the code to a GitHub repository.**
2. **Create a Neon project** (pick an EU region) and copy its connection string
   (`postgres://…?sslmode=require`).
3. **Create the tables and the admin** from your computer:
   ```bash
   DATABASE_URL='postgres://…' npm run db:migrate
   DATABASE_URL='postgres://…' ADMIN_EMAIL=you@school.org ADMIN_PASSWORD='a-long-password' npm run db:seed
   ```
4. **Create an R2 bucket** with public access (or a custom domain), and an API token with
   *Object Read & Write* on that bucket. Serverless functions have no persistent disk, so uploads
   must go to a bucket. The starter library in `public/media` is bundled with the app and needs no bucket.
5. **Import the repository in Vercel** and set these environment variables:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Neon connection string |
   | `SESSION_SECRET` | output of `openssl rand -base64 48` |
   | `S3_BUCKET` | your R2 bucket name |
   | `S3_ENDPOINT` | `https://<account-id>.r2.cloudflarestorage.com` |
   | `S3_REGION` | `auto` |
   | `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | R2 API token |
   | `MEDIA_PUBLIC_ORIGIN` | public bucket URL, e.g. `https://media.yourdomain.org` |
   | `TEACHER_SIGNUP` | `open` or `closed` |

6. **Deploy.** Check `https://<your-app>/api/health` returns `{"ok":true}`.

When the schema changes later: run `npm run db:migrate` against `DATABASE_URL` before (or right after) deploying.

> Rate limits are kept in memory per server instance. On Vercel that is per function instance,
> which still blocks bursts but is not a global limit. For a strict global limit, back
> `src/lib/server/rate-limit.ts` with Redis (e.g. Upstash) — the interface stays the same.

---

## Option B — Docker on any server (VPS, school server, cloud VM)

Requires Docker with the compose plugin.

```bash
cp .env.example .env
# edit .env: SESSION_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD (DATABASE_URL is set by compose)
docker compose up -d --build
docker compose --profile tools run --rm tools npm run db:seed
```

The app listens on port 3000 and migrates the database on start (`AUTO_MIGRATE=true`).
Uploads are kept in the `uploads` volume, the database in `pgdata`. Put a TLS-terminating
reverse proxy (Caddy, nginx, Traefik) in front and, if the public host name differs from the one the
app sees, add it to `ALLOWED_ORIGINS`.

Backups: `docker compose exec db pg_dump -U rr real_or_rendered > backup.sql`.

---

## Production checklist

- [ ] `SESSION_SECRET` set (the server refuses to start without it in production)
- [ ] Admin created, default password changed
- [ ] `/api/health` OK
- [ ] HTTPS only (cookies are `Secure` in production)
- [ ] Content reviewed in the studio: every item marked *reviewed*, licences and attributions checked
- [ ] `TEACHER_SIGNUP` set to what you want
- [ ] Database backups scheduled
