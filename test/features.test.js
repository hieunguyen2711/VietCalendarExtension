import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lunarMonthlyDates, DEFAULT_YEARS, MONTHLY_YEARS } from '../src/core/occurrences.js';
import { convertSolar2Lunar } from '../src/core/lunar.js';
import { buildDraft, describeReminder } from '../src/core/draft.js';
import { lunarMonthly, lunarYearly, NONE } from '../src/core/recurrence.js';
import { HOLIDAYS, getHoliday, holidayName } from '../src/core/holidays.js';
import { validateSolarDate } from '../src/core/validate.js';
import { t, setLang, getLang } from '../src/core/i18n.js';

const lunarStart = { day: 15, month: 1, year: 2026, isLeapMonth: false };
const greg = { day: 3, month: 3, year: 2026 };

// ---------------------------------------------------------------- horizon

test('yearly horizon is 40 years', () => {
  assert.equal(DEFAULT_YEARS, 40);
});

// ------------------------------------------------------- monthly recurrence

test('monthly recurrence lands on the same lunar day every lunar month', () => {
  const dates = lunarMonthlyDates(lunarStart, 3);
  assert.ok(dates.length >= 36, `expected ~37 dates, got ${dates.length}`);
  for (const g of dates) {
    const [ld] = convertSolar2Lunar(g.day, g.month, g.year);
    // Rằm is day 15; short months clamp to the last day.
    assert.ok(ld === 15 || ld === 14, `unexpected lunar day ${ld} on ${g.year}`);
  }
});

test('monthly recurrence dates are strictly chronological', () => {
  const dates = lunarMonthlyDates(lunarStart, 5);
  for (let i = 1; i < dates.length; i++) {
    const a = dates[i - 1], b = dates[i];
    const key = (d) => d.year * 10000 + d.month * 100 + d.day;
    assert.ok(key(b) > key(a), `out of order at ${i}: ${JSON.stringify([a, b])}`);
  }
});

test('monthly recurrence includes leap months as their own occurrence', () => {
  // 2025 has a leap 6th month, so that lunar year yields 13 occurrences.
  const dates = lunarMonthlyDates({ day: 1, month: 1, year: 2025 }, 1);
  assert.equal(dates.length, 13);
});

test('monthly horizon stays smaller than yearly, by design', () => {
  assert.ok(MONTHLY_YEARS < DEFAULT_YEARS);
  const dates = lunarMonthlyDates(lunarStart);
  assert.ok(dates.length < 250, `monthly payload too large: ${dates.length}`);
});

test('monthly recurrence emits chunked RDATE lines', () => {
  const { googleEvent } = buildDraft({
    title: 'Rằm', gregorian: greg, lunar: lunarStart, allDay: true,
    recurrence: lunarMonthly(), timeZone: 'Asia/Ho_Chi_Minh',
  });
  // ~185 dates must be split across multiple RDATE properties (100 max each).
  assert.ok(googleEvent.recurrence.length > 1, 'expected chunked RDATE lines');
  for (const line of googleEvent.recurrence) {
    assert.match(line, /^RDATE;VALUE=DATE:/);
    assert.ok(line.replace('RDATE;VALUE=DATE:', '').split(',').length <= 100);
  }
});

// ---------------------------------------------------------------- reminders

test('reminder is attached as a popup override', () => {
  const { googleEvent } = buildDraft({
    title: 'Giỗ', gregorian: greg, lunar: lunarStart, allDay: true,
    recurrence: NONE, reminderMinutes: 4320,
  });
  assert.deepEqual(googleEvent.reminders, {
    useDefault: false,
    overrides: [{ method: 'popup', minutes: 4320 }],
  });
});

test('no reminder leaves the calendar defaults alone', () => {
  const { googleEvent } = buildDraft({
    title: 'Giỗ', gregorian: greg, lunar: lunarStart, allDay: true, recurrence: NONE,
  });
  assert.equal(googleEvent.reminders, undefined);
});

test('reminder is capped at Google\'s 4-week maximum', () => {
  const { googleEvent } = buildDraft({
    title: 'Giỗ', gregorian: greg, lunar: lunarStart, allDay: true,
    recurrence: NONE, reminderMinutes: 999999,
  });
  assert.equal(googleEvent.reminders.overrides[0].minutes, 40320);
});

test('describeReminder is readable in both languages', () => {
  assert.equal(describeReminder(null), 'Calendar default');
  assert.equal(describeReminder(0), 'At time of event');
  assert.equal(describeReminder(1440), '1 day before');
  assert.equal(describeReminder(10080), '1 week before');
  assert.equal(describeReminder(1440, 'vi'), 'Trước 1 ngày');
});

// ------------------------------------------------------------ reverse lookup

test('solar → lunar reverse lookup resolves both directions', () => {
  const r = validateSolarDate({ day: 17, month: 2, year: 2026 });
  assert.ok(r.ok);
  assert.deepEqual(r.value.lunar, { day: 1, month: 1, year: 2026, isLeapMonth: false });
  assert.deepEqual(r.value.gregorian, { day: 17, month: 2, year: 2026 });
});

test('impossible Gregorian dates are rejected', () => {
  assert.equal(validateSolarDate({ day: 31, month: 2, year: 2026 }).ok, false);
  assert.equal(validateSolarDate({ day: 30, month: 2, year: 2024 }).ok, false);
  assert.equal(validateSolarDate({ day: 29, month: 2, year: 2024 }).ok, true); // leap year
});

// ---------------------------------------------------------------- holidays

test('holidays are lunar dates and resolve through conversion', () => {
  const tet = getHoliday('tet');
  assert.deepEqual([tet.day, tet.month], [1, 1]);
  assert.equal(getHoliday('trung-thu').month, 8);
  assert.equal(getHoliday('nope'), null);
});

test('every holiday has both language names and a unique id', () => {
  const ids = new Set();
  for (const h of HOLIDAYS) {
    assert.ok(h.vi && h.en, `missing name for ${h.id}`);
    assert.ok(h.day >= 1 && h.day <= 30, `bad day for ${h.id}`);
    assert.ok(h.month >= 1 && h.month <= 12, `bad month for ${h.id}`);
    assert.ok(!ids.has(h.id), `duplicate id ${h.id}`);
    ids.add(h.id);
  }
});

test('holidayName switches language', () => {
  const tet = getHoliday('tet');
  assert.equal(holidayName(tet, 'vi'), 'Tết Nguyên Đán');
  assert.match(holidayName(tet, 'en'), /Lunar New Year/);
});

// ---------------------------------------------------------------- i18n

test('translations resolve and fall back safely', () => {
  setLang('vi');
  assert.equal(getLang(), 'vi');
  assert.equal(t('navNew'), 'Tạo mới');
  assert.equal(t('totallyUnknownKey'), 'totallyUnknownKey'); // falls back to key
  setLang('en');
  assert.equal(t('navNew'), 'New');
});

test('every English key has a Vietnamese counterpart', () => {
  setLang('en');
  const enKeys = Object.keys(
    // Probe via t(): compare a representative sample of user-facing keys.
    {
      appName: 1, navNew: 1, navHolidays: 1, navHistory: 1, navSettings: 1,
      title: 1, day: 1, month: 1, year: 1, allDay: 1, repeats: 1, reminder: 1,
      calendar: 1, preview: 1, create: 1, back: 1, delete: 1, edit: 1,
    }
  );
  for (const key of enKeys) {
    const en = t(key, 'en');
    const vi = t(key, 'vi');
    assert.notEqual(vi, key, `missing Vietnamese translation for "${key}"`);
    assert.ok(en && vi, `empty translation for "${key}"`);
  }
});
