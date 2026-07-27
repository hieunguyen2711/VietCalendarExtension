/*
 * Google OAuth for the hosted web build, via Google Identity Services.
 *
 * There is no backend and no client secret, so this is the GIS token client:
 * a popup returns an access token straight to the page. Consequences worth
 * knowing, because they shape everything below:
 *
 *   - No refresh token. Tokens last about an hour and then simply stop
 *     working; the user signs in again. A refresh token would require a
 *     server holding a client secret, which this project deliberately doesn't
 *     have.
 *   - The token lives in memory only. Never persist it — localStorage is
 *     readable by any script on the origin, and GitHub Pages shares one origin
 *     across every project a user hosts.
 *   - requestAccessToken opens a popup, so it must run inside a user gesture
 *     or the browser blocks it. That's why getAuthToken(false) never reaches
 *     for the network: it answers from memory, and only signIn() — wired to a
 *     button — is allowed to prompt.
 *
 * Selected at runtime by ./googleAuth.js. Keep the module body side-effect
 * free so the contract test can import it under Node.
 */

import { SCOPES } from './scopes.js';

/** Seconds of headroom, so a token can't expire mid-request. */
const EXPIRY_SKEW_MS = 60_000;

let accessToken = null;
let expiresAt = 0;
let tokenClient = null;

/** The client ID comes from the page, so deployments don't need a code edit. */
function clientId() {
  const meta = document.querySelector('meta[name="google-oauth-client-id"]');
  const id = meta?.content?.trim();
  if (!id || id.startsWith('REPLACE_')) {
    throw new Error(
      'No OAuth client id: set <meta name="google-oauth-client-id"> in the page to a Web application client.',
    );
  }
  return id;
}

/** The GIS script is loaded by a <script> tag, so it may not be parsed yet. */
async function whenGisReady(timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (!globalThis.google?.accounts?.oauth2) {
    if (Date.now() > deadline) {
      throw new Error('Google sign-in library failed to load. Check your connection and retry.');
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  return globalThis.google.accounts.oauth2;
}

async function getClient() {
  if (tokenClient) return tokenClient;
  const oauth2 = await whenGisReady();
  // The callback is replaced per request; GIS requires one at init time.
  tokenClient = oauth2.initTokenClient({
    client_id: clientId(),
    scope: SCOPES.join(' '),
    callback: () => {},
  });
  return tokenClient;
}

function tokenIsFresh() {
  return Boolean(accessToken) && Date.now() < expiresAt - EXPIRY_SKEW_MS;
}

/**
 * Get an OAuth access token.
 * @param {boolean} interactive allowed to open the Google popup
 * @returns {Promise<string>}
 */
export async function getAuthToken(interactive = true) {
  if (tokenIsFresh()) return accessToken;
  if (!interactive) throw new Error('Not signed in.');
  const res = await signIn();
  if (!res.ok) throw new Error(res.error);
  return accessToken;
}

/** Whether we already hold a usable token without prompting. */
export async function isSignedIn() {
  return tokenIsFresh();
}

/**
 * Start an interactive sign-in. Must be called from a user gesture.
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function signIn() {
  let client;
  try {
    client = await getClient();
  } catch (err) {
    return { ok: false, error: err.message };
  }
  return new Promise((resolve) => {
    client.callback = (res) => {
      if (res.error) {
        resolve({ ok: false, error: res.error_description || res.error });
        return;
      }
      accessToken = res.access_token;
      expiresAt = Date.now() + Number(res.expires_in || 3600) * 1000;
      resolve({ ok: true });
    };
    // Fires when the user closes the popup or it never opened.
    client.error_callback = (err) => {
      resolve({ ok: false, error: err?.message || 'Sign-in was cancelled.' });
    };
    // 'consent' only on the first grant; '' reuses an existing one silently
    // where the browser allows it.
    client.requestAccessToken({ prompt: accessToken ? '' : 'consent' });
  });
}

/** Drop a token the API just rejected, so the next call fetches a fresh one. */
export async function removeCachedToken(token) {
  if (!token || token === accessToken) {
    accessToken = null;
    expiresAt = 0;
  }
}

/** Revoke the grant and forget the token. */
export async function signOut() {
  const token = accessToken;
  accessToken = null;
  expiresAt = 0;
  if (!token) return;
  try {
    const oauth2 = await whenGisReady(2000);
    await new Promise((resolve) => oauth2.revoke(token, resolve));
  } catch {
    // Library gone or already revoked — the token is forgotten either way.
  }
}

/*
 * The extension records sign-in outcomes in session storage because its popup
 * is destroyed mid-flow. A web page isn't, so signIn() returns its own errors
 * and there is nothing to hand across a teardown. These exist to keep the two
 * platform modules interchangeable.
 */
export async function markSignInPending() {}

export async function recordSignInResult() {}

export async function clearSignInResult() {}

/** @returns {Promise<{pending: boolean, error: string|null}>} */
export async function readSignInResult() {
  return { pending: false, error: null };
}
