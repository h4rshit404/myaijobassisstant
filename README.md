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
- `OPENROUTER_API_KEY` — optional. When set, outreach email generation
  (`lib/openai/generate-email.ts`) tries a free Grok model (`x-ai/grok-4-fast:free`) via
  [OpenRouter](https://openrouter.ai/keys) as a second attempt whenever a user's own OpenAI
  key is missing/invalid or the OpenAI call fails, before giving up and using the static
  template. This model is free on OpenRouter's tier but rate-limited and can be
  rotated/retired by OpenRouter without notice — xAI's own direct API has no free tier.

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
| Jooble | Official free self-serve API ([jooble.org/api/about](https://jooble.org/api/about)) | Yes (free) |
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

### Finding the email, not just the listing

Search-result summaries almost never carry a contact email — the pipeline runs an
**enriching** step (`lib/scrapers/enrich.ts`) between scraping and classification that follows
each listing's own link (`sourceUrl` — which for Adzuna/JSearch/etc. is usually the original
posting on the company's own careers page or ATS) and pulls the full page text before the AI
classifier looks for an email. This is what makes company/HR emails findable even when the
platform's search-result card didn't show one. Listings that still come up with no email after
that (most of them, realistically — plenty of companies use apply-tracking systems with no
email at all) fall through to a second, independent lookup: **Hunter.io**
(`lib/enrichment/hunter.ts`) looks up real HR/careers inboxes and named employees' work
emails directly for the listing's company name, no posting text required. It works even
without an OpenAI key configured. This is the highest-leverage key to add if searches are
coming back with few or no results — configure it in Settings (free tier at
[hunter.io](https://hunter.io)).

For whatever's still unresolved after both of those, a third and final fallback kicks in:
**AI-guessed email** (`lib/ai/guess-listing-emails.ts`) asks the OpenAI model itself to infer
a standard-pattern HR email (`careers@`, `hr@`, ...) purely from the company name and, when
available, a verified domain hint taken from the listing's own link (skipped if that link is
a job board/ATS rather than the company's real site — see
`lib/enrichment/known-non-company-domains.ts`). The model is instructed to decline rather than
fabricate when it doesn't clearly recognize the company. This is **unverified** — it's marked
with a distinct `emailSource: AI_GUESSED`, shown with an amber "Guessed" badge in the results
table and a warning in the email preview modal, and its confidence is capped low. Only needs
an OpenAI key (already required for classification).

Listings still without any email after all three steps are left out of the results and the
table entirely; only listings with a contact email are shown.

## No duplicates, anywhere

Two dedupe layers, both scoped to the whole user — not just one search — so nothing shows up
twice across the results table, the Searched queue, and the Applied tab combined:

1. **Same posting, insert time** (`getExistingDedupeHashes` in `lib/scrapers/applied.ts`) —
   before a scraped job is even persisted, its title+company+location is checked against
   every listing the user already has, from any past search, applied or not. A repeat never
   becomes a second row.
2. **Same real contact, after email resolution** (`lib/scrapers/dedupe-contacts.ts`) — a final
   pipeline step collapses every (company, email) pair that now appears on more than one of
   the user's listings — this search's own and every past one — down to a single row. This is
   what catches Hunter/AI-guess resolving the same generic inbox for several
   differently-worded postings from the same company (different title, found via a different
   platform), which title+company+location matching alone would miss. The row that's kept is
   whichever one is already applied (if any), so a later duplicate can never "undo" an
   application that already went out; every other row in the group just loses its email and
   drops out of the results like it never found one.

Once an outreach email is actually sent for a listing, it shows up in the **Applied** tab
(`/dashboard/applied`) instead of anywhere else.

**Searched** (`/dashboard/searched`) is a paginated (25/page), cross-search queue: every job
with a contact email from *any* of your past searches that you haven't applied to yet, in one
place — no need to revisit each search individually. It uses the same Apply
(Selected)/Apply to All table as a single search's results page
(`components/job-listings-board.tsx`), so you can act on it directly from there.

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
