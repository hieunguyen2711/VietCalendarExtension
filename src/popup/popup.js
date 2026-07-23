/*
 * Popup controller.
 *
 * Flow for every creation path: validate -> convert -> preview -> explicit
 * confirmation -> write. Nothing reaches Google Calendar before the user
 * presses "Create" on the confirmation screen.
 */

import {
  validateLunarDate,
  validateSolarDate,
  validateTitle,
  validateTime,
} from '../core/validate.js';
import { convertSolar2Lunar, getLeapMonthOfYear } from '../core/lunar.js';
import { zodiacForLunarYear } from '../core/zodiac.js';
import { NONE, lunarYearly, lunarMonthly } from '../core/recurrence.js';
import { buildDraft, localTimeZone } from '../core/draft.js';
import { HOLIDAYS, holidayName } from '../core/holidays.js';
import { EVENT_COLORS, colorName } from '../core/colors.js';
import { parseBulk, partitionRows } from '../core/bulk.js';
import { t, setLang, getLang, applyTranslations } from '../core/i18n.js';
import {
  insertEvent,
  updateEvent,
  deleteEvent,
  listCalendars,
  findOrCreateLunarCalendar,
  getAccountEmail,
} from '../calendar/calendarService.js';
import { isSignedIn, getAuthToken, signOut } from '../auth/googleAuth.js';
import { resolveLunarClamped } from '../core/occurrences.js';
import {
  getPrefs,
  setPrefs,
  getHistory,
  addHistory,
  removeHistory,
  clearHistory,
} from '../storage/prefs.js';

const $ = (id) => document.getElementById(id);

let prefs = null;
/** Drafts awaiting confirmation (one for a single event, many for bulk). */
let pending = [];
let submitting = false;
/** Set when the form was loaded from History; saving PATCHes that event. */
let editing = null;
/** Which tab the confirm screen was entered from, so Back can return there. */
let confirmOrigin = 'new';

// ---------------------------------------------------------------- views

const VIEWS = ['new', 'confirm', 'success', 'holidays', 'history', 'settings'];

function show(view) {
  for (const v of VIEWS) $(`${v}-view`).classList.toggle('hidden', v !== view);
  for (const tab of document.querySelectorAll('.tab')) {
    tab.classList.toggle('active', tab.dataset.view === view);
  }
}

// ---------------------------------------------------------------- helpers

function todayParts() {
  const now = new Date();
  return { day: now.getDate(), month: now.getMonth() + 1, year: now.getFullYear() };
}

function renderToday() {
  const { day, month, year } = todayParts();
  const [ld, lm, ly, leap] = convertSolar2Lunar(day, month, year);
  const z = zodiacForLunarYear(ly);
  const animal = getLang() === 'vi' ? z.animal.vi : z.animal.en;
  $('today-line').textContent =
    `${t('todayIs')}: ${ld}/${lm}${leap ? ' (nhuận)' : ''} ${t('lunarLabel')} · ${z.name} (${animal})`;
}

function currentMode() {
  return $('mode').value;
}

function readDateInputs() {
  return {
    day: parseInt($('in-day').value, 10),
    month: parseInt($('in-month').value, 10),
    year: parseInt($('in-year').value, 10),
    isLeapMonth: $('leap-month').checked,
  };
}

/** Resolve the current date inputs into { gregorian, lunar } for either mode. */
function resolveDate() {
  const input = readDateInputs();
  return currentMode() === 'solar' ? validateSolarDate(input) : validateLunarDate(input);
}

function recurrenceFromForm() {
  const v = $('repeat').value;
  if (v === 'yearly') return lunarYearly();
  if (v === 'monthly') return lunarMonthly();
  return NONE;
}

function reminderFromForm() {
  const v = $('reminder').value;
  return v === '' ? null : Number(v);
}

/** Currently selected colour id in a picker, or null for "calendar default". */
function selectedColor(containerId) {
  const checked = $(containerId).querySelector('input:checked');
  return checked && checked.value !== '' ? checked.value : null;
}

