# Requests — M5 Import & Extraction

## R1. Nav item "Import" should need `import.leads` (blocking-ish, one token): NOT applied
- **What:** in `src/app/nav.ts`, change the `import` item from `permission: 'import.document'` to `permission: 'import.leads'`.
- **Why:** plan §8.3 M5 says executives get no `/import` (NoAccess). The route now requires `import.leads`, so an executive's sidebar link currently opens the NoAccess page. Executives reach document extraction from paste-and-fill / the assistant, and their drafts at `/import/drafts`.
- **Optional:** an executive-only "Drafts" nav entry (`/import/drafts`, permission `import.document`).
- M5 did not apply it because it changes a foundation value rather than adding one.

## R2. `vite.config.ts` excludes tesseract.js from pre-bundling (nice; worked around)
- The package root is CommonJS (`require`), so in the dev server `import('tesseract.js')` fails with "require is not defined". M5 imports the browser ESM build instead (`tesseract.js/dist/tesseract.esm.min.js`, typed by `src/ai/document/tesseract-esm.d.ts`), which works in dev and build. If the Parent prefers the root import, drop `optimizeDeps.exclude: ['tesseract.js']`.

## R3. Image thumbnails in `components/shared/file-uploader.tsx` break in dev (nice)
- `Thumb` creates the object URL in `useMemo` and revokes it in an effect cleanup. Under React Strict Mode the cleanup runs and the memo is not recomputed, so the `<img>` points at a revoked URL (`net::ERR_FILE_NOT_FOUND`, broken thumbnail). A fix with a React 19 ref cleanup:
  ```tsx
  <img alt="" className="size-10 rounded-md object-cover"
    ref={(el) => { if (!el) return; const u = URL.createObjectURL(file); el.src = u; return () => URL.revokeObjectURL(u) }} />
  ```

## R4. The route error page nests `<details>` inside `<p>` (nice)
- `app/error-boundary.tsx` passes a `<details>` in `EmptyState`'s `body`, which renders inside a `<p>`. React logs "In HTML, <details> cannot be a descendant of <p>". Render the details outside `body`, or make EmptyState's body a `<div>`.

## R5. `MappingTable` marks template and saved matches with the AI sparkle (nice)
- `auto = m.method !== 'manual'` paints exact template and saved-mapping matches as AI-suggested. Suggest `auto = ['synonym', 'fuzzy', 'value'].includes(m.method)`.

## Applied by M5 (additive only)
- `services/imports.ts`: new exports `runImport` (completeImport plus lead notes and "update existing" for leads; returns the undo token), `saveMappingProfile`, `deleteMappingProfile` and `removeImportJob`. The type import line gained `Lead` and `MappingProfile`. Existing functions are untouched.

## Reviewer note (independent M5 review)
- **R1 is no longer needed.** The sidebar's "Import" link failed the foundation smoke test (`e2e/smoke.spec.ts`, "every profile can open every nav item"): executives landed on NoAccess. The reviewer fixed it inside M5's own files instead of changing `app/nav.ts`. `/import` now needs `import.document`, and executives get a **limited hub**: document extraction, the document samples, their drafts KPI and their own document jobs, plus a note that bulk import is for admins and managers. Sheet wizards (`/import/leads`, property kinds) and `/import/history` stay NoAccess for executives. This also gives executives a way to reach `/import/drafts`, which R1 alone would have removed. If the Parent still applies R1, nothing breaks.
