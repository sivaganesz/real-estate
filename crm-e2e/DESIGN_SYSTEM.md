# DESIGN_SYSTEM — crm-e2e

> **Identity name: "Peacock & Marigold".** This is the design system for the end-to-end CRM in `crm-e2e/`, as Section 19 of the master prompt asks. It keeps the theme **mechanism** from `wireframe-rebuild/`: CSS variables in `src/index.css`, Tailwind v4 `@theme inline` mapping, a `.dark` class on `<html>` set by `src/lib/theme.ts` (light / dark / system, saved in localStorage and applied before first paint), shadcn token names, Inter Variable with Noto Sans Tamil, and the named small type sizes registered with `cn`. The **visual identity is new**. Screens never hard-code a colour. They use tokens only (`bg-primary`, `text-stage-booked`, `bg-hot-soft`, `shadow-md`...).

Every value here was checked by script. All OKLCH values are inside the sRGB gamut. Every text pair listed in §3.3 is at 4.5:1 or better in both themes.

---

## 1. References studied, and what we take from each

| # | Reference | What it does well | What we take | What we avoid |
|---|---|---|---|---|
| 1 | **Linear** (2024 to 2025 redesigns) | Themes come from a generator in a perceptual colour space (LCH) with only a few inputs: base, accent and contrast. The sidebar is calm and dense. The chrome stays quiet so content stands out. Cmd+K runs everything. | Perceptual colour (we use **OKLCH**), so tints at the same lightness look equally bright and dark mode is designed rather than inverted. A low-noise sidebar. A command palette (Ctrl+K) that doubles as the AI assistant. Keyboard-first focus rings. | The near-monochrome look is too austere for a sales team that needs colour coding. |
| 2 | **Attio** | One record can be a table row, a kanban card, a preview drawer or a full page. Attribute chips are colourful. Record pages have highlight widgets at the top. | The **same lead looks the same across views** (row, card, drawer, page share avatar, temperature dot, stage pill and score ring). Previewing a record in a drawer without leaving the list. A row of highlight widgets at the top of the lead and property pages. | The data-model-heavy UI. Our users are field sales staff, not ops admins. |
| 3 | **Stripe Dashboard** | KPI tiles that pair a number with a sparkline and a delta. Very clean chart axes. Hairline grid. Tabular numbers. Data that the hover tooltip explains. | The **KPI card anatomy** (label, big tabular number, delta chip, sparkline). Chart restraint: no chart borders, a dashed 1px grid on the value axis only, a crosshair tooltip. Careful formatting of money and numbers (for us, Indian ₹ L / Cr). | Stripe's fintech purple. |
| 4 | **Folk** | A friendly, people-first CRM. Big avatars and initials. Soft pastel chips. Generous white space. | Avatars and initials everywhere, with colour derived from a name hash. Pastel **soft** backgrounds for chips and tags. A warm, approachable feel for executives. | Very low information density. |
| 5 | **HubSpot (2024 to 2025 UI refresh)** | Clear module navigation. The record "sidebar plus timeline" layout. Association cards. A conversational AI (Breeze) that sits beside the work. | A three-zone **record layout**: summary rail, timeline or tabs, and related cards. An AI side panel that docks beside the work instead of replacing it. | The busy multi-level navigation. |
| 6 | **Pipedrive** | The kanban is the product: stage totals in the column header, a "rotting" deal turns red, drag and drop feels physical. | Stage **value totals and counts** in column headers. A thin stage-coloured progress bar. **Days-in-stage aging** that turns the card's age badge warning or danger. A lifted card with shadow-lg while dragging. | Heavy green branding. Dated form styling. |
| 7 | **Housing.com / Square Yards partner portals** | Indian real-estate vocabulary: price in L / Cr, BHK chips, RERA badge, possession date, locality first. Image-led listings. | **Property card grammar**: a large 4:3 image, a price badge over the image, config / area / possession chips, a RERA tick, the locality above the project name. | Ad-heavy, cluttered consumer layouts. |
| 8 | **Zillow Premier Agent** | An agent "today" inbox. Lead cards showing intent, last activity and one-tap contact. | A **one-tap Call / WhatsApp** row on every lead card. Last-contact badges. A "why this lead now" reason line. | US-only patterns. |
| 9 | **Notion** | Calm typography. Friendly line illustrations for empty states. Slash and command patterns. | The **empty-state illustration** tone: simple duotone line art with one accent. Calm, readable headings. Callout blocks for AI tips. | Too little visual hierarchy for dashboards. |
| 10 | **Vercel / shadcn "new-york" dashboards** | Modern shadcn token conventions, the `sidebar-*` tokens, chart tokens, inset layout. | Keep the exact **shadcn token names**, so `wireframe-rebuild` components port with no renames. | Generic shadcn-template sameness. Our colour, illustration and chart style is what sets us apart. |

**Summary:** Linear gives the calm and the colour science. Stripe gives the numbers. Attio and HubSpot give the record patterns. Pipedrive gives the pipeline. Housing.com and Square Yards give the Indian property grammar. Folk and Notion give the warmth.

---

## 2. Visual direction

**"A calm, confident workspace with India's colours used precisely."**

- **One primary accent: Peacock**, a deep blue-teal (`oklch(0.5 0.09 218)`, which brightens to "Lagoon" in dark mode). It is distinct from the generic SaaS blue and violet, and it suggests trust, water and greenery, which suits property. It is used for primary actions, the active navigation item, focus rings, links and the first chart series.
- **One sparing highlight: Marigold** (`oklch(0.8 0.15 78)`). It marks targets met, "New" and "Premium" markers, the gradient end of hero highlights, the target-gauge fill and star or shortlist states. It never appears on a large surface.
- **AI has its own colour: Iris** (violet). All AI surfaces (assistant panel, AI-filled fields, the "Demo AI" badge, AI suggestions) use Iris, and the AI hero uses a restrained Peacock-to-Iris gradient. This makes "what the AI did" instantly visible (Section 12.0).
- **Neutrals** are cool slate with a faint Peacock tint, never pure grey. Text is "ink" (`oklch(0.22 0.025 250)`), not black.
- **Graphical, not text-heavy.** Numbers sit next to sparklines, rings and bars. Every status has a colour plus a dot or icon plus a label (colour is never the only signal). Pipeline stages, temperatures and appointment types each have a fixed hue family that is the same everywhere.
- **Clean and professional.** Lots of white space on a 4/8 px grid. White cards on a soft cool canvas with **hairline borders plus subtle ink-tinted shadows** (no heavy borders). Radius 12 px for cards and 8 to 10 px for controls. Gradients appear only on the AI hero and the KPI "highlight" card.
- **Dark mode is designed, not inverted.** Deep ink-slate surfaces step **lighter** as they rise (canvas, background, card, popover). Accents brighten and lose chroma. Shadows deepen and gain a 1 px top highlight. Soft tints become low-lightness washes.
- **Indian real estate details.** ₹ L / Cr formatting in tabular numbers, BHK and carpet-area chips, RERA tick badges, locality-first labels, WhatsApp actions shown in the `success` tone (green, the hue people know for it) and nowhere else in green except real success, and an optional subtle jaali (lattice) dot pattern in empty-state illustrations and the login-less welcome hero.

---

## 3. Colour

All colours are OKLCH and live in `src/index.css` (§12). The tables were generated from that CSS. **Solid** tokens are used for text on card, dots, bars, icons and fills. **Soft** tokens are used for chip, badge and column-wash backgrounds. A `-foreground` token is text on the solid fill.

### 3.1 Usage rules

- **Stage, appointment and chart solids are for marks, not body text.** A stage badge is drawn as `bg-stage-x-soft` + a 6 px `bg-stage-x` dot + `text-foreground` label. Do not use `text-stage-x` for words; several stage solids (Visit scheduled, Docs, Marigold) are below 4.5:1 on white by design, for brightness.
- **Semantic tones** (`success/warning/danger/info/violet/neutral/ai/hot/warm/cold`) **are** text-safe: `text-x` on `bg-x-soft` and on `bg-card` are ≥ 4.5:1 in both themes.
- **Colour is never the only signal**: temperature = dot + flame/thermometer/snowflake icon + word; stage = dot + label; delta = arrow + sign + colour.
- **Avatars**: initials on a soft background picked by `hash(name) % 8` from the chart palette soft mixes: `background: color-mix(in oklch, var(--chart-n) 18%, var(--card)); color: var(--foreground)`.
- **Gradients** only: `--ai-gradient` (AI hero, AI button icon tile, "Demo AI" badge border), and the KPI highlight card (`--primary` → `--primary-strong`, 135°). No other gradients.
- **Destructive** = `--destructive` (same value as `--danger`), kept for shadcn compatibility.

### 3.2 Domain mapping (single source: `src/lib/tones.ts`)

| Domain value | Token family | Icon (lucide) |
|---|---|---|
| Hot / Warm / Cold | `hot` / `warm` / `cold` | `Flame` / `Thermometer` / `Snowflake` |
| New | `stage-new` (sky) | `Sparkle` |
| Contacted | `stage-contacted` (indigo) | `PhoneOutgoing` |
| Qualified | `stage-qualified` (violet) | `BadgeCheck` |
| Site Visit Scheduled | `stage-visit-scheduled` (marigold) | `CalendarClock` |
| Site Visit Done | `stage-visit-done` (saffron-orange) | `MapPinCheck` |
| Negotiation | `stage-negotiation` (rose) | `Handshake` |
| Booked (Token Paid) | `stage-booked` (peacock-teal) | `Stamp` (fallback `Ticket`) |
| Converted / Closed Won | `stage-converted` (green) | `Trophy` |
| Lost | `stage-lost` (slate) | `CircleX` |
| Site visit | `appt-site-visit` (terracotta) | `Building2` |
| Office meeting | `appt-office` (indigo) | `Briefcase` |
| Phone call | `appt-call` (green) | `Phone` |
| Video call | `appt-video` (violet) | `Video` |
| Documentation / Registration | `appt-docs` (gold) | `FilePenLine` |
| Property availability Available / On hold / Booked / Sold | `success` / `warning` / `info` / `neutral` | `CircleCheck` / `CirclePause` / `Stamp` / `Lock` |
| Appointment status Scheduled / Confirmed / Completed / No-show / Cancelled / Rescheduled | `info` / `primary` / `success` / `danger` / `neutral` / `warning` | |
| Task priority High / Medium / Low | `danger` / `warning` / `neutral` | `ChevronsUp` / `ChevronUp` / `Minus` |
| AI | `ai` | `Sparkles` |

Exact OKLCH values (generated from the CSS in §12; both themes):

**Surfaces and ink**

