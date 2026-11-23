# Wireframe v3 — a fresh redesign

Started 23 November 2026, after the CTO review on 20 November. This is a new design, not a restyle of `spec-system-wireframe/`. The old wireframe is used only as a list of what the product does.

**Three principles (CTO):** user journey, design system, user experience.

## How we work

One step at a time, module by module, starting with Properties. Each step is approved before the next one starts.

| Step | Output | Status |
|---|---|---|
| Requirements baseline | [docs/01-requirements-baseline.md](docs/01-requirements-baseline.md) | Approved 23 Nov |
| Personas and day journeys | [docs/02-personas-and-journeys.md](docs/02-personas-and-journeys.md) | Draft, on hold |
| **Properties — plan** | [docs/03-properties-module.md](docs/03-properties-module.md) | Approved 23 Nov |
| **Properties — P1 list and P2 property page** | `src/pages/properties/`, `src/pages/property/` | Built 23 Nov, for review |
| **Properties — P3 Add, and Edit with AI** | `src/pages/add/`, `src/lib/assistant.ts` | Built 23 Nov, for review |
| Properties — P4 Check import, P5 Customer page | — | Next |
| Design system | `references/` holds the Dribbble screenshots | Waiting for screenshots |
| Information architecture and navigation per role | — | Later |

## What's in the build so far

- **Data:** the old wireframe's 12 properties and 15 leads, reshaped and typed (`src/data/`), plus 2 drafts. HNI is dropped.
- **Logic:** two-way matching, listing completeness and to-do, price check, the customer view of nearby places, and plain-words search (`src/lib/`).
- **Screens:** Properties (P1) and the property page (P2), with the Share panel. They work on phone, tablet and desktop, in English and Tamil.
- **Demo menu** (top right): switch between Sales manager, Sales executive and Admin, and reset the demo data.
- **Add (P3) and Edit with AI:**
  - Describe a property in your own words, or drop a brochure, photos or a sheet. The listing card fills in beside the chat.
  - The assistant asks only for the missing required facts, with one-tap answers.
  - Every fact can be corrected in place.
  - Edit with AI shows each change and waits for **Apply** before saving it to History.
- **Not real yet:**
  - photos and the map are placeholders;
  - the voice button fills in an example;
  - WhatsApp, link and PDF sharing only log the share;
  - the assistant "AI" is rules: the same input and output shape as the real AI call, so it can be swapped in later.

## Stack

Built in the real product's stack, so the screens and the design system carry into development:
- React 19, Vite, TypeScript
- Tailwind CSS v4, shadcn/ui (Radix, Lucide icons)
- React Router
- i18next: English and Tamil from day one
- mock data only; no backend

**Run it:** `pnpm install`, then `pnpm dev` (or `pnpm build` for static files that can be demoed anywhere).

## Folder layout

- `docs/` — one document per section
- `references/` — design references (screenshots)
- `src/i18n/locales/` — all screen text, one file per language (`en.json`, `ta.json`)
- `src/components/ui/` — shadcn components, restyled by the design system
- `src/pages/` — screens
