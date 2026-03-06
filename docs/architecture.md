# Landscaip — Technical Architecture

> System architecture, data flows, database schema, and API design.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser / PWA)                  │
│                                                                 │
│  Next.js App Router (React)  +  Tailwind CSS                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────────┐  │
│  │ Landing   │ │Dashboard │ │Generation│ │ In-Painting       │  │
│  │ Page      │ │& Projects│ │   UI     │ │ Canvas            │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────────┐  │
│  │ Auth      │ │ Account  │ │ Pricing  │ │ Admin Area        │  │
│  │ (Supabase)│ │ Settings │ │ Page     │ │                   │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────────────┘  │
└───────────────────────┬─────────────────────────────────────────┘
                        │ HTTPS
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NEXT.JS SERVER (Vercel)                       │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ API Routes   │  │ Server       │  │ Middleware            │  │
│  │ /api/generate│  │ Actions      │  │ (Auth + Role checks)  │  │
│  │ /api/webhook │  │ (CRUD ops)   │  │                       │  │
│  │ /api/upload  │  │              │  │                       │  │
│  └──────┬───────┘  └──────┬───────┘  └───────────────────────┘  │
│         │                 │                                      │
└─────────┼─────────────────┼──────────────────────────────────────┘
          │                 │
          ▼                 ▼
┌──────────────┐  ┌──────────────────┐  ┌──────────────────────┐
│  Gemini API  │  │    Supabase      │  │      Stripe          │
│  (3.1 Flash  │  │                  │  │                      │
│   Image)     │  │  ┌────────────┐  │  │  - Checkout Sessions │
│              │  │  │  Postgres  │  │  │  - Subscriptions     │
│  - Generate  │  │  │  (+ RLS)   │  │  │  - Webhooks          │
│  - Edit      │  │  ├────────────┤  │  │  - Customer Portal   │
│              │  │  │  Auth      │  │  │                      │
│              │  │  ├────────────┤  │  └──────────────────────┘
│              │  │  │  Storage   │  │
│              │  │  │  (S3)      │  │
│              │  │  └────────────┘  │
└──────────────┘  └──────────────────┘
```

---

## Database Schema (Supabase Postgres)

### Users Table

Extended from Supabase Auth's `auth.users`.

```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  user_type TEXT CHECK (user_type IN ('landscaper', 'homeowner', 'admin')),
  credits_balance INTEGER NOT NULL DEFAULT 0,
  stripe_customer_id TEXT UNIQUE,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Projects Table

```sql
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_shared BOOLEAN NOT NULL DEFAULT false,
  share_slug TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_user_id ON public.projects(user_id);
CREATE INDEX idx_projects_share_slug ON public.projects(share_slug);
```

### Images Table

```sql
CREATE TABLE public.images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  thumbnail_path TEXT,
  original_filename TEXT,
  width INTEGER,
  height INTEGER,
  file_size_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_images_project_id ON public.images(project_id);
CREATE INDEX idx_images_user_id ON public.images(user_id);
```

### Generations Table

```sql
CREATE TABLE public.generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_id UUID NOT NULL REFERENCES public.images(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_generation_id UUID REFERENCES public.generations(id),
  storage_path TEXT NOT NULL,
  prompt TEXT NOT NULL,
  style_preset TEXT,
  time_of_day TEXT,
  season TEXT,
  weather TEXT,
  is_inpaint BOOLEAN NOT NULL DEFAULT false,
  input_tokens INTEGER,
  output_tokens INTEGER,
  generation_cost_cents INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_generations_image_id ON public.generations(image_id);
CREATE INDEX idx_generations_user_id ON public.generations(user_id);
CREATE INDEX idx_generations_parent ON public.generations(parent_generation_id);
```

### Credit Transactions Table

```sql
CREATE TABLE public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, -- positive = credit added, negative = credit used
  type TEXT NOT NULL CHECK (type IN ('free_signup', 'purchase', 'subscription', 'generation', 'refund', 'admin_adjustment')),
  description TEXT,
  generation_id UUID REFERENCES public.generations(id),
  stripe_event_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_credit_transactions_user_id ON public.credit_transactions(user_id);
CREATE INDEX idx_credit_transactions_stripe_event ON public.credit_transactions(stripe_event_id);
```

