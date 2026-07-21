/*
 * Persistence via chrome.storage.
 *
 *   sync  — small user preferences, follow the user across devices.
 *   local — the created-event log. Kept local because it can grow, and it is
 *           a record of this device's activity rather than a preference.
 *
 * The event log also stores each event's SOURCE lunar date and recurrence, not
 * just its Google id. That's what makes it possible to rebuild, extend, or
 * re-create an event later without asking the user to retype anything.
 */

const PREF_DEFAULTS = {
  lang: 'en',
  calendarId: 'primary',
  calendarName: '',
  defaultReminderMinutes: null,
  allDayDefault: true,
};

const HISTORY_KEY = 'createdEvents';
const HISTORY_LIMIT = 500;

/** Read all preferences, merged over defaults. */
export function getPrefs() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(PREF_DEFAULTS, (items) => resolve({ ...PREF_DEFAULTS, ...items }));
  });
}

/** Merge a partial preferences patch. */
export function setPrefs(patch) {
  return new Promise((resolve) => {
    chrome.storage.sync.set(patch, () => resolve());
  });
}

/**
 * @typedef {Object} HistoryEntry
 * @property {string} eventId
 * @property {string} calendarId
 * @property {string} title
 * @property {string} htmlLink
 * @property {string} createdAt      ISO timestamp
 * @property {Object} source         lunar date + recurrence, for rebuilding
 * @property {string} gregorianText  human-readable first occurrence
 */

/** All recorded events, newest first. */
export function getHistory() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ [HISTORY_KEY]: [] }, (items) =>
      resolve(items[HISTORY_KEY] || [])
    );
  });
}

/** Record a newly created event. */
export async function addHistory(entry) {
  const history = await getHistory();
  history.unshift(entry);
  const trimmed = history.slice(0, HISTORY_LIMIT);
  return new Promise((resolve) => {
    chrome.storage.local.set({ [HISTORY_KEY]: trimmed }, () => resolve(trimmed));
  });
}

/** Forget one event (after deleting it, or when the user dismisses it). */
export async function removeHistory(eventId) {
  const history = await getHistory();
  const filtered = history.filter((e) => e.eventId !== eventId);
  return new Promise((resolve) => {
    chrome.storage.local.set({ [HISTORY_KEY]: filtered }, () => resolve(filtered));
  });
}

/** Clear the whole log (does not touch Google Calendar). */
export function clearHistory() {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [HISTORY_KEY]: [] }, () => resolve([]));
  });
}