/**
 * Render a colour picker as radio swatches. The first option is always
 * "calendar default" (no colorId), matching Google's own behaviour.
 */
function renderColorPicker(containerId, groupName, selected, onChange) {
  const container = $(containerId);
  container.textContent = '';

  const options = [{ id: '', hex: null }, ...EVENT_COLORS];
  for (const opt of options) {
    const label = document.createElement('label');
    label.className = 'swatch';
    label.title = colorName(opt.id || null, getLang());

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = groupName;
    input.value = opt.id;
    input.checked = (selected ?? '') === opt.id;

    const dot = document.createElement('span');
    dot.className = opt.hex ? 'dot' : 'dot dot-default';
    if (opt.hex) dot.style.background = opt.hex;

    label.append(input, dot);
    container.appendChild(label);
  }

  container.addEventListener('change', () => onChange?.(selectedColor(containerId)));
}

function calendarLabel() {
  return prefs.calendarName || (prefs.calendarId === 'primary' ? 'Primary' : prefs.calendarId);
}

// ---------------------------------------------------------------- form UI

function updateModeUI() {
  const mode = currentMode();
  const bulk = mode === 'bulk';
  $('single-fields').classList.toggle('hidden', bulk);
  $('bulk-fields').classList.toggle('hidden', !bulk);
  $('date-legend').textContent = mode === 'solar' ? t('modeSolar') : t('modeLunar');
  // The leap-month question only exists in the lunar calendar.
  if (mode !== 'lunar') $('leap-row').classList.add('hidden');
  updateHint();
}

/**
 * The leap-month checkbox only appears when the month actually IS doubled that
 * year — otherwise it's a meaningless question for a normal user.
 */
function updateLeapVisibility() {
  if (currentMode() !== 'lunar') return;
  const { month, year } = readDateInputs();
  const row = $('leap-row');
  const relevant =
    Number.isInteger(month) && Number.isInteger(year) && getLeapMonthOfYear(year) === month;

  if (!relevant) {
    row.classList.add('hidden');
    $('leap-month').checked = false;
    return;
  }
  row.classList.remove('hidden');
  $('leap-label').textContent =
    getLang() === 'vi'
      ? `Ngày của tôi thuộc tháng ${month} nhuận`
      : `My date is in the leap month ${month} (nhuận tháng ${month})`;
  $('leap-explain').textContent =
    getLang() === 'vi'
      ? `Năm âm lịch ${year} có hai tháng ${month}. Chỉ chọn nếu ngày của bạn thuộc tháng nhuận (tháng thứ hai).`
      : `Lunar year ${year} has two month-${month}s. Leave unticked for the first (normal) one; tick only for the second (leap) one.`;
}

function updateHint() {
  if (currentMode() === 'bulk') return updateBulkStatus();
  updateLeapVisibility();

  const hint = $('converted-hint');
  const input = readDateInputs();
  if ([input.day, input.month, input.year].some((n) => Number.isNaN(n))) {
    hint.textContent = '';
    return;
  }
  const result = resolveDate();
  if (!result.ok) {
    hint.textContent = '⚠ ' + result.errors[0];
    return;
  }
  const { gregorian: g, lunar: l } = result.value;
  const z = zodiacForLunarYear(l.year);
  const animal = getLang() === 'vi' ? z.animal.vi : z.animal.en;
  const arrow =
    currentMode() === 'solar'
      ? `→ ${t('modeLunar')}: ${l.day}/${l.month}/${l.year}${l.isLeapMonth ? ' (nhuận)' : ''}`
      : `→ ${t('modeSolar')}: ${g.day}/${g.month}/${g.year}`;
  hint.textContent = `${arrow}\n${z.name} — ${animal}`;
}

