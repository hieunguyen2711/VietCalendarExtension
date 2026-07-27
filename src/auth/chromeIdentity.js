/*
 * Google OAuth via Chrome's identity API — the extension's implementation.
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
 *
 * Selected at runtime by ./googleAuth.js. Keep the module body side-effect
 * free — it must be importable off-platform so the contract test can compare
 * its exports against the web implementation.
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

/**
 * Start an interactive sign-in.
 *
 * Delegated to the service worker rather than run here: the consent window
 * destroys the popup, and a caller that no longer exists can't learn why
 * sign-in failed. The worker records the outcome for the next popup to report,
 * so the response below is a bonus for when the popup happens to survive.
 *
 * @returns {Promise<{ok: boolean, error?: string}|undefined>}
 */
export function signIn() {
  return chrome.runtime.sendMessage({ type: 'signIn' });
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
