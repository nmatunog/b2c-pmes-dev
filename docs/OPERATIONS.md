# B2C PMES — Production operations

This document describes how the **live** stack is wired: two Cloudflare surfaces (static marketing UI + API Worker), how to deploy safely, and common pitfalls (CORS, wrong hostname, wrong Worker).

For local development, use **[DEVELOPMENT.md](../DEVELOPMENT.md)**. For OpenNext/Wrangler details and dashboard setup, see **[frontend/CLOUDFLARE.md](../frontend/CLOUDFLARE.md)**.

---

## Architecture at a glance

| Surface | What it is | Typical URL role |
|---------|------------|------------------|
| **Vite static site** | `npm run vite:build` → `frontend/dist/` | Marketing/member shell served from **Cloudflare Pages** |
| **OpenNext Worker** | `npm run cf:build` → `frontend/.open-next/` | **REST-style API** (Next Route Handlers), Neon DB, auth sync, landing AI |

**Important:** The **custom domain for the public marketing site** (e.g. apex `b2ccoop.com`) should attach to the **Pages** project that serves the **Vite** build, not only to the OpenNext Worker. If the apex points only at the Worker, visitors may see the Next shell instead of the Vite landing experience you expect.

**API base URL:** The browser uses **`VITE_API_BASE_URL`** (built into the Vite app) pointing at the **Worker origin** (e.g. `https://b2c-pmes-web.<account>.workers.dev` or a dedicated API hostname). Paths are rewritten in Next so the client can call routes like `/auth/sync-member` and `/pmes/...` consistently—see `frontend/next.config.mjs` and middleware.

---

## Cloudflare project names (this repo)

| Asset | Cloudflare name / command | Notes |
|-------|---------------------------|--------|
| Vite UI (Pages) | **`b2c-pmes-web-ui`** | `wrangler pages deploy dist --project-name b2c-pmes-web-ui` |
| OpenNext API Worker | **`b2c-pmes-web`** | `wrangler deploy --config wrangler.b2c-pmes-web.jsonc` |

There is also a default **`frontend/wrangler.jsonc`** used by generic `cf:deploy*` scripts; **for production API** use **`cf:deploy:web:safe`** so the deployed Worker is **`b2c-pmes-web`**, not an accidental dev worker name.

---

## Canonical deploy commands

From **`frontend/`** (after `npm ci` and Wrangler auth as needed):

| Goal | Command |
|------|---------|
| Deploy **Vite UI** to Pages | `npm run pages:deploy:safe` |
| Deploy **production API Worker** (`b2c-pmes-web`) | `npm run cf:deploy:web:safe` |

Both run **`preflight:api`** first (`scripts/preflight-prod-api.sh`) to reduce “wrong env” deploys.

**Do not** rely on `cf:deploy:safe` alone for production API if it targets a different Worker config than `wrangler.b2c-pmes-web.jsonc`.

---

## Environment variables

- **Vite (built into static bundle):** set at **build time** via `frontend/.env` / `.env.production` (files are gitignored except examples). Key: **`VITE_API_BASE_URL`** → Worker origin.
- **Worker (OpenNext):** **`ADMIN_JWT_SECRET`** (required for staff admin API), **`DATABASE_URL`** (Neon), **`FIREBASE_PROJECT_ID`**, optional **`MEMBER_SYNC_SECRET`**, AI keys for server routes, etc. Configure in the Worker dashboard or Wrangler secrets—see **[CLOUDFLARE.md](../frontend/CLOUDFLARE.md)**.

Never commit secrets. Use `.env.example` files as templates only.

---

## CORS and middleware

API routes and rewritten paths are handled in **`frontend/middleware.ts`**. The matcher must include every path prefix the Vite app calls **without** going through `/api/...` (for example **`/pmes/*`**, **`/auth/sync-member`**, health, AI routes) so browsers do not block cross-origin requests.

**Pitfall:** Defining CORS headers in both **`next.config.mjs`** `headers()` and middleware can produce **duplicate** `Access-Control-Allow-Origin` values (e.g. `*, *`). Prefer **one** layer (middleware in this repo) for CORS on those routes.

Preflight (**OPTIONS**) for sensitive routes (e.g. sync-member) is implemented in the corresponding Route Handler plus shared helpers under **`frontend/lib/`** (e.g. edge CORS utilities).

---

## Firebase

- Add **authorized domains** for every hostname users sign in from (apex, `www`, Workers dev host if used for testing, etc.).
- Client config remains **`VITE_FIREBASE_*`** in the Vite env.

---

## SEO and link previews

Marketing HTML metadata lives in **`frontend/index.html`** (title, description, Open Graph, Twitter cards). Product branding for previews should stay aligned with that file (e.g. **B2C COOP**).

---

## Git remotes (typical)

This team often uses:

- **`origin`** — development mirror (e.g. `B2C-PMES-dev`)
- **`production`** — production repo (e.g. `B2C-PMES`)

Push documentation and code to the branch your team uses (commonly **`main`** on both).

---

## Related documents

- **[DEVELOPMENT.md](../DEVELOPMENT.md)** — full stack, Nest backend, Prisma, Firebase, member sync API semantics.
- **[cursor_docs.md](../cursor_docs.md)** — Cursor-oriented architecture notes (some paths refer to legacy layout; Next app lives under **`frontend/`** in this repository).
- **[deploy-neon.md](./deploy-neon.md)** — Neon + Prisma for server-side DB.
