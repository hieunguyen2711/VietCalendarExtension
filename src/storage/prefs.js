/*
 * Persistence, over whichever store the platform gives us.
 *
 * In the extension:
 *   sync  — small user preferences, follow the user across devices.
 *   local — the created-event log. Kept local because it can grow, and it is
 *           a record of this device's activity rather than a preference.
 *
 * In the hosted web build both land in localStorage, which is per-origin and
 * per-device: preferences don't follow the user between their phone and a
 * laptop. That's a real downgrade, but syncing would mean a backend, and this
 * project deliberately has none.
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
  defaultColorId: null,
  allDayDefault: true,
};

const HISTORY_KEY = 'createdEvents';
const HISTORY_LIMIT = 500;

/*
 * Two areas, one interface: get(defaults) resolves an object, set(patch)
 * merges. Everything below is written against this, so the platform split
 * stays in one place.
 */

function chromeArea(area) {
  return {
    get: (defaults) => new Promise((resolve) => area.get(defaults, resolve)),
    set: (patch) => new Promise((resolve) => area.set(patch, () => resolve())),
  };
}

/**
 * localStorage holds one JSON blob per area. Namespaced because GitHub Pages
 * serves every one of a user's projects from a single origin, so unprefixed
 * keys would collide with whatever else they host.
 */
function localArea(name) {
  const storageKey = `vietCalendar:${name}`;
  const read = () => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || '{}');
    } catch {
      return {}; // Corrupt or hand-edited — fall back to defaults.
    }
  };
  return {
    get: async (defaults) => ({ ...defaults, ...read() }),
    set: async (patch) => {
      localStorage.setItem(storageKey, JSON.stringify({ ...read(), ...patch }));
    },
  };
}

const inExtension = typeof chrome !== 'undefined' && chrome.storage?.sync;
const prefsArea = inExtension ? chromeArea(chrome.storage.sync) : localArea('prefs');
const historyArea = inExtension ? chromeArea(chrome.storage.local) : localArea('history');

/** Read all preferences, merged over defaults. */
export async function getPrefs() {
  const items = await prefsArea.get(PREF_DEFAULTS);
  return { ...PREF_DEFAULTS, ...items };
}

/** Merge a partial preferences patch. */
export async function setPrefs(patch) {
  await prefsArea.set(patch);
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
export async function getHistory() {
  const items = await historyArea.get({ [HISTORY_KEY]: [] });
  return items[HISTORY_KEY] || [];
}

/** Record a newly created event. */
export async function addHistory(entry) {
  const history = await getHistory();
  history.unshift(entry);
  const trimmed = history.slice(0, HISTORY_LIMIT);
  await historyArea.set({ [HISTORY_KEY]: trimmed });
  return trimmed;
}

/** Forget one event (after deleting it, or when the user dismisses it). */
export async function removeHistory(eventId) {
  const history = await getHistory();
  const filtered = history.filter((e) => e.eventId !== eventId);
  await historyArea.set({ [HISTORY_KEY]: filtered });
  return filtered;
}

/** Clear the whole log (does not touch Google Calendar). */
export async function clearHistory() {
  await historyArea.set({ [HISTORY_KEY]: [] });
  return [];
}
