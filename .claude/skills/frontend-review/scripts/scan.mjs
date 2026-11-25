#!/usr/bin/env node
// Finds mechanical problems against the FrontendCore standards. Changes nothing.
//
//   node scan.mjs <project> [file-or-folder ...]
//
// To accept a line on purpose, put "scan-ok: reason" in a comment on it or on
// the line above.
//
// EstateOS copy, adapted from github.com/Pandi2352/frontend-skills (7ce2970).
// Rules our project decided against are switched off in PROJECT_OFF below; the
// reasons are in the repository's AGENTS.md ("Project decisions").

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const project = path.resolve(process.argv[2] ?? '.');
if (!existsSync(project)) {
  console.error('Usage: node scan.mjs <project> [file-or-folder ...]');
  process.exit(2);
}
const only = process.argv.slice(3).map((p) => path.resolve(project, p));
const missing = only.filter((p) => !existsSync(p));
if (missing.length) {
  console.error(`Not found: ${missing.join(', ')}`);
  process.exit(2);
}

const inUi = (f) => /(^|\/)components\/(ui|form)\//.test(f);
// EstateOS: the API client is src/lib/api.ts.
const isApi = (f) => /(^|\/)services\/(api|upload)|(^|\/)lib\/api\.ts$/.test(f);

// EstateOS decisions (see AGENTS.md): these standards don't apply to this project.
const PROJECT_OFF = new Set([
  'native picker element', // our Select and <datalist> suggestions are allowed
  'native date/time/color input', // the browser's date and time pickers are allowed
  'raw form control', // inputs go through ui.tsx where it fits; small inline ones are fine
  'raw button', // pill and chip buttons are styled in place; Button is for standard actions
  'hardcoded color class', // Tailwind palette classes, not design tokens
  'other border radius', // rounded-xl to rounded-3xl tiles are the design
  'shadow', // soft shadows (shadow-card, shadow-pop) are the design
  'index as key', // fine for lists that only grow or never reorder
  'fixed path in link', // routes are declared in App.tsx and nav.tsx
]);
const isTest = (f) => /(\.(test|spec)\.|(^|\/)(test|tests|__tests__|e2e)\/)/.test(f);