### Subscriptions Table

```sql
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('starter', 'pro', 'business')),
  status TEXT NOT NULL CHECK (status IN ('active', 'past_due', 'canceled', 'incomplete')),
  credits_per_period INTEGER NOT NULL,
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_id ON public.subscriptions(stripe_subscription_id);
```

### Processed Stripe Events (Idempotency)

```sql
CREATE TABLE public.processed_stripe_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Admin Settings

```sql
CREATE TABLE public.admin_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default settings
INSERT INTO public.admin_settings (key, value) VALUES
  ('free_signup_credits', '3'),
  ('max_image_upload_size_mb', '20');
```

### Gallery Items Table (Admin-Curated)

```sql
CREATE TABLE public.gallery_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id UUID REFERENCES public.generations(id) ON DELETE SET NULL,
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  title TEXT,
  caption TEXT,
  style_preset TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_gallery_items_published ON public.gallery_items(is_published, display_order);

-- Gallery is publicly readable, admin-writable (via service role)
ALTER TABLE public.gallery_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Gallery items are publicly readable" ON public.gallery_items FOR SELECT USING (is_published = true);
```

---

## Database Functions

### Atomic Credit Deduction

```sql
CREATE OR REPLACE FUNCTION public.deduct_credit(p_user_id UUID, p_generation_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  -- Lock the user's row to prevent concurrent deductions
  SELECT credits_balance INTO v_balance
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_balance < 1 THEN
    RETURN FALSE;
  END IF;

  -- Deduct the credit
  UPDATE public.profiles
  SET credits_balance = credits_balance - 1,
      updated_at = now()
  WHERE id = p_user_id;

  -- Record the transaction
  INSERT INTO public.credit_transactions (user_id, amount, type, description, generation_id)
  VALUES (p_user_id, -1, 'generation', 'AI generation', p_generation_id);

  RETURN TRUE;
END;
$$;
```

### Credit Refund (for failed generations)

```sql
CREATE OR REPLACE FUNCTION public.refund_credit(p_user_id UUID, p_generation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET credits_balance = credits_balance + 1,
      updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO public.credit_transactions (user_id, amount, type, description, generation_id)
  VALUES (p_user_id, 1, 'refund', 'Failed generation refund', p_generation_id);
END;
$$;
```

### Add Credits (for purchases/subscriptions)

```sql
CREATE OR REPLACE FUNCTION public.add_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_type TEXT,
  p_description TEXT,
  p_stripe_event_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Idempotency check for Stripe events
  IF p_stripe_event_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.processed_stripe_events WHERE event_id = p_stripe_event_id) THEN
      RETURN FALSE; -- Already processed
    END IF;
    INSERT INTO public.processed_stripe_events (event_id, event_type)
    VALUES (p_stripe_event_id, p_type);
  END IF;

  UPDATE public.profiles
  SET credits_balance = credits_balance + p_amount,
      updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO public.credit_transactions (user_id, amount, type, description, stripe_event_id)
  VALUES (p_user_id, p_amount, p_type, p_description, p_stripe_event_id);

  RETURN TRUE;
END;
$$;
```

---

## Row Level Security (RLS) Policies

```sql
-- Profiles: users can read/update their own profile
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Projects: users can CRUD their own projects; shared projects are publicly readable
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own projects" ON public.projects FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Shared projects are publicly readable" ON public.projects FOR SELECT USING (is_shared = true);

-- Images: users can CRUD their own images; images in shared projects are publicly readable
ALTER TABLE public.images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own images" ON public.images FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Images in shared projects are readable" ON public.images FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND is_shared = true));

-- Generations: users can read their own; generations in shared projects are publicly readable
ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own generations" ON public.generations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Generations in shared projects are readable" ON public.generations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.images i
    JOIN public.projects p ON i.project_id = p.id
    WHERE i.id = image_id AND p.is_shared = true
  ));

-- Credit transactions: users can view their own
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own transactions" ON public.credit_transactions FOR SELECT USING (auth.uid() = user_id);

-- Subscriptions: users can view their own
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own subscription" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);

