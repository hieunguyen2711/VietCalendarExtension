/*
 * Google Calendar API service layer.
 *
 * Thin wrapper around the events.insert endpoint. Handles token acquisition,
 * one automatic retry on 401 (stale token), and a request-id for idempotency
 * so a double-click can't create two events.
 */

import { getAuthToken, removeCachedToken } from '../auth/googleAuth.js';

const EVENTS_URL =
  'https://www.googleapis.com/calendar/v3/calendars/primary/events';

/**
 * Insert an event into the user's primary calendar.
 * @param {Record<string, any>} googleEvent  event resource from buildDraft
 * @param {string} [requestId]  stable id to make the insert idempotent
 * @returns {Promise<{id: string, htmlLink: string}>}
 */
export async function insertEvent(googleEvent, requestId) {
  const body = requestId ? { ...googleEvent, id: sanitizeId(requestId) } : googleEvent;

  let token = await getAuthToken(true);
  let res = await postEvent(token, body);

  if (res.status === 401) {
    // Token likely expired — clear it and try once more interactively.
    await removeCachedToken(token);
    token = await getAuthToken(true);
    res = await postEvent(token, body);
  }

  if (res.status === 409) {
    // Same request id already created the event: treat as success.
    const existing = await fetchEvent(token, body.id);
    if (existing) return existing;
  }

  if (!res.ok) {
    const detail = await safeErrorMessage(res);
    throw new Error(`Google Calendar error (${res.status}): ${detail}`);
  }

  const data = await res.json();
  return { id: data.id, htmlLink: data.htmlLink };
}

function postEvent(token, body) {
  return fetch(EVENTS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

async function fetchEvent(token, id) {
  const res = await fetch(`${EVENTS_URL}/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return { id: data.id, htmlLink: data.htmlLink };
}

/**
 * Google event ids must be base32hex (a-v, 0-9), 5-1024 chars. Coerce an
 * arbitrary request id into that alphabet deterministically.
 */
function sanitizeId(requestId) {
  const cleaned = String(requestId).toLowerCase().replace(/[^a-v0-9]/g, '0');
  return ('vc' + cleaned).slice(0, 1024).padEnd(5, '0');
}

async function safeErrorMessage(res) {
  try {
    const data = await res.json();
    return data?.error?.message || res.statusText;
  } catch {
    return res.statusText;
  }
}
