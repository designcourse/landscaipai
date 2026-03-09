# Landscaip Brand Guidelines

## Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `primary` | `#0F8000` | Primary brand green, CTAs, active states |
| `primary-light` | `#2DA31E` | Hover states, secondary emphasis |
| `primary-dark` | `#0A5C00` | Pressed states, dark accents |
| `background` | `#FFFFFF` | Page background |
| `foreground` | `#171717` | Primary text |
| `muted` | `#F5F5F5` | Muted backgrounds, cards, input fields |
| `muted-foreground` | `#737373` | Secondary text, placeholders, captions |
| `border` | `#E5E5E5` | Borders, dividers |
| `border-light` | `#F0F0F0` | Subtle borders, hover outlines |
| `destructive` | `#DC2626` | Errors, destructive actions |
| `warning` | `#F59E0B` | Warnings, low-credit alerts |
| `success` | `#16A34A` | Success confirmations |

## Typography

- **Font family (sans):** Geist Sans (`--font-sans`)
- **Font family (mono):** Geist Mono (`--font-mono`)

### Type Scale

| Token | Size | Usage |
|-------|------|-------|
| `text-xs` | 12px | Fine print, badges |
| `text-sm` | 14px | Captions, helper text |
| `text-base` | 16px | Body text |
| `text-lg` | 18px | Large body, subheadings |
| `text-xl` | 20px | Section headings |
| `text-2xl` | 24px | Page headings |
| `text-3xl` | 30px | Hero subheadings |
| `text-4xl` | 36px | Hero headings |

## Spacing Scale

Use Tailwind's default spacing scale via theme tokens. Key named spacers:

| Token | Value | Usage |
|-------|-------|-------|
| `--spacing-section` | 64px | Between major page sections |
| `--spacing-group` | 32px | Between related groups |
| `--spacing-element` | 16px | Between sibling elements |
| `--spacing-tight` | 8px | Tight gaps (icon-to-label, etc.) |
| `--spacing-xs` | 4px | Minimal gaps (badge padding, etc.) |

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 6px | Buttons, badges, small elements |
| `--radius-md` | 8px | Cards, inputs |
| `--radius-lg` | 12px | Modals, image containers |
| `--radius-full` | 9999px | Avatars, pills |

## Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle elevation (cards) |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.07)` | Dropdowns, popovers |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, overlays |

## Design Principles

- **Light mode only**, white background
- **Simplistic, clean, professional but approachable**
- **Mobile-first**, fully responsive (phones → tablets → desktop)
- Generous whitespace; avoid visual clutter
- One primary accent color (green); use sparingly for emphasis
