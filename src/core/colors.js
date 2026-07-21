/*
 * Google Calendar event colours.
 *
 * The Calendar API exposes a fixed palette of 11 event colours, referenced by
 * `colorId` ("1".."11") on the event resource. The hex values below are the
 * ones Google renders for each id — they're hardcoded so the picker can draw
 * swatches without an extra /colors API round-trip on every popup open.
 *
 * Omitting colorId entirely makes the event inherit its calendar's colour,
 * which is Google's default behaviour and stays the default here.
 */

/**
 * @typedef {Object} EventColor
 * @property {string} id    Google colorId
 * @property {string} hex   swatch colour
 * @property {string} en    English name (matches Google's own labels)
 * @property {string} vi    Vietnamese name
 */

/** @type {EventColor[]} */
export const EVENT_COLORS = [
  { id: '1', hex: '#7986cb', en: 'Lavender', vi: 'Tím oải hương' },
  { id: '2', hex: '#33b679', en: 'Sage', vi: 'Xanh rêu' },
  { id: '3', hex: '#8e24aa', en: 'Grape', vi: 'Tím nho' },
  { id: '4', hex: '#e67c73', en: 'Flamingo', vi: 'Hồng' },
  { id: '5', hex: '#f6bf26', en: 'Banana', vi: 'Vàng chuối' },
  { id: '6', hex: '#f4511e', en: 'Tangerine', vi: 'Cam' },
  { id: '7', hex: '#039be5', en: 'Peacock', vi: 'Xanh biển' },
  { id: '8', hex: '#616161', en: 'Graphite', vi: 'Xám' },
  { id: '9', hex: '#3f51b5', en: 'Blueberry', vi: 'Xanh dương đậm' },
  { id: '10', hex: '#0b8043', en: 'Basil', vi: 'Xanh lá đậm' },
  { id: '11', hex: '#d50000', en: 'Tomato', vi: 'Đỏ' },
];

/** Look up a colour by its Google colorId. */
export function getColor(id) {
  if (id == null || id === '') return null;
  return EVENT_COLORS.find((c) => c.id === String(id)) || null;
}

/** Display name for a colour id; null/unknown reads as the calendar default. */
export function colorName(id, lang = 'en') {
  const color = getColor(id);
  if (!color) return lang === 'vi' ? 'Màu mặc định của lịch' : 'Calendar default';
  return lang === 'vi' ? color.vi : color.en;
}

/** True if the id names a real palette entry. */
export function isValidColorId(id) {
  return getColor(id) !== null;
}
