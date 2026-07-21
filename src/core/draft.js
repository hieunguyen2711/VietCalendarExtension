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
import { lunarAnniversaryDates, lunarMonthlyDates } from './occurrences.js';
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
 * @property {number|null} [reminderMinutes] popup reminder N minutes before,
 *           or null to use the calendar's default reminders.
 * @property {string} [lang] 'en' | 'vi', for preview text only.
 */

/** Max dates per RDATE line; long recurrence sets are split across several. */
const RDATE_CHUNK = 100;

/** Google Calendar caps reminders at 4 weeks before the event. */
const MAX_REMINDER_MINUTES = 40320;

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
    reminderMinutes = null,
    lang = 'en',
  } = input;

  const zodiac = zodiacForLunarYear(lunar.year);

  const description =
    `Vietnamese lunar date: ${lunar.day}/${lunar.month}/${lunar.year}` +
    `${lunar.isLeapMonth ? ' (leap month)' : ''}.\n` +
    `Zodiac year: ${describeZodiac(zodiac)}.\n` +
    `Created with Viet Calendar extension.`;

  // Lunar recurrences expand to the actual Gregorian dates the lunar date lands
  // on. occurrences[0] is the original date (it becomes DTSTART).
  let occurrences;
  if (recurrence?.freq === 'lunarYearly') {
    occurrences = lunarAnniversaryDates(lunar, recurrence.years);
  } else if (recurrence?.freq === 'lunarMonthly') {
    occurrences = lunarMonthlyDates(lunar, recurrence.years);
  } else {
    occurrences = [gregorian];
  }
  if (!occurrences.length) occurrences = [gregorian];

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
      googleEvent.recurrence = chunkRDates(
        occurrences.slice(1).map(toBasicDate),
        (dates) => `RDATE;VALUE=DATE:${dates}`
      );
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
      googleEvent.recurrence = chunkRDates(
        occurrences.slice(1).map((g) => toBasicDate(g) + timeSuffix),
        (dates) => `RDATE;TZID=${timeZone}:${dates}`
      );
    }
  }

  // Reminders. A giỗ needs preparation time, so an advance reminder is the
  // common case; null means "leave the calendar's own defaults alone".
  if (reminderMinutes != null) {
    googleEvent.reminders = {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: Math.min(reminderMinutes, MAX_REMINDER_MINUTES) },
      ],
    };
  }

  let recurrenceText = describeRecurrence(recurrence, lang);
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
      reminderText: describeReminder(reminderMinutes, lang),
      // All-day events are floating dates in Google Calendar — no zone applies.
      timezone: allDay
        ? (lang === 'vi' ? 'Cả ngày (không có múi giờ)' : 'All-day (no timezone)')
        : timeZone,
    },
    // The exact payload sent to Google Calendar:
    googleEvent,
    // Kept so the extension can rebuild/extend this event later.
    source: { lunar, recurrence, allDay, start, timeZone, reminderMinutes },
  };
}

/** Human-readable reminder summary. */
export function describeReminder(minutes, lang = 'en') {
  const vi = lang === 'vi';
  if (minutes == null) return vi ? 'Mặc định của lịch' : 'Calendar default';
  if (minutes === 0) return vi ? 'Lúc bắt đầu' : 'At time of event';
  const days = minutes / (24 * 60);
  if (Number.isInteger(days) && days >= 1) {
    if (days === 7) return vi ? 'Trước 1 tuần' : '1 week before';
    return vi ? `Trước ${days} ngày` : `${days} day${days > 1 ? 's' : ''} before`;
  }
  const hours = minutes / 60;
  if (Number.isInteger(hours)) {
    return vi ? `Trước ${hours} giờ` : `${hours} hour${hours > 1 ? 's' : ''} before`;
  }
  return vi ? `Trước ${minutes} phút` : `${minutes} minutes before`;
}

/** "YYYYMMDD" (RFC 5545 basic date form) for RDATE. */
function toBasicDate({ day, month, year }) {
  return `${year}${pad2(month)}${pad2(day)}`;
}

/**
 * Split a long date list across several RDATE properties. RFC 5545 allows
 * repeating the property, and a monthly recurrence can reach several hundred
 * dates — one enormous line risks being rejected.
 */
function chunkRDates(values, format) {
  const lines = [];
  for (let i = 0; i < values.length; i += RDATE_CHUNK) {
    lines.push(format(values.slice(i, i + RDATE_CHUNK).join(',')));
  }
  return lines;
}
