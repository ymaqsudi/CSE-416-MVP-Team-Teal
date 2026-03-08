# Player Valuation API

CSE 416 Team Teal — Fantasy Baseball Draft Kit — **Backend (Yusuf Fakhriddinov, Backend Lead)**.

REST API for player data and draft valuations. Deployed separately from the Draft Kit; the Draft Kit calls this API with an API key.

## Tech Stack

- **Node.js** + **Express** + **TypeScript**
- **MongoDB Atlas** (Mongoose)
- **CORS** enabled for Draft Kit origin
- **x-api-key** auth (required on all routes except `/health`)

## Run Locally

1. **Copy env and set values**
   ```bash
   cp .env.example .env
   ```
   Edit `.env`:
   - `MONGODB_URI` — your MongoDB Atlas connection string
   - `API_KEY` — any secret string (e.g. `mvp-teal-secret-key`)
   - `PORT` — optional, default 4000

2. **Install and build**
   ```bash
   npm install
   npm run build
   ```

3. **Seed the database**
   ```bash
   npm run seed
   ```

4. **Start the server**
   ```bash
   npm start
   ```
   Or for development with auto-reload: `npm run dev`

5. **Test**
   - Health (no key): `curl http://localhost:4000/health`
   - Players (with key): `curl -H "x-api-key: YOUR_API_KEY" "http://localhost:4000/players?limit=5"`
   - Player detail: `curl -H "x-api-key: YOUR_API_KEY" "http://localhost:4000/players/PLAYER_ID"`
   - Valuation: `curl -H "x-api-key: YOUR_API_KEY" "http://localhost:4000/players/PLAYER_ID/valuation"`
   - Transactions: `curl -H "x-api-key: YOUR_API_KEY" "http://localhost:4000/transactions"`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Public health check (no API key) |
| GET | `/players` | List players. Query: `q` (search), `position`, `limit` |
| GET | `/players/:id` | Single player detail |
| GET | `/players/:id/valuation` | Valuation (dollar value + explanation) |
| GET | `/transactions` | Recent transactions |

All except `/health` require header: `x-api-key: <API_KEY>`.

## Response Shapes (shared contract)

- **GET /players** → `{ players: Player[] }`
- **GET /players/:id** → `{ player: Player }`
- **GET /players/:id/valuation** → `{ valuation: { playerId, dollarValue, updatedAt, explanation? } }`
- **GET /transactions** → `{ transactions: Transaction[] }`

## Deploy to Render

1. Create a **Web Service** on [Render](https://render.com).
2. Connect this repo (or the `player-valuation-api` root).
3. **Build**: `npm install && npm run build`
4. **Start**: `npm start`
5. **Environment**: set `MONGODB_URI`, `API_KEY`, and optionally `PORT`.
6. **Health check path**: `/health`

After deploy, use the Render URL as the API base in the Draft Kit (e.g. `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_API_KEY`).

## Seed Data

- **~45 players** (mix of C, 1B, 2B, 3B, SS, OF, P; various risk/depth).
- **8 transactions** (sample headlines/dates).

Valuation logic (MVP): base value from player record, adjusted by depth role and risk.
