import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  convertSolar2Lunar,
  convertLunar2Solar,
  getLeapMonthOfYear,
  jdFromDate,
  jdToDate,
} from '../src/core/lunar.js';

test('jdFromDate / jdToDate round-trip', () => {
  for (const [d, m, y] of [
    [1, 1, 2000],
    [20, 7, 2026],
    [29, 2, 2024],
    [15, 10, 1582],
  ]) {
    const jd = jdFromDate(d, m, y);
    assert.deepEqual(jdToDate(jd), [d, m, y]);
  }
});

test('known solar -> lunar dates (VN, UTC+7)', () => {
  // 2026-02-17 is Tết (mùng 1 Tết), lunar 1/1/2026 (year of the Horse - Bính Ngọ)
  assert.deepEqual(convertSolar2Lunar(17, 2, 2026), [1, 1, 2026, 0]);
  // 2000-01-01 => lunar 25/11/1999
  assert.deepEqual(convertSolar2Lunar(1, 1, 2000), [25, 11, 1999, 0]);
  // 2014-10-24 is day 1 of the leap 9th month of 2014 (nhuận tháng 9)
  assert.deepEqual(convertSolar2Lunar(24, 10, 2014), [1, 9, 2014, 1]);
});

test('lunar -> solar dates (VN, UTC+7)', () => {
  // Tết 2026: lunar 1/1/2026 => 2026-02-17
  assert.deepEqual(convertLunar2Solar(1, 1, 2026, 0), [17, 2, 2026]);
  // Leap 9th month 2014, day 1 => 2014-10-24
  assert.deepEqual(convertLunar2Solar(1, 9, 2014, 1), [24, 10, 2014]);
});

test('solar<->lunar is invertible for a range of dates', () => {
  let jd = jdFromDate(1, 1, 2020);
  const end = jdFromDate(31, 12, 2027);
  for (; jd <= end; jd++) {
    const [d, m, y] = jdToDate(jd);
    const [ld, lm, ly, leap] = convertSolar2Lunar(d, m, y);
    const back = convertLunar2Solar(ld, lm, ly, leap);
    assert.deepEqual(back, [d, m, y], `failed round-trip on ${d}/${m}/${y}`);
  }
});

test('getLeapMonthOfYear matches known leap years', () => {
  assert.equal(getLeapMonthOfYear(2014), 9); // nhuận tháng 9
  assert.equal(getLeapMonthOfYear(2023), 2); // nhuận tháng 2
  assert.equal(getLeapMonthOfYear(2025), 6); // nhuận tháng 6
  assert.equal(getLeapMonthOfYear(2026), 0); // no leap month
});

test('non-existent leap month returns [0,0,0]', () => {
  // 2014 is a leap lunar year whose leap month is the 4th. Requesting a leap
  // 3rd month is invalid and must be rejected.
  assert.deepEqual(convertLunar2Solar(1, 3, 2014, 1), [0, 0, 0]);
});
