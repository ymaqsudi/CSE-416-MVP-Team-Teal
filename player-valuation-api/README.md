# Player Valuation API

REST API for MLB player data and rotisserie SGP dollar valuations. 

Deployed URL: **https://four16-teal-player-api.onrender.com**.

## Authentication

All routes except `GET /health` and the `/dev/*` + `/portal` routes require a license key in the request header:

```
x-license-key: <your-license-key>
```

License keys are issued through the **Developer Portal** at `/portal`. Register a developer account there to create and manage keys. Each key has a configurable per-window rate limit; requests that exceed it return `429`.

For testing the deployed API, use the deployed portal link to create an account and a key:

Deployed Portal Link: https://four16-teal-player-api.onrender.com/portal

## Run Locally

1. **Copy env and fill in values**
   ```bash
   cp .env.example .env
   ```

   `.env.example`:
   ```
   PORT=4000
   MONGODB_URI=YOUR_MONGO_URI
   JWT_SECRET=replace-with-a-long-random-string
   NODE_ENV=development
   ```

   - `MONGODB_URI` — connection string, e.g. `mongodb://localhost:27017/draft_kit` for a local instance
   - `JWT_SECRET` — secret used to sign developer portal session cookies (any long random string)
   - `PORT` — optional, defaults to `4000`

2. **Install and build**
   ```bash
   npm install
   npm run build
   ```

3. **Seed the database**
   ```bash
   npm run seed
   ```
   Populates players with projections and clears stale sessions. Run once after first setup or to reset data.

4. **Start**
   ```bash
   npm start        # production build
   npm run dev      # watch mode
   ```

5. **Run the valuation unit tests** (no server or database needed)
   ```bash
   npm test
   ```
   Tests cover the SGP engine: scoring, replacement-level math, draft-aware pricing, risk multipliers, flex-slot eligibility, Statcast blending, and two-way player handling.

6. **Smoke test**
   ```bash
   curl http://localhost:4000/health
   curl -H "x-license-key: YOUR_KEY" "http://localhost:4000/players?limit=3"
   ```

## Endpoints

### No auth required

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET/POST | `/portal/*` | Developer portal static UI |
| POST | `/dev/auth/register` | Register a developer account |
| POST | `/dev/auth/login` | Log in (sets session cookie) |
| POST | `/dev/auth/logout` | Clear session cookie |
| GET | `/dev/auth/me` | Current developer account (cookie auth) |
| POST | `/dev/auth/change-password` | Change password (cookie auth) |
| POST | `/dev/auth/delete-account` | Delete account and all keys (cookie auth) |
| GET | `/dev/keys` | List developer's license keys (cookie auth) |
| POST | `/dev/keys` | Create a license key (cookie auth) |
| POST | `/dev/keys/:id/revoke` | Revoke a key (cookie auth) |
| GET | `/dev/usage?keyId=...` | Recent usage logs for a key (cookie auth) |

### License key required (`x-license-key` header)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/sessions` | Create a draft session → `{ session_id }` |
| PATCH | `/sessions/:sessionId` | Append one pick to a session |
| PUT | `/sessions/:sessionId/draftState` | Replace the full pick list for a session |
| GET | `/players` | List players. Query: `q`, `position`, `mlbLeague`, `limit` |
| GET | `/players/:id` | Player by Mongo `_id` or `mlbPlayerId` |
| GET | `/players/:id/valuation` | SGP dollar value for one player |
| GET | `/valuations/all` | All undrafted player values |
| GET | `/transactions` | Recent transactions |

---

## Endpoint Details

### Developer Portal — `POST /dev/auth/register`

```json
{ "email": "you@example.com", "password": "atleast8chars" }
```

Response `201`:
```json
{ "id": "68...", "email": "you@example.com" }
```

---

### Developer Portal — `POST /dev/keys`

Requires session cookie (log in first). Returns the plaintext key **once** — store it immediately.

```json
{
  "label": "Draft Kit local dev",
  "rateLimit": { "windowSec": 60, "max": 200 }
}
```

