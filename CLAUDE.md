# Landscaip

AI-powered landscaping visualization. Upload a photo of your house, get professional landscaping designs in seconds.

## Tech Stack

- **Frontend/Fullstack:** Next.js (App Router) + Tailwind CSS
- **Database + Auth:** Supabase (Postgres + Auth + RLS + Storage)
- **Payments:** Stripe (subscriptions + one-time credit packs)
- **AI:** Gemini 3.1 Flash Image API (Nano Banana 2) — server-side only
- **Deployment:** Vercel
- **PWA:** Progressive Web App with mobile camera capture
- **Admin Charts:** Recharts

## Commands

```bash
npm run dev       # Start dev server
npm run build     # Production build
npm run lint      # ESLint
npm run test      # Tests (framework TBD)
```

## MCP Servers

- Supabase — DB, auth, storage operations
- Stripe — Payment processing
- Context7 — Documentation reference
- Vercel — Deployment management

## Core Features

- Photo upload (camera capture + file drop) organized into named Projects
- AI landscape generation with 16 style presets + custom prompts
- Generation settings: time of day, season, weather
- In-painting canvas (mask + targeted prompt) — client-side masking only
- Iterative conversation per image with "start over" reset to original
- Shareable project URLs (public, read-only)
- Credit system: 1 credit = 1 operation (generate, inpaint, or re-prompt)
- Free tier: 3 credits on signup (admin-configurable)
- Hybrid billing: monthly subscriptions (Starter/Pro/Business) + one-time credit packs
- User types: Landscaper (B2B), Homeowner (B2C), Admin

## Key Architecture Decisions

- All Gemini API calls are server-side only (Next.js API routes). No API keys on the client.
- Credit deduction is atomic via Supabase Postgres function with `SELECT ... FOR UPDATE` row locking.
- Credits deducted atomically before generation; refunded on failure or content policy rejection.
- Stripe webhook idempotency via `processed_stripe_events` table.
- Supabase RLS enforces data ownership at the database level.
- In-painting masks are client-side only — translated to prompt context, not stored server-side.
- Route groups: `(public)`, `(auth)`, `(protected)`, `(admin)` for access control.

## Design

- Light mode, white background, primary green: `#0F8000`
- Simplistic, clean, professional but approachable
- Mobile-first, fully responsive (phones, tablets, desktop)

## Docs

- [Product Requirements](docs/prd.md)
- [Technical Architecture](docs/architecture.md)
- [Brand Guidelines](docs/brand.md) *(TODO: create)*
