# 3. Properties module — structure and layouts

**Status:** approved 23 November 2026 with the recommended answers:
- one ＋ Add for single and bulk;
- one scrolling property page;
- "Waiting for approval" removed;
- executives don't see drafts;
- map view later.

P1 and P2 are built.

The first module designed from scratch. Its behaviour follows what the CTO approved: AI add property, bulk import, natural-language search, two-way matching and nearby places. The screens, the flow and the layout are new.

**Who does what**

| | Sales manager and Admin | Sales executive |
|---|---|---|
| Browse, search, view | ✓ | ✓ (only listed properties, never drafts) |
| Share with a lead, book a visit | ✓ | ✓ |
| Add, import, edit, change price or status | ✓ | — |

Because executives no longer add properties, **"Waiting for approval" goes away.** A property is either a Draft or listed.

**Statuses:** Draft → Available ⇄ Under negotiation ⇄ Reserved ⇄ On hold → Booked → Sold. Archived is kept out of view.

---

## 3.1 The screens

Five screens are new. Two existing features become panels instead of pages.

| # | Screen | Purpose | Main user |
|---|---|---|---|
| P1 | **Properties** | Find a property: a plain-words search and photo-first cards | Everyone |
| P2 | **Property page** | Everything about one property on one scrolling page, with matching at the top | Everyone |
| P3 | **Add** | One entry for adding properties: describe it, speak it, or drop files. One property goes to the AI assistant; many go to the Check screen | Manager |
| P4 | **Check import** | Review what the AI read from a sheet, brochure or photos before saving | Manager |
| P5 | **Customer page** | The brochure a customer opens from a WhatsApp link | Customer |
| — | *Edit with AI* (panel) | "Price is now 65 L" → shows the change → confirm | Manager |
| — | *Share* (panel) | Pick the lead, then send by WhatsApp, link or PDF; it's logged on the lead | Everyone |

```
                ┌──────────── ＋ Add ────────────┐
                │  describe · speak · drop files │
                └──────┬──────────────────┬──────┘
                one property        many properties
                       ▼                  ▼
              P3 AI assistant      P4 Check import
                       │                  │
                       └────► P2 ◄────────┘
P1 Properties ─────────────► Property page ──► Share panel ──► P5 Customer page
 (search, cards)               │   ▲                               (WhatsApp link)
                               ▼   │
                         Edit with AI panel
```

**What changes from before**
- **One ＋ Add instead of "Add property" and "Bulk import".** The system decides from what is dropped in: one property goes to the assistant, many go to Check.
- **The property page is one scrolling page with a jump bar** (Overview · Details · Location · Photos · Documents · Price · History), instead of tabs to click through.
- **Matching sits on the property page's first screen:** "4 leads fit", with their faces and the executive.
- **Cards instead of a table**; a compact list is an option for managers on desktop.

---

## 3.2 P1 — Properties

**Desktop**
```
┌───────────────────────────────────────────────────────────────────────────┐
│ 🔍 Try "east-facing plots in Madurai under 30 L"              🎤  [＋ Add] │
│ [Plot][Flat][House][Commercial]  [Sale|Rent]  [City ▾] [Budget ▾] [More ▾] │
│ Available 42 · Drafts 5 · Needs attention 7 · All              ▦ grid ☰ list│
├───────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│ │   [ photo ]  │ │   [ photo ]  │ │   [ photo ]  │ │   [ photo ]  │       │
│ │ Available    │ │ Under negot. │ │ Draft  60%   │ │ Available    │       │
│ │ ₹62 L        │ │ ₹1.2 Cr      │ │ ₹28 L        │ │ ₹45 L        │       │
│ │ 2 BHK flat   │ │ Villa        │ │ Plot 1,200 ft│ │ Plot 2,400 ft│       │
│ │ Porur,Chennai│ │ Anna Nagar   │ │ Madurai      │ │ Tambaram     │       │
│ │ 👥 4 leads fit│ │ 👥 1 lead fits│ │ ⚠ 3 to do    │ │ 👥 2 leads fit│       │
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘       │
└───────────────────────────────────────────────────────────────────────────┘
```
- The search box understands plain words and turns them into the filter chips below it, so the user can see and adjust what it understood.
- The views (Available · Drafts · Needs attention · All) are for managers. Executives see only the listed properties.
- **Each card:** the cover photo, status, price, type and size, locality, and one signal: leads that fit (or, for a manager's draft, what's left to do).
- **Executives:** a Share button on each card.

**Phone:** a sticky search bar with a 🎤 button; filters in a bottom sheet; one card per row; ＋ Add as a floating button (managers only).

---

## 3.3 P2 — Property page

**Desktop: content on the left, a sticky action panel on the right**
```
┌───────────────────────────────────────────────┬───────────────────────────┐
│ [        cover photo         ][ph][ph][+12]   │ ₹62 L  · ₹6,326/sq.ft     │
│ 2 BHK flat in Porur, Chennai     RERA ✓       │ Available ▾               │
│ 980 sq.ft · 3rd floor · East · Ready to move  │ [ Share ]  [ Book visit ] │
├───────────────────────────────────────────────┤ [ ✨ Edit with AI ]        │
│ 👥 4 leads fit this property        See all → │───────────────────────────│
│ (A) Arun · 92% · Karthi   (M) Meena · 88% ... │ Listing 80% complete      │
├───────────────────────────────────────────────┤ To do                     │
│ Overview · Details · Location · Photos ·      │ · Exact location   [Set]  │
│ Documents · Price · History   (jump bar)      │ · Building approval doc   │
│                                               │                 [Upload]  │
│ ── Details ────────────────────────────────   │ · 3 more photos  [Add]    │
│ ── Location & nearby places ───────────────   │                           │
│ ── Photos & videos ────────────────────────   │ (managers only)           │
│ ── Legal & documents ──────────────────────   │                           │
│ ── Price check ────────────────────────────   │                           │
│ ── History ────────────────────────────────   │                           │
└───────────────────────────────────────────────┴───────────────────────────┘
```

