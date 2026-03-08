# Pre-push checklist (MVP requirements)

Before pushing, confirm:

- [x] **No secrets in repo** — `.env` is in `.gitignore` and never committed. `.env.example` has placeholders only (USERNAME, PASSWORD, your-api-key-here).
- [x] **API structure** — Express + TypeScript, `src/server.ts`, routes, controllers, models, middleware.
- [x] **Endpoints** — GET /players (q, position, limit), GET /players/:id, GET /players/:id/valuation, GET /transactions; GET /health (no auth).
- [x] **Auth** — x-api-key middleware; 401 when key missing/invalid.
- [x] **CORS** — enabled for Draft Kit.
- [x] **Models** — Player, Transaction (Mongoose).
- [x] **Seed** — 30–50 players, 5–10 transactions; `npm run seed`.
- [x] **Valuation** — simple logic (base value + depth/risk).
- [x] **Docs** — README (run, deploy, endpoints), .env.example, MONGODB_ATLAS_SETUP.md.

After push: deploy to Render, add MONGODB_URI + API_KEY in Render env, share URL + key with team.
