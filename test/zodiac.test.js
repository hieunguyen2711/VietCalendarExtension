import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  zodiacForLunarYear,
  zodiacForSolarDate,
  describeZodiac,
  ANIMALS,
  CHI,
} from '../src/core/zodiac.js';

test('known Can Chi year names', () => {
  assert.equal(zodiacForLunarYear(2026).name, 'Bính Ngọ');
  assert.equal(zodiacForLunarYear(2025).name, 'Ất Tỵ');
  assert.equal(zodiacForLunarYear(2024).name, 'Giáp Thìn');
  assert.equal(zodiacForLunarYear(2023).name, 'Quý Mão');
  assert.equal(zodiacForLunarYear(1975).name, 'Ất Mão');
});

test('Vietnamese zodiac uses Cat for Mão, not Rabbit', () => {
  const z = zodiacForLunarYear(2023); // Quý Mão
  assert.equal(z.chi, 'Mão');
  assert.equal(z.animal.en, 'Cat');
  assert.equal(z.animal.vi, 'Mèo');
  assert.equal(ANIMALS[CHI.indexOf('Mão')].en, 'Cat');
});

test('Vietnamese zodiac uses Water Buffalo for Sửu, not Ox', () => {
  const z = zodiacForLunarYear(2021); // Tân Sửu
  assert.equal(z.name, 'Tân Sửu');
  assert.equal(z.animal.en, 'Water Buffalo');
  assert.equal(z.animal.vi, 'Trâu');
  assert.equal(ANIMALS[CHI.indexOf('Sửu')].en, 'Water Buffalo');
});

test('elements pair two stems each', () => {
  assert.equal(zodiacForLunarYear(2024).element.en, 'Wood');  // Giáp
  assert.equal(zodiacForLunarYear(2025).element.en, 'Wood');  // Ất
  assert.equal(zodiacForLunarYear(2026).element.en, 'Fire');  // Bính
  assert.equal(zodiacForLunarYear(2027).element.en, 'Fire');  // Đinh
});

test('the cycle repeats every 60 years', () => {
  for (const y of [1900, 1975, 2026]) {
    assert.equal(zodiacForLunarYear(y).name, zodiacForLunarYear(y + 60).name);
  }
  // ...and not sooner.
  assert.notEqual(zodiacForLunarYear(2026).name, zodiacForLunarYear(2026 + 12).name);
});

test('zodiac rolls over at Tết, not 1 January', () => {
  // Tết 2026 falls on 2026-02-17.
  // The day before still belongs to the previous zodiac year (Ất Tỵ).
  assert.equal(zodiacForSolarDate(16, 2, 2026).name, 'Ất Tỵ');
  assert.equal(zodiacForSolarDate(17, 2, 2026).name, 'Bính Ngọ');
  // A January date is emphatically NOT yet the new zodiac year.
  assert.equal(zodiacForSolarDate(1, 1, 2026).name, 'Ất Tỵ');
});

test('describeZodiac formats a readable label', () => {
  assert.equal(describeZodiac(zodiacForLunarYear(2026)), 'Bính Ngọ (Horse) — Fire');
});
