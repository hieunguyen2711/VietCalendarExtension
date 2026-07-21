import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBulk, partitionRows } from '../src/core/bulk.js';

test('parses title + day/month/year', () => {
  const [row] = parseBulk('Giỗ ông nội, 15/3/2026', 2030);
  assert.equal(row.ok, true);
  assert.equal(row.title, 'Giỗ ông nội');
  assert.deepEqual(row.lunar, { day: 15, month: 3, year: 2026, isLeapMonth: false });
});

test('omitted year falls back to the default year', () => {
  const [row] = parseBulk('Giỗ bà, 20/8', 2026);
  assert.equal(row.lunar.year, 2026);
});

test('tab-separated (spreadsheet paste) works', () => {
  const [row] = parseBulk('Giỗ cụ\t5/5/2026', 2026);
  assert.equal(row.ok, true);
  assert.equal(row.title, 'Giỗ cụ');
});

test('trailing leap marker is recognised in both languages', () => {
  assert.equal(parseBulk('X, 1/4/2026, leap', 2026)[0].lunar.isLeapMonth, true);
  assert.equal(parseBulk('X, 1/4/2026, nhuận', 2026)[0].lunar.isLeapMonth, true);
  assert.equal(parseBulk('X, 1/4/2026', 2026)[0].lunar.isLeapMonth, false);
});

test('blank lines and comments are skipped', () => {
  const rows = parseBulk('\n# a comment\nGiỗ ông, 1/1/2026\n\n', 2026);
  assert.equal(rows.length, 1);
});

test('bad lines are reported individually, not fatally', () => {
  const rows = parseBulk('Good, 1/1/2026\nbroken\nAlso good, 2/2/2026', 2026);
  const { valid, invalid } = partitionRows(rows);
  assert.equal(valid.length, 2);
  assert.equal(invalid.length, 1);
  assert.equal(invalid[0].lineNumber, 2);
  assert.match(invalid[0].error, /Expected/);
});

test('unreadable date is flagged', () => {
  const [row] = parseBulk('Giỗ, not-a-date', 2026);
  assert.equal(row.ok, false);
  assert.match(row.error, /Could not read the date/);
});
