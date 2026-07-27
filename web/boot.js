/*
 * Web entry point.
 *
 * The page has no markup of its own: it borrows the extension popup's body and
 * then hands control to the popup controller. One copy of the UI, no build
 * step, and nothing to regenerate when popup.html changes — a generated copy
 * would silently go stale, which is exactly the failure worth designing out.
 *
 * The platform difference is handled below popup.js, not here: googleAuth.js
 * and prefs.js pick their implementation from what the environment offers, so
 * popup.js itself runs unmodified on both surfaces.
 */

const POPUP_HTML = '../src/popup/popup.html';
const POPUP_JS = '../src/popup/popup.js';

function fail(message) {
  document.body.innerHTML = '';
  const main = document.createElement('main');
  main.className = 'app';
  const p = document.createElement('p');
  p.className = 'error';
  p.textContent = message;
  main.appendChild(p);
  document.body.appendChild(main);
}

try {
  const res = await fetch(POPUP_HTML);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const parsed = new DOMParser().parseFromString(await res.text(), 'text/html');

  // popup.html ends with its own <script src="popup.js">. innerHTML never
  // executes injected scripts, so it would sit there inert — drop it rather
  // than leave a dead tag pointing at a path that doesn't resolve here.
  parsed.body.querySelectorAll('script').forEach((s) => s.remove());
  document.body.innerHTML = parsed.body.innerHTML;

  // Imported only now: popup.js binds its listeners at module scope and would
  // throw on a document that doesn't have the form yet.
  await import(POPUP_JS);
} catch (err) {
  fail(`Could not start Viet Calendar: ${err.message}`);
}

// Registered after the app is up — an offline shell is a bonus, never a
// prerequisite for the page working.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {
    // Unsupported, blocked, or served over plain http. The app still runs;
    // it just won't install to the home screen.
  });
}