Response `201`:
```json
{
  "id": "68...",
  "prefix": "pk_abc123",
  "label": "Draft Kit local dev",
  "rateLimit": { "windowSec": 60, "max": 200 },
  "revokedAt": null,
  "createdAt": "2025-01-01T00:00:00.000Z",
  "plaintext": "pk_abc123.xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

---

### `POST /sessions`

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

Response `201`:
```json
{ "session_id": "sess_a1b2c3d4e5f6..." }
```

---

### `PATCH /sessions/:sessionId`

Appends one pick. `budgetsRemaining` is optional.

```json
{
  "pick": { "mlbPlayerId": 681010, "teamInLeagueId": "til_2", "price": 42 },
  "budgetsRemaining": [212, 218, 260]
}
```

Response:
```json
{ "sessionId": "sess_...", "picksRecorded": 2 }
```

---

### `PUT /sessions/:sessionId/draftState`

Replaces the entire pick list. Use this to sync the full draft state in one shot.

```json
{
  "picks": [
    { "mlbPlayerId": 665742, "teamInLeagueId": "til_1", "price": 48 },
    { "mlbPlayerId": 681010, "teamInLeagueId": "til_2", "price": 42 }
  ],
  "budgetsRemaining": [212, 218, 260]
}
```

Response:
```json
{ "sessionId": "sess_...", "picksRecorded": 2 }
```

---

### `GET /players`

Query params:

| Param | Type | Description |
|-------|------|-------------|
| `q` | string | Name or team search (case-insensitive) |
| `position` | string | Filter by position (e.g. `OF`, `SP`) |
| `mlbLeague` | string | `AL` or `NL` — filter to teams in that league |
| `limit` | number | Max results |

Response:
```json
{
  "players": [
    {
      "id": "65a...",
      "mlbPlayerId": 665742,
      "mlbTeamId": 147,
      "name": "Aaron Judge",
      "mlbTeam": "NYY",
      "positions": ["OF"],
      "bats": "R",
      "throws": "R",
      "depthRole": "starter",
      "rosterStatus": "active",
      "risk": "Low",
      "age": 32,
      "injuryStatus": null,
      "projGames": 150,
      "projStats": { "hr": 48, "rbi": 110, "r": 100, "sb": 5, "avg": 0.285 },
      "prevStats": { "games": 158, "hr": 37, "rbi": 99, "r": 96, "sb": 3, "avg": 0.267 },
      "savantStats": { "xba": 0.278, "xslg": 0.568, "barrelPct": 22.1, "exitVelo": 96.5 }
    }
  ]
}
```

Pitchers receive `projStats`/`prevStats` with `{ w, era, whip, k, sv, ip }`. Two-way players also include `hitterProjStats`, `pitcherProjStats`, etc.

---

### `GET /players/:id/valuation`

`:id` may be the Mongo `_id` or `mlbPlayerId` (numeric string).

Query params:

| Param | Type | Description |
|-------|------|-------------|
| `sessionId` | string | Session to use for draft-aware pricing |
| `currentBid` | number | Current auction bid → adds advice fields |
| `mlbLeague` | string | `AL` or `NL` |
| `categories` | string | Comma-separated stat cats (e.g. `HR,RBI,R,SB,AVG`) |
| `rosterSlots` | string | JSON-encoded slot map (e.g. `{"OF":5,"P":9}`) |

Response:
```json
{
  "valuation": {
    "playerId": "65a...",
    "mlbPlayerId": 665742,
    "name": "Aaron Judge",
    "mlbTeamId": 147,
    "dollarValue": 42,
    "sgpAboveRep": 3.8,
    "riskFlag": null,
    "updatedAt": "2025-05-18T12:00:00.000Z",
    "explanation": "Projected auction value from SGP vs replacement pool.",
    "adviceLabel": "undervalued",
    "adviceColor": "green"
  }
}
```

Drafted players return `dollarValue: 0` and `explanation: "Player is already drafted in this session."`.

---

### `GET /valuations/all`

Query params:

| Param | Type | Description |
|-------|------|-------------|
| `sessionId` | string | Session for draft-aware pricing (optional) |
| `position` | string | Filter by position |
| `minValue` | number | Exclude players below this dollar value |
| `mlbLeague` | string | `AL` or `NL` |
| `numTeams` | number | Override league size |
| `budget` | number | Override per-team budget |
| `categories` | string | Comma-separated stat categories |
| `rosterSlots` | string | JSON-encoded roster slot map |

Response:
```json
{
  "eligibleCount": 312,
  "valuations": [
    {
      "playerId": "65a...",
      "mlbPlayerId": 665742,
      "name": "Aaron Judge",
      "mlbTeamId": 147,
      "position": "OF",
      "positions": ["OF"],
      "mlbTeam": "NYY",
      "dollarValue": 42
    }
  ]
}
```

---

## Example Test Cases

These examples use `http://localhost:4000` and player IDs from `npm run seed:mock` (IDs 700001–700050). The 100-pick and 130-pick scenarios require the full seed (`npm run seed`), which pulls live projections from the MLB API.