function toggleTimeRow() {
  const allDay = $('all-day').checked;
  $('time-row').classList.toggle('hidden', allDay);
  const tzHint = $('tz-hint');
  tzHint.classList.toggle('hidden', allDay);
  if (!allDay) tzHint.textContent = `${t('tzNote')} ${localTimeZone()}`;
}

function updateBulkStatus() {
  const year = parseInt($('bulk-year').value, 10);
  const rows = parseBulk($('bulk-text').value, year);
  const { valid, invalid } = partitionRows(rows);
  const parts = [`${valid.length} ${t('bulkParsed')}`];
  for (const bad of invalid.slice(0, 3)) {
    parts.push(`⚠ ${t('errBulkLine')} ${bad.lineNumber}: ${bad.error}`);
  }
  $('bulk-status').textContent = parts.join('\n');
}

// ---------------------------------------------------------------- preview

function commonDraftOptions() {
  const allDay = $('all-day').checked;
  const opts = {
    allDay,
    recurrence: recurrenceFromForm(),
    reminderMinutes: reminderFromForm(),
    colorId: selectedColor('color-picker'),
    timeZone: localTimeZone(),
    lang: getLang(),
  };
  if (!allDay) {
    const timeRes = validateTime($('start-time').value);
    if (!timeRes.ok) return { errors: timeRes.errors };
    opts.start = timeRes.value;
  }
  return { opts };
}

function handlePreview(e) {
  e.preventDefault();
  const errorEl = $('form-error');
  errorEl.textContent = '';
  const errors = [];

  const { opts, errors: optErrors } = commonDraftOptions();
  if (optErrors) errors.push(...optErrors);

  pending = [];

  if (currentMode() === 'bulk') {
    const year = parseInt($('bulk-year').value, 10);
    const rows = parseBulk($('bulk-text').value, year);
    const { valid, invalid } = partitionRows(rows);
    for (const bad of invalid) {
      errors.push(`${t('errBulkLine')} ${bad.lineNumber}: ${bad.error}`);
    }
    if (!valid.length) errors.push(t('errNoneSelected'));
    if (errors.length) return void (errorEl.textContent = errors.join('\n'));

    for (const row of valid) {
      const dateRes = validateLunarDate(row.lunar);
      if (!dateRes.ok) {
        errors.push(`${row.title}: ${dateRes.errors[0]}`);
        continue;
      }
      pending.push(
        buildDraft({
          title: row.title,
          gregorian: dateRes.value.gregorian,
          lunar: dateRes.value.lunar,
          ...opts,
        })
      );
    }
    if (errors.length) return void (errorEl.textContent = errors.join('\n'));
  } else {
    const titleRes = validateTitle($('title').value);
    // Distinguish "empty" from "too long" — collapsing both into "required"
    // told users with a very long title that the field was blank.
    if (!titleRes.ok) {
      errors.push($('title').value.trim() ? t('errTitleLong') : t('errRequired'));
    }
    const dateRes = resolveDate();
    if (!dateRes.ok) errors.push(...dateRes.errors);
    if (errors.length) return void (errorEl.textContent = errors.join('\n'));

    pending.push(
      buildDraft({
        title: titleRes.value,
        gregorian: dateRes.value.gregorian,
        lunar: dateRes.value.lunar,
        ...opts,
      })
    );
  }

  confirmOrigin = 'new';
  renderConfirmation();
  show('confirm');
}

function renderConfirmation() {
  const many = pending.length > 1;
  const p = pending[0].preview;

  $('c-title').textContent = many ? `${pending.length} events` : p.title;
  $('c-lunar').textContent = many ? '—' : p.lunarText;
  $('c-gregorian').textContent = many ? '—' : p.gregorianText;
  $('c-zodiac').textContent = many ? '—' : p.zodiacText;
  $('c-recurrence').textContent = p.recurrenceText;
  $('c-reminder').textContent = p.reminderText;
  renderColorSummary(p);
  $('c-calendar').textContent = calendarLabel();
  $('c-timezone').textContent = p.timezone;
  $('confirm-error').textContent = '';

  fillList('c-upcoming', 'c-upcoming-wrap', !many && p.isRecurring ? p.upcoming : []);
  fillList(
    'c-batch',
    'c-batch-wrap',
    many ? pending.map((d) => `${d.preview.title} — ${d.preview.gregorianText}`) : []
  );
}

