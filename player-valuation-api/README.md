# Player Valuation API

CSE 416 Team Teal — Fantasy Baseball Draft Kit — **Backend (Yusuf Fakhriddinov, Backend Lead)**.

REST API for MLB-style player data, **rotisserie SGP → dollar values** (course Activity 7), and **draft-aware valuations** with **server-side sessions** (Activity 6). Deployed separately from the Draft Kit; clients send `x-api-key`.

## Tech Stack

- **Node.js** + **Express** + **TypeScript**
- **MongoDB Atlas** (Mongoose)
- **CORS** enabled
- **x-api-key** on all routes except `GET /health`

## Run Locally

1. **Copy env and set values**
   ```bash
   cp .env.example .env
   ```
   - `MONGODB_URI` — Atlas connection string  
   - `API_KEY` — shared secret for the Draft Kit  
   - `PORT` — optional (default 4000)

2. **Install and build**
   ```bash
   npm install
   npm run build
   ```

3. **Seed the database** (players with **mlbPlayerId**, projections, sample transactions; clears `sessions`)
   ```bash
   npm run seed
   ```

4. **Start**
   ```bash
   npm start
   ```
   Dev: `npm run dev`

5. **Smoke test**
   ```bash
   curl http://localhost:4000/health
   curl -H "x-api-key: YOUR_API_KEY" "http://localhost:4000/players?limit=3"
   ```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check (**no** API key) |
| POST | `/sessions` | Start draft session; body: `league`, `draftState` → `{ session_id }` |
| PATCH | `/sessions/:sessionId` | Append a pick; optional `budgetsRemaining` |
| GET | `/players` | List players. Query: `q`, `position`, `limit` |
| GET | `/players/:id` | Detail by **Mongo `_id`** or **`mlbPlayerId`** (numeric string) |
| GET | `/players/:id/valuation` | SGP-based value. Query: `sessionId` (optional), `currentBid` (optional → advice) |
| POST | `/valuations/batch` | Batch values. Query: **`sessionId` (required)**. Body: `{ playerIds: string[] }` |
| GET | `/valuations/all` | All **undrafted** values. Query: **`sessionId` (required)**, `position`, `minValue` |
| GET | `/transactions` | Recent transactions |

Protected routes need header: `x-api-key: <API_KEY>`.

### POST `/sessions`

```json
{
  "league": {
    "numTeams": 12,
    "budget": 260,
    "scoring": "5x5",
    "rosterSlotsPerTeam": { "C": 2, "1B": 1, "2B": 1, "3B": 1, "SS": 1, "OF": 5, "P": 9 }
  },
  "draftState": {
    "picks": [
      { "mlbPlayerId": 665742, "teamInLeagueId": "til_1", "price": 48 }
    ],
    "budgetsRemaining": [212, 260, 260]
  }
}
```

Response: `{ "session_id": "sess_..." }`.

### PATCH `/sessions/:sessionId`

```json
{
  "pick": { "mlbPlayerId": 681010, "teamInLeagueId": "til_2", "price": 42 }
}
```

Optional: `"budgetsRemaining": [200, 218, ...]` (length should match `numTeams`).

### GET `/players/:id/valuation`

- Without `sessionId`: uses default 12-team / $260 league and full player pool (Draft Kit compatible).
- With `sessionId`: loads stored session; **drafted players** get `$0` and an explanation.
- `currentBid` (number): adds `adviceLabel` / `adviceColor` (undervalued / fair / overpay).

### POST `/valuations/batch?sessionId=...`

Body:

```json
{ "playerIds": ["665742", "MLB-681001", "681002"] }
```

Custom / non-MLB strings (e.g. `MiLB-...`) return a placeholder row (~$8) per team design doc.

## Valuation model (summary)

- **SGP** from projected 5×5 stats; **availability** (`projGames/162`) × **depth role** modifier on counting stats; inverted SGP for **ERA** / **WHIP**.
- **Replacement level** per position from default or `league.rosterSlotsPerTeam` × `numTeams`.
- **Dollars**: \((\text{SGP above rep} / \sum \text{SGP above rep}) \times \text{remaining auction dollars} + \$1\) on the **undrafted** pool.
- **Remaining dollars**: sum of `budgetsRemaining` when provided and consistent; else `totalAuctionBudget - sum(pick prices)`.

## Deploy to Render

1. Web Service → repo root `player-valuation-api`.
2. **Build:** `npm install && npm run build`
3. **Start:** `npm start`
4. **Env:** `MONGODB_URI`, `API_KEY`, optional `PORT`
5. **Health check path:** `/health`
6. After deploy, run **`npm run seed`** once against Atlas (or a one-off Render shell) so collections include `mlbPlayerId` and projections.

Draft Kit: set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_API_KEY` to this service.

## Data model notes

- Each player has **`mlbPlayerId`** (unique) and **`mlbTeamId`** for external integration.
- **Mongo `_id`** remains the primary key; list/detail from the Draft Kit can keep using `id` from `GET /players`.