-- Admin settings: readable by admins only (accessed via service role in API routes)
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
```

---

## API Routes

### Generation

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| POST | `/api/generate` | Submit generation request (photo + settings + prompt) | Authenticated |
| POST | `/api/generate/inpaint` | Submit in-painting request (photo + mask data + prompt) | Authenticated |
| GET | `/api/generations/[id]` | Get generation status and result | Authenticated (owner) |

### Projects

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| GET | `/api/projects` | List user's projects | Authenticated |
| POST | `/api/projects` | Create new project | Authenticated |
| PATCH | `/api/projects/[id]` | Update project (rename, toggle sharing) | Authenticated (owner) |
| DELETE | `/api/projects/[id]` | Delete project and all contents | Authenticated (owner) |

### Images

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| POST | `/api/images/upload` | Upload photo to project | Authenticated |
| DELETE | `/api/images/[id]` | Delete image and its generations | Authenticated (owner) |

### Billing

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| POST | `/api/billing/checkout` | Create Stripe checkout session | Authenticated |
| POST | `/api/billing/portal` | Create Stripe customer portal session | Authenticated |
| POST | `/api/webhooks/stripe` | Handle Stripe webhook events | Stripe signature |
| GET | `/api/billing/balance` | Get current credit balance | Authenticated |

### Auth

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| POST | `/api/auth/callback` | Supabase auth callback | Public |
| PATCH | `/api/auth/update-profile` | Update user type, name | Authenticated |

### Admin

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| GET | `/api/admin/users` | List all users with usage stats | Admin |
| GET | `/api/admin/stats` | Dashboard analytics data | Admin |
| PATCH | `/api/admin/settings` | Update admin settings | Admin |
| POST | `/api/admin/credits` | Manually adjust user credits | Admin |
| GET | `/api/admin/gallery` | List all gallery items (published + drafts) | Admin |
| POST | `/api/admin/gallery` | Add gallery item (from generation or upload) | Admin |
| PATCH | `/api/admin/gallery/[id]` | Update gallery item (caption, order, publish) | Admin |
| DELETE | `/api/admin/gallery/[id]` | Remove gallery item | Admin |

### Public / Sharing

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| GET | `/api/share/[slug]` | Get shared project data | Public |
| GET | `/api/gallery` | Get published gallery items | Public |

---

## Data Flows

### Generation Flow

```
Client                    Server (API Route)              Gemini API          Supabase
  │                              │                            │                  │
  │  POST /api/generate          │                            │                  │
  │  {imageId, preset,           │                            │                  │
  │   timeOfDay, season,         │                            │                  │
  │   weather, prompt}           │                            │                  │
  │─────────────────────────────>│                            │                  │
  │                              │                            │                  │
  │                              │  1. Validate auth          │                  │
  │                              │  2. Create generation      │                  │
  │                              │     record (status:pending) │                 │
  │                              │──────────────────────────────────────────────>│
  │                              │                            │                  │
  │                              │  3. deduct_credit()        │                  │
  │                              │  (atomic, row-locked)      │                  │
  │                              │──────────────────────────────────────────────>│
  │                              │                            │  returns T/F     │
  │                              │<─────────────────────────────────────────────│
  │                              │                            │                  │
  │                              │  If false → 402 error      │                  │
  │                              │                            │                  │
  │                              │  4. Build compound prompt  │                  │
  │                              │  5. Send to Gemini API     │                  │
  │                              │───────────────────────────>│                  │
  │                              │                            │                  │
  │                              │     Generated image        │                  │
  │                              │<───────────────────────────│                  │
  │                              │                            │                  │
  │                              │  6. Upload to Storage      │                  │
  │                              │──────────────────────────────────────────────>│
  │                              │                            │                  │
  │                              │  7. Update generation      │                  │
  │                              │     (status:completed,     │                  │
  │                              │      storage_path, tokens) │                  │
  │                              │──────────────────────────────────────────────>│
  │                              │                            │                  │
  │  200 {generation}            │                            │                  │
  │<─────────────────────────────│                            │                  │
  │                              │                            │                  │
  │  ON FAILURE:                 │                            │                  │
  │                              │  refund_credit()           │                  │
  │                              │  Update status: failed     │                  │
  │                              │──────────────────────────────────────────────>│
  │  500 {error}                 │                            │                  │
  │<─────────────────────────────│                            │                  │