| Token | Light | Dark |
|---|---|---|
| `--background` | `oklch(0.975 0.004 230)` | `oklch(0.165 0.012 245)` |
| `--canvas` | `oklch(0.985 0.003 230)` | `oklch(0.145 0.012 245)` |
| `--card` | `oklch(1 0 0)` | `oklch(0.2 0.014 245)` |
| `--popover` | `oklch(1 0 0)` | `oklch(0.225 0.015 245)` |
| `--foreground` | `oklch(0.22 0.025 250)` | `oklch(0.94 0.006 240)` |
| `--muted` | `oklch(0.96 0.005 235)` | `oklch(0.24 0.013 245)` |
| `--muted-foreground` | `oklch(0.48 0.022 250)` | `oklch(0.7 0.016 245)` |
| `--subtle-foreground` | `oklch(0.55 0.018 250)` | `oklch(0.63 0.016 245)` |
| `--secondary` | `oklch(0.955 0.006 235)` | `oklch(0.255 0.014 245)` |
| `--secondary-foreground` | `oklch(0.32 0.025 250)` | `oklch(0.88 0.01 240)` |
| `--border` | `oklch(0.92 0.007 240)` | `oklch(0.285 0.014 245)` |
| `--border-strong` | `oklch(0.86 0.01 240)` | `oklch(0.35 0.016 245)` |
| `--input` | `oklch(0.88 0.01 240)` | `oklch(0.32 0.016 245)` |

**Primary (Peacock) and highlight (Marigold)**

| Token | Light | Dark |
|---|---|---|
| `--primary` | `oklch(0.5 0.09 218)` | `oklch(0.74 0.115 205)` |
| `--primary-strong` | `oklch(0.43 0.08 222)` | `oklch(0.8 0.1 200)` |
| `--primary-foreground` | `oklch(0.99 0.004 210)` | `oklch(0.18 0.03 225)` |
| `--primary-soft` | `oklch(0.955 0.025 212)` | `oklch(0.29 0.05 215)` |
| `--accent` | `oklch(0.955 0.025 212)` | `oklch(0.29 0.05 215)` |
| `--accent-foreground` | `oklch(0.43 0.08 222)` | `oklch(0.86 0.08 205)` |
| `--ring` | `oklch(0.55 0.099 218)` | `oklch(0.74 0.115 205)` |
| `--highlight` | `oklch(0.8 0.15 78)` | `oklch(0.82 0.14 80)` |
| `--highlight-soft` | `oklch(0.965 0.037 85)` | `oklch(0.29 0.05 75)` |
| `--highlight-foreground` | `oklch(0.3 0.06 60)` | `oklch(0.2 0.04 70)` |

**Semantic**

| Token | Light | Dark |
|---|---|---|
| `--success` | `oklch(0.52 0.125 155)` | `oklch(0.76 0.14 155)` |
| `--success-soft` | `oklch(0.955 0.04 158)` | `oklch(0.27 0.045 158)` |
| `--warning` | `oklch(0.54 0.12 62)` | `oklch(0.81 0.13 78)` |
| `--warning-soft` | `oklch(0.96 0.038 82)` | `oklch(0.28 0.045 72)` |
| `--danger` | `oklch(0.54 0.19 25)` | `oklch(0.72 0.16 22)` |
| `--danger-soft` | `oklch(0.96 0.019 22)` | `oklch(0.28 0.06 22)` |
| `--destructive` | `oklch(0.54 0.19 25)` | `oklch(0.7 0.17 22)` |
| `--info` | `oklch(0.52 0.14 255)` | `oklch(0.75 0.12 250)` |
| `--info-soft` | `oklch(0.955 0.021 255)` | `oklch(0.27 0.05 255)` |
| `--violet` | `oklch(0.52 0.18 292)` | `oklch(0.76 0.13 295)` |
| `--violet-soft` | `oklch(0.955 0.023 292)` | `oklch(0.28 0.06 295)` |
| `--neutral` | `oklch(0.47 0.02 250)` | `oklch(0.76 0.015 245)` |
| `--neutral-soft` | `oklch(0.955 0.005 250)` | `oklch(0.26 0.012 245)` |

**AI (Iris)**

| Token | Light | Dark |
|---|---|---|
| `--ai` | `oklch(0.52 0.17 285)` | `oklch(0.76 0.128 285)` |
| `--ai-soft` | `oklch(0.96 0.019 285)` | `oklch(0.27 0.06 285)` |
| `--ai-border` | `oklch(0.82 0.08 285)` | `oklch(0.42 0.1 285)` |

**Lead temperature**

| Token | Light | Dark |
|---|---|---|
| `--hot` | `oklch(0.54 0.18 32)` | `oklch(0.72 0.17 35)` |
| `--hot-soft` | `oklch(0.955 0.022 35)` | `oklch(0.28 0.06 32)` |
| `--warm` | `oklch(0.53 0.115 62)` | `oklch(0.81 0.13 78)` |
| `--warm-soft` | `oklch(0.96 0.038 82)` | `oklch(0.28 0.045 72)` |
| `--cold` | `oklch(0.53 0.12 240)` | `oklch(0.75 0.11 238)` |
| `--cold-soft` | `oklch(0.955 0.022 235)` | `oklch(0.27 0.045 240)` |

**Pipeline stages**

| Token | Light | Dark |
|---|---|---|
| `--stage-new` | `oklch(0.62 0.12 235)` | `oklch(0.74 0.11 235)` |
| `--stage-new-soft` | `oklch(0.96 0.02 235)` | `oklch(0.26 0.035 238)` |
| `--stage-contacted` | `oklch(0.56 0.15 265)` | `oklch(0.72 0.13 268)` |
| `--stage-contacted-soft` | `oklch(0.955 0.021 265)` | `oklch(0.27 0.05 268)` |
| `--stage-qualified` | `oklch(0.55 0.17 295)` | `oklch(0.73 0.14 295)` |
| `--stage-qualified-soft` | `oklch(0.955 0.023 295)` | `oklch(0.27 0.055 295)` |
| `--stage-visit-scheduled` | `oklch(0.74 0.14 75)` | `oklch(0.82 0.14 80)` |
| `--stage-visit-scheduled-soft` | `oklch(0.965 0.037 85)` | `oklch(0.28 0.045 75)` |
| `--stage-visit-done` | `oklch(0.66 0.15 50)` | `oklch(0.75 0.14 52)` |
| `--stage-visit-done-soft` | `oklch(0.96 0.023 55)` | `oklch(0.28 0.05 50)` |
| `--stage-negotiation` | `oklch(0.6 0.18 355)` | `oklch(0.72 0.16 355)` |
| `--stage-negotiation-soft` | `oklch(0.96 0.022 355)` | `oklch(0.28 0.06 355)` |
| `--stage-booked` | `oklch(0.58 0.098 200)` | `oklch(0.75 0.1 198)` |
| `--stage-booked-soft` | `oklch(0.955 0.03 200)` | `oklch(0.27 0.045 205)` |
| `--stage-converted` | `oklch(0.57 0.14 152)` | `oklch(0.75 0.14 152)` |
| `--stage-converted-soft` | `oklch(0.955 0.04 155)` | `oklch(0.27 0.045 155)` |
| `--stage-lost` | `oklch(0.6 0.02 250)` | `oklch(0.6 0.018 245)` |
| `--stage-lost-soft` | `oklch(0.955 0.004 250)` | `oklch(0.25 0.01 245)` |

**Appointment types**

| Token | Light | Dark |
|---|---|---|
| `--appt-site-visit` | `oklch(0.6 0.15 45)` | `oklch(0.74 0.14 48)` |
| `--appt-site-visit-soft` | `oklch(0.96 0.022 50)` | `oklch(0.28 0.05 48)` |
| `--appt-office` | `oklch(0.56 0.15 265)` | `oklch(0.72 0.13 268)` |
| `--appt-office-soft` | `oklch(0.955 0.021 265)` | `oklch(0.27 0.05 268)` |
| `--appt-call` | `oklch(0.57 0.129 160)` | `oklch(0.75 0.13 160)` |
| `--appt-call-soft` | `oklch(0.955 0.04 160)` | `oklch(0.27 0.045 160)` |
| `--appt-video` | `oklch(0.56 0.17 300)` | `oklch(0.74 0.14 300)` |
| `--appt-video-soft` | `oklch(0.955 0.025 300)` | `oklch(0.28 0.055 300)` |
| `--appt-docs` | `oklch(0.7 0.13 85)` | `oklch(0.82 0.13 85)` |
| `--appt-docs-soft` | `oklch(0.965 0.041 88)` | `oklch(0.28 0.045 82)` |

**Charts**

| Token | Light | Dark |
|---|---|---|
| `--chart-1` | `oklch(0.55 0.097 215)` | `oklch(0.72 0.11 205)` |
| `--chart-2` | `oklch(0.78 0.14 75)` | `oklch(0.82 0.14 80)` |
| `--chart-3` | `oklch(0.55 0.16 280)` | `oklch(0.7 0.14 282)` |
| `--chart-4` | `oklch(0.66 0.16 32)` | `oklch(0.72 0.15 35)` |
| `--chart-5` | `oklch(0.63 0.13 155)` | `oklch(0.74 0.13 155)` |
| `--chart-6` | `oklch(0.62 0.17 350)` | `oklch(0.72 0.15 352)` |
| `--chart-7` | `oklch(0.72 0.1 232)` | `oklch(0.8 0.09 232)` |
| `--chart-8` | `oklch(0.62 0.025 250)` | `oklch(0.62 0.02 245)` |
| `--chart-grid` | `oklch(0.93 0.006 240)` | `oklch(0.27 0.012 245)` |
| `--chart-axis` | `oklch(0.55 0.018 250)` | `oklch(0.62 0.016 245)` |

`--canvas` is the app chrome behind the main content (sidebar, topbar band, kanban board well). In light mode it is slightly brighter than `--background`. In dark mode it is the deepest layer. `--ai-gradient` is `linear-gradient(135deg, Peacock, Iris)`, with lighter stops in dark mode. The values are in §12.

### 3.3 Verified contrast (script-checked, WCAG 2.x)

- **Light:** foreground on background is 16.1. muted-foreground on card, background and muted is 6.5 / 6.1 / 5.8. subtle-foreground on card is 4.8. primary-foreground on primary is 5.7. Every semantic `text-x` on `bg-x-soft` and on `bg-card` is 4.5 or higher, including hot, warm and cold. chart-axis on card is 4.8.
- **Dark:** every pair above is 5.0 to 16.2 (chart-axis is the lowest at 5.0).
- **Non-text marks on the card (3:1 target):** in dark mode every stage, appointment and chart colour is 4.6 or higher. In light mode three bright hues fall below 3:1: `stage-visit-scheduled` (2.35), `appt-docs` (2.7) and `chart-2` / `chart-7` (2.0 / 2.4). The rule: these are **always paired with a label or icon**, and filled areas get a 1 px `color-mix(in oklch, <hue> 70%, var(--foreground))` outline when they are the only marker. Charts also have a legend and direct labels, so no meaning depends on that contrast alone.

