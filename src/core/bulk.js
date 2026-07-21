/*
 * Bulk entry parser.
 *
 * Families commonly track five to ten ancestors; entering each giỗ through the
 * form one at a time is the main tedium of setting this up. This parses a
 * pasted list instead.
 *
 * Accepted per line (blank lines and lines starting with # are ignored):
 *   Giỗ ông nội, 15/3/2026
 *   Giỗ bà nội, 20/8          <- year omitted, falls back to defaultYear
 *   Giỗ cụ, 15/3/2026, leap   <- trailing "leap"/"nhuận" marks the leap month
 *
 * The separator may be a comma or a tab, so a column pasted from a spreadsheet
 * works too.
 */

const LEAP_WORDS = new Set(['leap', 'nhuan', 'nhuận', 'thang nhuan', 'tháng nhuận']);

/**
 * @typedef {Object} BulkRow
 * @property {number} lineNumber
 * @property {string} raw
 * @property {boolean} ok
 * @property {string} [error]
 * @property {string} [title]
 * @property {{day:number, month:number, year:number, isLeapMonth:boolean}} [lunar]
 */

/**
 * Parse pasted text into rows. Always returns one row per non-empty line, with
 * `ok` telling the caller whether it parsed — so the UI can show which specific
 * line is wrong rather than failing the whole paste.
 * @param {string} text
 * @param {number} defaultYear lunar year used when a line omits it
 * @returns {BulkRow[]}
 */
export function parseBulk(text, defaultYear) {
  const rows = [];
  const lines = String(text ?? '').split(/\r?\n/);

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;

    const row = { lineNumber: i + 1, raw: line, ok: false };
    const parts = line.split(/[,\t]/).map((p) => p.trim()).filter(Boolean);

    if (parts.length < 2) {
      row.error = 'Expected "title, day/month[/year]".';
      rows.push(row);
      return;
    }

    const title = parts[0];
    if (!title) {
      row.error = 'Missing title.';
      rows.push(row);
      return;
    }

    const dateMatch = /^(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{3,4}))?$/.exec(parts[1]);
    if (!dateMatch) {
      row.error = `Could not read the date "${parts[1]}".`;
      rows.push(row);
      return;
    }

    const day = Number(dateMatch[1]);
    const month = Number(dateMatch[2]);
    const year = dateMatch[3] ? Number(dateMatch[3]) : defaultYear;

    if (!Number.isInteger(year)) {
      row.error = 'No year given and no default year available.';
      rows.push(row);
      return;
    }

    const isLeapMonth = parts
      .slice(2)
      .some((p) => LEAP_WORDS.has(p.toLowerCase()));

    row.ok = true;
    row.title = title;
    row.lunar = { day, month, year, isLeapMonth };
    rows.push(row);
  });

  return rows;
}

/** Convenience split of parseBulk output. */
export function partitionRows(rows) {
  return {
    valid: rows.filter((r) => r.ok),
    invalid: rows.filter((r) => !r.ok),
  };
}
