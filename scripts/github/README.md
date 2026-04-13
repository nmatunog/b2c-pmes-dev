# Dev vs production GitHub remotes

- **Production:** `B2C-PMES` — release target; keep stable.
- **Dev:** `B2C-PMES-dev` (or your name) — daily work; **post-commit auto-push** should target this repo.

Defaults are in `defaults.sh`. Override any time:

```bash
export PRODUCTION_REMOTE_URL='https://github.com/ORG/B2C-PMES.git'
export DEV_REMOTE_URL='https://github.com/ORG/B2C-PMES-dev.git'
```

## One-time: create the dev repo on GitHub

1. Open **[github.com/new](https://github.com/new)** while logged into the **same account** that owns `B2C-PMES` (e.g. `nmatunog`).
2. Repository name: e.g. **`B2C-PMES-dev`**.
3. **Do not** add README, `.gitignore`, or license (keep it empty), then **Create repository**.

If you see **`Repository not found`** on push, the repo is missing, the name/owner in `DEV_REMOTE_URL` is wrong, or you are not logged into GitHub with a user that can push there. For a failed half-run, remove the bad remote and retry after creating the repo:

```bash
git remote remove dev
bash scripts/github/bootstrap-dev-remotes.sh
```

## One-time: dev remote + switch `origin` to dev

From your existing clone (with `origin` still pointing at production), run **one** of these.

**Option A — single command (recommended):**

```bash
bash scripts/github/bootstrap-dev-remotes.sh
```

**Option B — two steps** (paste **only** the `bash ...` lines; lines starting with `#` are comments — if your paste drops the `#`, zsh will error on the `)`):

```bash
bash scripts/github/push-initial-to-dev.sh
bash scripts/github/switch-origin-to-dev.sh
```

This adds remote `dev`, pushes branches/tags, then renames remotes so `origin` = dev and `production` = prod.

After this:

- `origin` → dev
- `production` → production repo
- Post-commit hook runs `git push` to `origin` → **dev only**

## Promote `main` to production (when ready)

```bash
bash scripts/github/sync-to-production.sh
```

Uses remote `production` and pushes `main` → `production/main`. Set `SYNC_TO_PRODUCTION_YES=1` to skip the prompt (e.g. CI).

## Optional: push remote without renaming

If you keep `origin` as production, set auto-push explicitly:

```bash
export GIT_AUTOPUSH_REMOTE=dev
```

and ensure your branch tracks `dev/main` (`git branch -u dev/main`).
