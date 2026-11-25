---
name: frontend-review
description: Reviews the EstateOS web app (apps/web) against our frontend standards and lists what to fix - browser pop-ups, unsafe HTML, tokens or secrets in the browser, missing alt text, clicks on non-interactive elements, focus, any types, plus reuse, states, accessibility and layout. Use when asked to check, review, audit or clean up frontend code, a page, a component or the whole web app. Project decisions in AGENTS.md win over the general standards.
---

# Frontend review (EstateOS)

Adapted from github.com/Pandi2352/frontend-skills (`frontend-review`, 7ce2970).
This copy lives in the project only. Do not install it globally.

Report first. Change code only when the user asks to fix. Never commit or push
without the user's approval.

## Steps

1. Scope: the files the user named, otherwise changed files (`git diff`),
   otherwise `apps/web`.
2. Scan. It finds the mechanical problems:

   ```
   node .claude/skills/frontend-review/scripts/scan.mjs apps/web [file-or-folder ...]
   ```

   Each result is a lead, not a verdict. Open the line before reporting it.
   Rules this project decided against are switched off in the script
   (`PROJECT_OFF`); the reasons are in `AGENTS.md`.
3. Run the project's checks and report real results:
   - `pnpm typecheck`
   - `pnpm test` (API, from `apps/api`: `GEMINI_API_KEY= pnpm test`)
   - `pnpm e2e` (Playwright; starts its own servers on ports 4190 and 5190)
   - `pnpm --filter ./apps/web build` (also watch for the bundle-size warning)
4. Read only the files in scope for what a scan cannot see (below).
5. Confirm each finding in the code. Drop what you cannot show.

## What a scan cannot see

**Reuse** - same markup or logic twice; a local version of a shared piece that
already exists (`components/ui.tsx`, `components/Bento.tsx`, `components/confirm.tsx`,
`components/toast`, `components/DealSteps.tsx`, `features/*`).

**Fields** - label always present; error directly below or in `ErrorNote`;
submit cannot run twice (`loading` on the button); values kept after failure.

**States** - loading, empty, error, no permission (role), long text, many items.

**Accessibility** - keyboard path, visible focus, names on icon buttons
(`aria-label`), status not by colour alone, Esc closes modals and drawers.

**Layout** - 360, 768 and 1280px; no sideways scroll; phone bottom bar does not
cover content.

**Code** - effects that only derive state; server data copied into state;
unsafe casts; pages calling `fetch` instead of `lib/api`.

**Security** - unsafe HTML or URLs; tokens in storage (login is an httpOnly
cookie); secrets in `VITE_` variables (the Gemini key stays on the API);
permission only hidden in the UI (the API must check it too).

## Report

Start with one line: number of findings by level and whether typecheck, tests,
e2e and build pass. Then a table, worst first:

| Level | Where | Problem | Fix |
| --- | --- | --- | --- |
| High | `DealDrawer.tsx:95` | browser `confirm()` | `useConfirm()` |

- **High**: broken behaviour, security, cannot be used with keyboard or screen
  reader, data loss.
- **Medium**: breaks a standard people can see, or duplicates shared code.
- **Low**: naming, structure, small cleanup.

Group repeats into one row with a count. Say what was not checked. End by
offering to fix High and Medium.

When asked to fix: smallest change, reuse shared pieces, rerun the scan and the
checks, report what changed.
