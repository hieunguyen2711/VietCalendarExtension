/*
 * Auth facade — picks the right identity provider for wherever we're running.
 *
 * The extension gets tokens from chrome.identity; the hosted web build gets
 * them from Google Identity Services. Both implementations expose the same
 * names, so everything upstream (calendarService.js, popup.js, background.js)
 * imports from here and never learns which platform it's on.
 *
 * Both are imported STATICALLY and one is chosen, rather than dynamically
 * importing the winner: service workers reject dynamic import() and top-level
 * await, and background.js depends on this module. Neither implementation
 * touches its platform at module scope, so importing the loser is free.
 */

import * as chromeIdentity from './chromeIdentity.js';
import * as webIdentity from './webIdentity.js';

const impl =
  typeof chrome !== 'undefined' && chrome.identity && chrome.runtime?.id
    ? chromeIdentity
    : webIdentity;

/** Which implementation is live. Exposed for diagnostics and tests. */
export const platform = impl === chromeIdentity ? 'extension' : 'web';

export const getAuthToken = (interactive) => impl.getAuthToken(interactive);
export const isSignedIn = () => impl.isSignedIn();
export const signIn = () => impl.signIn();
export const signOut = () => impl.signOut();
export const removeCachedToken = (token) => impl.removeCachedToken(token);

export const markSignInPending = () => impl.markSignInPending();
export const recordSignInResult = (errorMessage) => impl.recordSignInResult(errorMessage);
export const clearSignInResult = () => impl.clearSignInResult();
export const readSignInResult = () => impl.readSignInResult();

/**
 * Map a sign-in failure onto an i18n key with advice the user can act on.
 * Shared by both platforms: the raw messages differ, but the three outcomes a
 * user can do something about are the same. Chrome's own wording ("The user
 * did not approve access.") doesn't distinguish "I clicked away" from "Google
 * refused my account", which is the distinction that actually matters.
 */
export function authErrorKey(message = '') {
  const m = message.toLowerCase();
  if (m.includes('not signed in')) return 'authErrorNoChromeAccount';
  // Google phrases this as "bad client id", Chrome sometimes as "invalid
  // client". Both mean the caller's identity doesn't match the ID the OAuth
  // client was registered against — the extension ID for the extension, the
  // page's origin for the web build. Either way it's a configuration problem,
  // not the account's fault, so it must not be reported as a blocked account.
  if (m.includes('client id') || m.includes('client_id') || m.includes('invalid client')) {
    return 'authErrorClientId';
  }
  return 'authErrorBlocked';
}
