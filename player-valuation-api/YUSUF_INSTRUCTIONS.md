# Instructions for Yusuf Fakhriddinov — Backend Lead

## What You Own (MVP)

- **Player Valuation API** in `player-valuation-api/`:
  - Express + TypeScript + MongoDB (Mongoose)
  - Models: Player, Transaction
  - Endpoints: GET /players, GET /players/:id, GET /players/:id/valuation, GET /transactions
  - x-api-key middleware (Zach can add/finish auth proof; you own the route wiring)
  - CORS, env config, seed script
- **Deploy API to Render** and verify it works.
- **Coordinate with Tasfiya** on response shapes (they already match `shared/src/types.ts`).
- **Sprint/PM**: Define backend tasks on the Jira board; mark what blocks frontend.
- **Presentation**: Present the API (what it does, deployed URL, structure, endpoints, where data comes from).

## Where to Push

- **Repo**: https://github.com/ymaqsudi/CSE-416-MVP-Team-Teal  
- **Branch**: Push your work to `main` (or a branch like `yusuf/api` and open a PR for the team to review).

## How to Push

1. **From project root** (CSE-416-MVP-Team-Teal):
   ```bash
   cd /Users/yusuffakhriddin/Desktop/CSE416/CSE-416-MVP-Team-Teal
   ```

2. **Check status**
   ```bash
   git status
   ```

3. **Add the new API folder**
   ```bash
   git add player-valuation-api/
   git add .gitignore   # if you updated root .gitignore
   ```

4. **Commit**
   ```bash
   git commit -m "feat(api): add Player Valuation API - Express, MongoDB, /players, /valuation, /transactions, x-api-key, seed"
   ```

5. **Push**
   ```bash
   git push origin main
   ```
   If you use a branch:
   ```bash
   git checkout -b yusuf/api
   git push origin yusuf/api
   ```
   Then open a Pull Request on GitHub for the team to merge.

## What to Tell Your Teammates

**In Discord / group chat:**

- "I added the Player Valuation API in the repo under `player-valuation-api/`. It has:
  - GET /players (q, position, limit)
  - GET /players/:id
  - GET /players/:id/valuation
  - GET /transactions
  - All need header **x-api-key** (same value as in .env API_KEY). Health check at /health is public.
  - README has local run and Render deploy steps. We need a MongoDB Atlas URI and an API key; I can add them to Render when we deploy.
  - Tasfiya: response shapes match our shared types (Player, Valuation, Transaction, *Response). Once the API is deployed, we can point the Draft Kit’s API client base URL to the Render URL and set the API key in env.
  - Zach: x-api-key middleware is in place; you can add Postman/curl tests for 401 without key and 200 with key. You can also help with GET /transactions if we want more seed data or fields."
- Share the **Render URL** once deployed so they can set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_API_KEY` in the Draft Kit (Vercel env).

## Before Demo (MVP Checklist)

- [ ] MongoDB Atlas cluster created and URI in .env (and Render env).
- [ ] API deployed to Render; health check returns 200.
- [ ] Run seed (locally or via a one-off script on Render) so /players and /transactions return data.
- [ ] Test: no key → 401; with key → 200 for /players, /players/:id, /players/:id/valuation, /transactions.
- [ ] Draft Kit env has API base URL and API key; All Players and Player Detail load from API and show valuation.
- [ ] No localhost in production configs.

## Run Locally (Quick Ref)

```bash
cd player-valuation-api
cp .env.example .env
# Edit .env: MONGODB_URI, API_KEY
npm install && npm run build && npm run seed && npm start
# Or: npm run dev
```

Then: `curl -H "x-api-key: YOUR_KEY" "http://localhost:4000/players?limit=3"`
