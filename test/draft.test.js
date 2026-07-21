import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDraft, addDays, toISODate, VN_TZID } from '../src/core/draft.js';
import { NONE, lunarYearly } from '../src/core/recurrence.js';

const baseLunar = { day: 1, month: 1, year: 2026, isLeapMonth: false };
const greg = { day: 17, month: 2, year: 2026 };

test('addDays crosses month/year boundaries', () => {
  assert.deepEqual(addDays({ day: 31, month: 12, year: 2025 }, 1), { day: 1, month: 1, year: 2026 });
  assert.deepEqual(addDays({ day: 28, month: 2, year: 2024 }, 1), { day: 29, month: 2, year: 2024 }); // leap year
});

test('all-day event uses exclusive end date', () => {
  const { googleEvent } = buildDraft({
    title: 'Tết', gregorian: greg, lunar: baseLunar, allDay: true, recurrence: NONE,
  });
  assert.deepEqual(googleEvent.start, { date: '2026-02-17' });
  assert.deepEqual(googleEvent.end, { date: '2026-02-18' });
  assert.equal(googleEvent.recurrence, undefined);
});

test('lunar-yearly recurrence expands to an all-day RDATE of drifting dates', () => {
  const { googleEvent, preview } = buildDraft({
    title: 'Giỗ', gregorian: greg, lunar: baseLunar, allDay: true,
    recurrence: lunarYearly({ years: 25 }),
  });
  assert.equal(googleEvent.recurrence.length, 1);
  const rdate = googleEvent.recurrence[0];
  assert.match(rdate, /^RDATE;VALUE=DATE:/);
  // DTSTART (2026-02-17) is NOT repeated in RDATE; 24 further dates remain.
  const dates = rdate.replace('RDATE;VALUE=DATE:', '').split(',');
  assert.equal(dates.length, 24);
  assert.ok(!dates.includes('20260217'));
  // 2027's Tết is 2027-02-06 — proves the date drifts, not fixed to Feb 17.
  assert.equal(dates[0], '20270206');
  assert.ok(preview.isRecurring);
  assert.equal(preview.upcoming.length, 5);
});

test('lunar-yearly timed recurrence uses TZID RDATE with the event time', () => {
  const { googleEvent } = buildDraft({
    title: 'Cúng', gregorian: greg, lunar: baseLunar, allDay: false,
    start: { hour: 9, minute: 0 }, recurrence: lunarYearly({ years: 3 }),
  });
  assert.equal(googleEvent.recurrence[0], `RDATE;TZID=${VN_TZID}:20270206T090000,20280126T090000`);
});

test('timed event sets dateTime, timezone, and 60-min default end', () => {
  const { googleEvent } = buildDraft({
    title: 'Cúng', gregorian: greg, lunar: baseLunar, allDay: false,
    start: { hour: 9, minute: 0 }, recurrence: NONE,
  });
  assert.deepEqual(googleEvent.start, { dateTime: '2026-02-17T09:00:00', timeZone: VN_TZID });
  assert.deepEqual(googleEvent.end, { dateTime: '2026-02-17T10:00:00', timeZone: VN_TZID });
});

test('timed event past midnight rolls the end date forward', () => {
  const { googleEvent } = buildDraft({
    title: 'Late', gregorian: greg, lunar: baseLunar, allDay: false,
    start: { hour: 23, minute: 30 }, durationMinutes: 60, recurrence: NONE,
  });
  assert.equal(googleEvent.start.dateTime, '2026-02-17T23:30:00');
  assert.equal(googleEvent.end.dateTime, '2026-02-18T00:30:00');
});

test('toISODate zero-pads', () => {
  assert.equal(toISODate({ day: 3, month: 4, year: 2026 }), '2026-04-03');
});
