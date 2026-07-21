import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchLunarCalendars, LUNAR_CALENDAR_NAME } from '../src/calendar/calendarService.js';

const cal = (id, summary, primary = false) => ({ id, summary, primary });

test('finds an existing calendar by exact name', () => {
  const list = [cal('a', 'Work'), cal('b', LUNAR_CALENDAR_NAME), cal('c', 'Personal')];
  const found = matchLunarCalendars(list);
  assert.equal(found.length, 1);
  assert.equal(found[0].id, 'b');
});

test('matching tolerates whitespace and case', () => {
  const list = [cal('a', '  lịch âm  ')];
  assert.equal(matchLunarCalendars(list).length, 1);
});

test('returns every duplicate so the UI can warn about leftovers', () => {
  const list = [cal('a', 'Lịch Âm'), cal('b', 'Work'), cal('c', 'Lịch Âm')];
  const found = matchLunarCalendars(list);
  assert.equal(found.length, 2);
  assert.deepEqual(found.map((c) => c.id), ['a', 'c']);
});

test('returns nothing when no lunar calendar exists', () => {
  assert.equal(matchLunarCalendars([cal('a', 'Work'), cal('b', 'Family')]).length, 0);
});

test('does not match similarly-named calendars', () => {
  const list = [cal('a', 'Lịch Âm 2'), cal('b', 'My Lịch Âm'), cal('c', 'Lich Am')];
  assert.equal(matchLunarCalendars(list).length, 0);
});

test('handles missing or empty summaries without throwing', () => {
  const list = [{ id: 'a' }, cal('b', ''), cal('c', null)];
  assert.equal(matchLunarCalendars(list).length, 0);
});
