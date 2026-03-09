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

## Style Rules

- **All UI must use Tailwind theme tokens** configured from `docs/brand.md` and defined in `src/app/globals.css` under `@theme inline`.
- **Never use raw hex colors** (e.g. `#0F8000`) in components — use `text-primary`, `bg-muted`, `border-border`, etc.
- **Never hardcode font values** — use `font-sans` / `font-mono` tokens.
- **Never hardcode margin, padding, gap, or spacing values** (e.g. `p-[24px]`, `mt-[64px]`) — use the named spacing tokens (`p-element`, `mt-section`, `gap-tight`, etc.) or Tailwind's default numeric scale (`p-4`, `mt-8`).
- **Never hardcode border-radius** — use `rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-full` mapped to theme tokens.
- **Never hardcode shadows** — use `shadow-sm`, `shadow-md`, `shadow-lg` mapped to theme tokens.
- If a needed token doesn't exist, add it to `docs/brand.md` and `src/app/globals.css` first, then use it.

## Docs

- [Product Requirements](docs/prd.md)
- [Technical Architecture](docs/architecture.md)
- [Brand Guidelines](docs/brand.md)