```

### Auth Flow

```
Client                    Supabase Auth              Next.js Server
  │                              │                        │
  │  1a. Google OAuth click      │                        │
  │     OR                       │                        │
  │  1b. Email/password signup   │                        │
  │─────────────────────────────>│                        │
  │                              │                        │
  │  2. Auth callback            │                        │
  │<─────────────────────────────│                        │
  │                              │                        │
  │  3. Redirect to /auth/callback                        │
  │──────────────────────────────────────────────────────>│
  │                              │                        │
  │                              │  4. Exchange code for  │
  │                              │     session             │
  │                              │<───────────────────────│
  │                              │                        │
  │                              │  5. Create profile row │
  │                              │     (if new user)      │
  │                              │  6. Add free credits   │
  │                              │     (from admin_settings)
  │                              │<───────────────────────│
  │                              │                        │
  │  7. Redirect to /dashboard   │                        │
  │     (or /generate if photo   │                        │
  │      was pre-uploaded)       │                        │
  │<─────────────────────────────────────────────────────│
  │                              │                        │
  │  ... on first generation submit ...                   │
  │                              │                        │
  │  8. Show user-type modal     │                        │
  │     during generation wait   │                        │
  │  9. User selects:            │                        │
  │     "Landscaper" or "DIY     │                        │
  │      Homeowner"              │                        │
  │                              │                        │
  │  PATCH /api/auth/update-profile                       │
  │  {user_type: 'landscaper'}   │                        │
  │──────────────────────────────────────────────────────>│
  │                              │  10. Update profile    │
  │                              │      user_type field   │
  │                              │<───────────────────────│
```

### Payment Flow (Stripe)

```
Client                    Next.js Server           Stripe                Supabase
  │                              │                    │                      │
  │  POST /api/billing/checkout  │                    │                      │
  │  {plan: 'pro'}               │                    │                      │
  │─────────────────────────────>│                    │                      │
  │                              │  Create checkout   │                      │
  │                              │  session           │                      │
  │                              │───────────────────>│                      │
  │                              │  session URL       │                      │
  │                              │<───────────────────│                      │
  │  Redirect to Stripe          │                    │                      │
  │<─────────────────────────────│                    │                      │
  │                              │                    │                      │
  │  ... user completes payment ...                   │                      │
  │                              │                    │                      │
  │                              │  Webhook:          │                      │
  │                              │  checkout.session   │                      │
  │                              │  .completed         │                      │
  │                              │<───────────────────│                      │
  │                              │                    │                      │
  │                              │  1. Verify signature│                     │
  │                              │  2. Check idempotency                     │
  │                              │  3. add_credits()   │                     │
  │                              │──────────────────────────────────────────>│
  │                              │  4. Create/update   │                     │
  │                              │     subscription    │                     │
  │                              │──────────────────────────────────────────>│
  │                              │                    │                      │
  │  Redirect to /dashboard      │                    │                      │
  │  (Stripe success_url)        │                    │                      │
  │<─────────────────────────────│                    │                      │
```

---

## File Storage Structure

```
supabase-storage/
├── uploads/                          # User-uploaded photos
│   └── {user_id}/
│       └── {project_id}/
│           └── {image_id}.{ext}      # Original photo (jpg, png, heic)
│
├── thumbnails/                       # Auto-generated thumbnails
│   └── {user_id}/
│       └── {project_id}/
│           └── {image_id}_thumb.webp # ~400px wide, webp format
│
└── generations/                      # AI-generated results
    └── {user_id}/
        └── {project_id}/
            └── {generation_id}.webp  # Generated landscape image
