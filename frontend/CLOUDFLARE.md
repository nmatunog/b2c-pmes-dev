# Deploy Next.js on Cloudflare (OpenNext)

This app uses [**OpenNext for Cloudflare**](https://opennext.js.org/cloudflare) (`@opennextjs/cloudflare`), which wraps Next.js into a **Cloudflare Worker** plus static assets. Use the **Workers** path with Git — not legacy static-only **Pages** unless you intentionally want a separate static site.

---

## Deployment roadmap (gold standard checklist)

Use this when setting up or revisiting production. Settings below match **`frontend/wrangler.jsonc`** and **`package.json`**.

### Phase 1 — Clean up (avoid domain / name conflicts)

Before attaching a production hostname, remove obsolete projects that might still hold the domain or duplicate names:

1. **Workers:** Delete old test Workers you no longer need (e.g. earlier names like `b2ccoop`, `b2c-pmes`) **only if** you are sure nothing production-critical uses them.
2. **Pages:** Remove unused **Pages** projects that might still serve the same hostname.
3. **Custom domains:** In each old project, remove **Custom domain** bindings so **`b2ccoop.com`** / **`www.b2ccoop.com`** are free to attach to **`b2c-pmes-web`**.

Deleting a Worker does **not** delete your Git repo; it only frees routing and names. When in doubt, detach domains first, then delete.

### Phase 2 — Create the OpenNext Worker + Git

1. Cloudflare dashboard → **Workers & Pages** → **Create application**.
2. Stay on the **Workers** tab (do **not** create a static-only Pages project for this Next app).
3. **Connect to Git** and select the repo/branch you deploy from (e.g. `main` on **`B2C-PMES`** or your dev mirror).

### Phase 3 — Build settings (must match this repo)

| Setting | Value |
|--------|--------|
| **Worker name** | **`b2c-pmes-web`** — must match `"name"` in `frontend/wrangler.jsonc` and `services[0].service`. |
| **Root directory** | **`frontend`** |
| **Build command** | **`npm ci && npm run cf:build`** |
| **Deploy command** | If the UI asks for a separate step: **`npx wrangler deploy`**. (Some pipelines combine build + deploy; follow what Cloudflare shows.) |

**Build environment variables (non-secret):**

| Name | Value |
|------|--------|
| `NODE_VERSION` | **`20`** |

**Application secrets / variables:** add in the Worker → **Settings** → **Variables** (use **Secrets** for tokens and DB URLs). See [Environment variables](#environment-variables-production--preview) below.

### Phase 4 — Compatibility flags

Your repo already declares runtime settings in **`frontend/wrangler.jsonc`**:

- `compatibility_flags` includes **`nodejs_compat`**
- `compatibility_date` is **`2024-12-30`**

Git-based deploys using Wrangler should pick these up from the file. In the dashboard, open the Worker → **Settings** → look for **Compatibility date** / **Compatibility flags** (labels vary by UI version). Keep them **aligned** with `wrangler.jsonc` so dashboard and Git deploys do not fight each other.

Do **not** rely on a tab name **“Functions”** for Workers — that naming is often associated with **Pages**. For Workers, use **Compatibility** / runtime settings on the Worker itself.

### Phase 5 — Custom domain (apex and/or www)

1. Ensure the domain’s DNS is on **Cloudflare** (same account as the Worker) or follow Cloudflare’s DNS steps for the hostname.
2. **Workers & Pages** → Worker **`b2c-pmes-web`** → **Triggers** / **Custom domains** → **Add**.
3. Add each hostname you need:
   - **Apex:** `b2ccoop.com`
   - **WWW:** `www.b2ccoop.com`  
   These are **separate** hostnames unless you add redirects (e.g. redirect apex → `www` or the reverse) in Cloudflare **Rules**.

HTTPS certificates are issued after DNS validates.

---

## Names must match

`wrangler.jsonc` sets the Worker name to **`b2c-pmes-web`**. The name in the Cloudflare dashboard **must match** `name` in `wrangler.jsonc`, or Git/automated builds can fail ([Workers name requirement](https://developers.cloudflare.com/workers/ci-cd/builds/troubleshoot/#workers-name-requirement)).

To rename, edit **`name`** and **`services[0].service`** consistently (and only change `main` / `assets` if you know the implications).

---

## Build locally

```bash
cd frontend
npm ci
npm run cf:build
```

| Script | Purpose |
|--------|--------|
| `npm run build` | Next.js only (e.g. CI smoke). |
| `npm run cf:build` | Next.js + OpenNext → **`frontend/.open-next/`** |
| `npm run cf:preview` | Build and run locally in the Workers runtime. |
| `npm run cf:deploy` | Build + deploy via Wrangler (requires `wrangler login`). |

---

## Environment variables (production / preview)

Configure in the Worker → **Settings** → **Variables** and **Secrets**.

**Treat as Secrets (encrypted):**

- **`ADMIN_JWT_SECRET`** — **Required** (min 32 characters). Signs and verifies **staff** JWTs for `POST /api/auth/admin/login` and every staff-protected route (`/api/pmes/admin/*`, etc.). Must be the **same** value in **Production** and **Preview** if you expect admin login on both; if you use the Nest backend for staff login in another environment, use the **same** secret there too so tokens verify. Rotating this secret **invalidates existing staff sessions** until admins sign in again. It does **not** affect member Firebase auth or ordinary PMES/LOI flows.
- `DATABASE_URL` — Neon connection string  
- `GEMINI_API_KEY` — landing FAQ AI  
- Optional: `MEMBER_SYNC_SECRET`; `FIREBASE_PRIVATE_KEY` / `FIREBASE_CLIENT_EMAIL` if you use Nest-style Admin verification  

**Typical non-secret / public:**

- **`FIREBASE_PROJECT_ID`** — **Required** for `POST /api/auth/staff/firebase-session` (Google sign-in → staff JWT when email matches `StaffUser`) and for verifying Firebase bearer tokens on sync-member and related routes. Use the **same** project id as `VITE_FIREBASE_PROJECT_ID` in the Pages build.  
- `GEMINI_CHAT_MODEL` — optional  
- `NEXT_PUBLIC_FIREBASE_*` — whatever `app/page.jsx` and client code need  

Mirror what you use in `frontend/.env` / `.env.local`. **Never commit secrets.**

**Wrangler vs dashboard:** `wrangler deploy --config wrangler.b2c-pmes-web.jsonc` **replaces** Worker metadata from the config file. Without `--keep-vars`, variables you set only in the Cloudflare UI can disappear on the next deploy. This repo uses **`--keep-vars`** on `cf:deploy:web*` and declares **`FIREBASE_PROJECT_ID`** under `vars` in `wrangler.b2c-pmes-web.jsonc` so `firebase-session` and sync-member keep working after each deploy. Change that id in the file if your Firebase project differs.

Local Wrangler preview can use **`frontend/.dev.vars.example`** as a template for **`.dev.vars`** (gitignored).

---

## OpenNext notes

- Route handlers do **not** use `export const runtime = "edge"`; OpenNext on Cloudflare uses the Worker runtime with **`nodejs_compat`** instead.
- Build output: **`frontend/.open-next/`** (gitignored).

---

## Vite app (separate stack)

The marketing UI under **`frontend/src`** is built with **`npm run vite:build`** → **`dist/`**. Deploy with **`npm run pages:deploy:safe`** (Cloudflare **Pages** project **`b2c-pmes-web-ui`**). Pages-only Wrangler config lives in **`frontend/cloudflare-pages-ui/wrangler.jsonc`** (`pages_build_output_dir` → **`../dist`**) so Wrangler does not mix Pages settings with the OpenNext **`frontend/wrangler.jsonc`** Worker config (which would error or warn). This document covers only the **Next.js** OpenNext Worker. For the full production picture (apex domain, API URL, CORS), see **[../docs/OPERATIONS.md](../docs/OPERATIONS.md)**.

---

## References

- [OpenNext Cloudflare — Get started](https://opennext.js.org/cloudflare/get-started)  
- [Workers CI/CD builds](https://developers.cloudflare.com/workers/ci-cd/builds/)  
- [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)