/** Colour row on the confirmation: a swatch plus its name. */
function renderColorSummary(preview) {
  const cell = $('c-color');
  cell.textContent = '';
  if (preview.colorHex) {
    const dot = document.createElement('span');
    dot.className = 'dot inline-dot';
    dot.style.background = preview.colorHex;
    cell.appendChild(dot);
  }
  cell.appendChild(document.createTextNode(preview.colorText));
}

function fillList(listId, wrapId, items) {
  const list = $(listId);
  list.textContent = '';
  for (const item of items) {
    const li = document.createElement('li');
    li.textContent = item;
    list.appendChild(li);
  }
  $(wrapId).classList.toggle('hidden', items.length === 0);
}

// ---------------------------------------------------------------- create

async function handleCreate() {
  if (submitting || !pending.length) return;
  submitting = true;
  const btn = $('create-btn');
  const errorEl = $('confirm-error');
  errorEl.textContent = '';
  btn.disabled = true;
  btn.textContent = t('creating');

  let done = 0;
  let last = null;
  try {
    // Editing replaces the original in place rather than inserting a copy.
    if (editing) {
      last = await updateEvent(editing.calendarId, editing.eventId, pending[0].googleEvent);
      await removeHistory(editing.eventId);
      await recordCreated(last, pending[0], editing.calendarId);
      done = 1;
    } else {
      for (const draft of pending) {
        const requestId = draft.requestId || (draft.requestId = makeRequestId(draft.googleEvent));
        // Drafts already written in an earlier attempt are skipped, so a retry
        // after a mid-batch failure can't double-record them in History.
        if (draft.created) { done++; last = draft.created; continue; }
        const result = await insertEvent(draft.googleEvent, prefs.calendarId, requestId);
        draft.created = result;
        last = result;
        await recordCreated(result, draft, prefs.calendarId);
        done++;
      }
    }

    const link = $('open-link');
    if (last?.htmlLink) {
      link.href = last.htmlLink;
      link.classList.remove('hidden');
    } else {
      link.classList.add('hidden');
    }
    $('success-body').textContent = editing
      ? t('eventUpdated')
      : done > 1
        ? `${done} ${t('holidaysAdded')}`
        : t('successBody');
    editing = null;
    show('success');
  } catch (err) {
    // The chosen calendar was deleted in Google Calendar since we saved it.
    // Reset the preference and ask the user to confirm again, rather than
    // silently filing the event somewhere they didn't choose.
    if (err.calendarMissing && prefs.calendarId !== 'primary') {
      await resetCalendarToPrimary();
      renderConfirmation();
      errorEl.textContent = t('calendarMissingRetry');
    } else {
      const base = err.rateLimited ? t('errRateLimited') : (err.message || 'Something went wrong.');
      // Never hide partial progress: say how many already exist, so the user
      // isn't left thinking nothing happened (and duplicating them by hand).
      errorEl.textContent = done > 0
        ? `${base}\n(${done}/${pending.length} ${t('partialSuccess')})`
        : base;
    }
  } finally {
    submitting = false;
    btn.disabled = false;
    btn.textContent = editing ? t('saveChanges') : t('create');
  }
}

/** Write one created/updated event into the local history log. */
async function recordCreated(result, draft, calendarId) {
  await addHistory({
    eventId: result.id,
    calendarId,
    title: draft.preview.title,
    htmlLink: result.htmlLink || '',
    createdAt: new Date().toISOString(),
    source: draft.source,
    gregorianText: draft.preview.gregorianText,
  });
}

