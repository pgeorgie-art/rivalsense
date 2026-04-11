# RivalSense AI — Architecture Document

## Overview

RivalSense AI is an AI-powered competitor intelligence dashboard for local service businesses (med spas, salons, dental clinics, gyms, etc.). It scrapes competitor websites, extracts pricing and promotional data, analyses customer sentiment from reviews, generates SWOT analysis, and presents actionable intelligence through a real-time dashboard.

**Hackathon MVP stack:** Next.js 16 · Supabase (Postgres + Auth) · Firecrawl · Anthropic Claude API · Recharts · Vercel

---

## Table of Contents

1. [High-Level Architecture](#1-high-level-architecture)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Database Schema](#4-database-schema)
5. [Authentication Flow](#5-authentication-flow)
6. [Onboarding Flow](#6-onboarding-flow)
7. [Analysis Pipeline](#7-analysis-pipeline)
8. [AI Intelligence Layer](#8-ai-intelligence-layer)
9. [Scoring System](#9-scoring-system)
10. [Frontend Pages & Components](#10-frontend-pages--components)
11. [API Routes](#11-api-routes)
12. [Change Detection & Alerts](#12-change-detection--alerts)
13. [Share System](#13-share-system)
14. [Weekly Report](#14-weekly-report)
15. [Currency Detection](#15-currency-detection)
16. [Environment Variables](#16-environment-variables)
17. [Deployment](#17-deployment)

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser / Client                      │
│   Next.js React pages (App Router, server + client comps)   │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTPS
┌───────────────────────▼─────────────────────────────────────┐
│                    Vercel Edge / Node                        │
│  ┌──────────────┐  ┌─────────────┐  ┌────────────────────┐  │
│  │  Next.js     │  │  API Routes │  │  Proxy (Middleware) │  │
│  │  App Router  │  │  /api/*     │  │  Auth + Routing     │  │
│  └──────────────┘  └──────┬──────┘  └────────────────────┘  │
└─────────────────────────┬─┘──────────────────────────────────┘
                          │
          ┌───────────────┼──────────────────┐
          │               │                  │
┌─────────▼──────┐ ┌──────▼──────┐ ┌────────▼────────┐
│   Supabase     │ │  Firecrawl  │ │  Anthropic API  │
│  Postgres + Auth│ │  Web Scraper│ │  Claude AI      │
└────────────────┘ └─────────────┘ └─────────────────┘
```

**Data flow:**
1. User adds their business + up to 5 competitor URLs
2. Pipeline fires: Firecrawl scrapes each URL + searches for reviews
3. Claude analyses content → produces structured JSON (pricing, SWOT, sentiment, market positioning)
4. Results stored in Supabase; scores calculated
5. Dashboard renders intelligence cards, charts, and alerts
6. Weekly cron re-runs pipeline and detects changes

---

## 2. Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | Next.js 16 (App Router) | Server + client rendering, API routes |
| Database | Supabase (PostgreSQL) | All persistent data storage |
| Authentication | Supabase Auth | Email/password auth, session management |
| Web Scraping | Firecrawl (`@mendable/firecrawl-js`) | Competitor website scraping + review search |
| AI Analysis | Anthropic Claude API (`@anthropic-ai/sdk`) | Insights, SWOT, sentiment, chat |
| Charts | Recharts | Pricing comparison bar charts |
| Styling | Tailwind CSS | UI styling |
| Hosting | Vercel | Deployment + cron jobs |

---

## 3. Project Structure

```
let-app/
├── src/
│   ├── app/
│   │   ├── (auth)/                   # Unauthenticated pages
│   │   │   ├── login/page.tsx        # Email/password login
│   │   │   ├── signup/page.tsx       # Account creation
│   │   │   └── forgot-password/      # Password reset
│   │   │
│   │   ├── (app)/                    # Authenticated pages (protected by proxy.ts)
│   │   │   ├── layout.tsx            # Shared nav + chat panel
│   │   │   ├── dashboard/page.tsx    # Main competitor overview
│   │   │   ├── competitor/[id]/      # Single competitor deep-dive
│   │   │   ├── compare/page.tsx      # Side-by-side comparison
│   │   │   ├── report/               # Weekly intelligence report
│   │   │   └── settings/             # Business + competitor management
│   │   │
│   │   ├── onboarding/               # 3-step setup wizard
│   │   │   ├── step-1/               # Business profile
│   │   │   ├── step-2/               # Add competitors
│   │   │   └── step-3/               # Run pipeline
│   │   │
│   │   ├── share/[token]/page.tsx    # Public shareable report (no auth)
│   │   │
│   │   ├── api/
│   │   │   ├── pipeline/route.ts     # Main scrape + analyse pipeline
│   │   │   ├── chat/route.ts         # AI chat endpoint
│   │   │   ├── cron/route.ts         # Weekly re-scrape + change detection
│   │   │   ├── report/route.ts       # Generate weekly intelligence report
│   │   │   ├── share/route.ts        # Create shareable link token
│   │   │   └── test-keys/route.ts    # API key diagnostics
│   │   │
│   │   └── auth/callback/            # Supabase OAuth callback handler
│   │
│   ├── components/
│   │   ├── nav.tsx                   # Top navigation bar
│   │   ├── chat-panel.tsx            # Floating AI chat widget
│   │   ├── score-badge.tsx           # Score ring with tooltip breakdown
│   │   ├── pricing-chart.tsx         # Recharts bar chart
│   │   └── share-button.tsx          # Share link generator button
│   │
│   └── lib/
│       ├── supabase/
│       │   ├── server.ts             # Server-side Supabase client (cookie-based)
│       │   ├── client.ts             # Browser Supabase client
│       │   └── admin.ts              # Service role client (bypasses RLS)
│       ├── claude.ts                 # Claude API wrapper + prompt logic
│       ├── firecrawl.ts              # Firecrawl scraping + review search
│       └── scoring.ts                # Market Positioning Score calculator
│
├── supabase/
│   ├── schema.sql                    # Full database schema
│   ├── add_sentiment.sql             # Migration: sentiment JSONB column
│   ├── add_market_positioning.sql    # Migration: market_positioning column
│   └── add_new_features.sql          # Migration: share_links + reports tables
│
├── proxy.ts                          # Next.js 16 middleware (auth guard + routing)
├── vercel.json                       # Cron schedule config
└── .env.local                        # API keys (not committed)
```

---

## 4. Database Schema

All tables live in Supabase (PostgreSQL). Row Level Security (RLS) is enabled on every table. Server-side writes from the pipeline use a **service role (admin) client** that bypasses RLS.

### businesses
Stores the user's own business as the benchmark anchor.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | Auto-generated |
| user_id | UUID FK → auth.users | Owner |
| name | TEXT | Business name |
| url | TEXT | Website URL |
| category | TEXT | e.g. "Med Spa", "Dental Clinic" |
| city | TEXT | Location city |
| zip | TEXT | Postcode |
| created_at | TIMESTAMPTZ | |

**Constraint:** One business per user (`UNIQUE INDEX on user_id`).

### competitors
Up to 5 tracked competitor URLs per user, each assigned a slot number.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| user_id | UUID FK | Owner |
| name | TEXT | Optional display name |
| url | TEXT | Competitor website |
| slot_number | INTEGER (1–5) | Position slot |
| created_at | TIMESTAMPTZ | |

**Constraint:** Unique `(user_id, slot_number)` — enforces the 5-competitor limit.

### scrape_results
Raw and parsed output from each Firecrawl scrape run.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| entity_id | UUID | References business or competitor ID |
| entity_type | TEXT | `'business'` or `'competitor'` |
| raw_content | TEXT | Full scraped markdown |
| parsed_pricing | JSONB | `[{service, price, price_numeric}]` |
| parsed_promos | JSONB | `[{type, description}]` |
| scrape_status | TEXT | `pending / success / failed` |
| error_message | TEXT | Failure reason if any |
| scraped_at | TIMESTAMPTZ | |

### ai_insights
Claude-generated intelligence per competitor. One row per pipeline run (latest is always used).

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| competitor_id | UUID FK → competitors | |
| summary_text | TEXT | 2–3 sentence summary |
| swot_strengths | TEXT | Newline-separated bullet points |
| swot_weaknesses | TEXT | |
| swot_opportunities | TEXT | |
| swot_threats | TEXT | |
| pricing_position | TEXT | `above_market / at_market / below_market` |
| market_positioning | TEXT | `luxury / mid-market / budget` |
| promo_patterns | JSONB | `["first-visit discount", ...]` |
| parsed_pricing | JSONB | Extracted service prices |
| parsed_promos | JSONB | Structured promo descriptions |
| sentiment | JSONB | Full sentiment object (see below) |
| generated_at | TIMESTAMPTZ | |

**Sentiment JSONB structure:**
```json
{
  "overall": "positive | mixed | negative | unknown",
  "rating_estimate": "4.2/5",
  "review_count_estimate": "200+",
  "positives": ["Great staff", "Clean facilities"],
  "negatives": ["Long wait times"],
  "summary": "Customers love the atmosphere but complain about wait times.",
  "sources": ["https://google.com/..."]
}
```

### scores
Market Positioning Score (1–100) per entity per pipeline run.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| entity_id | UUID | Business or competitor ID |
| entity_type | TEXT | `'business'` or `'competitor'` |
| score | INTEGER (1–100) | Composite score |
| score_breakdown | JSONB | `{pricing_competitiveness, promotional_activity, total, notes}` |
| calculated_at | TIMESTAMPTZ | |

### alerts
Change detection notifications generated by the weekly cron.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| user_id | UUID FK | |
| competitor_id | UUID FK | |
| alert_type | TEXT | `price_change / new_promo / content_change` |
| message | TEXT | Human-readable description |
| is_read | BOOLEAN | Cleared when user visits competitor page |
| created_at | TIMESTAMPTZ | |

### chat_sessions
Persisted AI chat history per user, scoped to a screen or competitor context.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| user_id | UUID FK | |
| messages | JSONB | `[{role, content}]` array |
| context_screen | TEXT | e.g. `"dashboard"`, `"competitor"` |
| context_entity_id | UUID | Competitor ID when on a competitor page |
| created_at / updated_at | TIMESTAMPTZ | |

### share_links
UUID tokens for public shareable competitor reports.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| token | UUID UNIQUE | Random token used in URL |
| competitor_id | UUID FK | |
| user_id | UUID FK | |
| created_at | TIMESTAMPTZ | |

### reports
AI-generated weekly intelligence reports per user.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| user_id | UUID FK | |
| content | TEXT | Full markdown report text |
| generated_at | TIMESTAMPTZ | |

---

## 5. Authentication Flow

```
User visits any (app)/* route
         │
         ▼
    proxy.ts runs
         │
    Is user session valid?
    ├── No  → redirect to /login
    └── Yes → allow through
         │
    User on /login or /signup?
    ├── Yes + has session → redirect to /dashboard
    └── No → render page
```

**Implementation:**
- `src/proxy.ts` — Next.js 16 middleware (exported as `proxy`, not `middleware`)
- Uses `@supabase/ssr` to refresh session cookies on every request
- Public routes: `/`, `/login`, `/signup`, `/forgot-password`, `/landing`, `/auth/*`, `/share/*`
- All `(app)/*` routes are protected

**Supabase clients:**
- `lib/supabase/server.ts` — reads/writes cookies; used in Server Components and API routes for auth
- `lib/supabase/client.ts` — browser client for Client Components
- `lib/supabase/admin.ts` — service role client; bypasses RLS for pipeline DB writes

---

## 6. Onboarding Flow

Three-step wizard that must complete before the dashboard is accessible.

```
Step 1: Business Profile
  → User enters: name, website URL, category, city, postcode
  → Saved to businesses table (upsert on user_id)

Step 2: Add Competitors
  → User enters up to 5 competitor URLs
  → Each saved to competitors table with a slot number (1–5)
  → Can also bulk import via CSV (settings page)

Step 3: Run Pipeline
  → User clicks "Analyse Competitors"
  → POST /api/pipeline fires
  → Shows progress + redirects to /dashboard when complete
```

The dashboard redirects to `/onboarding/step-1` if no business exists, or `/onboarding/step-2` if no competitors exist.

---

## 7. Analysis Pipeline

**Endpoint:** `POST /api/pipeline`
**Timeout:** 300 seconds (Vercel Pro limit)

The pipeline runs sequentially to avoid rate limiting. All DB writes use the admin (service role) client.

```
1. Auth check (user session required)
2. Load business + competitors from DB
3. Scrape business URL (benchmark) [non-fatal — failure skipped, pipeline continues]
   └── Firecrawl.scrape(business.url)
   └── Store in scrape_results
4. For each competitor (sequential, fully isolated):
   a. Scrape competitor website
      └── Firecrawl.scrape(competitor.url) → markdown
      └── If scrape fails or returns no content → mark as "failed", skip to next competitor
   b. Search for reviews [non-fatal — failure skipped, analysis continues without reviews]
      └── Firecrawl.search("{name} customer reviews") → up to 5 results
      └── Filter for: google, yelp, tripadvisor, trustpilot, facebook
      └── Combine up to 3 review sources into review text
   c. Generate AI insights [non-fatal — failure skipped, scrape result still stored]
      └── Claude prompt with: scraped content + review content
      └── Returns structured JSON (see AI Layer section)
   d. Store scrape_results (raw + parsed pricing/promos)
   e. Store ai_insights (summary, SWOT, sentiment, positioning) — only if insights generated
   f. Any unexpected error → log and skip competitor, never crash the pipeline
5. Calculate Market Positioning Scores [non-fatal — failure per competitor is isolated]
   └── For each competitor: calculateScore(pricing, promos, position, allPricing)
   └── Store in scores table
6. Store benchmark score for business (fixed at 50)
7. Return { success: true, results: { competitorId: "scraped" | "failed" | "error" } }
```

### Error Isolation Strategy

Each stage is wrapped in its own `try/catch` so a failure in one competitor never affects others:

| Stage | On failure |
|-------|-----------|
| Business scrape | Log warning, mark `failed`, continue to competitors |
| Competitor scrape (no content) | Store `failed` scrape record, `continue` to next competitor |
| Review scrape | Log warning, proceed with empty review content |
| AI insight generation | Log warning, store scrape result without insights |
| DB insert | Log error via `dbInsert()` helper, never throws |
| Score calculation | Log warning, skip score for that competitor |

**Fallback:** If Claude API fails (quota, auth error), `mockInsights()` returns a placeholder response so the app remains functional without API credits. This is handled inside `generateCompetitorInsights()` itself as a last resort.

### Review Rating Extraction

Review ratings are extracted from the same Firecrawl review search already in the pipeline (no additional API required). Claude parses the raw review page markdown and extracts:

- `rating_estimate` — e.g. `"4.2/5"` or `"unknown"` if not found
- `review_count_estimate` — e.g. `"200+"` or `"unknown"` if not found
- `overall` — sentiment classification (`positive / mixed / negative / unknown`)

These are stored inside the `sentiment` JSONB column on `ai_insights` and displayed on the competitor detail page as three separate metric tiles (Star Rating, Reviews, Sentiment) inside the header card. If Firecrawl does not find a review page with a visible rating, all three tiles show `—`.

---

## 8. AI Intelligence Layer

**File:** `src/lib/claude.ts`

### Model Fallback Chain

To maximise availability and minimise cost, Claude is tried in order:

```
1. claude-haiku-4-5-20251001   (cheapest, fastest)
2. claude-3-5-haiku-20241022
3. claude-3-haiku-20240307
4. claude-sonnet-4-6           (most capable, fallback)
```

If a model fails with a credit/auth error, the chain stops immediately (no point trying more expensive models). Other errors (rate limits, etc.) try the next model.

### Competitor Insights Prompt

Claude receives:
- Business context (name, category, city)
- Competitor name + URL
- Scraped website content (up to 8,000 chars)
- Review content from Firecrawl search (up to 4,000 chars)

Claude returns a strict JSON object:

```typescript
interface CompetitorInsights {
  summary: string                           // 2–3 sentence natural language summary
  swot: {
    strengths: string                       // Newline-separated bullet points
    weaknesses: string
    opportunities: string                   // Gaps the user's business can exploit
    threats: string
  }
  pricing_position: 'above_market' | 'at_market' | 'below_market'
  market_positioning: 'luxury' | 'mid-market' | 'budget'
  promo_patterns: string[]                  // e.g. ["first-visit discount", "bundle offer"]
  parsed_pricing: Array<{
    service: string
    price: string                           // Human-readable e.g. "£45"
    price_numeric: number | null            // For chart rendering
  }>
  parsed_promos: Array<{
    type: string
    description: string
  }>
  sentiment: {
    overall: 'positive' | 'mixed' | 'negative' | 'unknown'
    rating_estimate: string                 // e.g. "4.2/5" or "unknown"
    review_count_estimate: string           // e.g. "200+" or "unknown"
    positives: string[]
    negatives: string[]
    summary: string
    sources: string[]
  }
}
```

### Context-Aware AI Chat

**Function:** `chatWithContext(messages, contextData, contextScreen)`

The chat panel injects live competitor data as a system prompt:
- On `/dashboard` → summary of all competitors (scores, pricing positions, promo patterns)
- On `/competitor/[id]` → full insight data for that specific competitor

This allows the AI to answer questions like "how should I price against them?" with real data.

### Weekly Report Generation

**Function:** `callClaudeText()` (exported wrapper around `callClaude`)

Builds a context string from all competitors' latest insights and scores, then prompts Claude to produce a structured briefing with sections: Executive Summary, Key Threats, Opportunities, Pricing Recommendation, Promotional Recommendation, Competitor to Watch.

---

## 9. Scoring System

**File:** `src/lib/scoring.ts`

The **Market Positioning Score** (1–100) quantifies how aggressively a competitor is positioned in the market. It is explicitly NOT based on revenue, foot traffic, or social following — only data we can objectively scrape.

### Formula

```
Total Score = Pricing Competitiveness (0–60) + Promotional Activity (0–40)
```

**Pricing Competitiveness (60 points):**
- Base score by position: `below_market = 50`, `at_market = 30`, `above_market = 15`
- Bonus: +10 if they have more than 3 services listed
- Bonus: +10 if their average price is below the median across all competitors
- Bonus: +5 if they have any prices at all (transparency signal)

**Promotional Activity (40 points):**
- 8 points per promo pattern detected (capped at 40)
- e.g. 3 promo types = 24 points

**Business benchmark:** Always set to 50 (the midpoint), so competitors are shown relative to the user's business.

The score breakdown is stored as JSONB and surfaced in the `ScoreBadge` tooltip so users understand what drives the number.

---

## 10. Frontend Pages & Components

### Pages

| Route | Auth | Description |
|-------|------|-------------|
| `/` | No | Landing / redirect |
| `/login` | No | Email login form |
| `/signup` | No | Account creation |
| `/forgot-password` | No | Password reset |
| `/onboarding/step-1` | Yes | Business profile setup |
| `/onboarding/step-2` | Yes | Add competitor URLs |
| `/onboarding/step-3` | Yes | Run pipeline + progress |
| `/dashboard` | Yes | Main intelligence overview |
| `/competitor/[id]` | Yes | Full competitor deep-dive: review metrics (star rating, review count, sentiment), promo tactics, customer sentiment detail, SWOT analysis |
| `/compare` | Yes | Side-by-side comparison table |
| `/report` | Yes | Weekly AI intelligence report |
| `/settings` | Yes | Edit business + competitors, CSV import |
| `/share/[token]` | No | Public shareable competitor report |

### Key Components

**`ScoreBadge`** — Renders a circular score ring (SVG) with colour gradient (red→amber→green). Hovering shows a breakdown tooltip explaining the scoring methodology.

**`PricingChart`** — Recharts `BarChart` showing average prices per competitor service. Rendered as a client component with `'use client'`. Accepts a `currency` prop (e.g. `£`, `$`, `€`) that is auto-detected from the scraped price strings — so the Y-axis and tooltip always show the correct local currency symbol. The pricing breakdown table has been removed from the competitor detail page; the chart is retained on the dashboard only.

**`ChatPanel`** — Floating chat widget in the bottom-right corner. URL-aware: extracts competitor UUID from the current path using `usePathname()` regex, automatically switching context when navigating. Stores chat history per context.

**`ShareButton`** — Calls `/api/share` to generate a UUID token, then copies the public URL to clipboard. Shows a checkmark on success.

**`Nav`** — Sticky top navigation with: RivalSense AI logo + wordmark, Dashboard, Compare, Report, Settings links, and sign-out. Shows an unread alert badge count on the Dashboard link. Active links use a blue highlight (`bg-blue-600/20`).

---

## 11. API Routes

### `POST /api/pipeline`
Runs the full scrape + analyse pipeline for the authenticated user. Returns `{ success, results }` where each competitor entry is `"scraped"`, `"failed"` (scrape returned no content), or `"error"` (unexpected exception). The pipeline never returns a 500 due to a single competitor failing — only a fatal auth or DB load error will do so.

### `POST /api/chat`
Accepts `{ messages, contextEntityId? }`. Builds context from DB, calls Claude, upserts chat session. Returns `{ reply }`.

### `GET /api/cron` (also accepts POST)
Weekly re-scrape. Loads all users' competitors, re-runs scraping and AI analysis, detects changes vs previous results, creates alerts. Protected by `CRON_SECRET` header check.

### `POST /api/report`
Generates an AI weekly intelligence report for the authenticated user. Loads all competitor insights and scores, builds a summary context, calls Claude. Stores result in `reports` table. Returns `{ success, content, id }`.

### `POST /api/share`
Accepts `{ competitor_id }`. Verifies ownership, creates or retrieves a UUID token in `share_links`. Returns `{ token }`.

### `GET /api/test-keys`
Diagnostic endpoint. Tests Supabase connection, Anthropic API (tries all 4 models), Firecrawl. Returns `{ allOk, results }`.

---

## 12. Change Detection & Alerts

**File:** `src/app/api/cron/route.ts`
**Schedule:** Every Monday at 8:00 AM UTC (`0 8 * * 1`, configured in `vercel.json`)

```
1. Verify CRON_SECRET header
2. Load all users from businesses table
3. For each user:
   a. Load their competitors
   b. For each competitor:
      i.  Load previous scrape result (latest before this run)
      ii. Scrape current content
      iii.Compare pricing: detect price changes > threshold
      iv. Compare promos: detect new promo patterns
      v.  Create alerts for detected changes
      vi. Store new scrape result + insights
4. Return summary
```

**Alert types:**
- `price_change` — A service price increased or decreased
- `new_promo` — A new promotional pattern was detected
- `content_change` — Significant content change detected

Alerts appear as a banner on the dashboard and as orange dots on competitor cards. They are marked as read when the user visits the competitor's detail page.

---

## 13. Share System

Users can generate a public share link for any competitor's analysis report.

```
User clicks "Share" on /competitor/[id]
         │
         ▼
POST /api/share { competitor_id }
  → Verify user owns this competitor
  → Check if token already exists for this competitor+user
  → If yes: return existing token
  → If no: generate crypto.randomUUID(), insert to share_links
  → Return token
         │
         ▼
Share URL: https://app.com/share/{token}
  → Copied to clipboard
         │
         ▼
Anyone visits /share/{token}
  → Admin client looks up share_links by token
  → Loads competitor + ai_insights + scores
  → Renders read-only report (no auth required)
  → No edit/interact capabilities
```

The share page has its own standalone layout (no nav, no chat) with a "Powered by RivalSense AI" footer.

---

## 14. Weekly Report

The report page (`/report`) allows on-demand generation of an AI-written competitive briefing.

**Report structure:**
1. **Executive Summary** — 2–3 sentences on the competitive landscape
2. **Key Threats** — Top 2–3 immediate threats to watch
3. **Opportunities** — Top 2–3 actionable opportunities to exploit
4. **Pricing Strategy Recommendation** — Specific pricing action this week
5. **Promotional Recommendation** — One specific promotion to counter competitors
6. **Competitor to Watch** — Which competitor needs closest monitoring and why

Reports are stored in the `reports` table and the most recent one is shown by default. Users can regenerate at any time.

---

## 15. Currency Detection

The pricing chart auto-detects the currency symbol from scraped price strings — no manual configuration required.

**Logic (in `dashboard/page.tsx`):**
```
For each competitor's parsed_pricing entries:
  Scan the price string for a leading currency symbol: £ $ € ¥ ₹ ₩ ₪ ฿
  Return the first match found
Fallback: "$" if no prices are found
```

The detected symbol is passed as the `currency` prop to `PricingChart`, which uses it on both the Y-axis tick formatter and the tooltip. This means a business operating in the UK automatically sees `£`, one in the US sees `$`, and so on — driven entirely by what Claude extracts from the competitor's website, which is in turn based on the actual content of that competitor's page.

---

## 16. Environment Variables

All stored in `.env.local` (never committed to git).

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://[project-id].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[publishable key]
SUPABASE_SERVICE_ROLE_KEY=[secret key]

# Anthropic Claude
ANTHROPIC_API_KEY=sk-ant-api03-...

# Firecrawl
FIRECRAWL_API_KEY=fc-...

# Cron protection (any random string)
CRON_SECRET=your-secret-here
```

**Key distinction:**
- `NEXT_PUBLIC_*` variables are exposed to the browser (safe for anon/publishable keys only)
- `SUPABASE_SERVICE_ROLE_KEY` is server-only — grants full DB access, bypasses RLS

---

## 17. Deployment

### Vercel Deployment

```bash
npm install -g vercel
vercel           # Follow prompts, links to GitHub repo
```

Add all environment variables in Vercel Dashboard → Project → Settings → Environment Variables.

### Cron Job

`vercel.json` configures the weekly re-scrape:

```json
{
  "crons": [
    {
      "path": "/api/cron",
      "schedule": "0 8 * * 1"
    }
  ]
}
```

Vercel calls `GET /api/cron` every Monday at 8 AM UTC. The route verifies the `x-cron-secret` header matches `CRON_SECRET`.

### Database Migrations

Run these SQL files in Supabase SQL Editor in order:

1. `supabase/schema.sql` — Initial schema (all base tables)
2. `supabase/add_sentiment.sql` — Adds `sentiment` JSONB column to `ai_insights`
3. `supabase/add_new_features.sql` — Adds `market_positioning` column + `share_links` + `reports` tables
4. `supabase/add_parsed_columns.sql` — Adds `parsed_pricing` and `parsed_promos` JSONB columns to `ai_insights`

### Supabase Auth Settings

In Supabase Dashboard → Authentication → URL Configuration:
- **Site URL:** `https://your-vercel-domain.vercel.app`
- **Redirect URLs:** `https://your-vercel-domain.vercel.app/auth/callback`

---

## Data Flow Diagram

```
User Input (URL)
      │
      ▼
┌─────────────────┐
│  Firecrawl      │──► Raw markdown (website content)
│  .scrape()      │
└─────────────────┘
      │
      ├──► Firecrawl.search() ──► Review content (Google, Yelp, etc.)
      │
      ▼
┌─────────────────┐
│  Claude API     │◄── Business context
│  (4-model chain)│◄── Scraped content (8k chars)
│                 │◄── Review content (4k chars)
└────────┬────────┘
         │
         ▼ Structured JSON
┌─────────────────────────────────────┐
│  ai_insights table                  │
│  • summary_text                     │
│  • swot_strengths/weaknesses/...    │
│  • pricing_position                 │
│  • market_positioning               │
│  • promo_patterns                   │
│  • parsed_pricing                   │
│  • sentiment (JSONB)                │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│  Scoring Engine │──► scores table (1–100)
│  scoring.ts     │
└─────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Dashboard UI                       │
│  • Competitor cards with scores     │
│  • Pricing charts                   │
│  • Sentiment badges                 │
│  • Market positioning labels        │
│  • SWOT analysis                    │
│  • Alert notifications              │
│  • AI chat (context-aware)          │
│  • Compare table                    │
│  • Weekly report                    │
│  • Share links                      │
└─────────────────────────────────────┘
```
