/*
 * Google OAuth via Chrome's identity API.
 *
 * Uses chrome.identity.getAuthToken, which relies on the "oauth2" block in
 * manifest.json (client_id + scopes). Chrome handles the consent screen, token
 * caching, and refresh; we just ask for a token and, on 401, drop the cached
 * one and retry.
 *
 * Requires manifest.json:
 *   "oauth2": {
 *     "client_id": "<your-id>.apps.googleusercontent.com",
 *     "scopes": ["https://www.googleapis.com/auth/calendar.events"]
 *   }
 */

/**
 * Get an OAuth access token.
 * @param {boolean} interactive show the account/consent UI if needed
 * @returns {Promise<string>}
 */
export function getAuthToken(interactive = true) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError || !token) {
        reject(new Error(chrome.runtime.lastError?.message || 'Sign-in was cancelled.'));
        return;
      }
      resolve(token);
    });
  });
}

/**
 * Whether we already hold a token without prompting.
 *
 * Used to sign in BEFORE the user fills anything in. Chrome destroys the action
 * popup whenever it loses focus — including when the OAuth consent window
 * opens — so triggering sign-in at submit time discards everything the user
 * typed. Checking up front means the teardown happens on an empty form.
 */
export async function isSignedIn() {
  try {
    await getAuthToken(false);
    return true;
  } catch {
    return false;
  }
}

/*
 * Sign-in outcome, recorded in session storage.
 *
 * Chrome opens the consent screen in its own window, which takes focus and
 * destroys the action popup. So the popup can't own this flow: the
 * getAuthToken callback would die with it and Google's actual complaint would
 * be lost. The service worker runs it instead and parks the result here, where
 * the next popup can read it. PENDING covers the gap between "worker started"
 * and "worker finished" — a popup opened in that window knows an attempt is
 * still in flight rather than reporting a stale success.
 */
const PENDING_KEY = 'signInPending';
const ERROR_KEY = 'lastAuthError';

export function markSignInPending() {
  return chrome.storage.session.set({ [PENDING_KEY]: true, [ERROR_KEY]: null });
}

export function recordSignInResult(errorMessage = null) {
  return chrome.storage.session.set({ [PENDING_KEY]: false, [ERROR_KEY]: errorMessage });
}

export function clearSignInResult() {
  return chrome.storage.session.remove([PENDING_KEY, ERROR_KEY]);
}

/** @returns {Promise<{pending: boolean, error: string|null}>} */
export async function readSignInResult() {
  const got = await chrome.storage.session.get([PENDING_KEY, ERROR_KEY]);
  return { pending: Boolean(got[PENDING_KEY]), error: got[ERROR_KEY] || null };
}

/**
 * Map a chrome.identity failure onto an i18n key with advice the user can act
 * on. Chrome's own messages ("The user did not approve access.") don't
 * distinguish "I clicked away" from "Google refused my account", which is the
 * distinction that actually matters here.
 */
export function authErrorKey(message = '') {
  const m = message.toLowerCase();
  if (m.includes('not signed in')) return 'authErrorNoChromeAccount';
  // Google phrases this as "bad client id", Chrome sometimes as "invalid
  // client". Both mean the running extension's ID doesn't match the ID the
  // OAuth client was registered against — a packaging problem, not the
  // account's fault, so it must not be reported as a blocked account.
  if (m.includes('client id') || m.includes('client_id') || m.includes('invalid client')) {
    return 'authErrorClientId';
  }
  return 'authErrorBlocked';
}

/** Remove a cached (e.g. expired/revoked) token so the next call re-fetches. */
export function removeCachedToken(token) {
  return new Promise((resolve) => {
    if (!token) return resolve();
    chrome.identity.removeCachedAuthToken({ token }, () => resolve());
  });
}

/** Sign the user out by revoking and clearing the cached token. */
export async function signOut() {
  try {
    const token = await getAuthToken(false);
    await fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, { method: 'POST' });
    await removeCachedToken(token);
  } catch {
    // No token cached — already signed out.
  }
}
