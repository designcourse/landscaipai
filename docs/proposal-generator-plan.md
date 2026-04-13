# Proposal Generator — Implementation Plan

> **Status:** Planned, not yet started.
> **Surface:** Claude Managed Agents (`managed-agents-2026-04-01` beta) with the prebuilt `pdf` Skill.
> **Target users:** `Landscaper` user type only.
> **Cadence:** Two stacked PRs (see [PR breakdown](#pr-breakdown)).

## Goal & scope

Ship a feature that lets Landscaper users generate a branded PDF proposal from the contents of a Landscaip project. The proposal walks through one or more **sections** (each with a before/after photo pair, item list, and price), and optionally includes a per-plant care guide referencing the project's hardiness zone.

The agent framework is chosen deliberately to leave runway for non-deterministic features later — vision-assisted section naming, item detection from after-images, web-search-augmented pricing, multi-style narrative drafts. None of those ship in v1; the architecture just doesn't preclude them.

### In scope (v1)

- Multi-section authoring UI in a modal, launched from the canvas
- Two-stage image picker (seed → descendant generation)
- Library item picker (reusing the existing plant/hardscape browser) + free-text custom items
- Per-section pricing with a running cumulative total
- Hardiness zone editing per-document (defaults from `projects.hardiness_zone`)
- Optional per-plant care guide, zone-aware, hardscape excluded
- PDF output via Managed Agents + `pdf` Skill, stored in Supabase Storage
- `/proposals` list page, `/proposals/[id]` detail page with download/status/delete
- Manual status toggling: `draft → sent → accepted → paid → void`

### Out of scope (v2+, noted in CLAUDE.md as future work)

- Email sending (Resend integration, "Send to client" CTA)
- Vision-assisted section naming or item detection
- Web-search-augmented care guide ("Premium care guide" toggle)
- Multi-image-pair sections (multiple before/after pairs in one section)
- Stripe Connect payment links inside the PDF
- Recurring or cloned proposals
- Templates / brand themes
- Proposal-to-invoice conversion (when a proposal is accepted)

## Architecture overview

```
   ┌─────────────────────────────────────────────────────────────────┐
   │ Canvas → "Generate Proposal" (3-dot menu, landscaper-only)      │
   └──────────────────────────────┬──────────────────────────────────┘
                                  ↓
   ┌─────────────────────────────────────────────────────────────────┐
   │ <ProposalModal>                                                 │
   │  Step 1: Client info                                            │
   │  Step 2: Hardiness zone (editable, document-scoped)             │
   │  Step 3: Sections (1+ sections, accumulative total)             │
   │           - Image picker (two-stage: seed → descendant)         │
   │           - Items panel (library + custom)                      │
   │           - Section price                                       │
   │  Step 4: Include care guide checkbox                            │
   │  Autosaves to project_documents draft on each step              │
   └──────────────────────────────┬──────────────────────────────────┘
                                  ↓ POST /api/proposals/[id]/generate
   ┌─────────────────────────────────────────────────────────────────┐
   │ Generation route (Node, maxDuration: 300)                       │
   │  1. Auth + validate draft                                       │
   │  2. Deduct credit (atomic via deduct_credit())                  │
   │  3. client.beta.sessions.create() → session_id                  │
   │  4. Return { session_id }                                       │
   └──────────────────────────────┬──────────────────────────────────┘
                                  ↓ GET /api/proposals/[id]/stream
   ┌─────────────────────────────────────────────────────────────────┐
   │ Stream route (Node, SSE)                                        │
   │  1. Open beta.sessions.events.stream() FIRST                    │
   │  2. Send kickoff user.message                                   │
   │  3. For each event:                                             │
   │      - Forward agent.message/thinking/status to browser as SSE  │
   │      - On agent.custom_tool_use: dispatch + send tool_result    │
   │  4. Break on session_terminated OR idle with terminal stop      │
   │  5. On error: refund credit, mark draft errored                 │
   └──────────────────────────────┬──────────────────────────────────┘
                                  ↓ Custom tool round-trips
   ┌─────────────────────────────────────────────────────────────────┐
   │ Anthropic Managed Agents container                              │
   │  - Pulls payload via get_proposal_payload                       │
   │  - Generates care guide text per unique plant                   │
   │  - pdf Skill renders /mnt/session/outputs/proposal.pdf          │
   │  - Calls save_proposal_output to signal completion              │
   └─────────────────────────────────────────────────────────────────┘
```

Two custom tools, both host-side:

- **`get_proposal_payload(document_id)`** — host fetches `project_documents` + joined `company_settings` + all referenced `library_items` + signed-URL-fetched-and-base64-encoded images. Returns one big JSON blob.
- **`save_proposal_output(document_id, document_number)`** — host fetches the PDF from `/mnt/session/outputs/proposal.pdf` via Files API (with brief poll for indexing lag), uploads to Supabase Storage `proposal-pdfs` bucket, updates the `project_documents` row with `pdf_path`, returns success. Errors propagate back to the agent so it can retry.

## Schema

One migration: `supabase/migrations/20260409000001_proposal_foundation.sql`

```sql
-- project_documents: holds the proposal draft + final state
CREATE TABLE project_documents (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id         uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  document_number    text,                           -- assigned at generation, not draft
  status             text NOT NULL DEFAULT 'draft',  -- draft|generating|ready|sent|accepted|paid|void|error

  -- Client (per-document, not stored on project)
  client_name        text,
  client_email       text,
  client_address     text,

  -- Document config
  hardiness_zone     text,                           -- pre-filled from project, document-scoped edit
  include_care_guide boolean NOT NULL DEFAULT false,

  -- Sections array — see ProposalSection JSON shape in src/types/proposal.ts
  sections           jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_amount       numeric(10,2) NOT NULL DEFAULT 0,

  -- Generation artifacts
  pdf_path           text,
  agent_session_id   text,
  error_message      text,

  issue_date         date,                           -- set at generation
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_documents_user_created ON project_documents (user_id, created_at DESC);
CREATE INDEX idx_project_documents_project ON project_documents (project_id);

-- RLS
ALTER TABLE project_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own their documents" ON project_documents
  FOR ALL USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

-- updated_at trigger (mirror existing pattern)
CREATE TRIGGER set_updated_at BEFORE UPDATE ON project_documents
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- Per-landscaper document counter on profiles
ALTER TABLE profiles ADD COLUMN proposal_counter integer NOT NULL DEFAULT 0;

-- Function: atomically increment + format the next document number
CREATE OR REPLACE FUNCTION next_proposal_number(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_counter integer;
  v_year text;
BEGIN
  v_year := to_char(current_date, 'YYYY');
  UPDATE profiles
    SET proposal_counter = proposal_counter + 1
    WHERE id = p_user_id
    RETURNING proposal_counter INTO v_counter;
  RETURN 'PRO-' || v_year || '-' || lpad(v_counter::text, 4, '0');
END;
$$;

-- Extend company_settings with the three remaining branding fields
ALTER TABLE company_settings ADD COLUMN business_address text;
ALTER TABLE company_settings ADD COLUMN business_email text;
ALTER TABLE company_settings ADD COLUMN tax_id text;
```

**Storage bucket** `proposal-pdfs` — private, RLS scoped to `auth.uid() = (storage.foldername(name))[1]::uuid`. Path pattern: `<user_id>/<document_id>.pdf`. Same pattern as the existing `generations` bucket.

### TypeScript types

Lives in `src/types/proposal.ts`, re-exported from `src/types/index.ts`.

```ts
export type SectionItem =
  | { type: 'library'; library_item_id: string; snapshot_name: string }
  | { type: 'custom'; name: string }

export interface ProposalSection {
  id: string                       // client-generated nanoid
  name: string
  before_image_id: string | null   // images.id
  after_generation_id: string | null  // generations.id
  items: SectionItem[]
  price: number                    // decimal, ≥ 0
}

export type ProposalStatus =
  | 'draft' | 'generating' | 'ready'
  | 'sent' | 'accepted' | 'paid' | 'void' | 'error'

export interface ProjectDocument {
  id: string
  user_id: string
  project_id: string
  document_number: string | null
  status: ProposalStatus
  client_name: string | null
  client_email: string | null
  client_address: string | null
  hardiness_zone: string | null
  include_care_guide: boolean
  sections: ProposalSection[]
  total_amount: number
  pdf_path: string | null
  agent_session_id: string | null
  error_message: string | null
  issue_date: string | null
  created_at: string
  updated_at: string
}
```

## Agent configuration (one-time setup)

`scripts/setup-proposal-agent.ts` — run locally once with a real `ANTHROPIC_API_KEY`, prints IDs to paste into Vercel env.

```ts
import Anthropic from '@anthropic-ai/sdk'
import { PROPOSAL_SYSTEM_PROMPT } from '../src/lib/anthropic/proposal-prompt'

const client = new Anthropic()

const env = await client.beta.environments.create({
  name: 'landscaip-proposal-env',
  config: { type: 'cloud', networking: { type: 'unrestricted' } },
})

const agent = await client.beta.agents.create({
  name: 'landscaip-proposal-generator',
  model: 'claude-opus-4-6',
  system: PROPOSAL_SYSTEM_PROMPT,
  tools: [
    { type: 'agent_toolset_20260401', default_config: { enabled: true } },
    {
      type: 'custom',
      name: 'get_proposal_payload',
      description: 'Fetch the full proposal data: branding, client info, sections with image data, library item details, hardiness zone. Call once at the start.',
      input_schema: {
        type: 'object',
        properties: { document_id: { type: 'string' } },
        required: ['document_id'],
      },
    },
    {
      type: 'custom',
      name: 'save_proposal_output',
      description: 'Call after the PDF is written to /mnt/session/outputs/proposal.pdf. Triggers host-side upload and marks the document complete.',
      input_schema: {
        type: 'object',
        properties: {
          document_id: { type: 'string' },
          document_number: { type: 'string' },
        },
        required: ['document_id', 'document_number'],
      },
    },
  ],
  skills: [{ type: 'anthropic', skill_id: 'pdf' }],
})

console.log('ANTHROPIC_PROPOSAL_ENV_ID=' + env.id)
console.log('ANTHROPIC_PROPOSAL_AGENT_ID=' + agent.id)
console.log('ANTHROPIC_PROPOSAL_AGENT_VERSION=' + agent.version)
```

### System prompt

Stored as a constant in `src/lib/anthropic/proposal-prompt.ts`:

> You are a professional proposal generator for landscaping companies. You produce polished, branded PDF proposals from structured project data.
>
> **Workflow (always in this order):**
> 1. Call `get_proposal_payload` with the document_id from the user message.
> 2. Use the `pdf` Skill to compose a single PDF at `/mnt/session/outputs/proposal.pdf` with this structure:
>    - **Cover page**: company logo, name, business address, phone, email; "PROPOSAL" header with document_number and issue_date; bill-to client block; hardiness zone notation; pricing summary table (section name → price → total).
>    - **Section pages** (one per section, multiple per page only if they fit cleanly): section name as heading; before/after images side-by-side, captioned; "Includes:" bulleted list of items (library items by snapshot_name, custom items by name); section price.
>    - **Care Guide pages** (only if `include_care_guide` is true): heading "Care Guide for Zone {hardiness_zone}". For each unique plant across all sections (deduped by library_item_id, hardscape items excluded entirely): high-resolution plant image; common name + scientific name; structured facts (sun requirement, water needs, growth rate, maintenance level, mature dimensions); 3-5 sentences of practical, zone-specific care advice that you write yourself, grounded in the plant's database attributes and the hardiness zone. Cover when to water, when to prune, winter protection, and common issues.
>    - **Closing**: the company's `default_note` from branding.
> 3. After the file exists, call `save_proposal_output(document_id, document_number)` with the document_number from the payload.
>
> **Constraints:**
> - Use only data from the payload. Do not invent prices, items, or plant facts.
> - Section prices are at the section level only — never break down items into line-item pricing.
> - Hardscape items (`item_type: "hardscape"`) appear in section item lists but never in the care guide.
> - Custom items appear in section item lists but never in the care guide.
> - If `get_proposal_payload` returns missing or malformed data, stop and explain what's missing — do not generate a partial PDF.
> - Care guide writing should be practical and actionable for a homeowner, not generic — reference the actual hardiness zone in your advice.

### Kickoff message

Sent from the stream route after the SSE connection is open:

```
Generate the proposal for document_id={id}. Begin by calling get_proposal_payload.
```

## Custom tool contracts

### `get_proposal_payload` response

Built host-side in `src/lib/anthropic/payload-builder.ts`:

```ts
{
  document_id: string
  document_number: string         // freshly generated via next_proposal_number()
  issue_date: string              // YYYY-MM-DD, set now
  hardiness_zone: string
  include_care_guide: boolean
  company: {
    name: string
    phone: string | null
    business_address: string | null
    business_email: string | null
    tax_id: string | null
    logo_b64: string | null       // data URI
    default_note: string | null
  }
  client: {
    name: string
    email: string | null
    address: string | null
  }
  sections: Array<{
    id: string
    name: string
    before_image_b64: string      // data URI
    after_image_b64: string       // data URI
    items: Array<
      | {
          type: 'library'
          library_item_id: string
          snapshot_name: string
          common_name: string
          scientific_name: string
          item_type: 'plant' | 'hardscape'
          category: string
          // Plant-only fields (null for hardscape)
          sun_requirement: string | null
          water_needs: string | null
          growth_rate: string | null
          maintenance_level: string | null
          height_min: number | null
          height_max: number | null
          spread_min: number | null
          spread_max: number | null
          drought_tolerant: boolean | null
          deer_resistant: boolean | null
          attracts_pollinators: boolean | null
          // Always
          image_b64: string | null  // high-res library item image
        }
      | { type: 'custom'; name: string }
    >
    price: number
  }>
  total: number
}
```

The host route's responsibilities, in order:
1. Load `project_documents` row + joined `company_settings`.
2. For each section, download the before-image (from `images` storage bucket) and after-generation (from `generations` storage bucket) via signed URLs, encode to base64.
3. For each library item in any section, join to `library_items` and download its high-res image, encode to base64.
4. Call `next_proposal_number(user_id)` exactly once to assign the document_number, persist it on the row, and include it in the payload.
5. Set `issue_date` and persist it.

### `save_proposal_output` handler

1. Polls `client.beta.files.list({ scope: session_id })` for `proposal.pdf` (up to 5 retries, 500ms apart, to absorb the 1-3s indexing lag).
2. Downloads the file via `client.beta.files.download(file_id)`.
3. Uploads to Supabase Storage at `proposal-pdfs/<user_id>/<document_id>.pdf`.
4. Updates the row: `pdf_path`, `status: 'ready'`.
5. Returns `{ success: true }`.

If any step fails, returns `{ success: false, error: <message> }` so the agent sees it and can retry.

## API surface

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/proposals/draft` | Create a new draft (returns `id`) |
| `PATCH` | `/api/proposals/[id]/draft` | Autosave updates while user fills the modal |
| `GET` | `/api/proposals/[id]` | Fetch a document with signed PDF URL if ready |
| `POST` | `/api/proposals/[id]/generate` | Auth + validate + deduct credit + create session, return `{ session_id }` |
| `GET` | `/api/proposals/[id]/stream?session_id=X` | SSE proxy + agent orchestration (handles tool dispatch) |
| `POST` | `/api/proposals/[id]/status` | Status toggle (sent / accepted / paid / void) |
| `DELETE` | `/api/proposals/[id]` | Delete row + storage file |
| `GET` | `/api/proposals` | List for current landscaper, paginated |

### Stream route — critical implementation rules

Straight from the Managed Agents client patterns doc. Get any of these wrong and the feature flakes intermittently.

1. **Stream-first**: open `events.stream()` before sending the kickoff `user.message` (Pattern 7).
2. **Reconnect-safe**: on initial open, also fetch `events.list()` and dedupe by event id (Pattern 1) — handles SSE drops without losing events.
3. **Idle gate**: do NOT break on bare `session.status_idle`. Only break on `session.status_terminated` OR idle with `stop_reason.type !== 'requires_action'` (Pattern 5). The session goes idle transiently while waiting on a custom tool result.
4. **Custom tool round-trip**: when an `agent.custom_tool_use` event arrives, dispatch the matching handler, then send a `user.custom_tool_result` event with `tool_use_id: event.id` (NOT a `toolu_*` id — it's `event.id`, typically `sevt_*`).
5. **On terminal failure**: refund the credit via the existing `refund_credit()` function and mark the document `status: 'error'` with the error message.

## UI components

```
src/components/proposal/
  proposal-modal.tsx              -- multi-step orchestrator
  client-info-step.tsx            -- step 1
  hardiness-zone-field.tsx        -- step 2 (also lives inline)
  section-editor.tsx              -- one section card
  image-picker-modal.tsx          -- two-stage before/after picker
  section-items-panel.tsx         -- library + custom item list
  add-custom-item-input.tsx       -- inline text → custom item
  running-total-bar.tsx           -- sticky bottom bar
  generate-cta.tsx                -- final CTA + validation summary
  generation-progress-modal.tsx   -- SSE consumer, status messages
  proposal-list.tsx               -- /proposals page table
  proposal-detail-card.tsx        -- /proposals/[id] view
```

### Two-stage image picker (the most novel piece)

- **Stage 1**: grid of `images` rows for the project, sorted newest first. Click selects the seed.
- **Stage 2**: enabled after stage 1. Grid of `generations` rows where `image_id = <seed_id>` AND `user_id = <me>`, sorted newest first. (This assumes `generations.image_id` is propagated through the parent chain — verify during PR1. If not, walk `parent_generation_id` recursively.)
- Both stages: thumbnails come from existing signed-URL helpers in `src/lib/utils/storage.ts`.
- Modal can be opened in "before mode" or "after mode" — controlled by props from `<SectionEditor>`.

### Library item picker

Reuse the existing plant/hardscape browser slide-over from the canvas. Add a `mode: 'select'` prop that returns chosen items via callback instead of inserting them into the canvas. One file change in the existing browser, additive.

### Canvas integration

Add a "Generate Proposal" entry to the canvas 3-dot menu, gated by `useUser().profile?.user_type === 'landscaper'`. Mirrors the existing "Finalize Video" entry pattern.

> **Possible alternative entry point**: the canvas toolbar (project-level action) instead of the per-card 3-dot menu. A project has many cards but only one project-level "Generate Proposal" action — toolbar might be more discoverable. Decide during PR1 implementation.

### Navbar

Add "Proposals" link to the dropdown menu, landscaper-only (same gating).

## File layout summary

```
NEW
  scripts/setup-proposal-agent.ts
  supabase/migrations/20260409000001_proposal_foundation.sql
  src/types/proposal.ts
  src/lib/anthropic/
    client.ts
    proposal-prompt.ts
    payload-builder.ts
    save-output.ts
    stream-handler.ts
  src/app/api/proposals/
    route.ts
    draft/route.ts
    [id]/route.ts
    [id]/draft/route.ts
    [id]/generate/route.ts
    [id]/stream/route.ts
    [id]/status/route.ts
  src/app/(protected)/proposals/page.tsx
  src/app/(protected)/proposals/[id]/page.tsx
  src/components/proposal/*.tsx (12 files — see UI components above)

MODIFIED
  package.json (add @anthropic-ai/sdk)
  src/types/index.ts (re-export from proposal.ts)
  src/components/account/account-settings.tsx (add 3 fields)
  src/components/generate/canvas-image-card.tsx (add 3-dot menu entry, gated)
  src/components/shared/navbar-client.tsx (add Proposals link, gated)
  src/lib/utils/storage.ts (add base64-encoding helper if not present)
  CLAUDE.md (document agent setup, new env vars, new tables)
```

## PR breakdown

### PR1 — Authoring foundation (no agent yet)

Everything the landscaper sees and does *before* clicking "Generate." Ships independently as an end-to-end demoable feature even without the agent — landscaper can build and save a proposal draft, just can't render it yet.

**Includes:**
- Migration (`project_documents`, `next_proposal_number()`, RLS, storage bucket, `company_settings` extension)
- Types in `src/types/proposal.ts`
- Account settings extension (3 new fields)
- Install `@anthropic-ai/sdk` (just the dep — no agent code yet)
- All proposal modal components (`<ProposalModal>` through `<RunningTotalBar>`)
- Two-stage image picker (with the `image_id` flat-query verification)
- Library item picker reuse hook
- Custom item input
- Canvas 3-dot menu entry (gated)
- Navbar Proposals link (gated, but `/proposals` page is empty stub)
- API routes: `POST /api/proposals/draft`, `PATCH /api/proposals/[id]/draft`, `GET /api/proposals/[id]`, `DELETE /api/proposals/[id]`, `GET /api/proposals`
- The `<GenerationProgressModal>` is stubbed — clicking "Generate Proposal" shows a "Coming soon" toast

**Acceptance for PR1:**
- Landscaper can build a complete multi-section proposal with library + custom items, set price, set hardiness zone, toggle care guide, autosave persists across reloads
- Validation shows what's incomplete before generation is allowed
- Account settings round-trip the new branding fields
- RLS verified: cross-user access blocked
- Build passes, no broken canvas flows

### PR2 — Agent integration + management

Layered on top of PR1. Wires up the actual Claude Managed Agents flow and the post-generation management surfaces.

**Includes:**
- `scripts/setup-proposal-agent.ts` (one-time, run before deploying PR2)
- Document the setup script + new env vars in CLAUDE.md
- `src/lib/anthropic/` modules: client, prompt, payload-builder, save-output handler, stream-handler
- API routes: `POST /api/proposals/[id]/generate`, `GET /api/proposals/[id]/stream`, `POST /api/proposals/[id]/status`
- Wire `<GenerationProgressModal>` to the SSE stream — replace the "Coming soon" toast
- `/proposals` page list view (table)
- `/proposals/[id]` detail page (download, status toggle, delete)
- Credit deduction + refund integration
- Error states and retry button
- New env vars on Vercel: `ANTHROPIC_API_KEY`, `ANTHROPIC_PROPOSAL_AGENT_ID`, `ANTHROPIC_PROPOSAL_ENV_ID`, `PROPOSAL_CREDIT_COST` (default 3)

**Acceptance for PR2:**
- Real end-to-end run from a real landscaper account produces a real PDF saved to Supabase Storage
- Care guide enabled vs disabled both work
- A test proposal with a hardscape-only section produces a PDF with no care guide section even when checkbox is on
- Credit deducted on success, refunded on failure
- Stream reconnect works (test by killing the dev tab mid-generation and reopening)
- Error path: agent failure shows clear message + refunds credit
- Status toggle works on the detail page
- Delete removes both the row and the storage file

## Risks and verification points

These are the spots most likely to bite. Verify them when you hit each one rather than blocking the plan on them.

1. **`generations.image_id` propagation.** Plan assumes `image_id` is set on every descendant generation, not just direct-from-seed. If the canvas-workspace code doesn't propagate it when creating a new generation from a parent generation, the picker query needs to walk `parent_generation_id` instead. **Check during PR1's image picker work.** A 5-line SQL test against any project with iterated generations resolves it.
2. **Pre-built `pdf` Skill availability.** Confident from the docs that `{type: "anthropic", skill_id: "pdf"}` is the correct shape. If the Skill turns out to need additional declared tools or a specific Python lib install, the system prompt may need adjustments. **Surfaces during the agent setup script smoke test in PR2.**
3. **Care guide token cost.** Generating 3-5 sentences per unique plant for 10 plants is ~3-5K output tokens. Check actual cost on a real run before launching credit cost (`PROPOSAL_CREDIT_COST` env var). Initial guess is 3 credits per proposal.
4. **Vercel function duration on `/stream`.** A typical generation should be 30-60s. Set `maxDuration: 300` on Pro plan. If on Hobby plan, the SSE proxy can't outlast 10s and a different topology is needed.
5. **Image base64 size.** Sending a payload with 6 images (3 sections × 2) plus 10 library item images at full resolution could be a multi-MB JSON blob inside a custom tool result. If too large, switch images to file mounts (upload via Files API, mount at `/workspace/images/`, reference by path in the payload). Decide based on real measurement during PR2.
6. **Document number race condition.** `next_proposal_number()` uses `UPDATE ... RETURNING` which row-locks the profile — no race. Confirmed by design.
7. **Credit refund idempotency.** The existing `refund_credit()` function should be safe to call multiple times; double-check during PR2 that a stream reconnect after an already-failed session doesn't double-refund.

## Open questions to confirm before PR1 starts

- **Credit cost** — guess of 3 credits per proposal, or do you have a target margin?
- **Storage bucket name** — `proposal-pdfs` fits existing naming (`uploads`, `thumbnails`, `generations`)?
- **Canvas entry point** — per-card 3-dot menu vs canvas toolbar (project-level)?

## Schema & dependency assumptions (verified)

- `generations.image_id` is `NOT NULL`, FK to `images.id`, confirmed in `supabase/migrations/20260309000001_tables.sql`
- `generations.parent_generation_id` is nullable, FK to `generations.id`, used by the existing recursive descendant delete in `src/app/api/generations/[id]/route.ts`
- `library_items.item_type` has a `CHECK (item_type IN ('plant', 'hardscape'))` constraint, confirmed in `supabase/migrations/20260329000001_plant_library.sql`
- `company_settings` exists with `company_name`, `company_phone`, `logo_path`, `default_note`, `updated_at` columns from `supabase/migrations/20260408000001_finalize_video.sql`
- No PDF generation libraries currently installed — `@anthropic-ai/sdk` will be the only new dependency for this feature

## Choosing the agent framework over Messages API

This feature could in principle be built with `client.messages.stream()` + `code_execution_20260120` + Skills instead of the full Managed Agents surface. The reasoning for picking Managed Agents anyway:

- **Forward-compatible scaffolding.** Future iterations of this feature (and potentially a proposal-style "design consultation chat" or "auto-compile project story video" feature) will benefit from non-deterministic agent loops, vision-driven decisions, and possibly web_search. Building on Managed Agents now means the second feature is cheap.
- **Versioned agent objects.** System prompt iteration is safer when sessions can pin to specific versions and roll forward independently.
- **Loop and container management is free.** The 80 lines of manual loop code we'd otherwise write is replaced by a single `sessions.create()` call.

The main thing this costs: an Anthropic-managed dependency in the critical path, beta-header surface, and a small amount of per-session container provisioning latency. Acceptable for v1.

---

## Ready-to-execute checklist

When picking this back up:

- [ ] Confirm credit cost, storage bucket name, canvas entry point (open questions above)
- [ ] Read this plan + `CLAUDE.md` + the existing `feature_finalize_video.md` memory entry for context on the codebase patterns
- [ ] Start with the migration in PR1 — run it against a Supabase branch first, verify RLS, then apply to live
- [ ] Build the modal UI in PR1 against an empty `<GenerationProgressModal>` stub
- [ ] Ship and merge PR1 before starting PR2 — PR1 must be demoable on its own
- [ ] Run `scripts/setup-proposal-agent.ts` locally before PR2 deploys, paste IDs into Vercel env
- [ ] Smoke-test the agent with a hardcoded payload before wiring up the UI in PR2
