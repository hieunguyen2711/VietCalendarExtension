/*
 * The OAuth scopes this app requests.
 *
 * The extension does NOT read this file — Chrome takes its scopes from the
 * "oauth2" block in manifest.json, which JSON can't import from. So the list
 * lives here for the web build and is mirrored in the manifest, with
 * test/platform-contract.test.js asserting the two never drift apart.
 *
 * Adding a scope means re-verification with Google, so treat this list as
 * something to shrink rather than grow.
 */
export const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.calendarlist',
  'https://www.googleapis.com/auth/calendar.app.created',
];
