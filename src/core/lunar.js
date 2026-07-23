/*
 * Vietnamese Lunar <-> Gregorian (Solar) calendar conversion.
 *
 * Based on Hồ Ngọc Đức's astronomical algorithm (amlich), which follows the
 * rules of the Vietnamese lunar calendar (múi giờ UTC+7):
 *   - Ngày đầu tiên của tháng âm lịch là ngày chứa điểm Sóc (new moon).
 *   - Đông chí (winter solstice) luôn rơi vào tháng 11 âm lịch.
 *   - Chu kỳ của điểm Sóc là ~29.53 ngày.
 *
 * Flow: Ngày dương -> Julian Day -> ngày Sóc -> các Trung Khí
 *       -> xác định tên tháng & kiểm tra tháng nhuận -> suy ra ngày âm.
 *
 * This module is intentionally pure (no Chrome / Google APIs) so it can be
 * unit tested heavily and reused anywhere.
 */

const PI = Math.PI;

/** Vietnam standard time offset, in hours. */
export const VN_TIMEZONE = 7;

/** Floor helper matching the reference algorithm's INT(). */
function INT(d) {
  return Math.floor(d);
}

/**
 * Convert a Gregorian date (dd/mm/yyyy) to a Julian Day Number.
 * Handles the Julian/Gregorian switch at 1582-10-15 (JDN 2299161).
 */
export function jdFromDate(dd, mm, yy) {
  const a = INT((14 - mm) / 12);
  const y = yy + 4800 - a;
  const m = mm + 12 * a - 3;
  let jd =
    dd +
    INT((153 * m + 2) / 5) +
    365 * y +
    INT(y / 4) -
    INT(y / 100) +
    INT(y / 400) -
    32045;
  if (jd < 2299161) {
    jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - 32083;
  }
  return jd;
}

/**
 * Convert a Julian Day Number back to a Gregorian date.
 * @returns {[number, number, number]} [day, month, year]
 */
export function jdToDate(jd) {
  let a, b, c;
  if (jd > 2299160) {
    a = jd + 32044;
    b = INT((4 * a + 3) / 146097);
    c = a - INT((b * 146097) / 4);
  } else {
    b = 0;
    c = jd + 32082;
  }
  const d = INT((4 * c + 3) / 1461);
  const e = c - INT((1461 * d) / 4);
  const m = INT((5 * e + 2) / 153);
  const day = e - INT((153 * m + 2) / 5) + 1;
  const month = m + 3 - 12 * INT(m / 10);
  const year = b * 100 + d - 4800 + INT(m / 10);
  return [day, month, year];
}

/**
 * Julian Day (with fraction) of the k-th new moon since 1900-01-01.
 * Reference: Astronomical Algorithms, Jean Meeus, 1998.
 */
function newMoon(k) {
  const T = k / 1236.85; // ~1236.85 new moons per Julian century
  const T2 = T * T;
  const T3 = T2 * T;
  const dr = PI / 180;
  let Jd1 =
    2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  Jd1 =
    Jd1 + 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3; // Sun's mean anomaly
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3; // Moon's mean anomaly
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3; // Moon's argument of latitude
  let C1 =
    (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
  C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr);
  C1 = C1 - 0.0004 * Math.sin(dr * 3 * Mpr);
  C1 = C1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
  C1 = C1 - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M));
  C1 = C1 - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr));
  C1 = C1 + 0.001 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M));
  let deltat;
  if (T < -11) {
    deltat =
      0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3;
  } else {
    deltat = -0.000278 + 0.000265 * T + 0.000262 * T2;
  }
  return Jd1 + C1 - deltat;
}

/** Integer Julian Day of the k-th new moon, at local midnight for timeZone. */
function getNewMoonDay(k, timeZone) {
  return INT(newMoon(k) + 0.5 + timeZone / 24);
}

