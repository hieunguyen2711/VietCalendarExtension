/*
 * Recurrence model for the extension.
 *
 * v1 supports two options:
 *   - none:        a single, non-recurring event.
 *   - lunarYearly: the same *lunar* date every year. Because that date drifts
 *                  across the Gregorian calendar, this expands to an explicit
 *                  list of Gregorian dates (RDATE, built in draft.js) rather
 *                  than an RRULE:FREQ=YEARLY (which would wrongly pin the event
 *                  to a fixed Gregorian date).
 *
 * The abstraction stays open: add a new `freq` and teach draft.js how to map
 * it (monthly, custom, etc.) without touching the calling code.
 */

import { DEFAULT_YEARS } from './occurrences.js';

/** @typedef {'none'|'lunarYearly'} RecurrenceFreq */

export const NONE = Object.freeze({ freq: 'none' });

/** Repeat on the same lunar date for `years` consecutive lunar years. */
export function lunarYearly({ years = DEFAULT_YEARS } = {}) {
  return { freq: 'lunarYearly', years };
}

/** Short human-readable summary for the confirmation preview. */
export function describe(recurrence) {
  if (!recurrence || recurrence.freq === 'none') {
    return 'Does not repeat';
  }
  if (recurrence.freq === 'lunarYearly') {
    return `Every year on the same lunar date, for ${recurrence.years} years`;
  }
  return 'Custom';
}
