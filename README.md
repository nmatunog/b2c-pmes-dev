# B2C PMES

Pre-membership education seminar (PMES) application: modular **React (Vite)** frontend with **Firebase** (Auth + Firestore), and a **NestJS + Prisma + PostgreSQL** backend scaffold for production APIs.

## Quick start

Full setup, env vars, Firestore paths, Git workflow, and troubleshooting are in **[DEVELOPMENT.md](./DEVELOPMENT.md)** — use that for onboarding and **remote reload** on a new machine.

## Structure

| Path | Description |
|------|-------------|
| `frontend/` | Vite + React app (`npm run dev`) |
| `backend/` | Nest bootstrap + Prisma (`npm run dev`) |
| `.cursor/rules/` | Project conventions for AI-assisted development |

## Scripts

**Frontend** (`frontend/`): `npm run dev` · `npm run build` · `npm run preview`

**Backend** (`backend/`): `npm run dev` · `npm run build` · `npm run prisma:generate` · `npm run prisma:migrate` · readiness: `GET /health` (needs valid `DATABASE_URL` and PostgreSQL running)

## Configuration

Copy `frontend/.env.example` and `backend/.env.example` to `.env` in each project and fill values. Never commit `.env` files.

## Preserve your work on GitHub

Initialize git, add a remote, and push — see **§7** in [DEVELOPMENT.md](./DEVELOPMENT.md). A root `.gitignore` excludes `node_modules/` and env files.