```

**Storage policies:**
- `uploads/` — Authenticated users can write to their own path. Read access for shared projects.
- `thumbnails/` — Server-generated only. Read access matches uploads.
- `generations/` — Server-generated only. Read access matches uploads.

**Thumbnail generation:** Server-side via Next.js API route on upload. Resize to ~400px width, convert to webp.

---

## Project Structure (Next.js App Router)

```
landscaipai-2026/
├── public/
│   ├── manifest.json              # PWA manifest
│   └── sw.js                      # Service worker
├── src/
│   ├── app/
│   │   ├── (public)/              # Public route group
│   │   │   ├── page.tsx           # Landing page
│   │   │   ├── gallery/
│   │   │   ├── faq/
│   │   │   ├── contact/
│   │   │   ├── pricing/
│   │   │   ├── terms/
│   │   │   ├── privacy/
│   │   │   └── share/[slug]/      # Public shared project view
│   │   ├── (auth)/                # Auth route group
│   │   │   ├── login/
│   │   │   ├── signup/
│   │   │   └── auth/callback/
│   │   ├── (protected)/           # Authenticated route group
│   │   │   ├── dashboard/         # Project list
│   │   │   ├── project/[id]/      # Project detail + images
│   │   │   ├── generate/          # Generation UI
│   │   │   └── account/           # Account settings + billing
│   │   ├── (admin)/               # Admin route group
│   │   │   └── admin/
│   │   │       ├── page.tsx       # Admin dashboard
│   │   │       ├── users/
│   │   │       └── settings/
│   │   ├── api/
│   │   │   ├── generate/
│   │   │   ├── images/
│   │   │   ├── projects/
│   │   │   ├── billing/
│   │   │   ├── auth/
│   │   │   ├── admin/
│   │   │   ├── share/
│   │   │   └── webhooks/stripe/
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                    # Base UI components
│   │   ├── landing/               # Landing page components
│   │   ├── generation/            # Generation UI + canvas
│   │   ├── projects/              # Project list + detail
│   │   ├── billing/               # Pricing + checkout
│   │   ├── admin/                 # Admin components
│   │   └── shared/                # Shared/common components
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts          # Browser client
│   │   │   ├── server.ts          # Server client
│   │   │   └── admin.ts           # Service role client
│   │   ├── gemini/
│   │   │   ├── client.ts          # Gemini API client
│   │   │   └── prompts.ts         # Prompt construction logic
│   │   ├── stripe/
│   │   │   ├── client.ts          # Stripe client
│   │   │   └── config.ts          # Plans, prices, products
│   │   └── utils/
│   │       ├── credits.ts         # Credit operations
│   │       ├── images.ts          # Image processing
│   │       └── storage.ts         # Storage path helpers
│   ├── hooks/                     # React hooks
│   ├── types/                     # TypeScript types
│   └── middleware.ts              # Auth + role middleware
├── supabase/
│   ├── migrations/                # Database migrations
│   └── seed.sql                   # Seed data
├── docs/
│   ├── prd.md
│   └── architecture.md
├── CLAUDE.md
├── tailwind.config.ts
├── next.config.ts
└── package.json
```

---

## Key Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **AI calls server-side only** | Next.js API routes | Protects API keys, enables credit deduction before dispatch |
| **Atomic credit operations** | Postgres functions with `FOR UPDATE` | Prevents race conditions and double-spending |
| **Deduct-before-generate, refund-on-failure** | Credit deducted before API call, refunded if call fails | Prevents users from consuming credits they don't have, while not charging for failures |
| **Client-side masking only** | Canvas API, no server storage | Reduces storage costs, simplifies data model. Mask translated to prompt context. |
| **Supabase Storage over AWS S3** | Supabase Storage (S3-compatible) | Unified platform, integrated auth policies, simpler infrastructure |
| **PWA over native app** | Web + service worker | Faster to ship, single codebase, avoids app store friction. Camera API is sufficient. |
| **Stripe for hybrid billing** | Subscriptions + one-time payments | Stripe handles both natively. Customer portal for self-service management. |
| **Webhook idempotency table** | `processed_stripe_events` table | Prevents double-crediting from duplicate Stripe events |
| **RLS for data isolation** | Supabase Row Level Security | Defense in depth — data access enforced at DB level, not just application |
| **Route groups for access control** | `(public)`, `(auth)`, `(protected)`, `(admin)` | Clean separation of access levels in Next.js App Router |

---

*See [docs/prd.md](./prd.md) for full product requirements.*
