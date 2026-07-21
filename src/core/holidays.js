/*
 * Vietnamese lunar-calendar holidays and observances.
 *
 * All dates here are LUNAR (âm lịch) — that's the whole point: their Gregorian
 * date moves every year, which is why they're painful to put in a calendar by
 * hand. Each entry resolves through the normal conversion pipeline.
 *
 * Fixed-date solar holidays (2/9 Quốc khánh, 30/4, 1/5) are deliberately
 * excluded: Google Calendar's built-in Vietnamese holiday calendar already
 * covers those, and they need no conversion.
 */

/**
 * @typedef {Object} Holiday
 * @property {string} id      stable key
 * @property {number} day     lunar day
 * @property {number} month   lunar month
 * @property {string} vi      Vietnamese name
 * @property {string} en      English name
 * @property {string} note    short description
 */

/** @type {Holiday[]} */
export const HOLIDAYS = [
  {
    id: 'tet',
    day: 1, month: 1,
    vi: 'Tết Nguyên Đán',
    en: 'Lunar New Year (Tết)',
    note: 'The most important holiday of the year.',
  },
  {
    id: 'nguyen-tieu',
    day: 15, month: 1,
    vi: 'Tết Nguyên Tiêu (Rằm tháng Giêng)',
    en: 'First Full Moon Festival',
    note: 'First full moon of the lunar year; major temple day.',
  },
  {
    id: 'han-thuc',
    day: 3, month: 3,
    vi: 'Tết Hàn Thực',
    en: 'Cold Food Festival',
    note: 'Bánh trôi, bánh chay offered to ancestors.',
  },
  {
    id: 'gio-to-hung-vuong',
    day: 10, month: 3,
    vi: 'Giỗ Tổ Hùng Vương',
    en: 'Hùng Kings Commemoration Day',
    note: 'National public holiday honouring the founding kings.',
  },
  {
    id: 'phat-dan',
    day: 15, month: 4,
    vi: 'Lễ Phật Đản',
    en: "Buddha's Birthday (Vesak)",
    note: 'Major Buddhist observance.',
  },
  {
    id: 'doan-ngo',
    day: 5, month: 5,
    vi: 'Tết Đoan Ngọ',
    en: 'Mid-year / Insect-killing Festival',
    note: 'Also called "Tết diệt sâu bọ".',
  },
  {
    id: 'vu-lan',
    day: 15, month: 7,
    vi: 'Lễ Vu Lan (Rằm tháng Bảy)',
    en: 'Ghost Festival / Parents’ Day',
    note: 'Filial piety; honouring parents and wandering souls.',
  },
  {
    id: 'trung-thu',
    day: 15, month: 8,
    vi: 'Tết Trung Thu',
    en: 'Mid-Autumn Festival',
    note: 'Children’s festival; mooncakes and lanterns.',
  },
  {
    id: 'trung-cuu',
    day: 9, month: 9,
    vi: 'Tết Trùng Cửu',
    en: 'Double Ninth Festival',
    note: 'Traditional day for honouring elders.',
  },
  {
    id: 'ong-tao',
    day: 23, month: 12,
    vi: 'Ông Công Ông Táo',
    en: 'Kitchen Gods Day',
    note: 'The Kitchen Gods depart for heaven; carp are released.',
  },
  {
    id: 'tat-nien',
    day: 30, month: 12,
    vi: 'Tất Niên / Giao Thừa',
    en: "New Year's Eve",
    note: 'Falls on day 29 in years whose final lunar month is short.',
  },
];

/** Look up a holiday by its stable id. */
export function getHoliday(id) {
  return HOLIDAYS.find((h) => h.id === id) || null;
}

/** Display name for a holiday in the given language. */
export function holidayName(holiday, lang = 'en') {
  return lang === 'vi' ? holiday.vi : holiday.en;
}