Set a shell variable for convenience:
```bash
KEY="your-license-key-here"
BASE="http://localhost:4000"
# or swap in the deployed URL:
# BASE="https://four16-teal-player-api.onrender.com"
```

### Health check
```bash
curl $BASE/health
# { "status": "ok", "service": "player-valuation-api" }
```

### List players (name search)
```bash
curl -H "x-license-key: $KEY" "$BASE/players?q=ohtani&limit=1"
```

### Get player by mlbPlayerId
```bash
curl -H "x-license-key: $KEY" "$BASE/players/700021"
```

---

### Valuations — before the draft starts

Create a session with no picks, then fetch all undrafted values. Every eligible player is in the pool.

```bash
SESSION=$(curl -s -X POST \
  -H "x-license-key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "league": { "numTeams": 12, "budget": 260 },
    "draftState": { "picks": [], "budgetsRemaining": [] }
  }' \
  $BASE/sessions | jq -r '.session_id')

curl -H "x-license-key: $KEY" \
  "$BASE/valuations/all?sessionId=$SESSION&minValue=1"
```

Expected: all 50 (mock) or 600+ (full seed) players returned, top values $50–$70+.

---

### Valuations — after 10 players taken

Set the draft state with 10 top picks, then get updated values. The remaining pool is repriced across the reduced undrafted set.

```bash
curl -s -X PUT \
  -H "x-license-key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "picks": [
      { "mlbPlayerId": 700021, "teamInLeagueId": "til_1",  "price": 72 },
      { "mlbPlayerId": 700028, "teamInLeagueId": "til_2",  "price": 65 },
      { "mlbPlayerId": 700016, "teamInLeagueId": "til_3",  "price": 58 },
      { "mlbPlayerId": 700013, "teamInLeagueId": "til_4",  "price": 52 },
      { "mlbPlayerId": 700017, "teamInLeagueId": "til_5",  "price": 50 },
      { "mlbPlayerId": 700022, "teamInLeagueId": "til_6",  "price": 48 },
      { "mlbPlayerId": 700024, "teamInLeagueId": "til_7",  "price": 46 },
      { "mlbPlayerId": 700037, "teamInLeagueId": "til_8",  "price": 44 },
      { "mlbPlayerId": 700038, "teamInLeagueId": "til_9",  "price": 42 },
      { "mlbPlayerId": 700032, "teamInLeagueId": "til_10", "price": 40 }
    ],
    "budgetsRemaining": [188, 195, 202, 208, 210, 212, 214, 216, 218, 220, 260, 260]
  }' \
  "$BASE/sessions/$SESSION/draftState"

curl -H "x-license-key: $KEY" \
  "$BASE/valuations/all?sessionId=$SESSION&minValue=1"
```

Expected: 10 fewer players, remaining values shift up slightly as top production is removed from the pool.

Check that a drafted player returns `$0`:
```bash
curl -H "x-license-key: $KEY" \
  "$BASE/players/700021/valuation?sessionId=$SESSION"
# dollarValue: 0, explanation: "Player is already drafted in this session."
```