/** Deterministic id from event content, so a double-click can't duplicate it. */
function makeRequestId(googleEvent) {
  // Every field the user can change must be in the seed. Leaving colour or
  // reminders out means a changed event hashes to the same id, Google 409s,
  // and the change is silently discarded.
  const seed = JSON.stringify([
    googleEvent.summary,
    googleEvent.start,
    googleEvent.end,
    googleEvent.recurrence || null,
    googleEvent.colorId || null,
    googleEvent.reminders || null,
  ]);
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  return 'e' + (h >>> 0).toString(32);
}

function resetForm() {
  pending = [];
  clearEditing();
  confirmOrigin = 'new';
  $('event-form').reset();
  $('converted-hint').textContent = '';
  $('bulk-status').textContent = '';
  applyDefaultsToForm();
  updateModeUI();
  toggleTimeRow();
  show('new');
}

// ---------------------------------------------------------------- holidays

function renderHolidays() {
  const list = $('holiday-list');
  list.textContent = '';
  const year = parseInt($('holiday-year').value, 10);
  for (const h of HOLIDAYS) {
    const li = document.createElement('li');
    const label = document.createElement('label');
    label.className = 'checkbox';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = h.id;

    const span = document.createElement('span');
    let text = `${holidayName(h, getLang())} — ${h.day}/${h.month} ${t('lunarLabel')}`;
    if (Number.isInteger(year)) {
      const res = resolveLunarClamped({ day: h.day, month: h.month, year, isLeapMonth: false });
      if (res) {
        const g = res.gregorian;
        text += ` → ${g.day}/${g.month}/${g.year}`;
        // Tất Niên is "the last day of month 12", which is day 29 about half
        // the time. Show that we adjusted rather than pretending otherwise.
        if (res.clamped) text += ` (${res.lunar.day}/${res.lunar.month} — ${t('holidayClamped')})`;
      }
    }
    span.textContent = text;

    label.append(cb, span);
    li.appendChild(label);
    list.appendChild(li);
  }
}

function handleAddHolidays() {
  const errorEl = $('holiday-error');
  errorEl.textContent = '';
  const year = parseInt($('holiday-year').value, 10);
  if (!Number.isInteger(year)) {
    errorEl.textContent = t('errYearRequired');
    return;
  }
  const chosen = [...$('holiday-list').querySelectorAll('input:checked')].map((c) => c.value);
  if (!chosen.length) {
    errorEl.textContent = t('errNoneSelected');
    return;
  }

  pending = [];
  for (const id of chosen) {
    const h = HOLIDAYS.find((x) => x.id === id);
    // Clamping resolver, not the strict validator: a holiday is a fixed
    // observance, so day 30 of a 29-day month must resolve to day 29 rather
    // than be dropped without a word.
    const res = resolveLunarClamped({ day: h.day, month: h.month, year, isLeapMonth: false });
    if (!res) continue;
    pending.push(
      buildDraft({
        title: holidayName(h, getLang()),
        gregorian: res.gregorian,
        lunar: res.lunar,
        allDay: true,
        recurrence: lunarYearly(),
        reminderMinutes: prefs.defaultReminderMinutes,
        colorId: prefs.defaultColorId,
        timeZone: localTimeZone(),
        lang: getLang(),
      })
    );
  }
  if (!pending.length) {
    errorEl.textContent = t('errNoneResolved');
    return;
  }
  confirmOrigin = 'holidays';
  renderConfirmation();
  show('confirm');
}

// ---------------------------------------------------------------- history

async function renderHistory() {
  const list = $('history-list');
  list.textContent = '';
  const history = await getHistory();
  if (!history.length) {
    const li = document.createElement('li');
    li.className = 'hint';
    li.textContent = t('historyEmpty');
    list.appendChild(li);
    return;
  }
  for (const entry of history) {
    const li = document.createElement('li');
    li.className = 'history-item';

    const info = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = entry.title;
    const meta = document.createElement('div');
    meta.className = 'hint';
    meta.textContent = entry.gregorianText || '';
    info.append(title, meta);

    const actions = document.createElement('div');
    actions.className = 'history-actions';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'secondary small';
    editBtn.textContent = t('edit');
    editBtn.addEventListener('click', () => loadIntoForm(entry));

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'secondary small danger';
    delBtn.textContent = t('delete');
    delBtn.addEventListener('click', () => handleDelete(entry, delBtn));

    actions.append(editBtn, delBtn);
    li.append(info, actions);
    list.appendChild(li);
  }
}

