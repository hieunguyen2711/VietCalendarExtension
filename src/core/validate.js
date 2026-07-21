/*
 * Validation for user-entered lunar dates and event fields.
 *
 * The conversion core assumes well-formed integers; this layer catches the
 * "impossible or ambiguous" inputs before we ever convert or hit the network.
 */

import {
  convertLunar2Solar,
  convertSolar2Lunar,
  jdFromDate,
  jdToDate,
  VN_TIMEZONE,
} from './lunar.js';

/** @typedef {{ ok: true, value: any } | { ok: false, errors: string[] }} Result */

const MIN_YEAR = 1900;
const MAX_YEAR = 2199; // the new-moon table is reliable across this range

/**
 * Validate a raw lunar-date form input.
 * @param {Object} input
 * @param {number} input.day    lunar day (1..30)
 * @param {number} input.month  lunar month (1..12)
 * @param {number} input.year   lunar year
 * @param {boolean} input.isLeapMonth whether the month is the leap month
 * @returns {Result} on success, value is the resolved Gregorian date
 *          { day, month, year } plus { lunar } echoing the normalized input.
 */
export function validateLunarDate({ day, month, year, isLeapMonth = false }) {
  const errors = [];

  for (const [name, v] of [['day', day], ['month', month], ['year', year]]) {
    if (!Number.isInteger(v)) {
      errors.push(`Lunar ${name} must be a whole number.`);
    }
  }
  if (errors.length) return { ok: false, errors };

  if (month < 1 || month > 12) errors.push('Lunar month must be between 1 and 12.');
  if (day < 1 || day > 30) errors.push('Lunar day must be between 1 and 30.');
  if (year < MIN_YEAR || year > MAX_YEAR) {
    errors.push(`Lunar year must be between ${MIN_YEAR} and ${MAX_YEAR}.`);
  }
  if (errors.length) return { ok: false, errors };

  const leap = isLeapMonth ? 1 : 0;
  const [gd, gm, gy] = convertLunar2Solar(day, month, year, leap, VN_TIMEZONE);

  if (gd === 0 && gm === 0 && gy === 0) {
    errors.push(
      `Lunar year ${year} has no leap month ${month}. Uncheck "leap month" or pick the correct month.`
    );
    return { ok: false, errors };
  }

  // Guard against a day that doesn't exist in that lunar month (e.g. day 30 of
  // a 29-day month): converting back must reproduce the same lunar date.
  const [ld, lm, ly, ll] = convertSolar2Lunar(gd, gm, gy, VN_TIMEZONE);
  if (ld !== day || lm !== month || ly !== year || ll !== leap) {
    errors.push(
      `Lunar date ${day}/${month}/${year}${leap ? ' (leap)' : ''} does not exist ` +
        `(that lunar month has fewer days). Please check the day.`
    );
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      gregorian: { day: gd, month: gm, year: gy },
      lunar: { day, month, year, isLeapMonth: !!leap },
    },
  };
}

/**
 * Validate a Gregorian date the user typed, and resolve the lunar date it maps
 * to. This is the reverse-lookup path: most people know a relative's Gregorian
 * death date from a document, but the giỗ is observed on the lunar date.
 * @returns {Result} value is { gregorian, lunar } — same shape as
 *          validateLunarDate, so downstream code doesn't branch.
 */
export function validateSolarDate({ day, month, year }) {
  const errors = [];

  for (const [name, v] of [['day', day], ['month', month], ['year', year]]) {
    if (!Number.isInteger(v)) errors.push(`Gregorian ${name} must be a whole number.`);
  }
  if (errors.length) return { ok: false, errors };

  if (month < 1 || month > 12) errors.push('Month must be between 1 and 12.');
  if (day < 1 || day > 31) errors.push('Day must be between 1 and 31.');
  if (year < MIN_YEAR || year > MAX_YEAR) {
    errors.push(`Year must be between ${MIN_YEAR} and ${MAX_YEAR}.`);
  }
  if (errors.length) return { ok: false, errors };

  // Reject dates that don't exist (31 February, 30 February, etc.) by round-
  // tripping through the Julian Day number.
  const [rd, rm, ry] = jdToDate(jdFromDate(day, month, year));
  if (rd !== day || rm !== month || ry !== year) {
    errors.push(`${day}/${month}/${year} is not a real date.`);
    return { ok: false, errors };
  }

  const [ld, lm, ly, ll] = convertSolar2Lunar(day, month, year, VN_TIMEZONE);
  return {
    ok: true,
    value: {
      gregorian: { day, month, year },
      lunar: { day: ld, month: lm, year: ly, isLeapMonth: !!ll },
    },
  };
}

/** Validate the event title. */
export function validateTitle(title) {
  const trimmed = (title ?? '').trim();
  if (!trimmed) return { ok: false, errors: ['Event title is required.'] };
  if (trimmed.length > 1024) {
    return { ok: false, errors: ['Event title is too long (max 1024 characters).'] };
  }
  return { ok: true, value: trimmed };
}

/**
 * Validate a "HH:MM" 24-hour time string. Only used for time-specific events.
 * @returns {Result} value is { hour, minute }
 */
export function validateTime(time) {
  const m = /^(\d{1,2}):(\d{2})$/.exec((time ?? '').trim());
  if (!m) return { ok: false, errors: ['Time must be in HH:MM format.'] };
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) {
    return { ok: false, errors: ['Time must be a valid 24-hour time.'] };
  }
  return { ok: true, value: { hour, minute } };
}