---

## 4. Typography

- **Families:** `Inter Variable` (`@fontsource-variable/inter`) for Latin text, with **Noto Sans Tamil** 400/500/600/700 (`@fontsource/noto-sans-tamil`) as the fallback that picks up Tamil characters. The stack is `'Inter Variable', 'Noto Sans Tamil', ui-sans-serif, system-ui, 'Segoe UI', sans-serif`.
- **Inter features:** `cv11` (single-storey a) and `ss01` (open digits) are set on `html`. **All numbers in tables, KPI cards, charts, prices and times use `tabular-nums`** (the `.tabular` utility or Tailwind's `tabular-nums`).
- **Tamil:** `:lang(ta)` sets `line-height: 1.65` and `letter-spacing: 0`. Tamil labels run about 30–40% longer, so buttons and chips must wrap or truncate with a `title`, and never use a fixed width. Headings never use negative tracking in Tamil.
- **Root size:** 90% at 64rem and above (a decision carried over from wireframe-rebuild). Below that the root is 100%.

| Role | Token / class | Size / line height | Weight | Tracking | Use |
|---|---|---|---|---|---|
| Display | `text-display` | 36 / 42 | 650 | −0.025em | Today greeting ("Good morning, Priya"), empty-state hero |
| Page title | `text-2xl` | 24 / 32 | 650 | −0.02em | Page header H1 |
| KPI number | `text-kpi` | 28 / 34 | 650 | −0.02em | KPI cards, ₹ totals (tabular) |
| Section title | `text-lg` | 18 / 28 | 600 | −0.01em | Card headings, drawer titles |
| Card title | `text-base` | 16 / 24 | 600 | normal | Lead / property names on cards |
| Body | `text-sm` | 14 / 20 | 400 | normal | Default UI text, table cells |
| Prompt | `text-prompt` | 14.5 | 400 | normal | AI input box |
| UI compact | `text-ui` | 13 | 500 | normal | Tabs, filter pills, breadcrumbs |
| Meta | `text-meta` | 12.5 | 500 | normal | Chips, IDs, timestamps |
| Caption | `text-xs` / `text-caption` | 12 / 11 | 500 | +0.01em | Helper text, sidebar group labels (uppercase, +0.06em) |
| Label | `text-label` | 11.5 | 600 | +0.04em, uppercase | Table headers, KPI labels |
| Micro | `text-micro` | 10 | 600 | +0.02em | Ring percentages, map pins, count bubbles |

Weights are 400 (body), 500 (UI and meta), 600 (titles and labels), 650 (display and KPI, which Inter Variable supports) and 700 (rare emphasis only). Italic is not used.

---

## 5. Spacing, layout grid and radius

- **Spacing scale (4/8 px):** use Tailwind's default (`1` = 4 px). Allowed steps: `0.5 1 1.5 2 3 4 5 6 8 10 12 16` (2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64 px). Do not use odd values like 7 or 9.
- **Rhythm:** card padding is `p-5` on desktop and `p-4` on tablet and phone. The gap between cards is `gap-4` to `gap-6`. The gap inside a card is `gap-3`. A form field stack is `gap-1.5` from label to input and `gap-4` between fields. Page padding is `px-8 py-6` on desktop, `px-6` on tablet and `px-4` on phone.
- **Content width:** dashboards and lists use the full width up to `max-w-[1600px]`. Forms and reading content are `max-w-3xl`. Drawers are `w-[480px]` (lead preview) or `w-[640px]` (forms, AI review).
- **Radius** (`--radius: 0.75rem`):

| Token | px | Use |
|---|---|---|
| `rounded-xs` | 6 | Chips inside tables, kbd, tiny badges |
| `rounded-sm` | 8 | Inputs, buttons (sm), checkbox (4 px fixed), skeleton bars |
| `rounded-md` | 10 | Buttons, selects, menu items, nav items |
| `rounded-lg` | 12 | Cards, popovers, kanban cards, toasts |
| `rounded-xl` | 16 | Dialogs, drawers' inner hero, property image |
| `rounded-2xl` | 20 | AI hero panel, Today greeting card |
| `rounded-full` | | Avatars, pills, rings, status dots |

---

## 6. Elevation and shadows

The shadows are layered and tinted with ink in light mode. In dark mode they get deeper and carry a 1 px inset top highlight. Combine them with hairline borders. Borders give definition and shadows give lift.

| Level | Token | Light recipe | Use |
|---|---|---|---|
| 0 | none plus `border` | | Table rows, inline sections |
| 1 | `shadow-xs` | 0 1 2 ink/5% | Inputs, buttons (secondary), chips that can be dragged |
| 2 | `shadow-sm` / `shadow-card` | 0 1 2 /5% + 0 1 3 /6% | **All cards at rest**, KPI tiles, kanban cards |
| 3 | `shadow-md` / `shadow-card-hover` | 0 2 4 /4% + 0 6 16 −2 /8% | Card hover (with `-translate-y-0.5`), sticky table header when it scrolls, dropdown |
| 4 | `shadow-lg` | 0 4 8 /4% + 0 16 32 −6 /12% | Popovers, the kanban card being dragged, toasts |
| 5 | `shadow-xl` | 0 8 16 /6% + 0 28 56 −12 /20% | Dialogs, drawers, command palette / AI panel |

The overlay behind a dialog or drawer is `bg-[var(--overlay)]` plus `backdrop-blur-[2px]`. Focus uses `ring-2 ring-ring ring-offset-2 ring-offset-background`. Inputs use `shadow-focus` (3 px soft ring) together with `border-ring`.

---

## 7. Motion

| Token | Value | Use |
|---|---|---|
| `--dur-instant` | 80 ms | Press feedback, checkbox tick |
| `--dur-fast` | 140 ms | Hover colour, tooltip, chip select |
| `--dur-base` | 200 ms | Dropdowns, popovers, tab indicator, toast in |
| `--dur-slow` | 280 ms | Drawer and side panel, dialog, accordion |
| `--dur-slower` | 420 ms | Chart entry, ring or progress fill, count-up of KPI numbers (max 600 ms) |
| `ease-out` | `cubic-bezier(0.22,1,0.36,1)` | Default for things entering |
| `ease-in-out` | `cubic-bezier(0.65,0,0.35,1)` | Moving or resizing (kanban reorder, panel width) |
| `ease-spring` | `cubic-bezier(0.34,1.4,0.64,1)` | Small pops only: badge count change, drop of a kanban card, "AI filled" sparkle |

**Rules**

- Things enter with `ease-out` and leave in about 70% of the time. Only `transform` and `opacity` are animated, never layout properties.
- Lists stagger by 30 ms for the first 8 items only, using `animate-fade-up` (4 px rise plus fade).
- AI field fill: each filled field flashes `bg-ai-soft` (200 ms in, holding as the `.ai-filled` marker). Fields fill in sequence 40 ms apart, so the user *sees* the AI working.
- `animate-ai-pulse` marks the assistant's "thinking" state only.
- **Reduced motion:** a global `@media (prefers-reduced-motion: reduce)` sets durations to 0.01 ms, turns off the skeleton shimmer (a static tint remains), switches off recharts animations (`isAnimationActive={!reduced}` through a `useReducedMotion()` hook) and turns off count-up and stagger. Drag and drop still works, without the lift animation.

---

## 8. Iconography (lucide-react)

- Sizes are `size-4` (16) inline and in buttons, `size-[18px]` in navigation, `size-5` (20) in card headers, and `size-6` (24) or larger only in empty states and KPI icon tiles.
- `strokeWidth={1.75}` is the default (set once in an `Icon` wrapper or through `className="[&_svg]:stroke-[1.75]"`). Use 2 for 16 px icons in dense tables.
- **Icon tile:** a 32 px or 36 px `rounded-md` square in `bg-x-soft` with a `text-x` icon. It is used in KPI cards, timeline nodes and notification items, and gives the product its graphical rhythm.
- Icons come only from lucide. **Fixed navigation icons:** Today `Sun`, Leads `Users`, Pipeline `KanbanSquare` (fallback `SquareKanban`), Properties `Building2`, Matching `Target`, Appointments `CalendarDays`, Tasks `ListChecks`, Clients `Contact`, Import `Upload`, Reports `ChartColumn`, Team `UsersRound`, Settings `Settings`, Notifications `Bell`, Assistant `Sparkles`. Call is `Phone`, WhatsApp is `MessageCircle` (in the success tone), Email is `Mail`, Map is `MapPin` / `Navigation`, RERA is `ShieldCheck`, Vastu or facing is `Compass`, Area is `Ruler`, Parking is `Car`, Possession is `KeyRound`.

---

## 9. Illustrations (empty states and onboarding)

- **Approach:** small **inline SVG React components** in `src/components/illustrations/` (no image files, no external libraries). Each is under 2 KB, has a 160×120 viewBox, and is drawn with `currentColor` and CSS variables so it themes itself.
- **Style:** duotone line art. Strokes are 1.5 px in `var(--border-strong)` with key strokes in `var(--primary)`. Fills are `var(--primary-soft)` and one spot of `var(--highlight)` (marigold). A faint **jaali dot lattice** (a 6 px dot grid at 40% `--border`) sits in the background circle. Use rounded line caps and no people's faces. Objects are architectural: building outline, key, calendar with pin, kanban cards, magnifier over a floor plan, upload tray with a sheet, bell, sparkle.
- **Set (minimum):** `EmptyLeads` (contact cards plus a plus sign), `EmptyProperties` (building plus a key), `EmptyMatches` (two puzzle pieces as a house plus a person), `EmptyCalendar`, `EmptyTasks` (checklist with a tick: "All caught up!" variant with marigold confetti dots), `EmptyPipeline`, `EmptyImport` (tray plus an xlsx sheet), `EmptyNotifications` (bell plus zzz), `NoAccess` (lock on a door), `ErrorState` (a cracked tile), `NoResults` (magnifier).
- **Empty-state layout:** centred, illustration 120 px high, a title (`text-base` 600), one line of `text-muted-foreground`, then a primary action and one secondary (usually the AI path: "Paste a WhatsApp message"). The block is `py-12`.

---

## 10. Charts (recharts)

**Library:** `recharts` (v2, React 19 compatible). Charts are wrapped by a shadcn-style `ChartContainer` that reads `--chart-*` tokens, so light and dark themes work automatically. Funnel, heatmap and gauge are custom SVG, because recharts' versions are weak:

- **Funnel** is horizontal bars per stage, coloured with the stage tokens, with drop-off % labels between them.
- **Heatmap** is a 7×N grid of `rounded-[3px]` cells. Its fill is `color-mix(in oklch, var(--primary) X%, var(--card))` with X from 8% to 100% in 5 buckets.
- **Gauge / target ring** is an SVG arc. The track is `--muted`, the fill is `--primary`, and the fill turns `--highlight` when the target is met.

**Style rules**

- There is no chart border or background. The chart sits on the card.
- Height is 240 px standard, 160 px compact, and 48 px for sparklines.
- **Grid:** horizontal lines only, `stroke="var(--chart-grid)"`, `strokeDasharray="3 3"`, no vertical lines.
- **Axes:** `axisLine={false}` and `tickLine={false}`. Tick text is 11 px `var(--chart-axis)` with tabular numbers. Y ticks are formatted ₹ short (`₹45 L`, `₹1.2 Cr`) or counts, with 4–5 ticks. X dates are `DD MMM`.
- **Series:** use `chart-1` to `chart-8` in order. Stage charts use stage tokens and appointment charts use appointment tokens. Area charts use a 2 px line plus a vertical gradient fill from 24% to 0% opacity of the same token. Bars get a top radius of 4 px, `maxBarSize={28}`, and 4 px gaps. Donuts have an inner radius of 70%, a 2 px `--card` padding stroke between slices, and the centre shows the total (`text-kpi`) with a label.
- **Tooltip:** `bg-popover`, `border`, `rounded-lg`, `shadow-lg`, `px-3 py-2`, `text-xs`. The title is 600 weight. Each row is a 8 px colour dot, a label and a right-aligned tabular value. The cursor is a `var(--border-strong)` 1 px vertical line for lines and areas, and a `var(--muted)` band for bars.
- **Legend:** custom, top-right, with dots and `text-meta muted-foreground`. Clicking a legend item toggles its series.
- **Interaction:** hover highlights the series and dims the others to 35%. Clicking a bar, slice or stage navigates to a filtered list (for example, clicking the "Negotiation" funnel bar opens the pipeline filtered to that stage).
- **Empty chart:** the grid is drawn with a centred `text-muted-foreground` "No data for this period" and a period switcher. Never show a blank card.
- **Loading:** a skeleton block of the same height with three faint skeleton bars.

---

## 11. Component specs

All components are built on shadcn/ui + Radix in `src/components/ui`. Product-level pieces go in `src/components/app`, and the shell goes in `src/components/layout`.

### 11.1 App shell

```
┌──────────┬─────────────────────────────────────────────────────────────┐
│ Sidebar  │ Topbar: breadcrumb/title · [Search or ask AI… Ctrl K] · 🔔 · ☾ · EN/த │
│ 248px    ├─────────────────────────────────────────────────────────────┤
│ (64 col- │ Page header: H1 + subtitle · view switcher · primary action │
│ lapsed)  │ Content                                                     │
│          │                                                             │
│ Profile  │                                          [✦ AI] floating btn│
└──────────┴─────────────────────────────────────────────────────────────┘
```

- **Sidebar** (`bg-sidebar`, right border `sidebar-border`). It is 248 px wide and collapses to 64 px icon-only (the state is remembered, and Tooltips show the labels).
  - Top: the logo mark (a 28 px Peacock rounded square with a white roof-line glyph in SVG) and the product name "RealSpec CRM" in 600 weight.
  - Groups use `text-caption` uppercase `subtle-foreground` labels: *Work* (Today, Tasks, Appointments), *Sales* (Leads, Pipeline, Clients, Matching), *Inventory* (Properties, Import), *Insights* (Reports), *Admin* (Team, Settings). **Items are filtered by the permission map** and empty groups are hidden.
  - Item: 36 px tall, `rounded-md`, `px-2.5`, an 18 px icon, `text-sm` 500 weight. On hover it gets `bg-sidebar-accent/60`. When **active** it gets `bg-sidebar-accent` (white in light mode) plus `shadow-xs` plus `text-sidebar-accent-foreground`, with a 3 px Peacock bar on the left edge and a Peacock icon. Count badges (overdue tasks, unassigned leads) are right-aligned `text-micro` pills in `bg-danger-soft text-danger` or `bg-primary-soft text-primary`.
  - Bottom: the **profile switcher**.
- **Profile switcher:** a card-like button with an avatar (initials, role-tinted ring: Admin = `violet`, Manager = `info`, Executive = `primary`), name, role, and `ChevronsUpDown`. It opens a Popover (`w-72`, `shadow-lg`) with exactly **three role rows** (Admin, Sales Manager, Sales Executive). Each row has an icon tile, a role name and a one-line description. The Executive row expands inline to **three executive accounts** (avatar, name, active-lead count, and an availability dot: Available `success`, In a visit `warning`, On leave `neutral`). The current choice shows a check. Switching shows a toast ("Now viewing as Arjun Mehta · Sales Executive") and the content cross-fades over 200 ms.
- **Topbar:** 56 px tall, `bg-background/80 backdrop-blur`, sticky, with a bottom hairline that appears only after scrolling.
  - **Command / AI bar** in the middle: `w-[420px]`, a `bg-muted` pill with a `Sparkles` icon in Iris, the placeholder "Search or ask AI…" and a `kbd` "Ctrl K". Clicking it opens the assistant.
  - The **Bell** is a ghost icon button with an unread badge (a `bg-danger` dot with a white count in `text-micro`, popping with `ease-spring` on change). It opens a 380 px Popover with Tabs (All / Unread / Mentions). Items have an icon tile, text, a relative time and an unread dot. Actions are "Mark all read" and a "View all" link.
  - A theme toggle and a language toggle (EN / த) sit beside it.
- **Floating AI button:** bottom-right, a 48 px circle with `bg-ai-gradient`, a white `Sparkles` icon and `shadow-lg`. It is hidden when the panel is open. On phone it moves above the bottom navigation.
- **Mobile (below 768 px):** the sidebar becomes a Sheet opened from a hamburger. A **bottom tab bar** shows five role-specific items (Today, Leads, Calendar, Pipeline or Properties, More). The topbar shows the title, a search icon, the bell and an avatar.

### 11.2 KPI card

```
┌──────────────────────────────────┐
│ [icon tile]  SITE VISITS (MONTH) │   label: text-label uppercase muted
│ 18          ▲ 12% vs last month  │   number: text-kpi tabular · delta chip
│ ▁▂▃▂▅▆▅▇  (sparkline, 48px)       │   or progress ring (40px) at right
│ Target 25 ━━━━━━━━━━░░░  72%      │   optional progress bar
└──────────────────────────────────┘
```

- `bg-card border rounded-lg shadow-card p-5`. On hover (when clickable) it shows `shadow-md` and `-translate-y-0.5`, and clicking it navigates to the filtered list.
- **Delta chip:** `rounded-full px-1.5 text-meta` with an arrow icon. It is `bg-success-soft text-success` for good, `bg-danger-soft text-danger` for bad, and `neutral` for flat. **"Good" depends on the metric.** For example, overdue going up is bad.
- **Sparkline:** a recharts `AreaChart` with no axes, a 1.75 px stroke in the card's tone, a 20% to 0% gradient fill and a dot on the last point.
- **Progress ring** (variant): 40 or 56 px, 4 or 5 px stroke. The track is `--muted`, the fill is the tone, the caps are round, and the % sits in the centre in `text-micro` 600. The fill turns `--highlight` when the target is met.
- **Highlight variant** (one per dashboard at most): `bg-[linear-gradient(135deg,var(--primary),var(--primary-strong))] text-primary-foreground`, with the sparkline in white at 80%. Use it for the single headline metric, such as pipeline value.
- **Loading:** a skeleton label bar, a number bar and a sparkline block.

### 11.3 Lead card

- `rounded-lg border bg-card shadow-card p-4`, with a **3 px top or left edge in the temperature colour** (`hot` / `warm` / `cold`).
- **Row 1:** an avatar (40 px, initials), then the name (`text-base` 600) and on a second line the locality and config in `text-meta muted`. At the right is a **score ring** (36 px, the number in the centre; ≥ 70 `success`, 40–69 `warning`, under 40 `neutral`).
- **Row 2 chips:** a temperature pill (dot, icon and word), a stage pill (stage soft background, dot and label), and the budget `₹60 L – ₹80 L` (tabular, `bg-muted`).
- **Row 3:** the **reason line** in Iris for AI reasons ("✦ Visit at 11:00 today · asked for price sheet") or muted for plain facts.
- **Footer:** a last-contact badge (`Clock` icon plus "2d ago": muted when under 2 days, `warning` at 3–6 days, `danger` at 7 or more days or when the SLA is breached) and an executive avatar (24 px). On the right are icon buttons Call (`tel:`), WhatsApp (`wa.me`, success tone), and a "More" menu. On desktop these show on hover or focus. On touch they are always visible.
- **Compact variant** (for lists in the Today view) is a single 56 px row with the same pieces.

### 11.4 Property card

```
┌───────────────────────────────┐
│ [image 4:3, rounded-t-lg]     │  top-left: availability pill (blurred bg)
│                    ◔ 86%      │  top-right: match ring (when in match context)
│ ₹1.25 Cr  (price badge)       │  bottom-left over gradient scrim
├───────────────────────────────┤
│ Whitefield · Bengaluru        │  text-meta muted (locality first)
│ Prestige Lakeside 3BHK        │  text-base 600, 1 line truncate
│ [3 BHK] [1,450 sqft carpet] [Ready] [RERA ✓] │ chips
│ ₹8,620/sqft      ♡  ⋯         │
└───────────────────────────────┘
```

- **Image:** `aspect-[4/3] object-cover` with a bottom scrim (`linear-gradient(to top, oklch(0.15 0.02 250 / 0.55), transparent 55%)`). If there is no image, show a generated placeholder: the `primary-soft` background, the building illustration, and the config as large text.
- **Price badge:** sits on the image bottom-left. It is `bg-card/95 backdrop-blur rounded-md px-2 py-1 shadow-sm`, with the price in `text-base` 650 tabular weight, in the format "₹1.25 Cr" or "₹45 L". When the price is negotiable, a small `text-micro muted` "onwards" or "neg." follows.
- **Availability pill:** sits on the image top-left, `bg-card/90 backdrop-blur`, as dot plus label (Available `success`, On hold `warning`, Booked `info`, Sold `neutral`). Booked and Sold cards are rendered at 70% opacity in match contexts and are **excluded** from match lists.
- **Match ring:** sits on the image top-right, 44 px, with `bg-card/90` behind it. The ring colour is ≥ 80% `success`, 60–79% `primary`, 40–59% `warning`, and under 40% `neutral`. Hovering or focusing it opens a Popover with the explanation ("✓ Within budget · ✓ Whitefield · ✓ 3 BHK · ✗ covered parking").
- **Chips:** `rounded-xs bg-muted text-meta px-1.5 py-0.5` with an icon, showing at most 4 and then "+2".
- **Hover:** `shadow-md`, `-translate-y-0.5`, and the image scales to 1.03 inside an `overflow-hidden` frame. The match-context footer has the actions Shortlist, Share (WhatsApp), Schedule visit, Not interested.
- **Grid:** `grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5`.

### 11.5 Pipeline kanban

- The **board** sits in a horizontally scrolling well (`bg-canvas`) with `gap-3`. Columns are 296 px wide (min 272). The **page header** above it has a stage **progress strip**: one segmented bar across the full width, each segment sized by the count in that stage and filled with the stage colour, and hovering a segment shows its count and ₹ value.
- **Column:** `rounded-xl bg-[var(--stage-x-soft)]/50` (in dark mode the soft wash as is). It has a sticky header with a stage dot, the name (`text-sm` 600), a count pill, and the **₹ total value** (tabular, `text-meta`). A **3 px top bar in the stage colour** sits above the header. A thin progress bar shows this stage's share of the total pipeline value. The column body has `p-2 gap-2`, scrolls vertically, and has a "+ Add" ghost button at the bottom.
- **Card:** `bg-card rounded-lg border shadow-card p-3`. It shows the client name (600) with a temperature dot, the property (`text-meta muted`, truncated), the deal value ₹ (tabular 600), an executive avatar (20 px), and a **days-in-stage badge** (muted when under the threshold, `warning` from 1× to 2× the stage's target days, `danger` above 2×, labelled "Stalled"). It also shows the next follow-up (`CalendarClock` plus the date, in danger when overdue). Cards for deals the AI marks as stalled get an Iris "✦" corner marker with a tooltip that gives the reason.
- **Drag:** `@dnd-kit`. The lifted card gets `shadow-lg`, `rotate-[1.5deg]`, `scale-[1.02]` and `cursor-grabbing`. The target column gets a `ring-2 ring-[var(--stage-x)]/40` with a dashed placeholder of the same height. Drop uses `ease-spring` over 200 ms. **Keyboard dragging** is supported (Space to lift, arrow keys to move, Space to drop) with spoken announcements. Moving a card to Lost or Booked opens the required dialog, and Cancel returns the card to where it was.
- **List view** toggle: the same data in the data table (§11.7).

### 11.6 Calendar event chips

- **Month view:** a chip is 20 px tall, `rounded-xs`, `bg-appt-x-soft`, with a 3 px left border in `appt-x`, the `text-meta` time in 600 weight and the client name in `text-foreground` truncated. Each day shows at most 3 chips, then "+2 more" opens a popover.
- **Week and day view:** the block is positioned by time, `rounded-md bg-appt-x-soft border-l-[3px] border-appt-x p-1.5`, showing the time range, the type icon, the client and the locality. Status modifiers: **Completed** gets a `CheckCircle` and 70% opacity. **Cancelled** gets strikethrough and `stage-lost` colours. **No-show** gets a `danger` dashed border. **Tentative or Scheduled** keeps the default and **Confirmed** adds a solid dot.
- A **conflict** (an executive double-booked) gets a striped `danger-soft` overlay (`repeating-linear-gradient(45deg, var(--danger-soft) 0 6px, transparent 6px 12px)`) plus an `AlertTriangle` badge.
- The **current-time line** is 2 px `--danger` with a dot. **Today** is marked with a filled `primary` circle behind the date number.
- A **legend** of appointment types sits above the calendar as clickable filter chips.

### 11.7 Data table

- It is built with TanStack Table (or the ported table) inside a `rounded-lg border bg-card` container.
- **Sticky header:** `bg-card/95 backdrop-blur` with `text-label` uppercase `muted-foreground`, a height of 40 px, and a bottom hairline. When the body has scrolled it gets `shadow-[0_1px_0_var(--border),0_4px_8px_-6px_oklch(0_0_0/0.12)]`. Sort is shown with an icon (`ArrowUpDown` / `ArrowUp` / `ArrowDown`) on hover or when active. The first column (checkbox plus name) is **sticky-left** on narrow widths.
- **Rows:** 52 px (comfortable) or 40 px (compact, a toggle), with `border-b border-border/70`. Hover is `bg-muted/60`. Selected is `bg-primary-soft/60` with a 2 px left Peacock inset. Numbers and ₹ are right-aligned and tabular.
- **Row hover actions:** a right-anchored action cluster (Call, WhatsApp, Schedule, More) that fades in over 140 ms on row hover or focus-within, over a gradient that fades from the row background, so it never pushes layout. On touch the "More" button is always visible.
- **Bulk bar:** when rows are selected, a floating `shadow-xl rounded-xl bg-popover` bar rises from the bottom centre. It shows "3 selected · Assign · Change stage · Export · Delete", with Delete in `text-danger`.
- **Toolbar** above the table: a search input, filter pills (a dashed border when empty; filled `bg-primary-soft text-primary` with the count when active), a saved-views dropdown, a density toggle and a column visibility menu.
- **Pagination:** "1–25 of 132", a page-size select, and previous and next buttons, in a footer inside the card.
- **Empty, loading and error** states render *inside* the table body (§11.10).

### 11.8 Drawer and side panel

- Built on a shadcn `Sheet`, opening from the right. The widths are 480 px (preview) and 640 px (form or review). Below 768 px it is a full screen sheet, or it opens from the bottom with `rounded-t-2xl` for short actions.
- It uses `bg-popover shadow-xl` with `--overlay` behind it, slides 24 px with a fade over `--dur-slow` `ease-out`, and Esc closes it.
- **Structure:** a sticky header (title in `text-lg` 600, subtitle, and close / expand-to-page / more icon buttons), a scrolling body `p-6 gap-6`, and a sticky footer (`border-t bg-popover/95 backdrop-blur p-4`) with a secondary button on the left and the primary button on the right.
- **Record preview** (lead): a hero row (avatar 56, name, chips, score ring), a quick-action row (Call, WhatsApp, Schedule visit, Add follow-up, Match), then Tabs (Overview · Timeline · Matches · Appointments).
- **Unsaved changes:** closing shows a confirm dialog ("Discard changes?").

### 11.9 AI elements

- **AI panel** (global assistant, Ctrl+K or the floating button): a right side panel (440 px, `shadow-xl`, docked so it pushes content at ≥ 1280 px and overlays below that).
  - **Header:** an icon tile with `bg-ai-gradient` and a white Sparkles icon, the title "Assistant", the **context chip** ("On: Lead · Priya Sharma") and the **Demo AI badge**.
  - **Body:** chat bubbles. The user's are `bg-primary text-primary-foreground rounded-2xl rounded-br-sm`. The assistant's are `bg-card border rounded-2xl rounded-bl-sm`. **Action proposals** render as a card (`border-ai-border bg-ai-soft/40`) listing the changes ("Create appointment · Site visit · Priya Sharma · Sat 11:00 AM · Prestige Lakeside") with **Confirm** (primary), **Edit** and **Cancel** buttons. After the action runs, it shows a success line with **links to the changed records**. A refusal is shown in a `neutral` card with a `Lock` icon and the reason.
  - **Footer:** a textarea (`text-prompt`), a mic button (a red pulsing ring while listening, with the "Listening… (en-IN)" label) and send. Suggested prompts appear as chips above the input when the conversation is empty.
- **Inline module assistant** (paste-and-fill box): a card with `border-dashed border-ai-border bg-ai-soft/30 rounded-xl p-4`, a textarea, a mic, an "Extract" button (`bg-ai text-ai-foreground`), and the Demo AI badge.
  - **Missing-field questions** appear as a compact checklist with quick-pick chips ("When is the client planning to buy?": [Immediately] [1–3 months] [3–6 months] [Just exploring]).
  - **Effort saved line:** "✦ 8 fields auto-filled".
- **"AI-filled" field marker:** the field's wrapper gets the `.ai-filled` class (`bg-ai-soft` plus a 2 px inset left bar in `--ai`). A 14 px Iris `Sparkles` icon sits at the end of the label with a tooltip ("Filled by AI from your message · edit freely"). Editing the field by hand removes the marker. **Low-confidence** values get a `warning` dotted underline and the tooltip "Please check".
- **Demo AI badge:** `inline-flex h-5 items-center gap-1 rounded-full px-2 text-micro font-semibold uppercase tracking-wide`, with a 1 px `--ai-border` border, `text-ai`, `bg-ai-soft` and a `FlaskConical` icon at 12 px. Its tooltip reads "Simulated AI (rule-based, runs in your browser). Not a live model." When the live provider is active it reads "AI" instead, with the gradient border. **Every AI output from the simulated provider carries it.**
- **AI suggestion inline chip** (next best action, stalled deal): `bg-ai-soft text-ai rounded-md px-2 py-1 text-meta` with ✦, which is clickable.
- **Today AI greeting hero:** `rounded-2xl`. In light mode it is `bg-card` with a faint corner glow (`radial-gradient(600px circle at 0 0, color-mix(in oklch, var(--primary) 10%, transparent), transparent 60%)`) and the jaali dot pattern. It holds the greeting in `text-display`, the AI summary sentence, and up to three "Start here" action chips.

### 11.10 Empty, loading, skeleton and error states

- **Skeleton:** the `.skeleton` utility (shimmer from `--skeleton` to `--skeleton-shine`, 1.6 s; static when reduced motion is on). Skeletons **match the final layout**: a card skeleton for a card, rows for a table (6 rows with columns at 60/40/30/20% widths), and a block for a chart. Show skeletons after 150 ms only, so fast loads do not flash. Data comes from the local store, so skeletons are mainly used for import parsing, OCR and AI "thinking".
- **Loading in buttons:** a `Loader2 animate-spin` icon replaces the leading icon, the label stays, and the button is disabled with `aria-busy`.
- **Empty:** see §9 (illustration, title, line, primary action plus AI action). A **filtered-empty** state is different: "No leads match these filters" with a **Clear filters** button and no big illustration (use `NoResults` at 80 px).
- **Error:** the `ErrorState` illustration, the title "Something went wrong", a human explanation, and **Try again** plus **Go to Today** buttons. A route-level ErrorBoundary catches errors per page so the shell survives. Form errors appear inline under the field in `text-danger text-xs` with an `AlertCircle` icon, and the field border turns `border-danger` with a `shadow-[0_0_0_3px_var(--danger-soft)]` ring.
- **No access:** the `NoAccess` illustration, "This area isn't available for Sales Executive", what the role *can* do, and a Go to Today button.

### 11.11 Toasts (sonner)

- Position is **bottom-right** on desktop and **top-centre** on phone. At most 3 are visible, and they stack with `gap-2`.
- Style: `bg-popover border rounded-lg shadow-lg p-3 pr-4 min-w-[320px]`. On the left is a 28 px icon tile in the tone's soft background (success `CircleCheck`, error `CircleAlert`, info `Info`, warning `TriangleAlert`, AI `Sparkles` in Iris). Then the title (`text-sm` 600), an optional description (`text-meta muted`), and a right-aligned action (`Undo` or `View`) as a ghost button.
- **Every action toasts.** Destructive and bulk actions offer **Undo** with a 6 s duration (the default is 4 s). Errors stay until dismissed.
- AI-executed actions use the AI tone and link to the changed record ("Site visit booked for Priya Sharma · View").

### 11.12 Other primitives (brief)

- **Buttons:** 36 px tall (sm 32, lg 40), `rounded-md`, `text-sm` 500 weight. **Primary** is `bg-primary` with hover to `primary-strong`. **Secondary** is `bg-card border shadow-xs`. **Ghost**. **Destructive** is `bg-danger text-danger-foreground`. **AI** is `bg-ai text-ai-foreground` (with the gradient variant for heroes only). Icon buttons are square at 36 or 32 px. Pressing scales to 0.98 over 80 ms.
- **Inputs:** 36 px, `rounded-sm` (8), `bg-card border-input shadow-xs`, and focus gives `border-ring shadow-focus`. Labels are `text-sm` 500 above the field, and optional fields are marked "(optional)" in muted text. Required fields are never asterisk-only; the label says "Required" for screen readers. Collapsed optional sections use an Accordion with a "+ More details (6)" trigger.
- **Badges and pills:** `h-5 rounded-full px-2 text-meta font-medium`, with a dot variant.
- **Tabs:** an underline style with a 2 px Peacock indicator that slides over 200 ms. Counts sit in `bg-muted` pills.
- **Timeline:** a vertical 1 px `--border` line with 28 px icon-tile nodes coloured by event type (stage change uses that stage's colour, a call `appt-call`, a note `neutral`, AI `ai`, assignment `info`). Each entry has its text, the actor avatar and a relative time. Items are grouped by day with sticky day labels.
- **Workload bars** (team): one row per executive, showing an avatar, name, a stacked horizontal bar (hot / warm / cold leads in the temperature colours) on a `--muted` track scaled to the team maximum, a count, and an availability dot.

---

## 12. Ready-to-paste `src/index.css`

The foundation developer replaces the whole of `crm-e2e/src/index.css` with this block. It needs `tailwindcss@4`, `tw-animate-css`, `shadcn`, `@fontsource-variable/inter` and `@fontsource/noto-sans-tamil` (the same packages as wireframe-rebuild). The theme script (`src/lib/theme.ts`, ported) toggles `.dark` on `<html>`. Changes from wireframe-rebuild:

- Every value is now OKLCH.
- New tokens: `canvas`, `primary-soft/-strong`, `subtle-foreground`, `border-strong`, `highlight`, `ai*`, `hot/warm/cold`, `stage-*`, `appt-*`, `chart-6..8`, `chart-grid/axis`, `shadow-xs..xl`, motion and skeleton tokens.
- The `ribbon` tokens are removed, because the new app has no wireframe ribbon.
- The `--shadow-card` and `--text-*` names are kept, so ported components still compile.

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";
@import "@fontsource-variable/inter";
@import "@fontsource/noto-sans-tamil/400.css";
@import "@fontsource/noto-sans-tamil/500.css";
@import "@fontsource/noto-sans-tamil/600.css";
@import "@fontsource/noto-sans-tamil/700.css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --breakpoint-3xl: 120rem;
  --breakpoint-4xl: 137.5rem;

  --font-sans: 'Inter Variable', 'Noto Sans Tamil', ui-sans-serif, system-ui, 'Segoe UI', sans-serif;
  --font-heading: var(--font-sans);
  --font-mono: ui-monospace, 'Cascadia Code', Consolas, monospace;

  /* shadcn core */
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-canvas: var(--canvas);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary-soft: var(--primary-soft);
  --color-primary-strong: var(--primary-strong);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-subtle-foreground: var(--subtle-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-border-strong: var(--border-strong);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-highlight: var(--highlight);
  --color-highlight-soft: var(--highlight-soft);
  --color-highlight-foreground: var(--highlight-foreground);

  /* semantic tones: text/solid + soft background + text-on-solid */
  --color-success: var(--success);
  --color-success-soft: var(--success-soft);
  --color-success-foreground: var(--success-foreground);
  --color-warning: var(--warning);
  --color-warning-soft: var(--warning-soft);
  --color-warning-foreground: var(--warning-foreground);
  --color-danger: var(--danger);
  --color-danger-soft: var(--danger-soft);
  --color-danger-foreground: var(--danger-foreground);
  --color-info: var(--info);
  --color-info-soft: var(--info-soft);
  --color-info-foreground: var(--info-foreground);
  --color-violet: var(--violet);
  --color-violet-soft: var(--violet-soft);
  --color-violet-foreground: var(--violet-foreground);
  --color-neutral: var(--neutral);
  --color-neutral-soft: var(--neutral-soft);
  --color-neutral-foreground: var(--neutral-foreground);

  /* AI */
  --color-ai: var(--ai);
  --color-ai-soft: var(--ai-soft);
  --color-ai-foreground: var(--ai-foreground);
  --color-ai-border: var(--ai-border);

  /* lead temperature */
  --color-hot: var(--hot);
  --color-hot-soft: var(--hot-soft);
  --color-warm: var(--warm);
  --color-warm-soft: var(--warm-soft);
  --color-cold: var(--cold);
  --color-cold-soft: var(--cold-soft);

  /* pipeline stages */
  --color-stage-new: var(--stage-new);
  --color-stage-new-soft: var(--stage-new-soft);
  --color-stage-contacted: var(--stage-contacted);
  --color-stage-contacted-soft: var(--stage-contacted-soft);
  --color-stage-qualified: var(--stage-qualified);
  --color-stage-qualified-soft: var(--stage-qualified-soft);
  --color-stage-visit-scheduled: var(--stage-visit-scheduled);
  --color-stage-visit-scheduled-soft: var(--stage-visit-scheduled-soft);
  --color-stage-visit-done: var(--stage-visit-done);
  --color-stage-visit-done-soft: var(--stage-visit-done-soft);
  --color-stage-negotiation: var(--stage-negotiation);
  --color-stage-negotiation-soft: var(--stage-negotiation-soft);
  --color-stage-booked: var(--stage-booked);
  --color-stage-booked-soft: var(--stage-booked-soft);
  --color-stage-converted: var(--stage-converted);
  --color-stage-converted-soft: var(--stage-converted-soft);
  --color-stage-lost: var(--stage-lost);
  --color-stage-lost-soft: var(--stage-lost-soft);

  /* appointment types */
  --color-appt-site-visit: var(--appt-site-visit);
  --color-appt-site-visit-soft: var(--appt-site-visit-soft);
  --color-appt-office: var(--appt-office);
  --color-appt-office-soft: var(--appt-office-soft);
  --color-appt-call: var(--appt-call);
  --color-appt-call-soft: var(--appt-call-soft);
  --color-appt-video: var(--appt-video);
  --color-appt-video-soft: var(--appt-video-soft);
  --color-appt-docs: var(--appt-docs);
  --color-appt-docs-soft: var(--appt-docs-soft);

  /* sidebar (shadcn names) */
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);

  /* charts */
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-chart-6: var(--chart-6);
  --color-chart-7: var(--chart-7);
  --color-chart-8: var(--chart-8);
  --color-chart-grid: var(--chart-grid);
  --color-chart-axis: var(--chart-axis);

  /* radius */
  --radius-xs: calc(var(--radius) - 6px);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --radius-2xl: calc(var(--radius) + 8px);
  --radius-3xl: calc(var(--radius) + 12px);
  --radius-4xl: calc(var(--radius) + 16px);

  /* elevation */
  --shadow-xs: var(--elev-xs);
  --shadow-sm: var(--elev-sm);
  --shadow-md: var(--elev-md);
  --shadow-lg: var(--elev-lg);
  --shadow-xl: var(--elev-xl);
  --shadow-card: var(--elev-sm);
  --shadow-card-hover: var(--elev-md);
  --shadow-focus: 0 0 0 3px var(--ring-soft);

  /* small named type sizes (kept from wireframe-rebuild so ported screens keep their names) */
  --text-micro: 0.625rem;
  --text-caption: 0.6875rem;
  --text-label: 0.71875rem;
  --text-meta: 0.78125rem;
  --text-ui: 0.8125rem;
  --text-prompt: 0.90625rem;
  /* display sizes for numbers and page titles */
  --text-kpi: 1.75rem;
  --text-kpi--line-height: 2.125rem;
  --text-kpi--letter-spacing: -0.02em;
  --text-display: 2.25rem;
  --text-display--line-height: 2.625rem;
  --text-display--letter-spacing: -0.025em;

  /* motion */
  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --ease-spring: cubic-bezier(0.34, 1.4, 0.64, 1);
  --animate-shimmer: shimmer 1.6s linear infinite;
  --animate-ai-pulse: ai-pulse 2.4s var(--ease-in-out) infinite;
  --animate-fade-up: fade-up 240ms var(--ease-out) both;
}

:root,
.light {
  --radius: 0.75rem;

  /* motion durations (read by components via var()) */
  --dur-instant: 80ms;
  --dur-fast: 140ms;
  --dur-base: 200ms;
  --dur-slow: 280ms;
  --dur-slower: 420ms;

  /* surfaces + ink: cool slate with a faint peacock tint */
  --background: oklch(0.975 0.004 230);
  --canvas: oklch(0.985 0.003 230);
  --foreground: oklch(0.22 0.025 250);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.22 0.025 250);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.22 0.025 250);

  /* primary: Peacock */
  --primary: oklch(0.5 0.09 218);
  --primary-strong: oklch(0.43 0.08 222);
  --primary-foreground: oklch(0.99 0.004 210);
  --primary-soft: oklch(0.955 0.025 212);
  --secondary: oklch(0.955 0.006 235);
  --secondary-foreground: oklch(0.32 0.025 250);
  --muted: oklch(0.96 0.005 235);
  --muted-foreground: oklch(0.48 0.022 250);
  --subtle-foreground: oklch(0.55 0.018 250);
  --accent: oklch(0.955 0.025 212);
  --accent-foreground: oklch(0.43 0.08 222);
  --destructive: oklch(0.54 0.19 25);
  --destructive-foreground: oklch(0.99 0.004 25);
  --border: oklch(0.92 0.007 240);
  --border-strong: oklch(0.86 0.01 240);
  --input: oklch(0.88 0.01 240);
  --ring: oklch(0.55 0.099 218);
  --ring-soft: oklch(0.55 0.099 218 / 0.22);

  /* highlight: Marigold, used sparingly (premium, "new", gradient end, target met) */
  --highlight: oklch(0.8 0.15 78);
  --highlight-soft: oklch(0.965 0.037 85);
  --highlight-foreground: oklch(0.3 0.06 60);

  /* semantic tones (text-on-white / dot / fill) */
  --success: oklch(0.52 0.125 155);
  --success-soft: oklch(0.955 0.04 158);
  --success-foreground: oklch(0.99 0.01 155);
  --warning: oklch(0.54 0.12 62);
  --warning-soft: oklch(0.96 0.038 82);
  --warning-foreground: oklch(0.99 0.009 80);
  --danger: oklch(0.54 0.19 25);
  --danger-soft: oklch(0.96 0.019 22);
  --danger-foreground: oklch(0.99 0.004 25);
  --info: oklch(0.52 0.14 255);
  --info-soft: oklch(0.955 0.021 255);
  --info-foreground: oklch(0.99 0.004 255);
  --violet: oklch(0.52 0.18 292);
  --violet-soft: oklch(0.955 0.023 292);
  --violet-foreground: oklch(0.99 0.004 292);
  --neutral: oklch(0.47 0.02 250);
  --neutral-soft: oklch(0.955 0.005 250);
  --neutral-foreground: oklch(0.99 0 0);

  /* AI: Iris, plus the Peacock to Iris gradient (AI surfaces only) */
  --ai: oklch(0.52 0.17 285);
  --ai-soft: oklch(0.96 0.019 285);
  --ai-foreground: oklch(0.99 0.004 285);
  --ai-border: oklch(0.82 0.08 285);
  --ai-gradient: linear-gradient(135deg, oklch(0.56 0.097 210), oklch(0.53 0.17 285));

  /* lead temperature */
  --hot: oklch(0.54 0.18 32);
  --hot-soft: oklch(0.955 0.022 35);
  --warm: oklch(0.53 0.115 62);
  --warm-soft: oklch(0.96 0.038 82);
  --cold: oklch(0.53 0.12 240);
  --cold-soft: oklch(0.955 0.022 235);

  /* pipeline stages: solid = dot, bar, column accent; soft = column wash, badge background */
  --stage-new: oklch(0.62 0.12 235);
  --stage-new-soft: oklch(0.96 0.02 235);
  --stage-contacted: oklch(0.56 0.15 265);
  --stage-contacted-soft: oklch(0.955 0.021 265);
  --stage-qualified: oklch(0.55 0.17 295);
  --stage-qualified-soft: oklch(0.955 0.023 295);
  --stage-visit-scheduled: oklch(0.74 0.14 75);
  --stage-visit-scheduled-soft: oklch(0.965 0.037 85);
  --stage-visit-done: oklch(0.66 0.15 50);
  --stage-visit-done-soft: oklch(0.96 0.023 55);
  --stage-negotiation: oklch(0.6 0.18 355);
  --stage-negotiation-soft: oklch(0.96 0.022 355);
  --stage-booked: oklch(0.58 0.098 200);
  --stage-booked-soft: oklch(0.955 0.03 200);
  --stage-converted: oklch(0.57 0.14 152);
  --stage-converted-soft: oklch(0.955 0.04 155);
  --stage-lost: oklch(0.6 0.02 250);
  --stage-lost-soft: oklch(0.955 0.004 250);

  /* appointment types */
  --appt-site-visit: oklch(0.6 0.15 45);
  --appt-site-visit-soft: oklch(0.96 0.022 50);
  --appt-office: oklch(0.56 0.15 265);
  --appt-office-soft: oklch(0.955 0.021 265);
  --appt-call: oklch(0.57 0.129 160);
  --appt-call-soft: oklch(0.955 0.04 160);
  --appt-video: oklch(0.56 0.17 300);
  --appt-video-soft: oklch(0.955 0.025 300);
  --appt-docs: oklch(0.7 0.13 85);
  --appt-docs-soft: oklch(0.965 0.041 88);

  /* sidebar: sits on the canvas, active item is a raised white pill */
  --sidebar: oklch(0.975 0.004 230);
  --sidebar-foreground: oklch(0.36 0.022 250);
  --sidebar-primary: oklch(0.5 0.09 218);
  --sidebar-primary-foreground: oklch(0.99 0.004 210);
  --sidebar-accent: oklch(1 0 0);
  --sidebar-accent-foreground: oklch(0.22 0.025 250);
  --sidebar-border: oklch(0.92 0.007 240);
  --sidebar-ring: oklch(0.55 0.099 218);

  /* charts: ordered for adjacent contrast */
  --chart-1: oklch(0.55 0.097 215);
  --chart-2: oklch(0.78 0.14 75);
  --chart-3: oklch(0.55 0.16 280);
  --chart-4: oklch(0.66 0.16 32);
  --chart-5: oklch(0.63 0.13 155);
  --chart-6: oklch(0.62 0.17 350);
  --chart-7: oklch(0.72 0.1 232);
  --chart-8: oklch(0.62 0.025 250);
  --chart-grid: oklch(0.93 0.006 240);
  --chart-axis: oklch(0.55 0.018 250);

  /* elevation: ink-tinted, layered */
  --elev-xs: 0 1px 2px oklch(0.22 0.025 250 / 0.05);
  --elev-sm: 0 1px 2px oklch(0.22 0.025 250 / 0.05), 0 1px 3px oklch(0.22 0.025 250 / 0.06);
  --elev-md: 0 2px 4px oklch(0.22 0.025 250 / 0.04), 0 6px 16px -2px oklch(0.22 0.025 250 / 0.08);
  --elev-lg: 0 4px 8px oklch(0.22 0.025 250 / 0.04), 0 16px 32px -6px oklch(0.22 0.025 250 / 0.12);
  --elev-xl: 0 8px 16px oklch(0.22 0.025 250 / 0.06), 0 28px 56px -12px oklch(0.22 0.025 250 / 0.2);

  --scrollbar: oklch(0.86 0.01 240);
  --scrollbar-soft: oklch(0.9 0.008 240);
  --scrollbar-hover: oklch(0.74 0.015 245);
  --skeleton: oklch(0.94 0.006 240);
  --skeleton-shine: oklch(0.975 0.004 240);
  --overlay: oklch(0.2 0.03 250 / 0.4);
}

