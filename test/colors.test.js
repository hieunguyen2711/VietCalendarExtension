import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EVENT_COLORS, getColor, colorName, isValidColorId } from '../src/core/colors.js';
import { buildDraft } from '../src/core/draft.js';
import { NONE } from '../src/core/recurrence.js';

const base = {
  title: 'Giỗ',
  gregorian: { day: 17, month: 2, year: 2026 },
  lunar: { day: 1, month: 1, year: 2026, isLeapMonth: false },
  allDay: true,
  recurrence: NONE,
};

test('palette matches Google\'s 11 event colours', () => {
  assert.equal(EVENT_COLORS.length, 11);
  assert.deepEqual(
    EVENT_COLORS.map((c) => c.id),
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11']
  );
  for (const c of EVENT_COLORS) {
    assert.match(c.hex, /^#[0-9a-f]{6}$/i, `bad hex for ${c.id}`);
    assert.ok(c.en && c.vi, `missing name for ${c.id}`);
  }
});

test('lookup and validation', () => {
  assert.equal(getColor('11').en, 'Tomato');
  assert.equal(getColor(11).en, 'Tomato'); // number coerces
  assert.equal(getColor('99'), null);
  assert.equal(getColor(null), null);
  assert.ok(isValidColorId('1'));
  assert.equal(isValidColorId(''), false);
  assert.equal(isValidColorId('12'), false);
});

test('colorName falls back to "calendar default"', () => {
  assert.equal(colorName(null), 'Calendar default');
  assert.equal(colorName(null, 'vi'), 'Màu mặc định của lịch');
  assert.equal(colorName('11', 'vi'), 'Đỏ');
});

test('a chosen colour is sent as colorId', () => {
  const { googleEvent, preview } = buildDraft({ ...base, colorId: '11' });
  assert.equal(googleEvent.colorId, '11');
  assert.equal(preview.colorText, 'Tomato');
  assert.equal(preview.colorHex, '#d50000');
});

test('no colour omits colorId so the event inherits the calendar colour', () => {
  const { googleEvent, preview } = buildDraft(base);
  assert.equal('colorId' in googleEvent, false);
  assert.equal(preview.colorText, 'Calendar default');
  assert.equal(preview.colorHex, null);
});

test('an invalid colour is dropped rather than failing the insert', () => {
  const { googleEvent } = buildDraft({ ...base, colorId: '99' });
  assert.equal('colorId' in googleEvent, false);
});

test('colour is recorded in source so Edit can restore it', () => {
  const { source } = buildDraft({ ...base, colorId: '5' });
  assert.equal(source.colorId, '5');
});
