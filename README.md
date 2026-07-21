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
| `src/auth/googleAuth.js` | OAuth via `chrome.identity.getAuthToken` |
| `src/calendar/calendarService.js` | `events.insert` with 401 retry + idempotency |
| `src/popup/` | Popup UI (form → preview → success) |
| `test/` | Node's built-in test runner (`npm test`) |

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
