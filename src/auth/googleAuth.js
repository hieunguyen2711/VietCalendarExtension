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
