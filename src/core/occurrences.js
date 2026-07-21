/*
 * Lunar recurrence occurrences.
 *
 * A Vietnamese anniversary (giỗ, lunar birthday) recurs on the same *lunar*
 * date every year, which lands on a different Gregorian date each year. Mùng 1
 * and Rằm (1st / 15th of each lunar month) recur every lunar month, which no
 * Gregorian rule can express at all — lunar months alternate 29/30 days.
 *
 * So both recurrences are generated as explicit Gregorian date lists.
 *
 * Edge cases handled per month/year:
 *   - Leap month: only years that actually have that leap month use the leap
 *     variant; other years fall back to the ordinary month.
 *   - Short month: if the lunar day doesn't exist (e.g. day 30 of a 29-day
 *     month), it clamps down to the last existing day of that month.
 */

import {
  convertLunar2Solar,
  convertSolar2Lunar,
  getLeapMonthOfYear,
  jdFromDate,
  VN_TIMEZONE,
} from './lunar.js';

/** Horizon for a lunar yearly recurrence (one date per year). */
export const DEFAULT_YEARS = 40;

/**
 * Horizon for a lunar monthly recurrence. Shorter than the yearly horizon on
 * purpose: monthly produces ~12.4 dates per year, so 15 years is already ~186
 * explicit dates. Going to 40 years would emit ~500, which bloats the event
 * payload for no practical benefit.
 */
export const MONTHLY_YEARS = 15;

/**
 * Resolve a lunar day within one specific lunar month/year to a Gregorian date.
 * Clamps the day down when the month is too short. Returns null if unresolvable.
 */
function resolveDay(day, month, lunarYear, leap, timeZone) {
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
    const y = lunar.year + i;
    // Only use the leap variant in years that actually have that leap month.
    const leap = lunar.isLeapMonth && getLeapMonthOfYear(y, timeZone) === lunar.month ? 1 : 0;
    const g = resolveDay(lunar.day, lunar.month, y, leap, timeZone);
    if (g) out.push(g);
  }
  return out;
}

/**
 * Gregorian dates for a lunar day-of-month repeated EVERY lunar month — the
 * Mùng 1 / Rằm pattern. Starts at `lunar`'s month and runs for `years` years.
 *
 * Leap months are included as their own occurrence (a leap month is a real
 * month; Rằm falls in it too), inserted directly after their base month so the
 * list stays chronological.
 *
 * @param {{day:number, month:number, year:number}} lunar starting point
 * @returns {Array<{day:number, month:number, year:number}>}
 */
export function lunarMonthlyDates(lunar, years = MONTHLY_YEARS, timeZone = VN_TIMEZONE) {
  const out = [];
  // Anything earlier than the requested starting month is dropped.
  const startG = resolveDay(lunar.day, lunar.month, lunar.year, 0, timeZone);
  const startJd = startG ? jdFromDate(startG.day, startG.month, startG.year) : -Infinity;

  for (let i = 0; i < years; i++) {
    const y = lunar.year + i;
    const leapMonth = getLeapMonthOfYear(y, timeZone);
    for (let m = 1; m <= 12; m++) {
      const normal = resolveDay(lunar.day, m, y, 0, timeZone);
      if (normal && jdFromDate(normal.day, normal.month, normal.year) >= startJd) {
        out.push(normal);
      }
      // A leap month directly follows its base month.
      if (leapMonth === m) {
        const leap = resolveDay(lunar.day, m, y, 1, timeZone);
        if (leap && jdFromDate(leap.day, leap.month, leap.year) >= startJd) {
          out.push(leap);
        }
      }
    }
  }
  return out;
}