async function handleDelete(entry, btn) {
  const errorEl = $('history-error');
  errorEl.textContent = '';
  btn.disabled = true;
  btn.textContent = t('deleting');
  try {
    await deleteEvent(entry.calendarId, entry.eventId);
    await removeHistory(entry.eventId);
    await renderHistory();
  } catch (err) {
    errorEl.textContent = err.message;
    btn.disabled = false;
    btn.textContent = t('delete');
  }
}

/** Load a previously created event's source back into the form for editing. */
function loadIntoForm(entry) {
  const src = entry.source;
  if (!src?.lunar) return;
  // Remember which event this is, so saving PATCHes it instead of inserting a
  // near-duplicate alongside the original.
  editing = { eventId: entry.eventId, calendarId: entry.calendarId };
  $('edit-banner').classList.remove('hidden');
  $('preview-btn').textContent = t('saveChanges');
  $('mode').value = 'lunar';
  $('title').value = entry.title;
  $('in-day').value = src.lunar.day;
  $('in-month').value = src.lunar.month;
  $('in-year').value = src.lunar.year;
  $('leap-month').checked = !!src.lunar.isLeapMonth;
  $('all-day').checked = !!src.allDay;
  if (src.start) {
    $('start-time').value =
      `${String(src.start.hour).padStart(2, '0')}:${String(src.start.minute).padStart(2, '0')}`;
  }
  $('repeat').value =
    src.recurrence?.freq === 'lunarYearly' ? 'yearly'
    : src.recurrence?.freq === 'lunarMonthly' ? 'monthly'
    : 'none';
  $('reminder').value = src.reminderMinutes == null ? '' : String(src.reminderMinutes);
  renderColorPicker('color-picker', 'event-color', src.colorId ?? prefs.defaultColorId);
  updateModeUI();
  toggleTimeRow();
  show('new');
}

// ---------------------------------------------------------------- settings

async function loadCalendars() {
  const select = $('calendar-select');
  const errorEl = $('settings-error');
  select.textContent = '';
  const loading = document.createElement('option');
  loading.textContent = t('calendarLoading');
  select.appendChild(loading);

  try {
    const calendars = await listCalendars();
    select.textContent = '';
    for (const c of calendars) {
      const opt = document.createElement('option');
      // Store the primary calendar under Google's stable "primary" alias
      // rather than its raw id (which is the account's email address).
      opt.value = c.primary ? 'primary' : c.id;
      opt.textContent = c.primary ? `${c.summary} (primary)` : c.summary;
      select.appendChild(opt);
    }

    // The saved calendar may have been deleted in Google Calendar behind our
    // back. Detect that here and fall back, instead of writing events into a
    // calendar that no longer exists.
    const available = new Set([...select.options].map((o) => o.value));
    if (!available.has(prefs.calendarId)) {
      await resetCalendarToPrimary();
      errorEl.textContent = t('calendarMissing');
    }
    select.value = prefs.calendarId;
  } catch (err) {
    select.textContent = '';
    const opt = document.createElement('option');
    opt.value = 'primary';
    opt.textContent = 'Primary';
    select.appendChild(opt);
    errorEl.textContent = err.message;
  }
}

/**
 * Reflect sign-in state in the UI. When signed out we show a sign-in button
 * up front rather than waiting for the first API call — Chrome tears the popup
 * down when the consent window takes focus, so prompting at submit time throws
 * away whatever the user had typed.
 */