/* Dark: deep ink-slate surfaces that step lighter with elevation (not an inversion). Peacock brightens to Lagoon. */
.dark {
  --background: oklch(0.165 0.012 245);
  --canvas: oklch(0.145 0.012 245);
  --foreground: oklch(0.94 0.006 240);
  --card: oklch(0.2 0.014 245);
  --card-foreground: oklch(0.94 0.006 240);
  --popover: oklch(0.225 0.015 245);
  --popover-foreground: oklch(0.94 0.006 240);

  --primary: oklch(0.74 0.115 205);
  --primary-strong: oklch(0.8 0.1 200);
  --primary-foreground: oklch(0.18 0.03 225);
  --primary-soft: oklch(0.29 0.05 215);
  --secondary: oklch(0.255 0.014 245);
  --secondary-foreground: oklch(0.88 0.01 240);
  --muted: oklch(0.24 0.013 245);
  --muted-foreground: oklch(0.7 0.016 245);
  --subtle-foreground: oklch(0.63 0.016 245);
  --accent: oklch(0.29 0.05 215);
  --accent-foreground: oklch(0.86 0.08 205);
  --destructive: oklch(0.7 0.17 22);
  --destructive-foreground: oklch(0.18 0.03 22);
  --border: oklch(0.285 0.014 245);
  --border-strong: oklch(0.35 0.016 245);
  --input: oklch(0.32 0.016 245);
  --ring: oklch(0.74 0.115 205);
  --ring-soft: oklch(0.74 0.115 205 / 0.3);

  --highlight: oklch(0.82 0.14 80);
  --highlight-soft: oklch(0.29 0.05 75);
  --highlight-foreground: oklch(0.2 0.04 70);

  --success: oklch(0.76 0.14 155);
  --success-soft: oklch(0.27 0.045 158);
  --success-foreground: oklch(0.18 0.03 155);
  --warning: oklch(0.81 0.13 78);
  --warning-soft: oklch(0.28 0.045 72);
  --warning-foreground: oklch(0.2 0.04 70);
  --danger: oklch(0.72 0.16 22);
  --danger-soft: oklch(0.28 0.06 22);
  --danger-foreground: oklch(0.18 0.03 22);
  --info: oklch(0.75 0.12 250);
  --info-soft: oklch(0.27 0.05 255);
  --info-foreground: oklch(0.18 0.03 255);
  --violet: oklch(0.76 0.13 295);
  --violet-soft: oklch(0.28 0.06 295);
  --violet-foreground: oklch(0.18 0.03 295);
  --neutral: oklch(0.76 0.015 245);
  --neutral-soft: oklch(0.26 0.012 245);
  --neutral-foreground: oklch(0.17 0.012 245);

  --ai: oklch(0.76 0.128 285);
  --ai-soft: oklch(0.27 0.06 285);
  --ai-foreground: oklch(0.18 0.03 285);
  --ai-border: oklch(0.42 0.1 285);
  --ai-gradient: linear-gradient(135deg, oklch(0.7 0.11 205), oklch(0.68 0.15 285));

  --hot: oklch(0.72 0.17 35);
  --hot-soft: oklch(0.28 0.06 32);
  --warm: oklch(0.81 0.13 78);
  --warm-soft: oklch(0.28 0.045 72);
  --cold: oklch(0.75 0.11 238);
  --cold-soft: oklch(0.27 0.045 240);

  --stage-new: oklch(0.74 0.11 235);
  --stage-new-soft: oklch(0.26 0.035 238);
  --stage-contacted: oklch(0.72 0.13 268);
  --stage-contacted-soft: oklch(0.27 0.05 268);
  --stage-qualified: oklch(0.73 0.14 295);
  --stage-qualified-soft: oklch(0.27 0.055 295);
  --stage-visit-scheduled: oklch(0.82 0.14 80);
  --stage-visit-scheduled-soft: oklch(0.28 0.045 75);
  --stage-visit-done: oklch(0.75 0.14 52);
  --stage-visit-done-soft: oklch(0.28 0.05 50);
  --stage-negotiation: oklch(0.72 0.16 355);
  --stage-negotiation-soft: oklch(0.28 0.06 355);
  --stage-booked: oklch(0.75 0.1 198);
  --stage-booked-soft: oklch(0.27 0.045 205);
  --stage-converted: oklch(0.75 0.14 152);
  --stage-converted-soft: oklch(0.27 0.045 155);
  --stage-lost: oklch(0.6 0.018 245);
  --stage-lost-soft: oklch(0.25 0.01 245);

  --appt-site-visit: oklch(0.74 0.14 48);
  --appt-site-visit-soft: oklch(0.28 0.05 48);
  --appt-office: oklch(0.72 0.13 268);
  --appt-office-soft: oklch(0.27 0.05 268);
  --appt-call: oklch(0.75 0.13 160);
  --appt-call-soft: oklch(0.27 0.045 160);
  --appt-video: oklch(0.74 0.14 300);
  --appt-video-soft: oklch(0.28 0.055 300);
  --appt-docs: oklch(0.82 0.13 85);
  --appt-docs-soft: oklch(0.28 0.045 82);

  --sidebar: oklch(0.145 0.012 245);
  --sidebar-foreground: oklch(0.78 0.014 245);
  --sidebar-primary: oklch(0.74 0.115 205);
  --sidebar-primary-foreground: oklch(0.18 0.03 225);
  --sidebar-accent: oklch(0.23 0.016 245);
  --sidebar-accent-foreground: oklch(0.96 0.006 240);
  --sidebar-border: oklch(0.25 0.013 245);
  --sidebar-ring: oklch(0.74 0.115 205);

  --chart-1: oklch(0.72 0.11 205);
  --chart-2: oklch(0.82 0.14 80);
  --chart-3: oklch(0.7 0.14 282);
  --chart-4: oklch(0.72 0.15 35);
  --chart-5: oklch(0.74 0.13 155);
  --chart-6: oklch(0.72 0.15 352);
  --chart-7: oklch(0.8 0.09 232);
  --chart-8: oklch(0.62 0.02 245);
  --chart-grid: oklch(0.27 0.012 245);
  --chart-axis: oklch(0.62 0.016 245);

  /* dark elevation: deeper drop + a 1px top highlight so raised surfaces read */
  --elev-xs: 0 1px 2px oklch(0 0 0 / 0.3);
  --elev-sm: inset 0 1px 0 oklch(1 0 0 / 0.04), 0 1px 2px oklch(0 0 0 / 0.35), 0 1px 3px oklch(0 0 0 / 0.25);
  --elev-md: inset 0 1px 0 oklch(1 0 0 / 0.05), 0 2px 4px oklch(0 0 0 / 0.3), 0 8px 20px -4px oklch(0 0 0 / 0.45);
  --elev-lg: inset 0 1px 0 oklch(1 0 0 / 0.06), 0 4px 8px oklch(0 0 0 / 0.3), 0 18px 36px -8px oklch(0 0 0 / 0.55);
  --elev-xl: inset 0 1px 0 oklch(1 0 0 / 0.06), 0 8px 16px oklch(0 0 0 / 0.35), 0 30px 60px -12px oklch(0 0 0 / 0.65);

  --scrollbar: oklch(0.33 0.014 245);
  --scrollbar-soft: oklch(0.29 0.013 245);
  --scrollbar-hover: oklch(0.42 0.016 245);
  --skeleton: oklch(0.24 0.013 245);
  --skeleton-shine: oklch(0.29 0.014 245);
  --overlay: oklch(0.08 0.01 245 / 0.6);
}

