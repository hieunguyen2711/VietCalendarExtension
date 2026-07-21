/*
 * Popup controller. Wires the form to validation -> conversion -> preview ->
 * confirmed submission. No calendar write happens until the user clicks
 * "Create event" on the confirmation screen.
 */

import { validateLunarDate, validateTitle, validateTime } from '../core/validate.js';
import { getLeapMonthOfYear } from '../core/lunar.js';
import { zodiacForLunarYear } from '../core/zodiac.js';
import { NONE, lunarYearly } from '../core/recurrence.js';
import { buildDraft } from '../core/draft.js';
import { insertEvent } from '../calendar/calendarService.js';

const $ = (id) => document.getElementById(id);

const views = {
  form: $('form-view'),
  confirm: $('confirm-view'),
  success: $('success-view'),
};

function show(view) {
  for (const v of Object.values(views)) v.classList.add('hidden');
  views[view].classList.remove('hidden');
}

/** The draft currently awaiting confirmation. */
let pendingDraft = null;
/** Guards against double-submits. */
let submitting = false;

// --- Live conversion hint + all-day toggle ---------------------------------

function readLunarInput() {
  return {
    day: parseInt($('lunar-day').value, 10),
    month: parseInt($('lunar-month').value, 10),
    year: parseInt($('lunar-year').value, 10),
    isLeapMonth: $('leap-month').checked,
  };
}

/**
 * Show the leap-month option only when the month the user typed is actually a
 * doubled (nhuận) month that year — otherwise it's meaningless and hidden.
 */
function updateLeapVisibility() {
  const { month, year } = readLunarInput();
  const row = $('leap-row');
  const relevant =
    Number.isInteger(month) && Number.isInteger(year) &&
    getLeapMonthOfYear(year) === month;

  if (!relevant) {
    row.classList.add('hidden');
    $('leap-month').checked = false; // reset so validation uses leap=0
    return;
  }
  row.classList.remove('hidden');
  $('leap-label').textContent = `My date is in the leap month ${month} (nhuận tháng ${month})`;
  $('leap-explain').textContent =
    `Lunar year ${year} has two ${ordinal(month)} months. ` +
    `Leave this unticked for the first (normal) one; tick it only for the second (leap) one.`;
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function updateHint() {
  updateLeapVisibility();
  const input = readLunarInput();
  const hint = $('converted-hint');
  if ([input.day, input.month, input.year].some((n) => Number.isNaN(n))) {
    hint.textContent = '';
    return;
  }
  const result = validateLunarDate(input);
  if (!result.ok) {
    hint.textContent = '⚠ ' + result.errors[0];
    return;
  }
  const g = result.value.gregorian;
  const z = zodiacForLunarYear(input.year);
  hint.textContent =
    `→ Gregorian: ${g.day}/${g.month}/${g.year}\n` +
    `Năm ${z.name} — ${z.animal.vi} (${z.animal.en})`;
}

function toggleTimeRow() {
  $('time-row').classList.toggle('hidden', $('all-day').checked);
}

// --- Step 1 -> 2: build draft ----------------------------------------------

function handlePreview(e) {
  e.preventDefault();
  const errorEl = $('form-error');
  errorEl.textContent = '';

  const errors = [];

  const titleRes = validateTitle($('title').value);
  if (!titleRes.ok) errors.push(...titleRes.errors);

  const dateRes = validateLunarDate(readLunarInput());
  if (!dateRes.ok) errors.push(...dateRes.errors);

  const allDay = $('all-day').checked;
  let start;
  if (!allDay) {
    const timeRes = validateTime($('start-time').value);
    if (!timeRes.ok) errors.push(...timeRes.errors);
    else start = timeRes.value;
  }

  if (errors.length) {
    errorEl.textContent = errors.join('\n');
    return;
  }

  const recurrence = $('annual').checked ? lunarYearly() : NONE;

  pendingDraft = buildDraft({
    title: titleRes.value,
    gregorian: dateRes.value.gregorian,
    lunar: dateRes.value.lunar,
    allDay,
    start,
    recurrence,
  });

  renderConfirmation(pendingDraft.preview);
  show('confirm');
}

function renderConfirmation(p) {
  $('c-title').textContent = p.title;
  $('c-lunar').textContent = p.lunarText;
  $('c-gregorian').textContent = p.gregorianText;
  $('c-zodiac').textContent = p.zodiacText;
  $('c-recurrence').textContent = p.recurrenceText;
  $('c-timezone').textContent = p.timezone;
  $('confirm-error').textContent = '';

  const wrap = $('c-upcoming-wrap');
  const list = $('c-upcoming');
  list.textContent = '';
  if (p.isRecurring) {
    for (const d of p.upcoming) {
      const li = document.createElement('li');
      li.textContent = d;
      list.appendChild(li);
    }
    wrap.classList.remove('hidden');
  } else {
    wrap.classList.add('hidden');
  }
}

// --- Step 2 -> 3: create -----------------------------------------------------

async function handleCreate() {
  if (submitting || !pendingDraft) return;
  submitting = true;
  const btn = $('create-btn');
  const errorEl = $('confirm-error');
  errorEl.textContent = '';
  btn.disabled = true;
  btn.textContent = 'Creating…';

  try {
    // Stable request id for this draft => a double-click can't duplicate it.
    const requestId = pendingDraft.requestId ||
      (pendingDraft.requestId = makeRequestId(pendingDraft.googleEvent));
    const result = await insertEvent(pendingDraft.googleEvent, requestId);
    const link = $('open-link');
    if (result.htmlLink) {
      link.href = result.htmlLink;
      link.classList.remove('hidden');
    } else {
      link.classList.add('hidden');
    }
    show('success');
  } catch (err) {
    errorEl.textContent = err.message || 'Something went wrong. Please try again.';
  } finally {
    submitting = false;
    btn.disabled = false;
    btn.textContent = 'Create event';
  }
}

/** Deterministic id from the event content (idempotency key). */
function makeRequestId(googleEvent) {
  const seed = JSON.stringify([
    googleEvent.summary,
    googleEvent.start,
    googleEvent.end,
    googleEvent.recurrence || null,
  ]);
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return 'e' + (h >>> 0).toString(32);
}

function resetForm() {
  pendingDraft = null;
  $('event-form').reset();
  $('converted-hint').textContent = '';
  toggleTimeRow();
  show('form');
}

// --- Wire up ----------------------------------------------------------------

$('event-form').addEventListener('submit', handlePreview);
$('back-btn').addEventListener('click', () => show('form'));
$('create-btn').addEventListener('click', handleCreate);
$('another-btn').addEventListener('click', resetForm);
$('all-day').addEventListener('change', toggleTimeRow);
for (const id of ['lunar-day', 'lunar-month', 'lunar-year', 'leap-month']) {
  $(id).addEventListener('input', updateHint);
}

toggleTimeRow();
