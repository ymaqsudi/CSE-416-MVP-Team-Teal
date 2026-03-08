# TealCore Draft Kit

Fantasy Baseball Draft Kit web application — CSE 416 Team Teal.

Built with Next.js, TypeScript, and Tailwind CSS. Deployed on Vercel.

**Live App:** https://cse-416-mvp-team-teal.vercel.app

---

## What's Built (MVP)

| Page                      | Route             | Status   |
| ------------------------- | ----------------- | -------- |
| Home / League Setup       | `/`               | Done     |
| Login                     | `/login`          | Done     |
| Create Account            | `/create-account` | Done     |
| All Players               | `/players`        | Live API |
| Player Detail + Valuation | `/players/[id]`   | Live API |
| Roster Screen             | `/roster`         | Done     |
| Live Draft Shell          | `/draft`          | Done     |
| Transactions              | `/transactions`   | Done     |

---

## Integration Status

The Draft Kit is fully integrated with the deployed Player Valuation API.

| SDK Method          | Page          | Status  |
| ------------------- | ------------- | ------- |
| `getPlayers()`      | All Players   | Wired   |
| `getPlayer(id)`     | Player Detail | Wired   |
| `getValuation(id)`  | Player Detail | Wired   |
| `getTransactions()` | Transactions  | Pending |

**Note on shared layer:** The `@tealcore/shared` types and API client are copied directly into `lib/shared/` rather than installed as a package. This is due to an ES module compatibility issue with Next.js and local package installs. The logic is the same as the shared/ folder sdk, this will be cleaned up in a future sprint by publishing the shared package properly.

---

## Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Components:** shadcn/ui
- **Deployment:** Vercel

---

## Getting Started Locally

### Prerequisites

- Node.js v20+ (install via nvm: `nvm install 20 && nvm use 20`)
- Git

### Install and Run

```bash
# From the repo root
cd draft-kit

# Install dependencies
npm install

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Environment Variables

Create a `.env.local` file inside `draft-kit/`:

```
NEXT_PUBLIC_API_BASE_URL=https://cse-416-mvp-team-teal.onrender.com
NEXT_PUBLIC_API_KEY=mvp-teal-secret-key
```

---

## Project Structure

```
draft-kit/
├── app/
│   ├── layout.tsx              # Global layout + navbar
│   ├── page.tsx                # Home / League Setup
│   ├── login/                  # Login page
│   ├── create-account/         # Create Account page
│   ├── players/                # All Players page (live API)
│   │   └── [id]/               # Player Detail + Valuation (live API)
│   ├── roster/                 # Roster Screen
│   ├── draft/                  # Live Draft shell
│   └── transactions/           # Transaction Notifications
├── components/
│   ├── navbar.tsx              # Top navigation bar
│   └── ui/                     # shadcn/ui components
├── lib/
│   ├── api.ts                  # API client instance
│   ├── mock-data.ts            # Mock data for non-integrated pages
│   └── shared/                 # Local copy of @tealcore/shared
│       ├── types.ts            # Shared TypeScript types
│       └── apiClient.ts        # Typed API client
└── .env.local                  # Local env vars (never committed)
```

---

## Demo Flow

The core MVP interaction sequence:

1. Open https://cse-416-mvp-team-teal.vercel.app
2. Navigate to **Players**
3. Search for a player by name or team
4. Click a player
5. View real player detail and live valuation from the deployed API

---

## Notes

- Navbar is hidden on `/login` and `/create-account` by design
- Color theme is teal
- Roster and Draft pages use mock data — full wiring comes in a later sprint
- Do not commit `.env.local` — it is gitignored
- Render (API host) may have a cold start delay of ~30s if inactive
