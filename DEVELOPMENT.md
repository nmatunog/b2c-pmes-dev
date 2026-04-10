# B2C PMES — Development handbook

Use this document to **reload the project on a new machine**, onboard another developer, or resume work after a long break.

---

## 1. What this repository is

| Area | Stack | Role |
|------|--------|------|
| **Frontend** | Vite, React 19, Tailwind 4, Lucide, Firebase (Auth + Firestore) | PMES UI, exam, certificates, LOI, admin views |
| **Backend** | NestJS, Prisma 6, PostgreSQL | **Health**, **AI/TTS proxy**, **PMES REST** (`/pmes/*`) when DB migrated |
| **AI / TTS** | Gemini, OpenAI, or **Grok (xAI)** via **Nest** (`POST /ai/tts`) | Ka-uban voice; keys only in `backend/.env` (`AI_PROVIDER` + provider key). |

**Data:** With `VITE_API_BASE_URL` set, PMES/LOI/admin use **Postgres via Nest**. Without it, the app uses **Firebase** paths under `artifacts/{VITE_APP_ID}/public/data/…`.

---

## 2. Prerequisites

- **Node.js** 20 LTS or newer (recommended; matches current ecosystem).
- **npm** (bundled with Node).
- **PostgreSQL** — only required when you work on the backend database or run Prisma migrations locally.
- Accounts: **Firebase** project (web app config). For paid TTS, a **Google AI** key in **`backend/.env`** (not in Vite) when `AI_PROVIDER=gemini`.

---

## 3. Clone and install (remote reload checklist)

From any machine:

```bash
git clone <your-github-repo-url> b2c-pmes
cd b2c-pmes
```

### Frontend

```bash
cd frontend
cp .env.example .env
# Edit .env — fill all VITE_* values (see section 5)
npm install
npm run dev
```

Default Vite dev server: **http://localhost:5173** (confirm in terminal output).

### Backend (optional until you use the API/DB)

**Prisma and Nest both read `DATABASE_URL` from `backend/.env`.** If you see `P1012` / “Environment variable not found: DATABASE_URL”, create the file first:

```bash
cd backend
cp .env.example .env
# Edit DATABASE_URL if your Postgres user, password, host, or database name differs
```

