# Viet Calendar → Google Calendar

A Chrome extension (Manifest V3) that creates Google Calendar events from
**Vietnamese lunar (âm lịch) dates**, with an optional **annual recurrence**.
Enter a lunar date and a title, preview the converted Gregorian date, confirm,
and the event is added to your primary Google Calendar.

## How it works

```
Lunar date  ──▶  validate  ──▶  convert to Gregorian  ──▶  preview  ──▶  confirm  ──▶  Google Calendar
(âm lịch)         (validate.js)   (lunar.js, UTC+7)         (draft.js)    (popup.js)    (calendarService.js)
```

- **Conversion** uses Hồ Ngọc Đức's astronomical algorithm (new-moon + solar
  longitude), fixed to Vietnam time (UTC+7). Pure and unit-tested.
- **Annual recurrence is lunar-based.** A giỗ or lunar birthday recurs on the
  same *lunar* date each year, which drifts across the Gregorian calendar (Tết
  is Feb 17 in 2026 but Feb 6 in 2027). So instead of `RRULE:FREQ=YEARLY`
  (which would wrongly fix the Gregorian date), the extension computes the
  Gregorian date of that lunar date for each of the next 25 lunar years and
  emits them as an `RDATE` list — a single recurring event on the correct
  drifting dates.
- **No write happens until you click "Create event"** on the confirmation
  screen. The preview lists the upcoming Gregorian dates so you can see the
  drift. A per-event idempotency key prevents duplicate submissions.

## Project layout

| Path | Purpose |
|------|---------|
| `manifest.json` | MV3 manifest (popup, `identity` permission, OAuth config) |
| `src/core/lunar.js` | Pure lunar ⇄ solar conversion (formerly `conversion.js`) |
| `src/core/recurrence.js` | Recurrence model (none / lunar-yearly) |
| `src/core/occurrences.js` | Expands a lunar date into per-year Gregorian dates |
| `src/core/validate.js` | Input validation (impossible/ambiguous dates) |
| `src/core/draft.js` | Builds the preview + the exact Google event payload |
| `src/auth/googleAuth.js` | Auth facade — picks the platform's identity provider |
| `src/auth/chromeIdentity.js` | OAuth via `chrome.identity.getAuthToken` (extension) |
| `src/auth/webIdentity.js` | OAuth via Google Identity Services (hosted web build) |
| `src/auth/scopes.js` | The scope list, mirrored in `manifest.json` |
| `src/background.js` | Service worker; owns interactive sign-in (extension only) |
| `src/calendar/calendarService.js` | `events.insert` with 401 retry + idempotency |
| `src/popup/` | The UI (form → preview → success), shared by both surfaces |
| `web/` | Hosted mobile build — borrows the popup's markup and controller |
| `test/` | Node's built-in test runner (`npm test`) |

`src/core/` is pure: no `chrome.*`, no DOM. The platform difference lives
entirely in `src/auth/googleAuth.js` and `src/storage/prefs.js`, which is what
lets the same popup UI run as an extension and as a web page.

## Running the tests

```bash
npm test        # runs node --test over test/
```

No dependencies to install — the conversion, recurrence, validation, and draft
layers are pure and tested without Chrome or the network.

## One-time Google Cloud setup (required before loading)

The extension needs an OAuth **client ID** so Chrome can sign the user in.
You must do this once — it can't be scripted.

1. **Load the extension unpacked first** so it gets a stable ID:
   - Go to `chrome://extensions`, enable **Developer mode**.
   - Click **Load unpacked** and select this project folder.
   - Copy the extension's **ID** (a long string under its name).

   > The `"key"` field in `manifest.json` pins this ID. Without it, an unpacked
   > build takes an ID hashed from its folder path, which won't match the Web
   > Store build — and the OAuth client can only be registered against one ID,
   > so the other fails with `bad client id`. Keep `key` in place.
