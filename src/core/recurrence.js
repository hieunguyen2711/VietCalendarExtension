/*
 * Recurrence model for the extension.
 *
 *   - none:         a single, non-recurring event.
 *   - lunarYearly:  the same lunar date every year (giỗ, lunar birthday).
 *   - lunarMonthly: the same lunar day every lunar month (Mùng 1, Rằm).
 *
 * Both lunar modes expand to explicit Gregorian date lists (RDATE, built in
 * draft.js) rather than an RRULE. A Gregorian RRULE cannot express either
 * pattern: lunar years drift ~11 days against the solar year, and lunar months
 * alternate between 29 and 30 days.
 *
 * The abstraction stays open: add a new `freq` and teach draft.js how to
 * expand it, without touching the calling code.
 */

import { DEFAULT_YEARS, MONTHLY_YEARS } from './occurrences.js';

/** @typedef {'none'|'lunarYearly'|'lunarMonthly'} RecurrenceFreq */

export const NONE = Object.freeze({ freq: 'none' });

/** Repeat on the same lunar date for `years` consecutive lunar years. */
export function lunarYearly({ years = DEFAULT_YEARS } = {}) {
  return { freq: 'lunarYearly', years };
}

/** Repeat on the same lunar day of EVERY lunar month, for `years` years. */
export function lunarMonthly({ years = MONTHLY_YEARS } = {}) {
  return { freq: 'lunarMonthly', years };
}

/** True when this recurrence expands into an explicit date list. */
export function isLunarRecurrence(recurrence) {
  return recurrence?.freq === 'lunarYearly' || recurrence?.freq === 'lunarMonthly';
}

/** Short human-readable summary for the confirmation preview. */
export function describe(recurrence, lang = 'en') {
  const vi = lang === 'vi';
  if (!recurrence || recurrence.freq === 'none') {
    return vi ? 'Không lặp lại' : 'Does not repeat';
  }
  if (recurrence.freq === 'lunarYearly') {
    return vi
      ? 'Hằng năm theo ngày âm lịch'
      : 'Every year on the same lunar date';
  }
  if (recurrence.freq === 'lunarMonthly') {
    return vi
      ? 'Hằng tháng theo ngày âm lịch'
      : 'Every lunar month on the same lunar day';
  }
  return vi ? 'Tùy chỉnh' : 'Custom';
}
