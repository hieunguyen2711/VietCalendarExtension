/*
 * Render PRIVACY.md to PRIVACY.html.
 *
 *   node tools/build-privacy.mjs
 *
 * GitHub Pages doesn't convert PRIVACY.md — it has no YAML front matter, so
 * Jekyll copies it verbatim and it is served as text/markdown, which browsers
 * may download instead of display. A store listing's privacy policy link has
 * to render for anyone who clicks it, so we publish an HTML version too.
 *
 * PRIVACY.md stays the source of truth: edit it, re-run this, commit both.
 * Handles only the Markdown that file actually uses (headings, paragraphs,
 * bullet lists, bold, italic, inline code, links) — it is not a general
 * converter, and it fails loudly rather than silently emitting something
 * wrong. Dependency-free, like the rest of tools/.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'PRIVACY.md');
const OUT = path.join(ROOT, 'PRIVACY.html');

const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Inline markup. Order matters: links before emphasis, so link text is safe. */
function inline(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/_([^_]+)_/g, '<em>$1</em>');
}

/** A bullet's continuation lines are indented; fold them into one item. */
function listItems(lines) {
  const items = [];
  for (const line of lines) {
    if (line.startsWith('- ')) items.push(line.slice(2));
    else if (items.length) items[items.length - 1] += ` ${line.trim()}`;
    else throw new Error(`list continuation with no item: ${line}`);
  }
  return items;
}

function renderBlock(block) {
  const lines = block.split('\n').filter(Boolean);
  const [first] = lines;
  if (first.startsWith('## ')) return `<h2>${inline(first.slice(3))}</h2>`;
  if (first.startsWith('# ')) return `<h1>${inline(first.slice(2))}</h1>`;
  if (first.startsWith('- ')) {
    const items = listItems(lines).map((i) => `      <li>${inline(i)}</li>`);
    return `<ul>\n${items.join('\n')}\n    </ul>`;
  }
  if (lines.some((l) => l.startsWith('#'))) {
    throw new Error(`heading not at the start of a block: ${first}`);
  }
  return `<p>${inline(lines.join(' '))}</p>`;
}

const markdown = fs.readFileSync(SRC, 'utf8');
const body = markdown
  .trim()
  .split(/\n\s*\n/)
  .map(renderBlock)
  .map((html) => `    ${html}`)
  .join('\n');

// Title comes from the H1 so the two can't disagree.
const h1 = markdown.match(/^#\s+(.+)$/m);
if (!h1) throw new Error('PRIVACY.md has no H1 to use as the page title');

const page = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(h1[1])}</title>
    <!-- Generated from PRIVACY.md by tools/build-privacy.mjs — do not edit. -->
    <style>
      :root {
        color-scheme: light dark;
        --bg: #ffffff;
        --fg: #1f2328;
        --muted: #6b7280;
        --border: #d1d5db;
        --primary: #b91c1c;
        --code-bg: #f3f4f6;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --bg: #1f2328;
          --fg: #e6e6e6;
          --muted: #9aa0a6;
          --border: #3a3f45;
          --code-bg: #2a2f35;
        }
      }
      * { box-sizing: border-box; }
      body {
        margin: 0 auto;
        padding: 32px 20px 64px;
        max-width: 40rem;
        background: var(--bg);
        color: var(--fg);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 16px;
        line-height: 1.65;
      }
      h1 { font-size: 1.6rem; line-height: 1.3; margin: 0 0 4px; }
      h2 {
        font-size: 1.15rem;
        margin: 2rem 0 0.5rem;
        padding-top: 1rem;
        border-top: 1px solid var(--border);
      }
      p, li { margin: 0.75rem 0; }
      ul { padding-left: 1.25rem; }
      a { color: var(--primary); }
      em { color: var(--muted); font-style: normal; font-size: 0.9rem; }
      code {
        background: var(--code-bg);
        padding: 1px 5px;
        border-radius: 4px;
        font-size: 0.9em;
      }
    </style>
  </head>
  <body>
${body}
  </body>
</html>
`;

fs.writeFileSync(OUT, page);
console.log(`Wrote ${path.relative(process.cwd(), OUT)} from ${path.basename(SRC)}`);
