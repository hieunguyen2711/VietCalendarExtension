/*
 * Google Calendar API service layer.
 *
 * Handles token acquisition, one automatic retry on 401 (stale token), and a
 * request-id for idempotency so a double-click can't create two events.
 */

import { getAuthToken, removeCachedToken } from '../auth/googleAuth.js';

const BASE = 'https://www.googleapis.com/calendar/v3';

/** Name used for the dedicated calendar this extension can create. */
export const LUNAR_CALENDAR_NAME = 'Lịch Âm';

/**
 * Perform an authenticated API call, retrying once with a fresh token on 401.
 * @returns {Promise<Response>}
 */
async function apiFetch(path, options = {}) {
  let token = await getAuthToken(true);
  let res = await send(token, path, options);
  if (res.status === 401) {
    await removeCachedToken(token);
    token = await getAuthToken(true);
    res = await send(token, path, options);
  }
  return res;
}

function send(token, path, options) {
  const headers = {
    Authorization: `Bearer ${token}`,
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {}),
  };
  return fetch(`${BASE}${path}`, { ...options, headers });
}

/**
 * Calendars the user can write to.
 * @returns {Promise<Array<{id:string, summary:string, primary:boolean}>>}
 */
export async function listCalendars() {
  const res = await apiFetch('/users/me/calendarList?minAccessRole=writer&maxResults=250');
  if (!res.ok) throw new Error(await errorMessage(res));
  const data = await res.json();
  return (data.items || []).map((c) => ({
    id: c.id,
    summary: c.summary,
    primary: !!c.primary,
  }));
}

/**
 * Calendars whose name matches the lunar calendar name.
 * Pure, so the matching rule is unit-testable. Comparison ignores surrounding
 * whitespace and case, since the name may have been edited in Google Calendar.
 */
export function matchLunarCalendars(calendars, name = LUNAR_CALENDAR_NAME) {
  const norm = (s) => String(s ?? '').trim().toLocaleLowerCase();
  const target = norm(name);
  return calendars.filter((c) => norm(c.summary) === target);
}

/**
 * Select the dedicated lunar calendar, creating it only if it doesn't already
 * exist. This MUST stay idempotent: creating a second calendar with the same
 * name silently orphans every event already filed under the first one, which
 * looks to the user like their events vanished.
 *
 * @returns {Promise<{id:string, summary:string, created:boolean, duplicates:number}>}
 *          `created` is false when an existing calendar was reused;
 *          `duplicates` is how many same-named calendars exist (>1 means the
 *          account already has leftovers that need manual cleanup).
 */
export async function findOrCreateLunarCalendar(name = LUNAR_CALENDAR_NAME) {
  const existing = matchLunarCalendars(await listCalendars(), name);
  if (existing.length) {
    return {
      id: existing[0].id,
      summary: existing[0].summary,
      created: false,
      duplicates: existing.length,
    };
  }

  const res = await apiFetch('/calendars', {
    method: 'POST',
    body: JSON.stringify({ summary: name }),
  });
  if (!res.ok) throw new Error(await errorMessage(res));
  const data = await res.json();
  return { id: data.id, summary: data.summary, created: true, duplicates: 1 };
}

/**
 * Insert an event.
 * @param {Record<string, any>} googleEvent  event resource from buildDraft
 * @param {string} [calendarId]  target calendar (defaults to primary)
 * @param {string} [requestId]   stable id to make the insert idempotent
 * @returns {Promise<{id: string, htmlLink: string}>}
 */
export async function insertEvent(googleEvent, calendarId = 'primary', requestId) {
  const body = requestId ? { ...googleEvent, id: sanitizeId(requestId) } : googleEvent;
  const path = `/calendars/${encodeURIComponent(calendarId)}/events`;

  const res = await apiFetch(path, { method: 'POST', body: JSON.stringify(body) });

  if (res.status === 409 && body.id) {
    // Same request id already created this event: treat as success.
    const existing = await getEvent(calendarId, body.id);
    if (existing) return existing;
  }

  if (!res.ok) {
    throw new Error(`Google Calendar error (${res.status}): ${await errorMessage(res)}`);
  }

  const data = await res.json();
  return { id: data.id, htmlLink: data.htmlLink };
}

/** Fetch a single event, or null if it isn't there. */
export async function getEvent(calendarId, eventId) {
  const res = await apiFetch(
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`
  );
  if (!res.ok) return null;
  const data = await res.json();
  return { id: data.id, htmlLink: data.htmlLink };
}

/**
 * Delete an event. Treats 404/410 as success — if it's already gone (the user
 * removed it in Google Calendar), the caller's intent is satisfied.
 */
export async function deleteEvent(calendarId, eventId) {
  const res = await apiFetch(
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: 'DELETE' }
  );
  if (res.ok || res.status === 404 || res.status === 410) return true;
  throw new Error(`Google Calendar error (${res.status}): ${await errorMessage(res)}`);
}

/**
 * Google event ids must be base32hex (a-v, 0-9), 5-1024 chars. Coerce an
 * arbitrary request id into that alphabet deterministically.
 */
function sanitizeId(requestId) {
  const cleaned = String(requestId).toLowerCase().replace(/[^a-v0-9]/g, '0');
  return ('vc' + cleaned).slice(0, 1024).padEnd(5, '0');
}

async function errorMessage(res) {
  try {
    const data = await res.json();
    return data?.error?.message || res.statusText;
  } catch {
    return res.statusText;
  }
}