---

### Valuations — after 50 players taken

All mock-seed players are drafted. This scenario requires `npm run seed:mock` and uses the full 50-player pool.

```bash
curl -s -X PUT \
  -H "x-license-key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "picks": [
      { "mlbPlayerId": 700021, "teamInLeagueId": "til_1",  "price": 72 },
      { "mlbPlayerId": 700028, "teamInLeagueId": "til_2",  "price": 65 },
      { "mlbPlayerId": 700016, "teamInLeagueId": "til_3",  "price": 58 },
      { "mlbPlayerId": 700013, "teamInLeagueId": "til_4",  "price": 52 },
      { "mlbPlayerId": 700017, "teamInLeagueId": "til_5",  "price": 50 },
      { "mlbPlayerId": 700022, "teamInLeagueId": "til_6",  "price": 48 },
      { "mlbPlayerId": 700024, "teamInLeagueId": "til_7",  "price": 46 },
      { "mlbPlayerId": 700037, "teamInLeagueId": "til_8",  "price": 44 },
      { "mlbPlayerId": 700038, "teamInLeagueId": "til_9",  "price": 42 },
      { "mlbPlayerId": 700032, "teamInLeagueId": "til_10", "price": 40 },
      { "mlbPlayerId": 700029, "teamInLeagueId": "til_11", "price": 38 },
      { "mlbPlayerId": 700030, "teamInLeagueId": "til_12", "price": 36 },
      { "mlbPlayerId": 700018, "teamInLeagueId": "til_1",  "price": 34 },
      { "mlbPlayerId": 700023, "teamInLeagueId": "til_2",  "price": 33 },
      { "mlbPlayerId": 700007, "teamInLeagueId": "til_3",  "price": 32 },
      { "mlbPlayerId": 700014, "teamInLeagueId": "til_4",  "price": 31 },
      { "mlbPlayerId": 700019, "teamInLeagueId": "til_5",  "price": 30 },
      { "mlbPlayerId": 700006, "teamInLeagueId": "til_6",  "price": 29 },
      { "mlbPlayerId": 700044, "teamInLeagueId": "til_7",  "price": 28 },
      { "mlbPlayerId": 700004, "teamInLeagueId": "til_8",  "price": 27 },
      { "mlbPlayerId": 700025, "teamInLeagueId": "til_9",  "price": 26 },
      { "mlbPlayerId": 700031, "teamInLeagueId": "til_10", "price": 25 },
      { "mlbPlayerId": 700020, "teamInLeagueId": "til_11", "price": 24 },
      { "mlbPlayerId": 700036, "teamInLeagueId": "til_12", "price": 23 },
      { "mlbPlayerId": 700035, "teamInLeagueId": "til_1",  "price": 22 },
      { "mlbPlayerId": 700041, "teamInLeagueId": "til_2",  "price": 21 },
      { "mlbPlayerId": 700005, "teamInLeagueId": "til_3",  "price": 20 },
      { "mlbPlayerId": 700043, "teamInLeagueId": "til_4",  "price": 19 },
      { "mlbPlayerId": 700040, "teamInLeagueId": "til_5",  "price": 18 },
      { "mlbPlayerId": 700015, "teamInLeagueId": "til_6",  "price": 17 },
      { "mlbPlayerId": 700027, "teamInLeagueId": "til_7",  "price": 16 },
      { "mlbPlayerId": 700039, "teamInLeagueId": "til_8",  "price": 15 },
      { "mlbPlayerId": 700026, "teamInLeagueId": "til_9",  "price": 14 },
      { "mlbPlayerId": 700042, "teamInLeagueId": "til_10", "price": 13 },
      { "mlbPlayerId": 700046, "teamInLeagueId": "til_11", "price": 12 },
      { "mlbPlayerId": 700033, "teamInLeagueId": "til_12", "price": 11 },
      { "mlbPlayerId": 700034, "teamInLeagueId": "til_1",  "price": 10 },
      { "mlbPlayerId": 700001, "teamInLeagueId": "til_2",  "price": 22 },
      { "mlbPlayerId": 700002, "teamInLeagueId": "til_3",  "price": 20 },
      { "mlbPlayerId": 700003, "teamInLeagueId": "til_4",  "price": 14 },
      { "mlbPlayerId": 700009, "teamInLeagueId": "til_5",  "price": 18 },
      { "mlbPlayerId": 700010, "teamInLeagueId": "til_6",  "price": 15 },
      { "mlbPlayerId": 700011, "teamInLeagueId": "til_7",  "price": 12 },
      { "mlbPlayerId": 700012, "teamInLeagueId": "til_8",  "price": 10 },
      { "mlbPlayerId": 700047, "teamInLeagueId": "til_9",  "price":  9 },
      { "mlbPlayerId": 700048, "teamInLeagueId": "til_10", "price": 16 },
      { "mlbPlayerId": 700045, "teamInLeagueId": "til_11", "price": 14 },
      { "mlbPlayerId": 700049, "teamInLeagueId": "til_12", "price":  8 },
      { "mlbPlayerId": 700008, "teamInLeagueId": "til_1",  "price": 15 },
      { "mlbPlayerId": 700050, "teamInLeagueId": "til_2",  "price":  5 }
    ],
    "budgetsRemaining": [121, 130, 141, 110, 108, 117, 131, 122, 116, 124, 106, 119]
  }' \
  "$BASE/sessions/$SESSION/draftState"

curl -H "x-license-key: $KEY" \
  "$BASE/valuations/all?sessionId=$SESSION&minValue=1"
```