async function refreshAuthState() {
  const signedIn = await isSignedIn();
  $('auth-banner').classList.toggle('hidden', signedIn);
  if (signedIn) {
    const email = await getAccountEmail();
    $('account-email').textContent = email || '—';
  } else {
    $('account-email').textContent = '—';
  }
  return signedIn;
}

async function handleSignIn() {
  const btn = $('sign-in-btn');
  btn.disabled = true;
  try {
    await getAuthToken(true);
    await refreshAuthState();
  } catch {
    // User dismissed the consent window; the banner simply stays visible.
  } finally {
    btn.disabled = false;
  }
}

async function handleSignOut() {
  await signOut();
  await resetCalendarToPrimary();
  await refreshAuthState();
  $('settings-status').textContent = t('signedOut');
}

/** Leave edit mode and return the form to normal "create" behaviour. */
function clearEditing() {
  editing = null;
  $('edit-banner').classList.add('hidden');
  $('preview-btn').textContent = t('preview');
}

/** Point the extension back at the primary calendar and persist that. */
async function resetCalendarToPrimary() {
  prefs = { ...prefs, calendarId: 'primary', calendarName: '' };
  await setPrefs({ calendarId: 'primary', calendarName: '' });
}

async function handleCreateCalendar() {
  const btn = $('create-cal-btn');
  if (btn.disabled) return; // in-flight; a second click must not create another
  const errorEl = $('settings-error');
  const statusEl = $('settings-status');
  errorEl.textContent = '';
  statusEl.textContent = '';
  btn.disabled = true;
  try {
    const cal = await findOrCreateLunarCalendar();
    prefs = { ...prefs, calendarId: cal.id, calendarName: cal.summary };
    await setPrefs({ calendarId: cal.id, calendarName: cal.summary });
    await loadCalendars();
    $('calendar-select').value = cal.id;
    statusEl.textContent = cal.created ? t('calendarCreated') : t('calendarExisting');
    const notes = [];
    // If we couldn't switch the calendar on, events would be invisible in the
    // Google Calendar grid — tell the user how to fix it themselves.
    if (!cal.visible) notes.push(t('calendarNotVisible'));
    if (cal.duplicates > 1) notes.push(`${t('calendarDuplicates')} (${cal.duplicates})`);
    errorEl.textContent = notes.join('\n');
  } catch (err) {
    errorEl.textContent = err.message;
  } finally {
    btn.disabled = false;
  }
}

async function applyLanguage(lang) {
  setLang(lang);
  // applyTranslations rewrites every [data-i18n] element, wiping any dynamic
  // text written over one. Everything so affected is re-rendered below.
  applyTranslations(document);
  $('lang-select').value = lang;
  $('lang-quick').value = lang;
  renderToday();
  updateModeUI();
  toggleTimeRow();
  renderHolidays();
  await renderHistory();
  if (editing) $('preview-btn').textContent = t('saveChanges');

  // The confirmation is built from buildDraft({lang}), so its values (not just
  // its labels) have to be regenerated or the screen ends up half-translated.
  if (pending.length && !$('confirm-view').classList.contains('hidden')) {
    pending = pending.map((d) => buildDraft({ ...d.source, title: d.preview.title, lang }));
    renderConfirmation();
  }
}

function applyDefaultsToForm() {
  const { day, month, year } = todayParts();
  const [, , lunarYear] = convertSolar2Lunar(day, month, year);
  $('in-year').value = lunarYear;
  $('bulk-year').value = lunarYear;
  $('holiday-year').value = lunarYear;
  $('all-day').checked = prefs.allDayDefault;
  $('reminder').value =
    prefs.defaultReminderMinutes == null ? '' : String(prefs.defaultReminderMinutes);
  renderColorPicker('color-picker', 'event-color', prefs.defaultColorId);
}

// ---------------------------------------------------------------- wiring

