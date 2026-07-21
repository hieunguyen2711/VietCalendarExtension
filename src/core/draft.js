/*
 * Event draft builder.
 *
 * Turns validated form input into (a) a normalized draft used for the
 * confirmation preview and (b) the exact Google Calendar event resource that
 * will be POSTed. Keeping both in one place means the preview can never drift
 * from what actually gets sent.
 */

import { jdFromDate, jdToDate } from './lunar.js';
import { describe as describeRecurrence } from './recurrence.js';
import { lunarAnniversaryDates } from './occurrences.js';
import { zodiacForLunarYear, describeZodiac } from './zodiac.js';

/**
 * IANA timezone for Vietnam.
 *
 * NOTE the two distinct roles timezones play here — don't conflate them:
 *   1. The lunar CONVERSION is always computed at UTC+7 (see VN_TIMEZONE in
 *      lunar.js). That is not a preference; the Vietnamese lunar calendar is
 *      *defined* at Vietnam's meridian, so it must never follow the user.
 *   2. The resulting EVENT is scheduled in the user's own timezone. Someone in
 *      California asking for a 9:00 giỗ means 9:00 their time — not 9:00 in
 *      Hanoi, which would land the evening before for them.
 * VN_TZID below is only a fallback for role 2 when the platform can't tell us
 * the local zone.
 */
export const VN_TZID = 'Asia/Ho_Chi_Minh';

/** The user's IANA timezone, falling back to Vietnam if unavailable. */
export function localTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || VN_TZID;
  } catch {
    return VN_TZID;
  }
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const pad2 = (n) => String(n).padStart(2, '0');

/** "YYYY-MM-DD" for a {day,month,year}. */
export function toISODate({ day, month, year }) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** Add `n` days to a Gregorian date via Julian Day arithmetic (TZ-safe). */
export function addDays({ day, month, year }, n) {
  const [d, m, y] = jdToDate(jdFromDate(day, month, year) + n);
  return { day: d, month: m, year: y };
}

function humanDate({ day, month, year }) {
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

/**
 * @typedef {Object} DraftInput
 * @property {string} title            validated, trimmed title
 * @property {{day,month,year}} gregorian   resolved Gregorian date
 * @property {{day,month,year,isLeapMonth}} lunar  original lunar date
 * @property {boolean} allDay
 * @property {{hour,minute}} [start]   required when allDay is false
 * @property {number} [durationMinutes] timed events only (default 60)
 * @property {import('./recurrence.js').Recurrence} recurrence
 * @property {string} [timeZone] IANA zone the EVENT is scheduled in; defaults
 *           to the user's local zone. Unrelated to the UTC+7 used to convert
 *           the lunar date.
 */

/**
 * Build a draft object containing everything the confirmation screen shows and
 * everything the API call needs.
 * @param {DraftInput} input
 */
export function buildDraft(input) {
  const {
    title,
    gregorian,
    lunar,
    allDay,
    start,
    durationMinutes = 60,
    recurrence,
    timeZone = localTimeZone(),
  } = input;

  const zodiac = zodiacForLunarYear(lunar.year);

  const description =
    `Vietnamese lunar date: ${lunar.day}/${lunar.month}/${lunar.year}` +
    `${lunar.isLeapMonth ? ' (leap month)' : ''}.\n` +
    `Zodiac year: ${describeZodiac(zodiac)}.\n` +
    `Created with Viet Calendar extension.`;

  // For a lunar-yearly recurrence, expand to the actual Gregorian dates the
  // lunar date lands on across the horizon. occurrences[0] is this year's date.
  const occurrences =
    recurrence?.freq === 'lunarYearly'
      ? lunarAnniversaryDates(lunar, recurrence.years)
      : [gregorian];

  /** @type {Record<string, any>} */
  const googleEvent = {
    summary: title,
    description,
  };

  let whenText;
  if (allDay) {
    googleEvent.start = { date: toISODate(gregorian) };
    googleEvent.end = { date: toISODate(addDays(gregorian, 1)) }; // end.date exclusive
    whenText = `${humanDate(gregorian)} (all day)`;
    if (occurrences.length > 1) {
      // RDATE carries the *additional* occurrences (DTSTART is the first).
      const dates = occurrences.slice(1).map((g) => toBasicDate(g)).join(',');
      googleEvent.recurrence = [`RDATE;VALUE=DATE:${dates}`];
    }
  } else {
    if (!start) throw new Error('Timed event requires a start time.');
    const startISO = `${toISODate(gregorian)}T${pad2(start.hour)}:${pad2(start.minute)}:00`;
    const startMinutes = start.hour * 60 + start.minute + durationMinutes;
    const dayOffset = Math.floor(startMinutes / (24 * 60));
    const endMinuteOfDay = startMinutes % (24 * 60);
    const endDateParts = dayOffset ? addDays(gregorian, dayOffset) : gregorian;
    const endISO =
      `${toISODate(endDateParts)}T` +
      `${pad2(Math.floor(endMinuteOfDay / 60))}:${pad2(endMinuteOfDay % 60)}:00`;
    googleEvent.start = { dateTime: startISO, timeZone };
    googleEvent.end = { dateTime: endISO, timeZone };
    whenText = `${humanDate(gregorian)} at ${pad2(start.hour)}:${pad2(start.minute)}`;
    if (occurrences.length > 1) {
      const timeSuffix = `T${pad2(start.hour)}${pad2(start.minute)}00`;
      const dates = occurrences.slice(1).map((g) => toBasicDate(g) + timeSuffix).join(',');
      googleEvent.recurrence = [`RDATE;TZID=${timeZone}:${dates}`];
    }
  }

  let recurrenceText = describeRecurrence(recurrence);
  if (occurrences.length > 1) {
    const first = occurrences[0].year;
    const last = occurrences[occurrences.length - 1].year;
    recurrenceText += ` (${occurrences.length} dates, ${first}–${last})`;
  }

  return {
    // For the preview screen:
    preview: {
      title,
      lunarText:
        `${lunar.day}/${lunar.month}/${lunar.year}` +
        `${lunar.isLeapMonth ? ' (leap)' : ''} (âm lịch)`,
      gregorianText: whenText,
      zodiacText: `${zodiac.name} — ${zodiac.animal.vi} (${zodiac.animal.en})`,
      recurrenceText,
      // Next few Gregorian dates, so the user sees the lunar drift is real.
      upcoming: occurrences.slice(0, 5).map(humanDate),
      isRecurring: occurrences.length > 1,
      // All-day events are floating dates in Google Calendar — no zone applies.
      timezone: allDay ? 'All-day (no timezone)' : timeZone,
    },
    // The exact payload sent to Google Calendar:
    googleEvent,
  };
}

/** "YYYYMMDD" (RFC 5545 basic date form) for RDATE. */
function toBasicDate({ day, month, year }) {
  return `${year}${pad2(month)}${pad2(day)}`;
}
