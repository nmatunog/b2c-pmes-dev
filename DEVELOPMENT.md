# B2C PMES — Development handbook

Use this document to **reload the project on a new machine**, onboard another developer, or resume work after a long break.

---

## 1. What this repository is

| Area | Stack | Role |
|------|--------|------|
| **Frontend** | Vite, React 19, Tailwind 4, Lucide, Firebase (Auth + Firestore) | PMES UI, exam, certificates, LOI, admin views |
| **Backend** | NestJS, Prisma 6, PostgreSQL | **Health**, **AI/TTS proxy**, **PMES REST** (`/pmes/*`) when DB migrated |
| **AI / TTS** | Gemini, OpenAI, or **Grok (xAI)** via **Nest** (`POST /ai/tts`) | Ka-uban voice; keys only in `backend/.env` (`AI_PROVIDER` + provider key). |

**Source of truth for live app data today:** Firebase (Firestore paths under `artifacts/{VITE_APP_ID}/public/data/…`). The Prisma schema in `backend/` models the **target** relational design for a future Nest migration.

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

**Option A — Docker (simplest on Mac):** from `backend/`:

```bash
docker compose up -d
npx prisma migrate deploy
npm run dev
```

Wait until the container is healthy (`docker compose ps`), then migrate.

**Option B — Postgres.app, Homebrew, or a cloud DB:** create database `b2c_pmes`, set `DATABASE_URL` in `backend/.env`, then `npx prisma migrate deploy`.

**First-time schema:** run `npx prisma migrate deploy` (or `npm run prisma:migrate` for dev) so tables exist before using PMES APIs.

**PMES REST (when `VITE_API_BASE_URL` is set, the frontend uses Postgres via Nest instead of Firestore for these):**

| Method | Path | Notes |
|--------|------|--------|
| `POST` | `/pmes/submit` | Body: `fullName`, `email`, `phone`, `dob`, `gender`, `score`, `passed` |
| `POST` | `/pmes/loi` | Body: `email`, `address`, `occupation`, `employer`, `initialCapital` |
| `GET` | `/pmes/certificate?email=&dob=` | 404 if none; returns flat record for certificate UI |
| `GET` | `/pmes/admin/records` | Header `x-admin-code: B2Cmmddyyyy` (server local date), same as UI prompt |

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

---

## 6. Firebase / Firestore expectations

Anonymous (or configured) auth is used from the client. Data is written to:

- `artifacts/{VITE_APP_ID}/public/data/pmes_records`
- `artifacts/{VITE_APP_ID}/public/data/loi_records`

**Production:** define **Firestore Security Rules** so these paths are not world-readable/writable inappropriately. The app historically relied on prototype assumptions; treat rules as mandatory before public launch.

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

## 8. Recommended roadmap (best next moves)

Order is intentional:

1. **Git + GitHub** — first safety net (section 7).
2. **Run Prisma migrations** on every environment; keep `VITE_API_BASE_URL` aligned so the app hits Postgres for PMES data.
3. **Firestore rules** — still required if anyone uses Firebase-only mode or during cutover.
4. **Replace weak admin code** — move to real auth (JWT / role) before public launch.
5. **Extend AI / tests** — optional Q&A route, rate limits; Jest + RTL + e2e.

---

## 9. Troubleshooting

| Issue | What to check |
|-------|----------------|
| Blank Firebase / permission errors | `.env` filled; same `VITE_APP_ID` as data in console; Auth enabled; Firestore API enabled. |
| TTS silent or errors | Backend running with `VITE_API_BASE_URL` set; if `AI_PROVIDER=noop`, switch to `gemini` + `GEMINI_API_KEY`; check quota and `GEMINI_TTS_MODEL`. |
| **`P1001` Can’t reach database** | Postgres not running or wrong host/port. Use `docker compose up -d` in `backend/` or start local Postgres; confirm `DATABASE_URL`. |
| Other Prisma errors | `DATABASE_URL` correct; `npx prisma generate`; migrations applied. |
| Port already in use | Change Vite port in `vite.config.js` or `PORT` for backend. |

---

## 10. Production deployment (orientation only)

- **Frontend:** static build (`frontend/dist`) on any static host (Firebase Hosting, Netlify, Vercel, S3+CloudFront). Inject env at **build time** for Vite (`VITE_*`).
- **Backend:** Node process + PostgreSQL; run migrations in CI/CD; do not expose DB to the public internet without TLS and firewall rules.

---

## 11. Related files

- Project principles for AI-assisted work: `.cursor/rules/core-principles.mdc`
- Prisma models: `backend/prisma/schema.prisma`
- Optional historical SQL (not used by current Firebase frontend): `backend/supabase/schema.sql`

---

*Last aligned with repo layout: modular Vite frontend + Firebase; NestJS + Prisma backend scaffold.*
