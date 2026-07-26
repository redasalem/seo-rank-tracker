# 🚀 RankBoost Deployment & Git Workflow

This document explains the Git workflow for pushing code to the correct repositories.

## 📋 Quick Reference

| What changed? | Where to push? | Repositories |
| :--- | :--- | :--- |
| **Frontend only** (`/client`) | Monorepo + Frontend Repo | 1 & 2 |
| **Backend only** (`/server`) | Monorepo + Backend Repo | 1 & 3 |
| **Both** | All 3 Repos | 1, 2, & 3 |

---

## 📁 Project Structure

The project is structured as a monorepo containing both the frontend and backend code:

```text
e:\coding\react-node_projects\seo-rank-tracker\ (Monorepo Root)
├── client/   → Frontend (React + Vite)
└── server/   → Backend (Express + MongoDB)
```

---

## 🔗 The 3 Repositories

1. **Monorepo (Both):** `https://github.com/redasalem/seo-rank-tracker.git`
2. **Frontend only:** `https://github.com/redasalem/seo-rank-tracer-client.git`
3. **Backend only:** `https://github.com/redasalem/seo-rank-server.git`

---

## 📜 Rules of the Workflow

- **Frontend changes** → Push to the Frontend-only repo (2) AND the Monorepo (1).
- **Backend changes** → Push to the Backend-only repo (3) AND the Monorepo (1).
- **Both changed** → Push to ALL 3 repos.
- 🚨 **NEVER** push backend code to the frontend-only repository.
- 🚨 **NEVER** push frontend code to the backend-only repository.

---

## 💻 Commands to Run (PowerShell)

### Scenario A: Only Frontend Changed (`/client`)

If you only modified files inside the `client/` folder:

```powershell
# 1. Commit changes in the monorepo root
git add client/
git commit -m "Update frontend components"

# 2. Push to Monorepo
git push origin main

# 3. Push ONLY the client folder to the Frontend Repo using git subtree
git subtree push --prefix client https://github.com/redasalem/seo-rank-tracer-client.git main
```

### Scenario B: Only Backend Changed (`/server`)

If you only modified files inside the `server/` folder:

```powershell
# 1. Commit changes in the monorepo root
git add server/
git commit -m "Update backend API"

# 2. Push to Monorepo
git push origin main

# 3. Push ONLY the server folder to the Backend Repo using git subtree
git subtree push --prefix server https://github.com/redasalem/seo-rank-server.git main
```

### Scenario C: Both Changed

If you modified files in both `client/` and `server/`:

```powershell
# 1. Commit all changes in the monorepo root
git add .
git commit -m "Update frontend and backend"

# 2. Push to Monorepo
git push origin main

# 3. Push client folder to Frontend Repo
git subtree push --prefix client https://github.com/redasalem/seo-rank-tracer-client.git main

# 4. Push server folder to Backend Repo
git subtree push --prefix server https://github.com/redasalem/seo-rank-server.git main
```

---

## ⚠️ WARNINGS & Common Mistakes

> [!WARNING]
> **Pushing from the wrong directory:** Always run these commands from the **root** of the monorepo (`e:\coding\react-node_projects\seo-rank-tracker\`), never from inside `client/` or `server/`.

> [!CAUTION]
> **Mixing Subtrees:** Never run a subtree push for `server` to the `client` repo or vice versa. It will mix your backend source code into your public frontend repository!
> - `client` prefix ALWAYS goes to `seo-rank-tracer-client.git`
> - `server` prefix ALWAYS goes to `seo-rank-server.git`