Then:

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev
```

Default Nest listen port from `main.ts`: **3000** (override with `PORT` in `.env`). **`DATABASE_URL` is required** — the API validates env at startup and connects Prisma on boot. Check readiness with **`GET /health`** (returns `{ "status": "ok", "database": "connected" }` when PostgreSQL accepts a query).

**PostgreSQL must be running** at the host in `DATABASE_URL` (default `localhost:5432`). If you see **`P1001` / “Can’t reach database server”**, start Postgres first.

**Option A — Docker (simplest on Mac):** from the repo root:

```bash
./scripts/verify-local.sh
```

Or from `backend/` manually — use **`docker compose`** (Compose V2, two words) or the legacy **`docker-compose`** (hyphen), depending on your install:

```bash
docker compose up -d
# if that fails with flag errors, try:
docker-compose up -d
npx prisma migrate deploy
npm run dev
```

Wait until the container is healthy (`docker compose ps` or `docker-compose ps`), then migrate.

**Option B — Postgres.app, Homebrew, or a cloud DB:** create database `b2c_pmes`, set `DATABASE_URL` in `backend/.env`, then `npx prisma migrate deploy`.

**First-time schema:** run `npx prisma migrate deploy` (or `npm run prisma:migrate` for dev) so tables exist before using PMES APIs.

**PMES REST (when `VITE_API_BASE_URL` is set, the frontend uses Postgres via Nest instead of Firestore for these):**

| Method | Path | Notes |
|--------|------|--------|
| `POST` | `/auth/admin/login` | Body: `{ "email", "password" }` (must match `ADMIN_EMAIL` + bcrypt `ADMIN_PASSWORD_HASH` in `backend/.env`) → `{ accessToken }` |
| `POST` | `/pmes/submit` | Body: `fullName`, `email`, `phone`, `dob`, `gender`, `score`, `passed` |
| `POST` | `/pmes/loi` | Body: `email`, `address`, `occupation`, `employer`, `initialCapital` |
| `GET` | `/pmes/certificate?email=&dob=` | 404 if none; returns flat record for certificate UI |
| `GET` | `/pmes/admin/records` | Header `Authorization: Bearer <JWT>` from `/auth/admin/login` |

### Verify builds

```bash
cd frontend && npm run build
cd ../backend && npm run build
```

---

## 4. Repository layout (high level)

```
B2C-PMES/
├── frontend/           # Vite React app
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   ├── constants/
│   │   ├── services/   # firebase.js, pmesService.js, ttsApi.js
│   │   ├── lib/
│   │   └── styles/
│   ├── .env.example
│   └── package.json
├── backend/
│   ├── prisma/schema.prisma
│   ├── src/pmes/     # PMES + LOI REST
│   ├── src/main.ts, app.module.ts
│   ├── supabase/schema.sql   # optional SQL artifact from earlier experiments; frontend uses Firebase
│   └── package.json
├── firebase/           # firestore.rules (deploy with Firebase CLI)
├── scripts/            # verify-local.sh
├── .github/workflows/  # CI
├── .cursor/rules/      # AI/editor conventions
├── README.md
└── DEVELOPMENT.md      # this file
```

---

## 5. Environment variables

### Frontend (`frontend/.env`)

| Variable | Purpose |
|----------|---------|
| `VITE_APP_ID` | Firestore path segment: `artifacts/{appId}/public/data/...`. Use a stable value per environment (e.g. `b2c-pmes`). |
| `VITE_FIREBASE_*` | From Firebase Console → Project settings → Your apps → Web app config. |
| `VITE_API_BASE_URL` | Nest API (e.g. `http://localhost:3000`). Enables **TTS** (`/ai/tts`) and **PMES data** (`/pmes/*`) instead of Firestore for saves/list/certificate lookup. Omit to stay Firebase-only for data. |

Never commit `frontend/.env`. Copy from `.env.example` only.

### Backend (`backend/.env`)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string for Prisma. |
| `PORT` | HTTP port (default 3000). |
| `AI_PROVIDER` | `noop` (default) \| `gemini` \| `openai` \| `grok` (xAI Grok TTS). |
| `GEMINI_API_KEY` | Required when `AI_PROVIDER=gemini`. |
| `OPENAI_API_KEY` | Required when `AI_PROVIDER=openai`. |
| `XAI_API_KEY` | Required when `AI_PROVIDER=grok`. |
| `GEMINI_TTS_MODEL` / `OPENAI_TTS_MODEL` | Optional model overrides. |
| `ADMIN_JWT_SECRET` | **Required** (min 32 chars). Signs tokens from `POST /auth/admin/login`. |
| `ADMIN_EMAIL` | **Required.** Admin dashboard sign-in email (checked server-side only). |
| `ADMIN_PASSWORD_HASH` | **Required.** Bcrypt hash of the admin password. Generate: `cd backend && npm run hash-admin-password -- 'YourPassword'` and paste the line into `.env`. |

---

## 6. Firebase / Firestore

Authentication is **Email/Password** only (anonymous sign-in is not used). Data paths:

- `artifacts/{VITE_APP_ID}/public/data/pmes_records`
- `artifacts/{VITE_APP_ID}/public/data/loi_records`

**Rules file (versioned in repo):** `firebase/firestore.rules` — users may only **read** documents where `userId` matches their auth uid (certificate retrieval uses a query scoped to the current user). **Create** requires `userId` on the new document to match `request.auth.uid`. **Listing all records for admin** in raw Firestore requires `request.auth.token.admin == true` (set via Firebase Admin SDK) or use the **Nest admin API** instead.

Deploy rules (Firebase CLI, logged in):

```bash
firebase deploy --only firestore:rules --project YOUR_PROJECT_ID
```

`firebase.json` at the repo root points at `firebase/firestore.rules`.

---

## 7. Git and GitHub: when and how to preserve work

### First-time setup (this folder was not initialized as git in early setup)

From the repository root:

