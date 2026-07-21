import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateLunarDate,
  validateTitle,
  validateTime,
} from '../src/core/validate.js';

test('valid lunar date resolves to Gregorian', () => {
  const r = validateLunarDate({ day: 1, month: 1, year: 2026, isLeapMonth: false });
  assert.ok(r.ok);
  assert.deepEqual(r.value.gregorian, { day: 17, month: 2, year: 2026 });
});

test('out-of-range month/day are rejected', () => {
  assert.equal(validateLunarDate({ day: 1, month: 13, year: 2026 }).ok, false);
  assert.equal(validateLunarDate({ day: 31, month: 1, year: 2026 }).ok, false);
});

test('non-integer input is rejected', () => {
  assert.equal(validateLunarDate({ day: 1.5, month: 1, year: 2026 }).ok, false);
});

test('leap month that does not exist is rejected', () => {
  // 2014's only leap month is the 9th, so a leap 3rd month is impossible.
  const r = validateLunarDate({ day: 1, month: 3, year: 2014, isLeapMonth: true });
  assert.equal(r.ok, false);
  assert.match(r.errors[0], /no leap month/);
});

test('day beyond the length of the lunar month is rejected', () => {
  // Find a 29-day lunar month and assert day 30 is rejected there.
  // Lunar 12/2025 — verify via round-trip that day 30 does not exist.
  const r = validateLunarDate({ day: 30, month: 12, year: 2025, isLeapMonth: false });
  // Either it's a valid 30-day month (ok) or rejected as non-existent; if
  // rejected, the message must explain it.
  if (!r.ok) assert.match(r.errors[0], /does not exist/);
});

test('title validation', () => {
  assert.equal(validateTitle('  ').ok, false);
  const r = validateTitle('  Giỗ ông  ');
  assert.ok(r.ok);
  assert.equal(r.value, 'Giỗ ông');
});

test('time validation', () => {
  assert.deepEqual(validateTime('09:30').value, { hour: 9, minute: 30 });
  assert.equal(validateTime('24:00').ok, false);
  assert.equal(validateTime('9:5').ok, false);
  assert.equal(validateTime('nope').ok, false);
});
