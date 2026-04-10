# B2C PMES — Development handbook

Use this document to **reload the project on a new machine**, onboard another developer, or resume work after a long break.

---

## 1. What this repository is

| Area | Stack | Role |
|------|--------|------|
| **Frontend** | Vite, React 19, Tailwind 4, Lucide, Firebase (Auth + Firestore) | PMES UI, exam, certificates, LOI, admin views |
| **Backend** | NestJS-style bootstrap, Prisma 6, PostgreSQL (planned) | Production API scaffold; **business REST endpoints not fully implemented yet** |
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

```bash
cd backend
cp .env.example .env
# Set DATABASE_URL to your local or hosted PostgreSQL
npm install
npx prisma generate
npm run dev
```

Default Nest listen port from `main.ts`: **3000** (override with `PORT` in `.env`). **`DATABASE_URL` is required** — the API validates env at startup and connects Prisma on boot. Check readiness with **`GET /health`** (returns `{ "status": "ok", "database": "connected" }` when PostgreSQL accepts a query).

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
| `VITE_API_BASE_URL` | Base URL of the Nest API (e.g. `http://localhost:3000`). Used for TTS (`/ai/tts`). **Do not put Gemini keys in Vite.** |

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
2. **Document and tighten Firebase** — rules + indexes for the `artifacts/...` paths; document admin access model if it stays client-assisted.
3. **Backend slice** — one Nest module (e.g. health + `participants` read-only) wired to Prisma, with env validation on startup.
4. **Extend AI module** — e.g. optional text Q&A route with the same provider pattern; add rate limits / Redis cache if traffic grows.
5. **Tests** — Jest on backend, RTL on critical frontend flows, then e2e when flows stabilize.

---

## 9. Troubleshooting

| Issue | What to check |
|-------|----------------|
| Blank Firebase / permission errors | `.env` filled; same `VITE_APP_ID` as data in console; Auth enabled; Firestore API enabled. |
| TTS silent or errors | Backend running with `VITE_API_BASE_URL` set; if `AI_PROVIDER=noop`, switch to `gemini` + `GEMINI_API_KEY`; check quota and `GEMINI_TTS_MODEL`. |
| Prisma errors | `DATABASE_URL` correct; `npx prisma generate`; Postgres running. |
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