```bash
git init
git add .
git status   # confirm node_modules and .env are NOT listed
git commit -m "Initial commit: B2C PMES frontend + backend scaffold"
```

Create an empty repository on GitHub (private recommended), then:

```bash
git remote add origin https://github.com/<org>/<repo>.git
git branch -M main
git push -u origin main
```

### When to commit

| Moment | Why |
|--------|-----|
| **Now / ASAP** | Baseline snapshot after modularization and tooling — protects against disk loss. |
| After each **working feature** or **fix** | Small commits with clear messages beat one giant merge. |
| Before **risky refactors** | Easy rollback (`git revert` / branch). |
| Before **dependency major upgrades** | Lock known-good state. |

### Commit message style (suggested)

- `feat: …` / `fix: …` / `chore: …` / `docs: …`

### What must never be committed

- `node_modules/`
- Any file containing real API keys or `DATABASE_URL` with passwords

The root `.gitignore` is configured for these.

---

## 8. CI and verification

- **GitHub Actions:** `.github/workflows/ci.yml` — builds frontend, runs backend `prisma migrate deploy`, `build`, and `jest` against a Postgres service.
- **Local DB smoke:** `./scripts/verify-local.sh` starts Docker Postgres and applies migrations (start **`npm run dev`** separately, then `curl http://localhost:3000/health`).

---

## 9. Recommended follow-ups

1. **Staging deploy** — one hosted API + Postgres + static frontend; see §10.
2. **Firebase admin claims** — only if you must keep Firestore-based admin list; otherwise rely on Nest + JWT.
3. **E2E tests** — Playwright against staging.
4. **Optional AI** — chat/Q&A route behind the same rate limits.

---

## 10. Troubleshooting

| Issue | What to check |
|-------|----------------|
| Blank Firebase / permission errors | `.env` filled; same `VITE_APP_ID` as data in console; Auth enabled; Firestore API enabled. |
| TTS silent or errors | Backend running with `VITE_API_BASE_URL` set; if `AI_PROVIDER=noop`, switch to `gemini` + `GEMINI_API_KEY`; check quota and `GEMINI_TTS_MODEL`. |
| **`P1001` Can’t reach database** | Postgres not running or wrong host/port. Run `./scripts/verify-local.sh` or `docker compose up -d` / `docker-compose up -d` in `backend/`; confirm `DATABASE_URL`. |
| **`unknown shorthand flag: 'd'`** with Docker | Usually means Compose isn’t available as `docker compose`. Try **`docker-compose up -d`** (hyphen) in `backend/`, or update Docker Desktop so the Compose V2 plugin is installed. |
| Other Prisma errors | `DATABASE_URL` correct; `npx prisma generate`; migrations applied. |
| Port already in use | Change Vite port in `vite.config.js` or `PORT` for backend. |
| **429 Too Many Requests** | Global rate limits apply (see `@nestjs/throttler`). Heavier limits on `/ai/tts` and `/auth/admin/login`. |

---

## 11. Staging / production deployment (orientation)

**Frontend:** build `frontend/dist` with production `VITE_*` (especially `VITE_API_BASE_URL` → your API origin, `VITE_FIREBASE_*`). Host on Firebase Hosting, Netlify, Vercel, S3+CloudFront, etc.

**Backend:** run Node (`npm run start` after `npm run build`) behind HTTPS (reverse proxy or platform). Set **strong** `ADMIN_JWT_SECRET`, real `DATABASE_URL`, and AI keys as needed.

**Database:** run `npx prisma migrate deploy` in the release pipeline or container entrypoint before accepting traffic.

**Secrets:** never commit `.env`; use host env vars or a secrets manager.

**Rate limiting:** default in-memory throttler is fine for moderate traffic; for multiple instances use Redis-backed throttling later.

---

## 12. Related files

- Project principles for AI-assisted work: `.cursor/rules/core-principles.mdc`
- Prisma models: `backend/prisma/schema.prisma`
- Optional historical SQL (not used by current Firebase frontend): `backend/supabase/schema.sql`

---

*Last aligned with repo layout: modular Vite frontend + Firebase; NestJS + Prisma backend scaffold.*
