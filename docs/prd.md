# Landscaip — Product Requirements Document

> AI-powered landscaping visualization. Upload a photo of your house, get professional landscaping designs in seconds.

**Version:** 1.0
**Date:** March 4, 2026
**Status:** Draft

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [User Personas](#2-user-personas)
3. [Feature Requirements](#3-feature-requirements)
4. [User Flows](#4-user-flows)
5. [AI Specification](#5-ai-specification)
6. [Data Model](#6-data-model)
7. [Authentication & Authorization](#7-authentication--authorization)
8. [Monetization](#8-monetization)
9. [Technical Architecture](#9-technical-architecture)
10. [Design & UX](#10-design--ux)
11. [MVP Scope](#11-mvp-scope)
12. [Risks & Open Questions](#12-risks--open-questions)

---

## 1. Product Overview

### Problem Statement

Homeowners and landscaping professionals currently have no easy way to preview what landscaping changes will look like before committing time and money. Today, people either:
- Guess and hope for the best
- Hire expensive landscape designers for concept renderings
- Browse Pinterest/Instagram for inspiration with no way to see those ideas on *their* property

This leads to costly mistakes, buyer's remorse, and missed opportunities to upsell clients (for professionals).

### Proposed Solution

Landscaip lets users take a photo of their property and instantly generate professional-quality landscaping visualizations using AI. Users can make broad sweeping changes with style presets, or targeted edits with in-painting. The system supports iterative refinement — users can re-prompt, adjust settings, and compare results while always being able to reset to the original photo.

### Key Differentiators

- **Latest AI technology** — Powered by Gemini 3.1 Flash Image (Nano Banana 2) for high-quality, fast results
- **Broad + specific editing** — Full-scene redesigns via presets AND targeted in-painting for precise changes
- **Comprehensive controls** — Time of day, season, weather, 16 curated style presets, plus freeform prompts
- **Iterative workflow** — Conversational refinement per image with ability to reset to original
- **B2B + B2C** — Serves both professional landscapers (client presentations) and DIY homeowners
- **Built by a veteran** — 20+ years of application development experience

---

## 2. User Personas

### Primary: Landscaping Professional (B2B)

- **Role:** Landscape business owner, designer, or salesperson
- **Goal:** Show clients realistic previews of proposed landscaping work to close deals faster and reduce revision cycles
- **Tech comfort:** Moderate — comfortable with phones/tablets, not necessarily technical
- **Device:** Primarily tablets on-site, desktop in the office
- **Pain point:** Currently relies on verbal descriptions, mood boards, or expensive 3D rendering software to communicate vision to clients
- **Value prop:** Snap a photo at a client's property, generate multiple design options on the spot, share a project link with the client afterward

### Secondary: DIY Homeowner (B2C)

- **Role:** Homeowner planning their own landscaping improvements
- **Goal:** See what their yard *could* look like before buying plants, materials, or hiring contractors
- **Tech comfort:** General consumer — expects mobile-first, intuitive experience
- **Device:** Primarily smartphones
- **Pain point:** Guessing what plants/styles will look like, spending money on landscaping that doesn't turn out as imagined
- **Value prop:** Upload a photo, pick a style, see instant results. Low cost, no commitment.

### Admin

- **Role:** System administrator (internal)
- **Goal:** Manage platform settings, curate gallery, monitor usage and revenue
- **Access:** Protected admin area

### Not Building For

- Professional landscape architects who need CAD-level precision, 3D modeling, or construction-grade specifications
- Garden/plant e-commerce — this is not a marketplace
- Project management / CRM for landscaping businesses

---

## 3. Feature Requirements

### P0 — Must Have for Launch

| Feature | Description |
|---------|-------------|
| **Landing Page** | Public marketing page with hero section containing image drop zone for instant onboarding. Possibly separate B2B/B2C variants later. |
| **Auth System** | Supabase Auth with Google OAuth and custom email/password. Email confirmation sent but not required for first generation. |
| **Projects** | Named containers for organizing work. B2B: client name/address. B2C: descriptive name (e.g., "Front porch landscaping"). Full CRUD — create, rename, delete. |
| **Photo Upload** | Camera capture (mobile) or file drop/select. Images tied to active project. Stored in Supabase Storage with auto-generated thumbnails. |
| **AI Generation** | Send photo + compound prompt (style preset + time of day + season + weather + custom text) to Gemini 3.1 Flash Image API. Return generated landscape image. |
| **Style Presets** | 16 curated landscaping aesthetics + "Let me specify" option. Categories: Architectural/Contemporary (3), Traditional/Classic (3), Regional/Climate (4), Lifestyle/Thematic (4), Eco/Low-Maintenance (2). |
| **Generation Settings** | Time of day, time of year (season), weather conditions. Applied to entire image. |
| **Custom Prompt** | Freeform textarea for user-directed input. Specific vegetation, hardscaping, structural requests. |
| **In-Painting** | Drawing canvas for masking specific regions. Finger-based on mobile, pointer on desktop. Zoom support. Masked region targeted by custom prompt only; environment settings apply globally. |
| **Iterative Conversation** | Per-image session allowing re-prompting and setting changes on AI-returned images. Must always allow "start over" reset to original uploaded photo. |
| **Loading State** | Visual loader during AI generation. First-time users see a quick modal during wait to self-identify as landscaper or DIY homeowner. |
| **Image Gallery/History** | Per-project view of all uploaded images and their generation chains. |
| **Shareable Projects** | Public URL per project showing project name, all images, and click-through to each image's generations with prompts/settings. Read-only. Configurable sharing setting per project. |
| **Credit System** | 1 credit = 1 operation (generation, in-paint edit, or re-prompt). Balance tracked per user. Atomic deduction via Supabase DB function. Credits deducted atomically before generation; refunded on failure or content policy rejection. |
| **Free Tier** | 3 credits on signup, no credit card required, full feature access. Count configurable in admin. |
| **Stripe Billing** | Subscription tiers (monthly) + one-time credit packs. Webhook handling with idempotency. |
| **Account Settings** | Change email, update password, view credit balance, manage subscription. |
| **Admin Area** | Protected admin dashboard. Configure free credit count. User management. Usage monitoring. |
| **Public Pages** | FAQ, Contact, Pricing, Terms of Service, Privacy/Terms. |
| **Gallery Page** | Admin-curated showcase of best results. Static/manual — not tied to user-generated content system. |
| **PWA** | Progressive Web App with mobile camera capture support. Installable on iOS/Android. |

### P1 — Important, Post-Launch

| Feature | Description |
|---------|-------------|
| **Separate B2B/B2C Landing Pages** | Tailored messaging and CTAs for each audience segment |
| **Admin Analytics Dashboard** | Revenue metrics, generation counts, user growth, conversion rates (Recharts) |
| **Before/After Comparison** | Slider or toggle to compare original photo with generated result |
| **Batch Generation** | Generate multiple style variations from one photo simultaneously |
| **Favorites/Bookmarks** | Save and organize favorite generations across projects |

### P2 — Nice to Have / Future

| Feature | Description |
|---------|-------------|
| **Plant Identification** | AI identifies existing plants in uploaded photos |
| **Cost Estimation** | Rough cost estimates for proposed landscaping changes |
| **B2B Team Accounts** | Multiple users under one business account with shared projects |
| **White-Label** | Branded version for large landscaping companies |
| **Export/Download** | High-resolution download of generated images, PDF reports |
| **Seasonal Preview** | Show same design across all four seasons automatically |

### Explicit Non-Features

- **3D rendering or CAD tools** — This is a 2D visualization tool, not architectural software
- **Plant marketplace or e-commerce** — Not selling plants, materials, or services
- **Project management / CRM** — Not tracking jobs, invoices, or client communications
- **Contractor matching** — Not connecting homeowners with landscaping services
- **Construction specifications** — Not generating planting plans, measurements, or material lists

---

## 4. User Flows

### 4.1 First-Time User (Onboarding)

```
Landing Page
  → User sees hero section with image drop zone
  → Drops/snaps a photo of their property
  → Photo uploads, triggers "Create Free Account" modal
  → User's photo is preserved during signup
  → User signs up (Google OAuth or email)
  → Auto-login (confirmation email sent, not required yet)
  → Redirected to Generation UI with their photo loaded
  → Default project created automatically (e.g., "My First Project")
  → User sees: their photo + style presets + settings + prompt textarea + submit button
  → User configures and submits
  → Loading state appears
  → During first wait: modal asks "Are you a landscaper or DIY homeowner?"
  → AI returns generated image
  → User can re-prompt/adjust (2 more free credits)
  → After free credits exhausted → shown Pricing page with balance message
```

### 4.2 Primary User Flow (Returning User)

```
Login
  → Dashboard: list of projects
  → Select existing project OR create new project (enter name)
  → Project view: grid of uploaded images
  → Upload new photo OR select existing image
  → If new photo: enters Generation UI with fresh settings
  → If existing image: sees generation history, can continue iterating or start new session
  → Configure settings (preset, time of day, season, weather)
  → Write custom prompt
  → Optionally: use in-painting canvas to mask specific region
  → Submit (1 credit deducted before generation; refunded on failure)
  → AI returns image
  → User can: re-prompt, adjust settings, start over with original, or move to next image
```

### 4.3 In-Painting Flow

```
User is in Generation UI with an image (original or AI-generated)
  → Taps "Edit Region" / in-painting mode
  → Canvas overlay appears with zoom controls
  → User draws mask over target area (finger on mobile, pointer on desktop)
  → Mask highlights the selected region
  → Environment settings (time of day, season, weather) still apply globally
  → User writes prompt specific to the masked area in textarea
  → Submits (1 credit)
  → AI returns image with targeted edit applied
  → User can continue iterating or reset to original
```

### 4.4 Payment Flow

```
User attempts generation with 0 credits
  → Generation blocked (not queued)
  → Message: "You're out of credits" with current balance (0)
  → CTA: "Get More Credits" → Pricing page
  → User selects subscription tier OR one-time credit pack
  → Stripe Checkout
  → On success: credits added to balance immediately
  → User returned to Generation UI, can resume work
```

### 4.5 Project Sharing Flow

```
User opens project settings
  → Enables sharing (toggle or generate link)
  → Public URL generated
  → User copies/sends link to client or friend
  → Recipient opens link (no auth required)
  → Sees: project name, grid of all uploaded images
  → Clicks an image → sees all AI generations for that image
  → Each generation shows the prompt and settings used
  → Read-only — no editing, generating, or downloading (unless specified)
```

### 4.6 Subscription Management

```
User goes to Account Settings → Billing
  → Sees current plan, credit balance, renewal date
  → Can upgrade/downgrade plan
  → Can cancel subscription
  → On cancellation: credits remain until end of billing period
  → Purchased credit pack balances persist regardless of subscription status
```

---

## 5. AI Specification

### Model

**Gemini 3.1 Flash Image (Nano Banana 2)** via Google Gemini API

- Variable resolution up to 4K
- Supports prompt-based image editing and generation
- Multi-turn conversational editing
- Accepts up to 14 reference images (**needs validation during prototyping** — do not build features around multi-reference until confirmed)

### Pricing (Cost to Landscaip)

| Resolution | Standard | Batch |
|-----------|----------|-------|
| 512px | $0.045 | $0.022 |
| 1K | $0.067 | $0.034 |
| 2K | $0.101 | $0.051 |
| 4K | $0.151 | $0.076 |

Input tokens: $0.50 per 1M tokens. No free tier from Google.

### Prompt Construction

When a user submits a generation, the system constructs a compound prompt from:

1. **System context:** "You are a professional landscape designer. Transform the landscaping in this photo while preserving the existing architecture, structures, and non-landscape elements exactly as they appear."
2. **Style preset:** Full description from the 16 presets (e.g., "Japanese Zen: Raked gravel, moss, stone lanterns, maple trees, bamboo accents, water basin")
3. **Environment settings:** Time of day, season, weather conditions
4. **User prompt:** Freeform text from the textarea
5. **In-painting context (if applicable):** "Apply the following changes only to the masked/highlighted region of the image: [user prompt]. Maintain all other areas unchanged."

### Style Presets

**Architectural / Contemporary**
1. Modern Minimalist — Clean lines, geometric planters, ornamental grasses, concrete pavers, restrained palette
2. Contemporary Luxe — Infinity-edge water features, LED landscape lighting, large-format porcelain tiles, sculptural plants
3. Mid-Century Modern — Desert-adapted plants, exposed aggregate, low-profile ground covers, atomic-age hardscape patterns

**Traditional / Classic**
4. English Cottage — Overflowing flower beds, climbing roses, stone pathways, white picket borders, wildflower meadow feel
5. French Formal — Symmetrical hedges, boxwood parterres, gravel paths, lavender rows, fountain centerpiece
6. Colonial Traditional — Manicured lawn, foundation shrubs, brick walkway, seasonal flower beds, classic symmetry

**Regional / Climate**
7. Desert Xeriscape — Drought-tolerant plants, succulents, agave, decomposed granite, boulders, no lawn
8. Tropical Paradise — Palm trees, bird of paradise, lush ferns, pool integration, tiki/resort feel
9. Mediterranean — Olive trees, terracotta pots, stucco walls, lavender, gravel courtyard, warm tones
10. Pacific Northwest — Ferns, mosses, native conifers, rain garden, natural stone, green-on-green layering

**Lifestyle / Thematic**
11. Japanese Zen — Raked gravel, moss, stone lanterns, maple trees, bamboo accents, water basin
12. Farmhouse Rustic — Raised garden beds, wildflowers, reclaimed wood borders, herb garden, gravel drive
13. Entertainer's Yard — Outdoor kitchen, fire pit, string lights, lounge seating, turf lawn, privacy screening
14. Kid-Friendly — Play areas with soft landscaping, shade trees, wide open lawn, stepping stone paths, no thorny plants

**Eco / Low-Maintenance**
15. Native Wildscape — All native plants, pollinator garden, no irrigation, meadow aesthetic, natural habitat
16. Low-Maintenance Evergreen — Year-round structure, evergreen shrubs, mulched beds, minimal pruning, automated irrigation

**17. None — "Let me specify"** (user provides all direction via prompt textarea)

### Known Considerations

- **Architecture preservation:** The AI must maintain the existing house structure, driveway, and non-landscape elements. This is the most critical quality requirement.
- **In-painting support:** Gemini supports prompt-based image editing. Whether it accepts pixel-level mask images (vs. only text-based region descriptions) needs validation during prototyping.
- **Content policy:** Landscape imagery is unlikely to trigger content policy issues, but edge cases (e.g., images with people, vehicles, or structures that look like something else) should be handled gracefully with user-friendly error messages.
- **Consistency:** Generated images should maintain photorealistic quality consistent with the original photo's lighting, perspective, and camera angle.

---

## 6. Data Model

### Core Entities

| Entity | Description |
|--------|-------------|
| **User** | Authenticated user with profile, credit balance, user type, and subscription status |
| **Project** | Named container for organizing images. Belongs to a user. Can be shared via public URL. |
| **Image** | User-uploaded photo of their property. Belongs to a project. Stored in Supabase Storage with thumbnail. |
| **Generation** | AI-generated output image linked to a source image. Stores prompt, settings, and result. |
| **Credit Transaction** | Ledger entry tracking credit additions (purchase, subscription, free tier) and deductions (generations). |
| **Subscription** | Stripe subscription record linked to user. Tracks plan, status, and billing period. |
| **Gallery Item** | Admin-curated entry for the public gallery page. References a generation or stores a standalone image with caption/metadata. |

### Entity Relationships

```
User (1) ──── (many) Project
Project (1) ──── (many) Image
Image (1) ──── (many) Generation
User (1) ──── (many) Credit Transaction
User (1) ──── (0..1) Subscription
```

### File Storage (Supabase Storage / S3-Compatible)

```
storage/
├── uploads/
│   └── {user_id}/
│       └── {project_id}/
│           └── {image_id}.{ext}          # Original uploaded photo
├── thumbnails/
│   └── {user_id}/
│       └── {project_id}/
│           └── {image_id}_thumb.webp     # Auto-generated thumbnail
├── generations/
│   └── {user_id}/
│       └── {project_id}/
│           └── {generation_id}.webp      # AI-generated result
```

**Masks:** Handled client-side only. No server-side storage required — the mask data is translated into prompt context before the API call.

### Data Ownership

- All data is per-user. No shared editing.
- Projects can be shared via public URL (read-only).
- Shared view exposes: project name, images, generations, prompts, and settings.
- Admin can view all users and usage data.

---

## 7. Authentication & Authorization

### Auth Provider

**Supabase Auth** with:
- Google OAuth (social login)
- Custom email/password
- Email confirmation sent on signup but NOT required for first generation

### User Types

| Type | Description | Access |
|------|-------------|--------|
| **Landscaper** | B2B professional user | Full app access, all features |
| **Homeowner** | B2C DIY user | Full app access, all features |
| **Admin** | Internal administrator | Full app access + admin area |

User type is collected via modal popup during first generation wait. Stored in user profile. Landscaper and Homeowner have identical permissions — the distinction is for analytics, marketing segmentation, and future feature differentiation.

### Route Protection

| Route | Access |
|-------|--------|
| `/` (Landing Page) | Public |
| `/gallery` | Public |
| `/faq` | Public |
| `/contact` | Public |
| `/pricing` | Public |
| `/login`, `/signup` | Public |
| `/terms`, `/privacy` | Public |
| `/share/{project_id}` | Public (read-only project view) |
| `/dashboard` | Authenticated |
| `/project/{id}` | Authenticated (owner only) |
| `/generate` | Authenticated |
| `/account` | Authenticated |
| `/admin/*` | Authenticated + Admin role |

### Security Rules

- All Gemini API calls are server-side only (Next.js API routes / server actions). No API keys on the client.
- Supabase Row Level Security (RLS) enforces data ownership — users can only access their own projects, images, and generations.
- Admin routes protected by role check at both middleware and database levels.
- Rate limiting on generation endpoints to prevent abuse.
- Stripe webhook signature verification on all webhook handlers.

---

## 8. Monetization

### Pricing Philosophy

Everything costs 1 credit. No variable pricing. Simple and predictable for users.

- 1 full generation = 1 credit
- 1 in-painting edit = 1 credit
- 1 re-prompt iteration = 1 credit

### Free Tier

- **3 credits** on signup (admin-configurable)
- No credit card required
- Full feature access — no feature gating
- Purpose: Let users experience full value before purchasing

### Subscription Tiers (Monthly)

| Plan | Price | Credits | Target |
|------|-------|---------|--------|
| Starter | $19/mo | 50 credits | Light B2B use, active B2C |
| Pro | $39/mo | 150 credits | Regular B2B landscapers |
| Business | $79/mo | 400 credits | High-volume B2B |

- Unused subscription credits roll over for **1 month** (then expire)
- Subscribers can purchase top-up credit packs at any time
- On cancellation: remaining subscription credits stay active until end of billing period

### One-Time Credit Packs

| Pack | Price | Credits | Per-Credit Cost |
|------|-------|---------|----------------|
| Quick Start | $5 | 10 credits | $0.50 |
| Project Pack | $15 | 40 credits | $0.375 |
| Power Pack | $29 | 100 credits | $0.29 |

- Purchased credits do not expire (**Open Question:** or 12-month expiry?)
- Persist regardless of subscription status

### Margin Analysis

At ~$0.067/generation (1K resolution), Landscaip's cost per credit is well below the lowest per-credit revenue ($0.29 for Power Pack), yielding healthy margins:

| Pack/Plan | Revenue/Credit | Cost/Credit | Gross Margin |
|-----------|---------------|-------------|-------------|
| Quick Start | $0.50 | ~$0.07 | ~86% |
| Project Pack | $0.375 | ~$0.07 | ~81% |
| Power Pack | $0.29 | ~$0.07 | ~76% |
| Starter | $0.38 | ~$0.07 | ~82% |
| Pro | $0.26 | ~$0.07 | ~73% |
| Business | $0.20 | ~$0.07 | ~65% |

### Edge Cases

1. **Insufficient credits:** Block generation before dispatch. Show balance + pricing page CTA. Never queue unpaid work.
2. **Failed generation (API error/timeout):** Credit is refunded automatically (deducted before dispatch, refunded on failure). User can retry.
3. **Content policy rejection:** Credit is refunded automatically. Show user-friendly error with guidance to adjust prompt.
4. **Credit deduction atomicity:** Supabase Postgres function with `SELECT ... FOR UPDATE` row-level locking. Single transaction: check balance → deduct → return success/failure.
5. **Race conditions:** Row-level locking prevents concurrent requests from double-spending. If AI call fails after deduction, a compensating `refund_credit` function re-credits.
6. **Stripe webhook idempotency:** `processed_events` table stores Stripe event IDs. Check before processing; skip duplicates. Insert + process in a single transaction.
7. **Subscription cancellation:** Credits remain until billing period ends. Purchased pack credits persist.
8. **Duplicate webhook events:** Idempotent handling — `checkout.session.completed` firing twice won't double-credit.

---

## 9. Technical Architecture

### Stack

| Layer | Technology |
|-------|-----------|
| Frontend / Fullstack | Next.js (App Router) + Tailwind CSS |
| Database + Auth | Supabase (Postgres + Auth + RLS) |
| File Storage | Supabase Storage (S3-compatible) |
| Payments | Stripe (Checkout, Subscriptions, Webhooks) |
| AI | Gemini 3.1 Flash Image API (Nano Banana 2) |
| Deployment | Vercel |
| PWA | Service worker + web manifest for installability + camera capture |
| Admin Charts | Recharts (TBD) |

### MCP Servers

- **Supabase** — Database operations, auth management, storage
- **Stripe** — Payment processing, subscription management
- **Context7** — Up-to-date documentation reference
- **Vercel** — Deployment and hosting management

### Key Architecture Decisions

1. **Server-side AI calls only:** All Gemini API interactions happen in Next.js API routes / server actions. No API keys exposed to the client.
2. **Atomic credit deduction:** Postgres function handles balance check + deduction in a single locked transaction.
3. **Deduct-before-generate, refund-on-failure:** Credit is deducted atomically before dispatching the AI call. If the API call fails, a compensating `refund_credit` function re-credits the user.
4. **Supabase RLS:** Row Level Security policies enforce data isolation at the database level — defense in depth beyond application-level checks.
5. **Supabase Storage:** Leverages S3-compatible storage integrated with Supabase auth for simplified access control.
6. **Client-side masking:** In-painting mask data is generated on the client and translated to prompt context. No mask storage server-side.

### Security Constraints

- All API keys stored as environment variables, server-side only
- Supabase service role key used only in server-side code
- Stripe webhook signature verification on all endpoints
- Rate limiting on generation and auth endpoints
- CORS restricted to application domain
- Input sanitization on all user-provided prompts

See [docs/architecture.md](./architecture.md) for detailed technical architecture, database schema, and API routes.

---

## 10. Design & UX

### Visual Direction

- **Mode:** Light mode by default
- **Background:** White (`#FFFFFF`)
- **Primary color:** Green `#0F8000`
- **Style:** Simplistic, clean, uncluttered
- **Feel:** Professional but approachable — a tool that landscaping pros trust but homeowners find easy

### Responsive Strategy

- **Mobile-first** — Primary use case is homeowners on phones and landscapers on tablets
- **Fully responsive** — Must look polished on phones, tablets, and desktop
- **Breakpoints:** Phone (< 640px), Tablet (640–1024px), Desktop (> 1024px)
- **Camera capture:** PWA integration for native-feeling photo capture on mobile

### Key UI Components

| Component | Description |
|-----------|-------------|
| **Image Drop Zone** | Hero section on landing page. Drag-and-drop or tap-to-capture. |
| **Generation UI** | Main workspace: uploaded image + settings panel + prompt textarea + submit. |
| **Style Preset Selector** | Visual grid or list of 17 presets with descriptions. |
| **Settings Controls** | Time of day, season, weather — dropdowns or segmented controls. |
| **In-Painting Canvas** | Drawing overlay with zoom. Finger/pointer masking. Clear/undo controls. |
| **Generation History** | Timeline or grid of iterations for each image session. |
| **Project Dashboard** | Card grid of projects with thumbnails and metadata. |
| **Pricing Page** | Subscription tiers + credit packs with clear CTA. |
| **Shared Project View** | Public read-only gallery layout. |
| **Admin Dashboard** | User management, settings, usage stats. |

### Accessibility

- Semantic HTML throughout
- Keyboard navigable
- Sufficient color contrast (especially with `#0F8000` on white)
- Alt text for generated images
- Touch targets minimum 44x44px for mobile

---

## 11. MVP Scope

> **Note:** MVP scope was not explicitly defined by the product owner. The following is a recommended MVP based on P0 features and onboarding flow requirements.

### MVP Definition (Recommended)

The minimum viable product that delivers value to both B2B and B2C users:

1. Landing page with image drop zone for instant onboarding
2. Auth (Google OAuth + email/password via Supabase)
3. Projects (create, rename, delete)
4. Photo upload (camera capture + file upload)
5. AI generation with all 17 style presets + settings + custom prompt
6. Iterative conversation per image (re-prompt, adjust settings)
7. "Start over" reset to original image
8. In-painting canvas with mask + targeted prompts
9. Credit system (3 free + Stripe billing)
10. All subscription tiers + credit packs
11. Account settings
12. Shareable project URLs
13. Public pages (landing, pricing, FAQ, contact, TOS, privacy)
14. Admin area (configurable free credits, basic user management)
15. PWA with mobile camera capture

### Success Metrics (Recommended)

| Metric | Target | Why |
|--------|--------|-----|
| Signups (first 30 days) | 500+ | Validates demand |
| Free → paid conversion | > 10% | Validates pricing model |
| Generations per user (first session) | 3+ (use all free credits) | Validates core value |
| Day-7 retention | > 20% | Validates stickiness |
| Monthly recurring revenue | Track growth | Validates B2B subscription model |
| Average generations per paying user | Track monthly | Informs tier pricing |

---

## 12. Risks & Open Questions

### Open Questions

1. **Credit expiry for purchased packs:** Never expire vs. 12-month expiry? (Impacts accounting and liability)
2. **Separate B2B/B2C landing pages:** When to implement? How different are they?
3. **Gemini mask support:** Does the Gemini 3.1 Flash Image API accept pixel-level mask images, or only text-based region descriptions? This fundamentally affects in-painting implementation.
4. **Admin charts library:** Recharts is the leading candidate but not confirmed.
5. **Image resolution for generations:** What resolution should we default to? 1K is the sweet spot for cost vs. quality but needs testing.
6. **Sharing settings:** The user mentioned "There should be a setting i..." (incomplete). Need to clarify what sharing controls exist per project.
7. **Gallery curation workflow:** How does the admin curate the public gallery? Manual image selection? Is it just a static page?

### Technical Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Gemini API doesn't support mask-based in-painting | Core feature compromised | Prototype early. Fallback: translate client-side masks to text descriptions of regions. |
| AI distorts house architecture | Poor user experience, low trust | Strong system prompts emphasizing structure preservation. Add quality checks. Allow easy "start over." |
| PWA camera inconsistencies across iOS/Android | Mobile UX broken | Test extensively on Safari iOS and Chrome Android. Fallback to file upload. |
| Stripe subscription + credits hybrid complexity | Billing bugs, double-crediting | Idempotent webhooks, atomic transactions, comprehensive integration tests. |
| Gemini API rate limits | Users experience delays during peak | Implement queuing, show estimated wait times, consider batch API for non-urgent generations. |
| Supabase Storage performance for large images | Slow uploads/loads | Implement client-side image compression before upload. Generate thumbnails server-side. CDN for delivery. |

### Assumptions

1. Gemini 3.1 Flash Image can reliably preserve house/structure architecture while modifying only landscaping — this is the entire product premise.
2. B2B landscapers will pay $19–79/month for a visualization tool that helps close deals.
3. The quality difference between AI-generated landscaping and reality is acceptable for planning/sales purposes (not expected to be photorealistic to the pixel).
4. Users will find iterative prompting intuitive enough to get good results within 2-3 attempts.
5. Mobile camera capture via PWA provides a sufficient experience compared to a native app.

---

*This document should be treated as a living artifact. Update it as decisions are made and assumptions are validated.*