Expected: `eligibleCount: 0` with the mock seed (all 50 players drafted). With the full seed, undrafted players' values compress to reflect remaining budget.

---

### Valuations — after 100 players taken

> Requires `npm run seed` (full MLB projection data, 600+ players).

Use the same session. Add picks for players 100–50 (IDs from the full seeded collection) via another `PUT /sessions/:sessionId/draftState` call with 100 entries, or build incrementally with `PATCH` after each pick. Average price in rounds 51–100 is ~$12–18.

```bash
# Fetch undrafted players sorted by value to identify the next IDs to draft:
curl -H "x-license-key: $KEY" \
  "$BASE/valuations/all?sessionId=$SESSION&minValue=5" | jq '[.valuations[:50] | .[] | .mlbPlayerId]'

# Build your picks array from those IDs, then PUT the full state:
curl -s -X PUT \
  -H "x-license-key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{ "picks": [ /* 100 picks */ ], "budgetsRemaining": [/* 12 values */] }' \
  "$BASE/sessions/$SESSION/draftState"

curl -H "x-license-key: $KEY" \
  "$BASE/valuations/all?sessionId=$SESSION&minValue=1"
```

Expected: values in the $5–$25 range dominating the remaining pool; replacement-level players near $1.

---

### Valuations — after 130 players taken

> Requires `npm run seed` (full MLB projection data).

At 130 picks in a 12-team league (~10–11 roster spots filled per team), most premium players are gone. Remaining pool is depth starters, streamers, and closers in thin markets.

```bash
# Fetch the next 30 undrafted players and draft them:
curl -H "x-license-key: $KEY" \
  "$BASE/valuations/all?sessionId=$SESSION&minValue=1" | jq '[.valuations[:30] | .[] | .mlbPlayerId]'

# PUT the full 130-pick state:
curl -s -X PUT \
  -H "x-license-key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{ "picks": [ /* 130 picks */ ], "budgetsRemaining": [/* 12 values */] }' \
  "$BASE/sessions/$SESSION/draftState"

curl -H "x-license-key: $KEY" \
  "$BASE/valuations/all?sessionId=$SESSION&minValue=1"
```

Expected: most values cluster near $1–$8; any player with projected 20+ HR or 15+ SV still available should show outsized value due to reduced competition for those counting stats.

---

### All undrafted values filtered by position
```bash
curl -H "x-license-key: $KEY" \
  "$BASE/valuations/all?sessionId=$SESSION&position=OF&minValue=5"
```