**Phone**
```
┌─────────────────────┐
│ [   photo gallery  ]│
│ ₹62 L · Available   │
│ 2 BHK flat · Porur  │
│ 980 sq.ft · East    │
│ 👥 4 leads fit    → │
│ [To do: 3 items]  → │  managers only
│ Overview|Details|…  │  sticky jump bar
│ …sections…          │
├─────────────────────┤
│ [Share] [Book visit]│  sticky bottom bar
└─────────────────────┘
```
- Every section shows what's there and an **＋ Add** chip for anything missing (managers only). Empty fields are hidden, never shown as "—".
- **Location:** an approximate area until the exact location is set; nearby places switch between **Team view and Customer view**.
- **Legal:** approval badges; a badge stays "⚠ document pending" until its document is uploaded.

---

## 3.4 P3 — Add (one property)

**Desktop: the conversation on the left, the listing taking shape on the right**
```
┌──────────────────────────────────────┬────────────────────────────────────┐
│ Assistant                            │ Preview (as customers will see it) │
│                                      │ ┌────────────────────────────────┐ │
│ You: 2 BHK flat for sale in Porur,   │ │ [ drop photos here ]           │ │
│      980 sq.ft, 62 lakhs, RERA       │ │ ₹62 L · 2 BHK flat · Porur     │ │
│ AI:  Got it. Which floor is it on?   │ │ 980 sq.ft · RERA ⚠ doc pending │ │
│      [Ground][1][2][3][4+]           │ └────────────────────────────────┘ │
│                                      │ Required  7 of 9 ███████░░         │
│                                      │ ✓ Title  ✓ Purpose  ✓ Type ✓ City  │
│                                      │ ✓ Locality ✓ Price ✓ Area          │
│                                      │ ○ BHK ✓   ○ Floor                  │
│ ┌──────────────────────────────────┐ │ Optional: photos, exact location,  │
│ │ Type, paste a link, or drop files│ │ documents, amenities               │
│ │ 📎  🎤                    [Send] │ │ [Save draft]  [Publish] (disabled) │
│ └──────────────────────────────────┘ │                                    │
└──────────────────────────────────────┴────────────────────────────────────┘
```
- **The preview looks like the real listing card**, so the manager sees the result, not a form. Each fact can be clicked and corrected in place.
- **The assistant asks only for the missing required facts**, one at a time, with quick-answer buttons.
- **After Publish:** "4 leads fit. Notify their executives?" (one tap).
- **Phone:** the conversation fills the screen; a slim bar at the top shows "7 of 9 · Preview ▾" and opens the preview as a sheet.

---

## 3.5 P4 — Check import (many properties)

```
┌───────────────────────────────────────────────────────────────────────────┐
│ ABC Realty — plots.xlsx · 48 rows · Format recognised from last time      │
│ Ready 39 · Draft 6 · Update 2 · Needs fixing 1     [Save 39 ready + 6 …]  │
├───────────────────────────────────────────────────────────────────────────┤
│ Columns: Plot Size→Area ✓  Rate→Price ✓  Owner remarks→Extra detail ✓     │
│          "Survey" → [ choose ▾ ]  ← the only one the AI wasn't sure of    │
├───────────────────────────────────────────────────────────────────────────┤
│ ● Ready   Plot · Madurai · 1,200 sq.ft · ₹28 L           row 4            │
│ ◐ Draft   Plot · Madurai · price "onwards" — confirm     row 9   [Fix]    │
│ ↻ Update  PROP-1012 · price 30 L → 28 L                  row 12  [Review] │
│ ✕ Fix     no locality                                    row 31  [Fix]    │
└───────────────────────────────────────────────────────────────────────────┘
```
- **Brochures and photos:** the same screen; each row shows the page and the words it was read from.
- **Nothing is saved without this screen.** Drafts go to *Properties → Drafts*, where each draft opens in the assistant.

---

## 3.6 P5 — Customer page (from the Share panel)

A phone-first page:
- photos, the price and the approximate total cost;
- key facts, amenities, nearby places (Customer view) and verified approval badges;
- the executive's name with **Call** and **Book a visit** buttons.

It never shows the owner's details, internal notes, documents or the price check.

---

## 3.7 Key flows and their click budgets

| Flow | Steps | Clicks |
|---|---|---|
| Manager adds a property from a description | ＋ Add → type or speak → answer 1–2 questions → Publish → notify | 4–5, under 3 min |
| Manager imports a sheet | ＋ Add → drop file → confirm unknown columns → Save | 3 + review |
| Executive finds and shares | Search in plain words → card → Share → pick lead → WhatsApp | 4 |
| Manager finishes a listing | Needs attention → property → To do item → done | 3 |
| Manager changes the price | Property → Edit with AI → "price is now 65 L" → Confirm | 3 |

---

## Open questions

1. **One ＋ Add** for both a single property and a bulk import, with the system deciding from the input. Or keep Import as a separate entry?
2. **The property page as one scrolling page with a jump bar**, instead of tabs?
3. **Remove "Waiting for approval"**, since executives no longer add properties?
4. **Should executives see drafts?** (Assumed no.)
5. **A map view of the property list:** now, or later?
