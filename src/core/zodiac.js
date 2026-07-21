/*
 * Vietnamese zodiac year (Can Chi — Thiên Can + Địa Chi).
 *
 * A year's name combines one of 10 Heavenly Stems (Can) with one of 12 Earthly
 * Branches (Chi), producing a 60-year cycle: e.g. 2026 = Bính Ngọ.
 *
 * IMPORTANT: the zodiac year follows the LUNAR year, so it rolls over at Tết,
 * not on 1 January. Use `zodiacForSolarDate` for a Gregorian date — a date in
 * January still belongs to the previous zodiac year.
 *
 * The Vietnamese zodiac differs from the Chinese one in two of the twelve
 * animals (see ANIMALS below): the Cat replaces the Rabbit, and the Water
 * Buffalo stands in for the Ox.
 */

import { convertSolar2Lunar, VN_TIMEZONE } from './lunar.js';

/** The 10 Heavenly Stems (Thiên Can). */
export const CAN = [
  'Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu',
  'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý',
];

/** The 12 Earthly Branches (Địa Chi). */
export const CHI = [
  'Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ',
  'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi',
];

/**
 * The 12 Vietnamese zodiac animals, aligned index-for-index with CHI.
 *
 * Two entries deliberately differ from the Chinese/Korean/Japanese zodiac:
 *   - index 1, Sửu  → Water Buffalo (Trâu), not Ox. The water buffalo is
 *     central to Vietnam's wet-rice farming culture.
 *   - index 3, Mão  → Cat (Mèo), not Rabbit.
 * Do not "correct" these to Ox/Rabbit.
 */
export const ANIMALS = [
  { vi: 'Chuột', en: 'Rat' },
  { vi: 'Trâu', en: 'Water Buffalo' },
  { vi: 'Hổ', en: 'Tiger' },
  { vi: 'Mèo', en: 'Cat' },
  { vi: 'Rồng', en: 'Dragon' },
  { vi: 'Rắn', en: 'Snake' },
  { vi: 'Ngựa', en: 'Horse' },
  { vi: 'Dê', en: 'Goat' },
  { vi: 'Khỉ', en: 'Monkey' },
  { vi: 'Gà', en: 'Rooster' },
  { vi: 'Chó', en: 'Dog' },
  { vi: 'Lợn', en: 'Pig' },
];

/** Ngũ hành (five elements), paired across the stems: two stems per element. */
const ELEMENTS = [
  { vi: 'Mộc', en: 'Wood' },
  { vi: 'Hỏa', en: 'Fire' },
  { vi: 'Thổ', en: 'Earth' },
  { vi: 'Kim', en: 'Metal' },
  { vi: 'Thủy', en: 'Water' },
];

/** Modulo that stays non-negative for years before the epoch. */
const mod = (n, m) => ((n % m) + m) % m;

/**
 * @typedef {Object} ZodiacYear
 * @property {string} can       Heavenly Stem, e.g. "Bính"
 * @property {string} chi       Earthly Branch, e.g. "Ngọ"
 * @property {string} name      Full Can Chi name, e.g. "Bính Ngọ"
 * @property {{vi:string,en:string}} animal   e.g. { vi: "Ngựa", en: "Horse" }
 * @property {{vi:string,en:string}} element  e.g. { vi: "Hỏa", en: "Fire" }
 * @property {number} lunarYear the lunar year this describes
 */

/**
 * Zodiac name for a LUNAR year.
 * @param {number} lunarYear
 * @returns {ZodiacYear}
 */
export function zodiacForLunarYear(lunarYear) {
  const canIndex = mod(lunarYear + 6, 10);
  const chiIndex = mod(lunarYear + 8, 12);
  return {
    can: CAN[canIndex],
    chi: CHI[chiIndex],
    name: `${CAN[canIndex]} ${CHI[chiIndex]}`,
    animal: ANIMALS[chiIndex],
    element: ELEMENTS[Math.floor(canIndex / 2)],
    lunarYear,
  };
}

/**
 * Zodiac year for a Gregorian date. Converts to the lunar year first, so dates
 * before Tết correctly resolve to the previous zodiac year.
 * @returns {ZodiacYear}
 */
export function zodiacForSolarDate(day, month, year, timeZone = VN_TIMEZONE) {
  const [, , lunarYear] = convertSolar2Lunar(day, month, year, timeZone);
  return zodiacForLunarYear(lunarYear);
}

/** One-line label, e.g. "Bính Ngọ (Horse) — Fire". */
export function describeZodiac(z) {
  return `${z.name} (${z.animal.en}) — ${z.element.en}`;
}
