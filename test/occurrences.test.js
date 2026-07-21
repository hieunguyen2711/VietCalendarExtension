import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lunarAnniversaryDates } from '../src/core/occurrences.js';
import { convertSolar2Lunar } from '../src/core/lunar.js';

const lunar = (day, month, year, isLeapMonth = false) => ({ day, month, year, isLeapMonth });

test('produces one Gregorian date per lunar year, starting at the given year', () => {
  const dates = lunarAnniversaryDates(lunar(1, 1, 2026), 25);
  assert.equal(dates.length, 25);
  // First entry is this year's Tết (2026-02-17).
  assert.deepEqual(dates[0], { day: 17, month: 2, year: 2026 });
});

test('each occurrence is the SAME lunar date, drifting across the Gregorian year', () => {
  const dates = lunarAnniversaryDates(lunar(10, 3, 2026), 25);
  const gregDays = new Set();
  for (const g of dates) {
    const [ld, lm] = convertSolar2Lunar(g.day, g.month, g.year);
    assert.equal(ld, 10, `lunar day drifted on ${g.year}`);
    assert.equal(lm, 3, `lunar month drifted on ${g.year}`);
    gregDays.add(`${g.month}/${g.day}`);
  }
  // The Gregorian date is NOT fixed — that's the whole point vs FREQ=YEARLY.
  assert.ok(gregDays.size > 1, 'Gregorian date should move year to year');
});

test('short lunar month clamps the day down instead of skipping the year', () => {
  // Day 30 requested every year; some lunar months only have 29 days. Every
  // year must still yield a date, and its lunar day is 30 or 29 of month 6.
  const dates = lunarAnniversaryDates(lunar(30, 6, 2026), 25);
  assert.equal(dates.length, 25);
  for (const g of dates) {
    const [ld, lm] = convertSolar2Lunar(g.day, g.month, g.year);
    assert.equal(lm, 6);
    assert.ok(ld === 30 || ld === 29, `unexpected clamped day ${ld} in ${g.year}`);
  }
});