$('tabs').addEventListener('click', (e) => {
  const tab = e.target.closest('.tab');
  if (!tab) return;
  // Navigating away mid-write would strand the batch and desync the counters.
  if (submitting) return;
  const view = tab.dataset.view;
  if (view === 'history') renderHistory();
  if (view === 'holidays') renderHolidays();
  if (view === 'settings') loadCalendars();
  show(view);
});

$('event-form').addEventListener('submit', handlePreview);
$('sign-in-btn').addEventListener('click', handleSignIn);
$('sign-out-btn').addEventListener('click', handleSignOut);
$('cancel-edit-btn').addEventListener('click', () => {
  clearEditing();
  resetForm();
});
// Return to whichever tab the confirmation was reached from, so a holiday
// selection isn't silently thrown away.
$('back-btn').addEventListener('click', () => {
  if (confirmOrigin === 'holidays') show('holidays');
  else show('new');
});
$('create-btn').addEventListener('click', handleCreate);
$('another-btn').addEventListener('click', resetForm);
$('all-day').addEventListener('change', toggleTimeRow);
$('mode').addEventListener('change', updateModeUI);
for (const id of ['in-day', 'in-month', 'in-year', 'leap-month']) {
  $(id).addEventListener('input', updateHint);
}
$('bulk-text').addEventListener('input', updateBulkStatus);
$('bulk-year').addEventListener('input', updateBulkStatus);

$('holiday-year').addEventListener('input', renderHolidays);
$('select-all-btn').addEventListener('click', () => {
  const boxes = [...$('holiday-list').querySelectorAll('input[type=checkbox]')];
  const allOn = boxes.every((b) => b.checked);
  boxes.forEach((b) => (b.checked = !allOn));
});
$('add-holidays-btn').addEventListener('click', handleAddHolidays);

$('clear-history-btn').addEventListener('click', async () => {
  // Destructive and un-undoable, so confirm first.
  if (!confirm(t('confirmClearHistory'))) return;
  await clearHistory();
  await renderHistory();
});

$('create-cal-btn').addEventListener('click', handleCreateCalendar);
$('calendar-select').addEventListener('change', async (e) => {
  const id = e.target.value;
  const name = e.target.selectedOptions[0]?.textContent || '';
  prefs = { ...prefs, calendarId: id, calendarName: name };
  await setPrefs({ calendarId: id, calendarName: name });
  $('settings-status').textContent = t('settingsSaved');
});
$('default-reminder').addEventListener('change', async (e) => {
  const v = e.target.value === '' ? null : Number(e.target.value);
  prefs = { ...prefs, defaultReminderMinutes: v };
  await setPrefs({ defaultReminderMinutes: v });
  // Deliberately does NOT touch the New form: this sets the default for FUTURE
  // events, and overwriting a half-composed event would discard the user's
  // explicit choice. The default applies on the next reset.
  $('settings-status').textContent = t('settingsSaved');
});

for (const id of ['lang-select', 'lang-quick']) {
  $(id).addEventListener('change', async (e) => {
    prefs = { ...prefs, lang: e.target.value };
    await setPrefs({ lang: e.target.value });
    await applyLanguage(e.target.value);
  });
}

// ---------------------------------------------------------------- init

(async function init() {
  prefs = await getPrefs();
  setLang(prefs.lang);
  applyTranslations(document);
  $('lang-select').value = prefs.lang;
  $('lang-quick').value = prefs.lang;
  $('default-reminder').value =
    prefs.defaultReminderMinutes == null ? '' : String(prefs.defaultReminderMinutes);
  applyDefaultsToForm();
  renderColorPicker('default-color-picker', 'default-color', prefs.defaultColorId, async (id) => {
    prefs = { ...prefs, defaultColorId: id };
    await setPrefs({ defaultColorId: id });
    // As with the reminder default: applies to future events, not the one
    // currently being composed.
    $('settings-status').textContent = t('settingsSaved');
  });
  await refreshAuthState();
  renderToday();
  updateModeUI();
  toggleTimeRow();
  renderHolidays();
  show('new');
})();
