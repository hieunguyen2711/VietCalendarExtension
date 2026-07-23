/*
 * Regression tests for bugs found in review. Each one failed before its fix.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  convertSolar2Lunar,
  convertLunar2Solar,
  getLeapMonthOfYear,
  jdFromDate,
  jdToDate,
} from '../src/core/lunar.js';
import {
  lunarMonthlyDates,
  lunarAnniversaryDates,
  resolveLunarClamped,
} from '../src/core/occurrences.js';
import { validateLunarDate } from '../src/core/validate.js';
import { buildDraft } from '../src/core/draft.js';
import { lunarMonthly, NONE } from '../src/core/recurrence.js';
import { HOLIDAYS, getHoliday } from '../src/core/holidays.js';

// ---- k-estimate overshoot: convertSolar2Lunar returned lunar day 0 ---------

test('dates whose new-moon estimate overshoots by >1 lunation convert correctly', () => {
  assert.deepEqual(convertSolar2Lunar(7, 5, 2054), [30, 3, 2054, 0]);
  assert.deepEqual(convertSolar2Lunar(9, 4, 2062), [30, 2, 2062, 0]);
});

test('no date in 1900-2199 produces an out-of-range lunar day or month', () => {
  let bad = 0;
  for (let jd = jdFromDate(1, 1, 1900); jd <= jdFromDate(31, 12, 2199); jd++) {
    const [d, m, y] = jdToDate(jd);
    const [ld, lm] = convertSolar2Lunar(d, m, y);
    if (ld < 1 || ld > 30 || lm < 1 || lm > 12) bad++;
  }
  assert.equal(bad, 0);
});

test('solar<->lunar round-trips across the full supported range', () => {
  let fails = 0;
  for (let jd = jdFromDate(1, 1, 1900); jd <= jdFromDate(31, 12, 2199); jd++) {
    const [d, m, y] = jdToDate(jd);
    const [ld, lm, ly, ll] = convertSolar2Lunar(d, m, y);
    const back = convertLunar2Solar(ld, lm, ly, ll);
    if (back[0] !== d || back[1] !== m || back[2] !== y) fails++;
  }
  assert.equal(fails, 0);
});

test('the affected dates are no longer falsely rejected as non-existent', () => {
  assert.ok(validateLunarDate({ day: 30, month: 3, year: 2054 }).ok);
  assert.ok(validateLunarDate({ day: 30, month: 2, year: 2062 }).ok);
});

test('an anniversary spanning 2054 lands on the right day', () => {
  const dates = lunarAnniversaryDates({ day: 30, month: 3, year: 2050, isLeapMonth: false }, 8);
  const y2054 = dates.find((d) => d.year === 2054);
  assert.deepEqual(y2054, { day: 7, month: 5, year: 2054 });
});

// ---- monthly recurrence: leap-month start filter --------------------------

test('monthly recurrence starting in a leap month begins at the leap date', () => {
  // 2025 has a leap 6th month.
  assert.equal(getLeapMonthOfYear(2025), 6);
  const lunar = { day: 1, month: 6, year: 2025, isLeapMonth: true };
  const expected = resolveLunarClamped(lunar).gregorian;
  const occ = lunarMonthlyDates(lunar, 1);
  assert.deepEqual(occ[0], expected, 'occurrences[0] must be the leap-month date');
});

test('occurrences[0] equals the event start for every leap year 1990-2100', () => {
  let mismatches = 0, checked = 0;
  for (let y = 1990; y <= 2100; y++) {
    const lm = getLeapMonthOfYear(y);
    if (!lm) continue;
    checked++;
    const lunar = { day: 1, month: lm, year: y, isLeapMonth: true };
    const g = resolveLunarClamped(lunar).gregorian;
    const occ = lunarMonthlyDates(lunar, 1);
    if (!occ.length || occ[0].day !== g.day || occ[0].month !== g.month || occ[0].year !== g.year) {
      mismatches++;
    }
  }
  assert.ok(checked > 30, `expected many leap years, got ${checked}`);
  assert.equal(mismatches, 0);
});

test('RDATE never repeats DTSTART for a leap-month monthly recurrence', () => {
  const lunar = { day: 1, month: 6, year: 2025, isLeapMonth: true };
  const gregorian = resolveLunarClamped(lunar).gregorian;
  const { googleEvent } = buildDraft({
    title: 'Mùng 1', gregorian, lunar, allDay: true,
    recurrence: lunarMonthly({ years: 1 }), timeZone: 'Asia/Ho_Chi_Minh',
  });
  const dtstart = googleEvent.start.date.replace(/-/g, '');
  const rdates = (googleEvent.recurrence || [])
    .flatMap((line) => line.replace(/^RDATE[^:]*:/, '').split(','));
  assert.ok(!rdates.includes(dtstart), 'RDATE must not duplicate DTSTART');
});

// ---- holidays: Tất Niên clamping ------------------------------------------

test('Tất Niên resolves in every year, clamping day 30 to 29 when needed', () => {
  let clamped = 0;
  for (let y = 2020; y <= 2060; y++) {
    const res = resolveLunarClamped({ day: 30, month: 12, year: y, isLeapMonth: false });
    assert.ok(res, `Tất Niên unresolved for ${y}`);
    assert.equal(res.lunar.month, 12);
    assert.ok(res.lunar.day === 30 || res.lunar.day === 29);
    if (res.clamped) clamped++;
  }
  assert.ok(clamped > 0, 'expected some years to need clamping');
});

test('2026 Tất Niên resolves (it clamps) instead of vanishing', () => {
  const res = resolveLunarClamped({ day: 30, month: 12, year: 2026, isLeapMonth: false });
  assert.ok(res);
  assert.equal(res.clamped, true);
  assert.equal(res.lunar.day, 29);
  // The strict validator still rejects it — that difference is the whole point.
  assert.equal(validateLunarDate({ day: 30, month: 12, year: 2026 }).ok, false);
});

test('every holiday resolves for a decade of years', () => {
  for (let y = 2024; y <= 2034; y++) {
    for (const h of HOLIDAYS) {
      const res = resolveLunarClamped({ day: h.day, month: h.month, year: y, isLeapMonth: false });
      assert.ok(res, `${h.id} unresolved for ${y}`);
    }
  }
});

test('the Tất Niên entry is the one that needs clamping', () => {
  const h = getHoliday('tat-nien');
  assert.deepEqual([h.day, h.month], [30, 12]);
});

// ---- draft source completeness (needed to rebuild/edit a draft) -----------

test('source carries everything buildDraft needs to reproduce the draft', () => {
  const lunar = { day: 1, month: 1, year: 2026, isLeapMonth: false };
  const gregorian = { day: 17, month: 2, year: 2026 };
  const first = buildDraft({
    title: 'Giỗ', gregorian, lunar, allDay: false, start: { hour: 9, minute: 0 },
    recurrence: NONE, reminderMinutes: 1440, colorId: '11', timeZone: 'Asia/Ho_Chi_Minh',
  });
  const rebuilt = buildDraft({ ...first.source, title: 'Giỗ' });
  assert.deepEqual(rebuilt.googleEvent, first.googleEvent);
});
