# RealSpec — wireframe rebuild (React)

The clickable wireframe in `spec-system-wireframe/` (HTML and JavaScript), rebuilt in the product's stack one section at a time.

- The current wireframe stays in `spec-system-wireframe/` as the reference until each section is rebuilt and approved here.
- Simplifications and modern touches are welcome; each section is reviewed before the next one.

## Stack

- React 19, Vite, TypeScript
- Tailwind CSS v4 and shadcn/ui (Radix, Lucide icons)
- React Router
- i18next: English and Tamil, with a switch in the top bar
- Mock data saved in the browser, shaped like the real database; no backend

**Run it:** `pnpm install`, then `pnpm dev`. `pnpm build` makes static files that can be demoed anywhere.

## Theme

- **Light:** the current wireframe's light-blue look:
  - `#2f5bea` blue;
  - `#f3f4f7` background;
  - white cards;
  - 10 px rounding;
  - Inter font.
- **Dark:** the original warm dark theme with an orange accent is defined but not switched on yet.
- **One file:** everything lives in [src/index.css](src/index.css). Screens use token names (`bg-primary`, `text-success`, `bg-warning-soft`), never raw colours, so changing the theme means editing that one file.
- **Status tones:** `neutral`, `primary`, `success`, `warning`, `danger`, `info` and `violet`, each with a `-soft` background.

## Building blocks

| Where | What |
|---|---|
| `src/components/ui/` | shadcn components: button, input, select, dialog, sheet, table, … |
| `src/components/app/` | Our shared components: `Page` and `PageHeader`, `SectionCard`, `StatCard`, `StatusChip`, `Callout`, `Meter`, `EmptyState`, `KeyValueGrid`, `FilterBar`, `Segmented` (tabs and view switch), `DataTable`, `SidePanel` (right on desktop, bottom on phone), `ConfirmDialog`, `UserAvatar` |
| `src/components/layout/` | The app shell: sidebar, top bar, phone drawer; the navigation list in `nav.ts` |
| `src/data/` | Types, the property catalogue and the seed data (from the current wireframe) |
| `src/lib/` | Rules: formatting, matching, listing completeness, plain-words search, the property assistant |
| `src/store/` | The in-browser "backend" and the demo role switch |
| `src/i18n/locales/` | All screen text: `en.json`, `ta.json` |

The **UI kit** page (`/ui-kit`, at the bottom of the menu) shows the theme and every shared component. It's a temporary page for review.

## Progress

| Section | Status |
|---|---|
| Setup, theme, shared components, app shell | Done (24dfd08) |
| Properties: list, property page (Overview, Legal & documents, Price, Matching buyers, History), Share panel, archive | Built, for review — `src/features/properties/` |
| Properties: Add and Edit with AI, Bulk import, Share page (customer brochure) | Next |
| Leads, Pipeline, Appointments, Matching, Projects, Bulk import, Reports, HNI, Settings, Enquiry form, System map, Dashboard | Later, one at a time |
