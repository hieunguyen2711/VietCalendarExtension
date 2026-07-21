import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  NONE,
  lunarYearly,
  lunarMonthly,
  isLunarRecurrence,
  describe,
} from '../src/core/recurrence.js';
import { DEFAULT_YEARS, MONTHLY_YEARS } from '../src/core/occurrences.js';

test('none does not repeat', () => {
  assert.equal(describe(NONE), 'Does not repeat');
  assert.equal(isLunarRecurrence(NONE), false);
});

test('lunarYearly defaults to the yearly horizon', () => {
  assert.deepEqual(lunarYearly(), { freq: 'lunarYearly', years: DEFAULT_YEARS });
  assert.match(describe(lunarYearly()), /same lunar date/);
  assert.ok(isLunarRecurrence(lunarYearly()));
});

test('lunarMonthly defaults to the monthly horizon', () => {
  assert.deepEqual(lunarMonthly(), { freq: 'lunarMonthly', years: MONTHLY_YEARS });
  assert.match(describe(lunarMonthly()), /lunar month/);
  assert.ok(isLunarRecurrence(lunarMonthly()));
});

test('descriptions are translated', () => {
  assert.equal(describe(NONE, 'vi'), 'Không lặp lại');
  assert.match(describe(lunarYearly(), 'vi'), /Hằng năm/);
  assert.match(describe(lunarMonthly(), 'vi'), /Hằng tháng/);
});
