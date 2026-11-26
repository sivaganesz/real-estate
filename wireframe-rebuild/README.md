# RealSpec — wireframe rebuild (React)

The clickable wireframe in `spec-system-wireframe/` (HTML and JavaScript), rebuilt in the product's stack one section at a time.

- The current wireframe stays in `spec-system-wireframe/` as the reference until each section is rebuilt and approved here.
- Simplifications and modern touches are welcome; each section is reviewed before the next one.

## Stack

- React 19, Vite, TypeScript
- Tailwind CSS v4 and shadcn/ui (Radix, Lucide icons)
- React Router
- i18next: English and Tamil, chosen in Settings → Your preferences
- Mock data saved in the browser, shaped like the real database; no backend

**Run it:** `pnpm install`, then `pnpm dev`, and open **http://localhost:5180** (always this port, so the demo data you edit is still there next time; `pnpm preview` uses 5181). Edits are saved in the browser; **Reset demo data** in the top bar brings back the original data. `pnpm build` makes static files that can be demoed anywhere.

## Theme

- **Light:** the current wireframe's light-blue look:
  - `#2f5bea` blue;
  - `#f3f4f7` background;
  - white cards;
  - 10 px rounding;
  - Inter font.
- **Dark:** the original warm dark theme with an orange accent. Each person picks Light, Dark or "Match my device" in Settings → Your preferences ([src/lib/theme.ts](src/lib/theme.ts)); index.html applies the choice before the page draws.
- **One file:** everything lives in [src/index.css](src/index.css). Screens use token names (`bg-primary`, `text-success`, `bg-warning-soft`), never raw colours, so changing the theme means editing that one file.
- **Status tones:** `neutral`, `primary`, `success`, `warning`, `danger`, `info` and `violet`, each with a `-soft` background and a `-foreground` for text on the solid colour.
- **Ribbon:** the dark WIREFRAME bar has its own colours (`bg-ribbon`, `text-ribbon-foreground`, …).
- **Text sizes:** Tailwind's `text-xs` (12), `text-sm` (14), `text-base` (16) and `text-xl` (20), plus named small sizes: `text-micro` (10), `text-caption` (11), `text-label` (11.5), `text-meta` (12.5), `text-ui` (13) and `text-prompt` (14.5). Use these instead of `text-[13px]`.
- **`cn` must know the named sizes:** import it from `@/lib/utils`, never from the `cn` package. Otherwise it reads `text-meta` as a colour and drops a class. After `shadcn add`, change the new file's `import { cn } from "cn"` to `@/lib/utils`.

## Building blocks

| Where | What |
|---|---|
| `src/components/ui/` | shadcn components: button, input, select, dialog, sheet, table, … |
| `src/components/app/` | Our shared components: `Page` and `PageHeader`, `SectionCard`, `StatCard`, `StatusChip` (labels), `Chip` (clickable options, suggestions and dashed "add" actions), `Callout`, `Meter`, `EmptyState`, `KeyValueGrid`, `FilterBar`, `Segmented` (tabs and view switch), `DataTable` (optional sortable headers, row selection, compact rows, columns that hide below a screen width, a pinned ⋯ column), `SidePanel` (right on desktop, bottom on phone), `ConfirmDialog`, `UserAvatar` |
| `src/components/layout/` | The app shell: sidebar, top bar, phone drawer; the navigation list in `nav.ts` |
| `src/data/` | Types, the property catalogue and the seed data (from the current wireframe) |
| `public/demo-photos/` | One cover photo per demo property, resized to 1000 px and compressed. Raw photos dropped in `demo-photos-inbox/` stay out of git. For demos only: check each photo's licence before any public use |
| `src/lib/` | Rules: formatting, matching, listing completeness, plain-words search, the property assistant |
| `src/store/` | The in-browser "backend" and the demo role switch |
| `src/i18n/locales/` | All screen text: `en.json`, `ta.json` |

The **UI kit** page (`/ui-kit`, at the bottom of the menu) shows the theme and every shared component. It's a temporary page for review.

## Progress

The full feature-by-feature list, against the old wireframe, is in [CHECKLIST.md](CHECKLIST.md).

| Section | Status |
|---|---|
| Setup, theme, shared components, app shell | Done (24dfd08) |
| Properties: list, property page (Overview, Legal & documents, Price, Matching buyers, History), Share panel, archive | Built, for review — `src/features/properties/` |
| Properties: Add and Edit with AI, Bulk import, Share page (customer brochure) | Next |
| Leads, Pipeline, Appointments, Matching, Projects, Bulk import, Reports, HNI, Settings, Enquiry form, System map, Dashboard | Later, one at a time |
