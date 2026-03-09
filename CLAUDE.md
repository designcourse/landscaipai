# Landscaip

AI-powered landscaping visualization. Upload a photo of your house, get professional landscaping designs in seconds.

## Tech Stack

- **Frontend/Fullstack:** Next.js 16.1.6 (App Router) + Tailwind CSS 4
- **Database + Auth:** Supabase (Postgres + Auth + RLS + Storage)
- **Payments:** Stripe (subscriptions + one-time credit packs)
- **AI:** Gemini 3.1 Flash Image API (Nano Banana 2) — server-side only
- **Deployment:** Vercel
- **PWA:** Progressive Web App with mobile camera capture
- **Admin Charts:** Recharts

## Commands

```bash
npm run dev       # Start dev server (usually port 3000)
npm run build     # Production build
npm run lint      # ESLint
npm run test      # Tests (framework TBD)
```

## MCP Servers

- Supabase — DB, auth, storage operations
- Vercel — Deployment management
- Context7 — Documentation reference
- Chrome DevTools — Browser testing

## Environments

- **Local:** `http://localhost:3000` — needs `.env.local` with Supabase + Stripe keys
- **Production:** Vercel auto-deploys from `master` branch. Env vars configured in Vercel dashboard.
- **Supabase project:** `bedufmdktgpokgsfwxri` (region: us-east-1)

## Core Features

- Photo upload (camera capture + file drop) organized into named Projects
- AI landscape generation with 16 style presets + custom prompts
- Generation settings: time of day, season, weather
- In-painting canvas (mask + targeted prompt) — client-side masking only
- Iterative conversation per image with "start over" reset to original
- Shareable project URLs (public, read-only)
- Credit system: 1 credit = 1 operation (generate, inpaint, or re-prompt)
- Free tier: 3 credits on signup (admin-configurable via `admin_settings` table)
- Hybrid billing: monthly subscriptions (Starter/Pro/Business) + one-time credit packs
- User types: Landscaper (B2B), Homeowner (B2C), Admin

## Key Architecture Decisions

- All Gemini API calls are server-side only (Next.js API routes). No API keys on the client.
- Credit deduction is atomic via Supabase Postgres function with `SELECT ... FOR UPDATE` row locking.
- Credits deducted atomically before generation; refunded on failure or content policy rejection.
- Stripe webhook idempotency via `processed_stripe_events` table.
- Supabase RLS enforces data ownership at the database level. Uses `(SELECT auth.uid())` pattern.
- In-painting masks are client-side only — translated to prompt context, not stored server-side.
- Route groups: `(public)`, `(auth)`, `(protected)`, `(admin)` for access control.
- Server components use `getAuthenticatedProfile()` from `src/lib/supabase/queries.ts` — wrapped in React `cache()` to deduplicate user+profile queries across components in a single request.

## Database

9 tables deployed via Supabase migrations (in `supabase/migrations/`):

- `profiles` — extends auth.users, stores credits_balance, user_type, stripe_customer_id
- `projects` — user projects with optional sharing (share_slug)
- `images` — uploaded photos linked to projects
- `generations` — AI generation results with status tracking
- `credit_transactions` — full credit audit trail
- `subscriptions` — Stripe subscription state
- `processed_stripe_events` — webhook idempotency
- `admin_settings` — configurable settings (free_signup_credits, max_image_upload_size_mb)
- `gallery_items` — admin-curated public gallery

3 Postgres functions: `deduct_credit()`, `refund_credit()`, `add_credits()` — all SECURITY DEFINER with row locking.

Trigger: `handle_new_user()` on `auth.users` INSERT — auto-creates profile + awards free signup credits.

## Auth

- **Email/password** + **Google OAuth** via Supabase Auth
- Auth callback at `src/app/(auth)/auth/callback/route.ts` — exchanges code for session with open-redirect protection
- Middleware (`src/middleware.ts`) — redirects unauthenticated users from protected routes, redirects authenticated users away from auth pages
- Client-side hook: `useUser()` from `src/hooks/use-user.ts` returns `{ user, profile, loading }`
- Google OAuth requires Supabase Dashboard setup: Authentication > Providers > Google (Client ID + Secret from Google Cloud Console)
- Supabase Site URL must match deployment URL; redirect URLs needed for both prod and localhost

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

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/supabase/server.ts` | Server-side Supabase client (cookie-based) |
| `src/lib/supabase/client.ts` | Browser-side Supabase client |
| `src/lib/supabase/admin.ts` | Service role client (server-only) |
| `src/lib/supabase/queries.ts` | Cached `getAuthenticatedProfile()` helper |
| `src/components/shared/auth-form.tsx` | Shared login/signup form (client component) |
| `src/components/shared/navbar.tsx` | Navbar server component (fetches auth state) |
| `src/components/shared/navbar-client.tsx` | Navbar client component (dropdown, mobile menu) |
| `src/middleware.ts` | Auth middleware (skips if Supabase env vars not set) |
| `src/types/index.ts` | All DB model TypeScript types |
| `src/lib/gemini/prompts.ts` | 16 style presets + prompt builder |
| `src/lib/stripe/config.ts` | Plan definitions (starter/pro/business) |

## Docs

- [Product Requirements](docs/prd.md)
- [Technical Architecture](docs/architecture.md)
- [Brand Guidelines](docs/brand.md)
