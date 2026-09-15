# myjobassistant

Automates job searching, AI-based email filtering, and Gmail outreach: search multiple job
titles across up to 3 locations at once, aggregate listings from several platforms, classify
any contact email in each posting as HR (application) or a working professional (referral
request) via OpenAI, and send personalized outreach from your own Gmail account.

## Stack

Next.js (App Router, TypeScript) · PostgreSQL + Prisma · Tailwind CSS + shadcn/ui ·
NextAuth (Google) · OpenAI · Gmail API

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Database

```bash
docker compose up -d       # Postgres on localhost:5433
npx prisma migrate dev     # applies prisma/migrations
```

### 3. Environment variables

Copy `.env.example` to `.env` (already done in this repo with generated secrets — rotate them
for anything beyond local dev) and fill in:

- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — from the
  [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
  1. Create an OAuth 2.0 Client ID (Web application).
  2. Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`.
  3. Enable the **Gmail API** for the project (APIs & Services → Library).
  4. On the OAuth consent screen, add `https://www.googleapis.com/auth/gmail.send` as a
     scope — it's a sensitive scope, so a personal/testing project needs the account added
     as a test user (or the app verified for production use with real users).
- `NEXTAUTH_SECRET` / `ENCRYPTION_KEY` — already generated for local dev; regenerate with
  `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` for anything
  beyond your own machine.
- `ADZUNA_APP_ID` / `ADZUNA_APP_KEY`, `RAPIDAPI_KEY`, `SERPAPI_KEY` — optional app-level
  fallback keys for the job-source APIs (see below). Users can also set their own in Settings.

### 4. Run

```bash
npm run dev
```

Visit `http://localhost:3000`. Sign in with Google → complete onboarding (resume +
profile) → add an OpenAI key in Settings → run a search.

## Job sources

| Source | How it works | Needs a key? |
|---|---|---|
| Adzuna | Official free self-serve API ([developer.adzuna.com](https://developer.adzuna.com)) | Yes (free) |
| JSearch (RapidAPI) | Free-tier API aggregating Indeed, LinkedIn, Glassdoor & more — the real source is reported per listing | Yes (free tier) |
| Google Jobs | Via SerpAPI ([serpapi.com](https://serpapi.com)) | Yes (free trial / paid) |
| LinkedIn | Best-effort scrape of LinkedIn's public, unauthenticated job-search results | No |
| Naukri, Indeed, Glassdoor, Hirist | Best-effort scrape of each site's public search page | No |

The best-effort scrapers fetch public pages the same way an ordinary browser would — no
login, no CAPTCHA solving, no proxy rotation. That means they're inherently fragile: Indeed
and Glassdoor typically block plain server-side requests outright, and Naukri's listings are
loaded client-side so its public page usually yields nothing without a browser. LinkedIn's
public results endpoint reliably returns real listings as of this writing. Every source runs
in parallel behind its own timeout, and a source failing (blocked, empty, errored) never
affects the others or the rest of the pipeline — check the "Source status" panel on a
search's results page to see what each platform actually returned.

For reliable coverage, configure the Adzuna and/or JSearch keys (both have free tiers).

## Security notes

- OpenAI keys, optional job-source API keys, and the Gmail refresh token are encrypted at
  rest (AES-256-GCM) using `ENCRYPTION_KEY` — never stored in plaintext.
- NextAuth uses JWT sessions with no database adapter, so no OAuth access/refresh tokens are
  persisted by NextAuth itself; the only long-lived secret kept is the encrypted Gmail
  refresh token, captured directly in the sign-in callback.
- Uploaded resumes are stored under `storage/` (gitignored) and served only to their owner via
  an authenticated route.

## Known limitations

- The scrape-triggered background pipeline (`lib/scrapers/run-search.ts`) runs detached from
  the request that started it, relying on the Node process staying alive between requests —
  correct for `next dev` / `next start`, but would need a real job queue on a per-request
  serverless deployment (e.g. Vercel functions).
- Best-effort HTML scrapers depend on each site's current markup and can return zero results
  if a page changes or blocks the request — see the table above.