// `tag` rules look at one whole JSX opening tag, also over several lines.
const rules = [
  { level: 'High', name: 'native picker element', fix: 'Dropdown, MultiDropdown or Combobox', tag: /^(select|datalist)$/ },
  { level: 'High', name: 'native date/time/color input', fix: 'DatePicker, TimePicker, MonthPicker or ColorPicker', tag: /^input$/, has: /\btype=["'{`\s]*(date|time|month|week|datetime-local|color)["'}`]/ },
  { level: 'High', name: 'browser dialog', fix: 'useConfirm, Modal or toast', line: /(?<![\w.])(?:window\.)?(?:alert|confirm|prompt)\(\s*(?:['"`]|\w+\.message)/ },
  { level: 'High', name: 'unsafe HTML', fix: 'render as text, or sanitize and note it', line: /dangerouslySetInnerHTML|\.innerHTML\s*=/ },
  { level: 'High', name: 'token in browser storage', fix: 'memory plus httpOnly cookie', line: /(?:local|session)Storage\.setItem\([^)]*(?:token|jwt|secret)/i },
  { level: 'High', name: 'eval', fix: 'remove', line: /\beval\(|new Function\(/ },
  { level: 'High', name: 'secret in public variable', fix: 'move to the server', line: /VITE_\w*(?:SECRET|PASSWORD|PRIVATE)\w*/ },
  { level: 'High', name: 'image without alt', fix: 'alt text, or alt="" if decorative', tag: /^img$/, lacks: /\balt\b|\{\.\.\./ },
  { level: 'High', name: 'click on a non-interactive element', fix: 'button or link', tag: /^(div|span|li|p|td|tr)$/, has: /\bonClick=/, lacks: /\brole=|\{\.\.\.|aria-hidden/ },
  { level: 'High', name: 'new tab without rel', fix: 'rel="noopener noreferrer"', tag: /^a$/, has: /target=["'{]+_blank/, lacks: /\brel=/ },
  { level: 'High', name: 'visible focus removed', fix: 'focus-visible outline', tag: /^(button|a)$/, has: /outline-none/, lacks: /focus-visible|focus:|role=["']combobox/ },
  { level: 'Medium', name: 'raw form control', fix: 'shared field component', tag: /^(input|textarea)$/, lacks: /type=["'](hidden|submit)/, skip: inUi },
  { level: 'Medium', name: 'raw button', fix: 'Button or IconButton', tag: /^button$/, skip: (f) => inUi(f) || /components\/(layout|shared)\//.test(f) },
  { level: 'Medium', name: 'hardcoded color class', fix: 'token class such as bg-surface', line: /\b(?:bg|text|border|ring|outline|fill|stroke|from|to|via|divide|placeholder)-(?:white|black|(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3})\b/ },
  { level: 'Medium', name: 'arbitrary color', fix: 'token in theme.css', line: /-\[(?:#|rgb|hsl|oklch)/ },
  { level: 'Medium', name: 'inline color', fix: 'token class', line: /(?:color|background|backgroundColor|borderColor):\s*['"`](?:#|rgb|hsl)/ },
  { level: 'Medium', name: 'shadow', fix: 'border', line: /(?<![\w-])(?:drop-)?shadow(?:-(?:2xs|xs|sm|md|lg|xl|2xl|inner|\[))?(?=[\s"'`\]])/, inClass: true },
  { level: 'Medium', name: 'other border radius', fix: 'rounded-md', line: /(?<![\w-])rounded-(?:(?:[trbl]|tl|tr|bl|br|s|e)-)?(?:none|xs|sm|lg|xl|2xl|3xl|4xl|\[)/ },
  { level: 'Medium', name: 'request outside the API client', fix: 'feature service with api', line: /(?<![\w.])fetch\(|\baxios\b|new XMLHttpRequest/, skip: isApi },
  { level: 'Medium', name: 'any type', fix: 'real type or unknown', line: /(?::\s*|\bas\s+|<)any\b(?!\w)/, noComment: true },
  { level: 'Medium', name: 'type check disabled', fix: 'fix the type', line: /@ts-(?:ignore|nocheck)/ },
  { level: 'Medium', name: 'dark: class', fix: 'change tokens, not components', line: /(?<![\w-])dark:/, skip: () => false },
  { level: 'Low', name: 'index as key', fix: 'stable id', line: /\bkey=\{(?:i|idx|index)\}/ },
  { level: 'Low', name: 'console output', fix: 'logger or remove', line: /\bconsole\.(?:log|debug|info)\(/, noComment: true },
  { level: 'Low', name: 'fixed path in link', fix: 'ROUTES constant', line: /(?:\bto=["']\/\w|navigate\(["']\/\w)/ },
  { level: 'Low', name: 'disabled lint rule without reason', fix: 'fix, or add "-- reason"', line: /eslint-disable(?!.*--)/ },
  { level: 'Low', name: 'unfinished note', fix: 'finish or file an issue', line: /\b(?:TODO|FIXME|HACK)\b/ },
];

function* walk(target) {
  if (statSync(target).isFile()) {
    if (/\.(tsx?|jsx?)$/.test(target)) yield target;
    return;
  }
  for (const entry of readdirSync(target, { withFileTypes: true })) {
    if (/^(node_modules|dist|build|coverage|\..*)$/.test(entry.name)) continue;
    const full = path.join(target, entry.name);
    if (entry.isDirectory() || entry.isFile()) yield* walk(full);
  }
}

/** Opening JSX tags with their text; understands quotes and nested braces. */
function tags(text) {
  const found = [];
  for (const match of text.matchAll(/<([a-z][a-z0-9]*)(?=[\s/>])/g)) {
    let depth = 0;
    let quote = '';
    let end = match.index + match[0].length;
    for (; end < text.length && end - match.index < 4000; end++) {
      const c = text[end];
      if (quote) {
        if (c === quote && text[end - 1] !== '\\') quote = '';
      } else if (c === '"' || c === "'" || c === '`') quote = c;
      else if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) break;
    }
    found.push({ name: match[1], index: match.index, text: text.slice(match.index, end + 1) });
  }
  return found;
}

const src = path.join(project, 'src');
const targets = only.length ? only : [existsSync(src) ? src : project];
const findings = [];
let count = 0;

for (const target of targets) {
  for (const file of walk(target)) {
    const name = path.relative(project, file).replaceAll('\\', '/');
    if (isTest(name)) continue;
    count++;
    const text = readFileSync(file, 'utf8').replaceAll('\r\n', '\n');
    const lines = text.split('\n');
    const report = (rule, line) => {
      const accepted = [lines[line - 1], lines[line - 2]].some((l) => l?.includes('scan-ok:'));
      if (!accepted) findings.push({ ...rule, at: `${name}:${line}` });
    };
    const isComment = lines.map((l) => /^\s*(?:\/\/|\*|\/\*|\{\/\*)/.test(l));
    const jsx = /\.[jt]sx$/.test(file) ? tags(text) : [];
    for (const rule of rules) {
      if (PROJECT_OFF.has(rule.name)) continue;
      if (rule.skip?.(name)) continue;
      if (rule.tag) {
        for (const tag of jsx) {
          if (!rule.tag.test(tag.name)) continue;
          if (rule.has && !rule.has.test(tag.text)) continue;
          if (rule.lacks?.test(tag.text)) continue;
          const line = text.slice(0, tag.index).split('\n').length;
          if (!isComment[line - 1]) report(rule, line);
        }
      } else {
        lines.forEach((l, i) => {
          if (isComment[i] && !/ts-|eslint|TODO|FIXME|HACK/.test(rule.line.source)) return;
          if (rule.inClass && !/class(?:Name)?=|cn\(|['"`]/.test(l)) return;
          if (rule.line.test(l)) report(rule, i + 1);
        });
      }
    }
  }
}

const order = ['High', 'Medium', 'Low'];
for (const level of order) {
  const groups = Map.groupBy
    ? Map.groupBy(findings.filter((f) => f.level === level), (f) => f.name)
    : findings.filter((f) => f.level === level).reduce((m, f) => m.set(f.name, [...(m.get(f.name) ?? []), f]), new Map());
  for (const [name, list] of groups) {
    console.log(`\n${level}: ${name} (${list.length}) -> ${list[0].fix}`);
    for (const f of list.slice(0, 20)) console.log(`  ${f.at}`);
    if (list.length > 20) console.log(`  ... ${list.length - 20} more`);
  }
}
const total = (level) => findings.filter((f) => f.level === level).length;
console.log(`\n${count} files. High ${total('High')}, Medium ${total('Medium')}, Low ${total('Low')}.`);
process.exit(total('High') ? 1 : 0);