@keyframes shimmer {
  from { background-position: -200% 0; }
  to { background-position: 200% 0; }
}
@keyframes ai-pulse {
  0%, 100% { opacity: 0.55; }
  50% { opacity: 1; }
}
@keyframes fade-up {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  html {
    @apply font-sans;
    font-feature-settings: 'cv11', 'ss01';
  }
  /* Laptops and desktops: 90% root (decision carried over from wireframe-rebuild, 26 Nov). */
  @media (min-width: 64rem) {
    html { font-size: 90%; }
  }
  body {
    @apply bg-background text-foreground antialiased;
  }
  /* Tamil script needs a little more line height and no negative tracking */
  :lang(ta) {
    line-height: 1.65;
    letter-spacing: 0;
  }
  button:not(:disabled),
  [role='button']:not(:disabled) {
    cursor: pointer;
  }
  .tabular, .num { font-variant-numeric: tabular-nums; }
}

@layer utilities {
  .bg-ai-gradient { background-image: var(--ai-gradient); }
  .text-ai-gradient { background-image: var(--ai-gradient); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .skeleton {
    background: linear-gradient(90deg, var(--skeleton) 0%, var(--skeleton-shine) 50%, var(--skeleton) 100%);
    background-size: 200% 100%;
    animation: var(--animate-shimmer);
    border-radius: var(--radius-sm);
  }
  .ai-filled {
    background-color: var(--ai-soft);
    box-shadow: inset 2px 0 0 var(--ai);
  }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
  .skeleton { animation: none; }
}

/* Thin scrollbars (carried over from wireframe-rebuild) */
html::-webkit-scrollbar { width: 8px; height: 8px; }
html::-webkit-scrollbar-track { background: transparent; }
html::-webkit-scrollbar-thumb { background: var(--scrollbar); border-radius: 99px; border: 2px solid var(--background); }
html::-webkit-scrollbar-thumb:hover { background: var(--scrollbar-hover); }
*::-webkit-scrollbar { width: 6px; height: 6px; }
*::-webkit-scrollbar-track { background: transparent; }
*::-webkit-scrollbar-corner { background: transparent; }
*::-webkit-scrollbar-thumb { background: var(--scrollbar-soft); border-radius: 99px; }
*::-webkit-scrollbar-thumb:hover { background: var(--scrollbar-hover); }
@supports not selector(::-webkit-scrollbar) {
  * { scrollbar-width: thin; scrollbar-color: var(--scrollbar-soft) transparent; }
  html { scrollbar-width: thin; scrollbar-color: var(--scrollbar) transparent; }
}
```

**Font note:** add `@fontsource/noto-sans-tamil/700.css` (new compared with wireframe-rebuild) so Tamil text at 650–700 weight does not get faux bold.

**Tailwind usage examples:** `bg-stage-booked-soft`, `bg-stage-booked` (dot), `border-appt-site-visit`, `text-hot`, `bg-ai-soft`, `ring-ring`, `shadow-md`, `text-kpi`, `ease-out`, `animate-fade-up`, `bg-ai-gradient`, `.skeleton`, `.ai-filled`. For a value the utilities do not cover, use `var(--x)` in an arbitrary value, never a literal colour.

---

## 13. Theme and i18n mechanism (unchanged from wireframe-rebuild)

- `src/lib/theme.ts` (ported): `light | dark | system` is saved in localStorage (use the key `crm-e2e-theme`, a new key, so it does not collide with the old app) and toggles `.dark` and `color-scheme` on `<html>`. `index.html` has an inline script that applies the theme before first paint. `system` follows `prefers-color-scheme` live.
- Charts read CSS variables, so they re-theme without a re-render. Recharts props take `var(--chart-1)` strings directly.
- i18next with `en` and `ta`, and the language saved in localStorage. `<html lang>` is updated so the `:lang(ta)` typography rules apply. Every UI string goes through `t()`, including chart labels, empty states, toasts and the "Demo AI" badge.
- **Tone mapping** lives in one file, `src/lib/tones.ts`. It maps a domain value to its token family and icon (for example `stageTone['negotiation'] = { solid: 'bg-stage-negotiation', soft: 'bg-stage-negotiation-soft', icon: Handshake }`). Components never pick colours by hand, and the class strings are written in full, never interpolated, so Tailwind can detect them.

---

## 14. Responsive breakpoints and layout rules

The design is desktop first. Every screen must be fully usable at 360 px.

| Breakpoint | Width | Layout |
|---|---|---|
| Phone | < 640 (`sm`) | Single column. Bottom tab bar (5 items) and sidebar as a Sheet. Topbar 52 px. Cards full width with `p-4`. KPI cards in a 2-column grid of compact tiles (no sparkline, only number and delta). Tables become **stacked cards** (a lead-card compact variant), never horizontal-scroll walls. Kanban shows one column at a time with stage tabs plus a swipe; dragging is replaced by a "Move to…" sheet. Calendar defaults to day or list view. Drawers are full screen. Dialogs are bottom sheets. The floating AI button sits above the tab bar. Hit targets are at least 44 px. |
| Large phone / small tablet | 640–767 | As above, with 2-column card grids. |
| Tablet | 768–1023 (`md`) | Sidebar collapsed to 64 px icons, expanding as an overlay. Content grids 2 columns. KPI row 2×2. Tables show the key columns only, with the rest in a "Columns" menu and a sticky first column. Kanban scrolls horizontally with 280 px columns. Drawers 480 px over the content. The AI panel is an overlay. |
| Laptop | 1024–1279 (`lg`) | Root font 90%. Full sidebar 248 px (collapsible). KPI row with 4 columns. Dashboards use a 12-column grid (charts 8 + 4). The AI panel overlays. |
| Desktop | 1280–1919 (`xl`, `2xl`) | AI panel **docks** and pushes content. Property grid 3–4 per row. Lead page in three zones: summary rail 320, main, related 360. |
| Wide | ≥ 1920 (`3xl`), ≥ 2200 (`4xl`) | Content capped at `max-w-[1600px]` for dashboards and forms. List grids add columns (5–6 property cards). |

**Layout rules (every module)**

1. The page header is always: H1 plus a one-line subtitle on the left, and on the right a view switcher (List / Board / Calendar), secondary actions, and **one** primary action (with the AI paste action next to it). Below it come the toolbar (search, filters, saved views) and then the content.
2. One primary button per view. The others are secondary or ghost.
3. Record pages use the same three zones. Below `xl` the related zone moves under the main zone, and below `md` everything stacks in the order summary, actions, tabs.
4. Today views: hero greeting across the full width, then a 12-column grid where the priority list takes 7 columns and the appointments timeline plus targets take 5. Below `lg` it is a single column in the order hero, priority list, appointments, targets.
5. Cards in a row keep equal heights (`grid auto-rows-fr` where the content is similar).
6. Scrolling: only the page scrolls, except the kanban well, table bodies inside fixed-height panels, and drawers. Nested scrolling is avoided on phone.
7. Focus is always visible (`focus-visible:ring-2 ring-ring ring-offset-2 ring-offset-background`). Tab order follows the visual order. Ctrl+K opens the assistant, `/` focuses the search, `g` then `t / l / p / c` jump to Today, Leads, Pipeline or Calendar, and Esc closes the top layer.

---

## 15. What makes this distinct (summary for reviewers)

- The Peacock primary with Marigold highlights, instead of the generic SaaS blue and violet, with Iris kept only for AI so AI-made changes are always identifiable.
- Indian property grammar on every card: ₹ L / Cr, BHK and carpet chips, RERA tick, locality first, WhatsApp-first actions.
- Graphical density: icon tiles, rings, sparklines, stage strips, workload bars and timelines on every screen, all drawn from one token set.
- Duotone architectural line illustrations with a jaali dot motif.
- A dark mode designed as its own palette (rising lightness, brightened accents, inset highlights), not an inversion.
