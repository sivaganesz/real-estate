# 02 · Bulk import

**Status:** built · **Commit:** Phase 2 · **Users:** sales managers and admins.

## 1. How property data really arrives

| Source | What it looks like | Problem today |
|---|---|---|
| Builder price list | Excel with a title row, merged cells, totals at the bottom, a tab per tower | Columns renamed every time; "BUA", "SBA", "Rate" |
| Broker or owner sheet | Ad-hoc columns: "Location", "Plot Size", "Rate", "Owner remarks", values like "48 L", "1,200 sqft", "30x40" | No two senders alike; half the facts in remarks |
| Our own template | Clean columns, dropdowns | Few people use it |
| Brochure or catalogue (PDF), photo of a price board | Several unit types per document | Retyped by hand |
| The previous system's export | Starred headings ("Property name *"), an *Instructions* and a *Lists* tab | Must still import |

**Assumption challenged:** "users will fill our template". In practice they won't. The importer is built for *their* sheets first; our template is just the case where everything matches instantly.

## 2. Journey

1. **Upload.** Drop a file. Optionally say **who sent it** (to remember their layout) and a default type or city for sheets that don't say.
2. **Columns** (sheets only). Every heading is shown with sample values and where it goes. A badge says how it was matched:
   - **Our template**: the headings are our own;
   - **Saved format**: the same sender's layout, seen before;
   - **Matched**: synonyms, and the values decide ambiguous headings ("Area" with numbers is the size; with names, the locality);
   - **AI suggestion**: only for headings still unknown, one call per file, with a confidence;
   - **Not matched**: kept as an internal detail, never dropped.
3. **Check.** Each row is one of:
   - **Ready**;
   - **Draft** (a key fact is missing, so it's saved as a draft);
   - **Already exists** (in the system, or an earlier row of the same file);
   - **Needs fixing** (a value can't be read, e.g. price "Call").

   Fix a row inline and it's re-checked. Skip any row. If many rows share a gap (no city), set it for all in one go.
4. **Import.** Choose whether ready rows go live and whether existing ones are skipped or updated.
5. **Done.** Counts, links, and a CSV of rows not imported, with a *Problems* column, ready to fix and re-upload.

Brochures and photos skip step 2. The AI finds one entry per unit type, and each row shows the words it was read from.

## 3. Rules

- **Nothing is saved before the Check screen.**
- **Messy sheets are expected:**
  - title lines above the headings and totals rows are skipped;
  - *Instructions*, *Lists* and *Help* tabs are ignored; the tab with the most data rows wins;
  - "30 L", "1.2 Cr", "1,200 sq.ft", "3 cents", "30x40", "Ground", "E", "NE", "Yes/No" and Excel dates are all read.
- **Nothing is dropped.** An unmapped column becomes an *internal* extra detail on each property. A value that fits no detail of that type (a "floor" on a plot) is kept as an extra too.
- **Duplicates** use the same rule as Add property: same project, block and unit; or same locality and type with price within ±5% and area within ±2%.
- **Executives can't import** (CTO decision, 23 Nov).
- **Up to 2,000 rows per file.**
- **Every import is logged** with who, when, file and counts. Created properties keep a link to their import batch.

## 4. AI use

| Step | AI? | Why |
|---|---|---|
| Template, saved format, synonyms, value sniffing | No | Free, instant, predictable; covers most files |
| Unknown headings | Yes, one small Gemini call per file | Unfamiliar layouts without a rules list growing forever |
| Brochures and photos | Yes | Only practical way to read them; each value carries its source quote |
| Final decision | Person | The Check screen is mandatory |

Offline, unknown headings stay "Not matched" (kept as details) and brochures are read from their PDF text with rules.

## 5. Sample

`docs/samples/owner-sheet-sri-balaji.xlsx` is a realistic owner sheet, with:

- a title and contact lines above the headings;
- "Rate" and "Area" headings;
- prices like "68 L", "1.15 Cr" and "Call";
- a duplicate row and a totals row.
