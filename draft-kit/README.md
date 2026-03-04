# TealCore Draft Kit

Fantasy Baseball Draft Kit web application — CSE 416 Team Teal.

Built with Next.js, TypeScript, and Tailwind CSS. Deployed on Vercel.

**Live App:** https://cse-416-mvp-team-teal.vercel.app

---

## What's Built (MVP)

| Page                | Route             | Status |
| ------------------- | ----------------- | ------ |
| Home / League Setup | `/`               | Done   |
| Login               | `/login`          | Done   |
| Create Account      | `/create-account` | Done   |
| All Players         | `/players`        | Done   |
| Player Detail       | `/players/[id]`   | Done   |
| Roster Screen       | `/roster`         | Done   |
| Live Draft Shell    | `/draft`          | Done   |

All pages currently use mock data. API integration will be wired once the Player Valuation API is deployed.

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
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
NEXT_PUBLIC_API_KEY=dev-key
```

Once we deploy the API, update `NEXT_PUBLIC_API_BASE_URL` to the real Render URL. The Vercel deployment environment variables will also need to be updated at that point.

---

## Project Structure

```
draft-kit/
├── app/
│   ├── layout.tsx           # Global layout + navbar
│   ├── page.tsx             # Home / League Setup
│   ├── login/               # Login page
│   ├── create-account/      # Create Account page
│   ├── players/             # All Players page
│   │   └── [id]/            # Player Detail page
│   ├── roster/              # Roster Screen
│   └── draft/               # Live Draft shell
├── components/
│   ├── navbar.tsx           # Top navigation bar
│   └── ui/                  # shadcn/ui components
├── lib/
│   └── mock-data.ts         # Placeholder data (replaced by API later)
└── .env.local               # Local env vars (never committed)
```

---

## API Integration (Coming Next)

This app consumes the Player Valuation API. Once the SDK is ready, the following will be added:

- `getPlayers()` → All Players page
- `getPlayer(id)` → Player Detail page
- `getValuation(id)` → Player Detail valuation card
- `getTransactions()` → Transaction Notifications

The mock data in `lib/mock-data.ts` will be replaced by real API calls at that point.

---

## Notes

- The navbar is hidden on `/login` and `/create-account` by design
- Color theme is teal — defined via CSS variables in `app/globals.css`
- Do not commit `.env.local` — it is gitignored
