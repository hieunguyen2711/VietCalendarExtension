/*
 * Lunar anniversary occurrences.
 *
 * A Vietnamese anniversary (giỗ, lunar birthday) recurs on the same *lunar*
 * date every year, which lands on a different Gregorian date each year. So a
 * yearly recurrence is really: "the same lunar day/month, resolved to Gregorian
 * for each of the next N lunar years."
 *
 * Edge cases handled per year:
 *   - Leap month: only years that actually have that leap month use the leap
 *     variant; other years fall back to the ordinary month.
 *   - Short month: if the lunar day doesn't exist that year (e.g. day 30 of a
 *     29-day month), it clamps down to the last existing day of that month.
 */

import {
  convertLunar2Solar,
  convertSolar2Lunar,
  getLeapMonthOfYear,
  VN_TIMEZONE,
} from './lunar.js';

/** Default horizon for a lunar "annual" recurrence. */
export const DEFAULT_YEARS = 25;

/** Resolve a lunar date to a valid Gregorian date for one specific lunar year. */
function resolveForYear(day, month, isLeap, lunarYear, timeZone) {
  const leap = isLeap && getLeapMonthOfYear(lunarYear, timeZone) === month ? 1 : 0;
  // Clamp the day down until it names a real day of that lunar month.
  for (let d = day; d >= 1; d--) {
    const [gd, gm, gy] = convertLunar2Solar(d, month, lunarYear, leap, timeZone);
    if (gd === 0) continue;
    const [ld, lm, ly, ll] = convertSolar2Lunar(gd, gm, gy, timeZone);
    if (ld === d && lm === month && ly === lunarYear && ll === leap) {
      return { day: gd, month: gm, year: gy };
    }
  }
  return null;
}

/**
 * Gregorian dates for a lunar date repeated over `years` consecutive lunar
 * years, starting at `lunar.year`. The first entry is the original date.
 * @param {{day:number, month:number, year:number, isLeapMonth:boolean}} lunar
 * @returns {Array<{day:number, month:number, year:number}>}
 */
export function lunarAnniversaryDates(lunar, years = DEFAULT_YEARS, timeZone = VN_TIMEZONE) {
  const out = [];
  for (let i = 0; i < years; i++) {
    const g = resolveForYear(lunar.day, lunar.month, lunar.isLeapMonth, lunar.year + i, timeZone);
    if (g) out.push(g);
  }
  return out;
}