/** Sun's ecliptic longitude (radians, 0..2PI) at Julian Day jdn. */
function sunLongitude(jdn) {
  const T = (jdn - 2451545.0) / 36525;
  const T2 = T * T;
  const dr = PI / 180;
  const M = 357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let DL = (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
  DL = DL + (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.00029 * Math.sin(dr * 3 * M);
  let L = L0 + DL;
  L = L * dr;
  L = L - PI * 2 * INT(L / (PI * 2)); // normalize to (0, 2PI)
  return L;
}

/**
 * Sun longitude bucket (0..11) at local midnight. Each unit = 30°.
 * Value 9 corresponds to 270° = winter solstice (đông chí).
 */
function getSunLongitude(dayNumber, timeZone) {
  return INT((sunLongitude(dayNumber - 0.5 - timeZone / 24) / PI) * 6);
}

/** Julian Day of the new moon that starts lunar month 11 of year yy. */
function getLunarMonth11(yy, timeZone) {
  const off = jdFromDate(31, 12, yy) - 2415021;
  const k = INT(off / 29.530588853);
  let nm = getNewMoonDay(k, timeZone);
  const sunLong = getSunLongitude(nm, timeZone);
  if (sunLong >= 9) {
    nm = getNewMoonDay(k - 1, timeZone);
  }
  return nm;
}

/** Offset (from month 11) of the leap month in a 13-month lunar year. */
function getLeapMonthOffset(a11, timeZone) {
  const k = INT((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let last = 0;
  let i = 1; // start with the month following lunar month 11
  let arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
  do {
    last = arc;
    i++;
    arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
  } while (arc !== last && i < 14);
  return i - 1;
}

/**
 * Convert a Gregorian date to a Vietnamese lunar date.
 * @returns {[number, number, number, number]} [lunarDay, lunarMonth, lunarYear, isLeapMonth(0|1)]
 */
export function convertSolar2Lunar(dd, mm, yy, timeZone = VN_TIMEZONE) {
  const dayNumber = jdFromDate(dd, mm, yy);
  let k = INT((dayNumber - 2415021.076998695) / 29.530588853);
  let monthStart = getNewMoonDay(k + 1, timeZone);
  // The k estimate can overshoot by more than a single lunation, so stepping
  // back only once is not enough: when it isn't, lunarDay below computes to 0
  // and the month comes out wrong too (e.g. 2054-05-07, 2062-04-09). Keep
  // walking back until the month start is on or before the target day.
  while (monthStart > dayNumber) {
    k -= 1;
    monthStart = getNewMoonDay(k + 1, timeZone);
  }
  let a11 = getLunarMonth11(yy, timeZone);
  let b11 = a11;
  let lunarYear;
  if (a11 >= monthStart) {
    lunarYear = yy;
    a11 = getLunarMonth11(yy - 1, timeZone);
  } else {
    lunarYear = yy + 1;
    b11 = getLunarMonth11(yy + 1, timeZone);
  }
  const lunarDay = dayNumber - monthStart + 1;
  const diff = INT((monthStart - a11) / 29);
  let lunarLeap = 0;
  let lunarMonth = diff + 11;
  if (b11 - a11 > 365) {
    const leapMonthDiff = getLeapMonthOffset(a11, timeZone);
    if (diff >= leapMonthDiff) {
      lunarMonth = diff + 10;
      if (diff === leapMonthDiff) {
        lunarLeap = 1;
      }
    }
  }
  if (lunarMonth > 12) {
    lunarMonth = lunarMonth - 12;
  }
  if (lunarMonth >= 11 && diff < 4) {
    lunarYear -= 1;
  }
  return [lunarDay, lunarMonth, lunarYear, lunarLeap];
}

/**
 * Convert a Vietnamese lunar date to a Gregorian date.
 * @param {number} lunarLeap 1 if the input refers to the leap month, else 0.
 * @returns {[number, number, number]} [day, month, year], or [0,0,0] if the
 *          leap month does not exist in that lunar year (invalid input).
 */
export function convertLunar2Solar(
  lunarDay,
  lunarMonth,
  lunarYear,
  lunarLeap = 0,
  timeZone = VN_TIMEZONE
) {
  let a11, b11;
  if (lunarMonth < 11) {
    a11 = getLunarMonth11(lunarYear - 1, timeZone);
    b11 = getLunarMonth11(lunarYear, timeZone);
  } else {
    a11 = getLunarMonth11(lunarYear, timeZone);
    b11 = getLunarMonth11(lunarYear + 1, timeZone);
  }
  let off = lunarMonth - 11;
  if (off < 0) {
    off += 12;
  }
  if (b11 - a11 > 365) {
    const leapOff = getLeapMonthOffset(a11, timeZone);
    let leapMonth = leapOff - 2;
    if (leapMonth < 0) {
      leapMonth += 12;
    }
    if (lunarLeap !== 0 && lunarMonth !== leapMonth) {
      return [0, 0, 0]; // requested leap month doesn't exist this year
    } else if (lunarLeap !== 0 || off >= leapOff) {
      off += 1;
    }
  }
  const k = INT(0.5 + (a11 - 2415021.076998695) / 29.530588853);
  const monthStart = getNewMoonDay(k + off, timeZone);
  return jdToDate(monthStart + lunarDay - 1);
}

/**
 * Which month (1..12) is the leap month in the given lunar year, or 0 if the
 * year has no leap month. Most years return 0.
 *
 * Derived from the conversion functions themselves (rather than the internal
 * offset helpers) so it can never disagree with what the rest of the app does:
 * a month M is the leap month of year Y iff asking for its leap variant yields
 * a real date that converts back to that same leap month.
 */
export function getLeapMonthOfYear(lunarYear, timeZone = VN_TIMEZONE) {
  for (let m = 1; m <= 12; m++) {
    const [d, mo, y] = convertLunar2Solar(1, m, lunarYear, 1, timeZone);
    if (d === 0) continue; // this month has no leap variant
    const [ld, lm, ly, ll] = convertSolar2Lunar(d, mo, y, timeZone);
    if (ld === 1 && lm === m && ly === lunarYear && ll === 1) {
      return m;
    }
  }
  return 0;
}
