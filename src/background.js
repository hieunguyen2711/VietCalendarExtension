/*
 * Service worker. Its only job is to own the interactive sign-in.
 *
 * chrome.identity.getAuthToken({interactive: true}) opens a consent window that
 * steals focus, and Chrome destroys the action popup the moment that happens.
 * Run from the popup, the callback dies with the page: a success is recovered
 * later from Chrome's token cache, but a FAILURE vanishes without a trace,
 * which is why a blocked account used to look like a dead button.
 *
 * The worker outlives the popup, so its callback actually runs. It writes the
 * outcome to session storage; whichever popup opens next reports it.
 */

import { getAuthToken, markSignInPending, recordSignInResult } from './auth/googleAuth.js';

async function runInteractiveSignIn() {
  await markSignInPending();
  try {
    await getAuthToken(true);
    await recordSignInResult(null);
    return { ok: true };
  } catch (err) {
    const message = err?.message || 'Sign-in failed.';
    await recordSignInResult(message);
    return { ok: false, error: message };
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== 'signIn') return undefined;
  // The popup usually dies before this resolves, so sendResponse is a bonus
  // path for when it survives — the durable channel is session storage.
  runInteractiveSignIn().then(sendResponse);
  return true; // keep the message channel open for the async reply
});