2. In the [Google Cloud Console](https://console.cloud.google.com/):
   - Create (or pick) a project.
   - **APIs & Services → Library →** enable **Google Calendar API**.
   - **APIs & Services → OAuth consent screen →** configure it (External is
     fine for personal use), and add your Google account under **Test users**.
   - **APIs & Services → Credentials → Create credentials → OAuth client ID →**
     application type **Chrome Extension**, and paste the **extension ID** from
     step 1. (For older console UIs, choose **Chrome App** and enter the ID.)
   - Copy the generated client ID (`...apps.googleusercontent.com`).
3. In `manifest.json`, replace the placeholder:
   ```json
   "oauth2": {
     "client_id": "REPLACE_WITH_YOUR_CLIENT_ID.apps.googleusercontent.com",
     "scopes": ["https://www.googleapis.com/auth/calendar.events"]
   }
   ```
4. Back on `chrome://extensions`, click **Reload** on the extension.

## Mobile web version

Chrome extensions don't exist on Chrome for Android or iOS, so anyone without a
desktop browser can't use the extension at all. `web/` is the same app served
as a web page for them.

It isn't a fork. `web/index.html` fetches `src/popup/popup.html`, injects its
body, and imports `src/popup/popup.js` — one copy of the markup, the CSS, the
controller, and all of `src/core/`. `web/web.css` only relaxes the popup's
fixed 360px geometry for a phone, and the platform split is handled underneath
by `googleAuth.js` (Google Identity Services instead of `chrome.identity`) and
`prefs.js` (`localStorage` instead of `chrome.storage`). There is no build step
and nothing generated, so the web build can't drift from the extension.

### Setup

1. **A second OAuth client.** The one in `manifest.json` is type *Chrome
   Extension* and is bound to the extension ID; it cannot authorize a web
   origin. In the same Cloud project create another client of type **Web
   application**, and list the site under **Authorized JavaScript origins**
   (e.g. `https://<user>.github.io`, plus `http://localhost:8000` for local
   testing). Leave redirect URIs empty — the GIS token client uses
   `postMessage`.
2. **Put its ID in the page.** In `web/index.html`, replace
   `REPLACE_WITH_WEB_CLIENT_ID` in the `google-oauth-client-id` meta tag.
   Browser OAuth clients have no secret, so this is public by design.
3. **Publish the OAuth consent screen.** In Testing status only listed test
   users can sign in and grants lapse every 7 days — unworkable for people on
   phones. *Google Auth Platform → Audience → Publish app*. Until verified,
   users see the "Google hasn't verified this app" screen and there's a
   100-user cap.
4. **Serve it.** On GitHub Pages: *Settings → Pages → Deploy from branch*,
   branch `main`, folder **`/ (root)`**. The root must be served, not `/docs`,
   because `web/` reaches `../src/` directly. `.nojekyll` keeps Pages from
   filtering paths, and the root `index.html` redirects to `web/`.

Locally: `python3 -m http.server 8000` from the project root, then open
`http://localhost:8000/web/`.

### Known limits

- **Tokens last about an hour.** Browser-only OAuth issues no refresh token
  (that needs a server holding a client secret). When it expires the user signs
  in again. On iOS, Safari's tracking prevention can also block silent renewal.
- **Preferences and history are per-device.** `localStorage` is per-origin, so
  unlike the extension's `chrome.storage.sync` they don't follow the user
  between devices.
- **The access token is never persisted** — memory only. On GitHub Pages every
  project shares one origin, so anything in `localStorage` is readable by other
  pages there.

## Using it

1. Click the extension icon.
2. Enter a title and a lunar date (day / month / year). Tick **leap month** if
   the date falls in a nhuận month. The popup previews the Gregorian date live.
3. Choose **all-day** or a start time, and optionally **repeat every year**.
4. Click **Preview →**, check the summary, then **Create event**.
5. The first time, Google will ask you to sign in and grant calendar access.

## Scope & limitations (v1)

- Creation only (no editing existing events).
- Writes to your **primary** calendar.
- Recurrence: none, or lunar-annual over a 25-year horizon (`RDATE`). Monthly/
  custom patterns are intentionally easy to add — extend
  `src/core/recurrence.js` + `src/core/occurrences.js`.
- Conversion is reliable roughly 1900–2199 (the range the validator enforces).
- Leap-month anniversaries: years without that leap month fall back to the
  ordinary month; days that don't exist in a short month clamp to the last day.

## Notes on the fix to `conversion.js`

The original `conversion.js` referenced several undefined identifiers
(`INT`, `PI`, `jdFromDate`, `getNewMoonDay`, a stray `k`) and a `const`
reassignment, so it could not run. The corrected, completed implementation now
lives in `src/core/lunar.js`; `conversion.js` re-exports from it for
compatibility.
