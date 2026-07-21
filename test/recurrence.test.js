import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NONE, lunarYearly, describe } from '../src/core/recurrence.js';

test('none does not repeat', () => {
  assert.equal(describe(NONE), 'Does not repeat');
});

test('lunarYearly carries a horizon and describes itself', () => {
  assert.deepEqual(lunarYearly({ years: 25 }), { freq: 'lunarYearly', years: 25 });
  assert.match(describe(lunarYearly({ years: 25 })), /same lunar date, for 25 years/);
});
