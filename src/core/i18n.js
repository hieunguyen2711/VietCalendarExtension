/*
 * Lightweight i18n (English / Vietnamese).
 *
 * Deliberately NOT chrome.i18n: that picks the language from the browser UI
 * locale, but a large share of this extension's users run Chrome in English
 * while preferring a Vietnamese interface (or are setting it up for a parent
 * who does). So the language is an explicit, persisted user choice.
 */

export const LANGS = ['en', 'vi'];

const STRINGS = {
  en: {
    appName: 'Viet Calendar',
    subtitle: 'Lunar calendar → Google Calendar',

    navNew: 'New',
    navHolidays: 'Holidays',
    navHistory: 'History',
    navSettings: 'Settings',

    todayIs: 'Today',
    lunarLabel: 'lunar',

    modeLabel: 'Enter date as',
    modeLunar: 'Lunar (âm lịch)',
    modeSolar: 'Gregorian (dương lịch)',
    modeBulk: 'Multiple events',

    title: 'Event title',
    titlePlaceholder: 'e.g. Giỗ ông nội',
    day: 'Day',
    month: 'Month',
    year: 'Year',
    leapMonth: 'This is the leap month',
    solarHint: 'Enter the Gregorian date you know; it converts to lunar.',

    timeSection: 'Time',
    allDay: 'All-day event',
    startTime: 'Start time',
    tzNote: 'Time is in your timezone:',

    repeats: 'Repeats',
    repeatNone: 'Does not repeat',
    repeatYearly: 'Every year (same lunar date)',
    repeatMonthly: 'Every lunar month (Mùng 1 / Rằm)',

    reminder: 'Remind me',
    reminderNone: 'Use calendar default',
    reminderSameDay: 'On the day',
    reminder1: '1 day before',
    reminder3: '3 days before',
    reminder7: '1 week before',

    calendar: 'Calendar',
    calendarLoading: 'Loading calendars…',
    createCalendar: 'Use a dedicated "Lịch Âm" calendar',
    calendarCreated: 'Calendar created and selected.',
    calendarExisting: 'Using your existing "Lịch Âm" calendar.',
    calendarDuplicates:
      '⚠ You have more than one calendar named "Lịch Âm". The first is selected. ' +
      'Delete the extras in Google Calendar to avoid confusion.',
    calendarNotVisible:
      '⚠ Could not switch this calendar on automatically. In Google Calendar, ' +
      'tick the box next to it under "My calendars" or your events won\'t show.',
    calendarMissing:
      'The calendar you had selected no longer exists, so "Primary" is now selected.',
    calendarMissingRetry:
      'The calendar you had selected no longer exists. Switched to "Primary" — ' +
      'press "Create event" again, or pick another calendar in Settings.',

    preview: 'Preview →',
    confirmTitle: 'Confirm event',
    fieldTitle: 'Title',
    fieldLunar: 'Lunar date',
    fieldGregorian: 'Gregorian date',
    fieldZodiac: 'Zodiac year',
    fieldRepeats: 'Repeats',
    fieldReminder: 'Reminder',
    fieldCalendar: 'Calendar',
    fieldTimezone: 'Timezone',
    upcomingLabel: 'Next occurrences (Gregorian):',
    willCreate: 'This will create an event in the calendar shown above.',
    back: '← Back',
    create: 'Create event',
    creating: 'Creating…',

    successTitle: 'Event created',
    successBody: 'Your event was added to Google Calendar.',
    openInCalendar: 'Open in Calendar',
    createAnother: 'Create another',

    holidaysIntro: 'Add Vietnamese lunar holidays for a given year.',
    holidayYear: 'Lunar year',
    selectAll: 'Select all',
    addSelected: 'Add selected',
    addingHolidays: 'Adding…',
    holidaysAdded: 'holidays added.',

    historyEmpty: 'No events created yet.',
    historyIntro: 'Events created with this extension.',
    delete: 'Delete',
    deleting: 'Deleting…',
    edit: 'Edit',
    deleted: 'Deleted.',
    clearHistory: 'Clear list',

    language: 'Language',
    settingsSaved: 'Saved.',
    defaultReminder: 'Default reminder',
    color: 'Colour',
    defaultColor: 'Default colour',

    bulkHelp:
      'One event per line: title, day/month[/year]\nExample: Giỗ ông nội, 15/3/2026',
    bulkPlaceholder: 'Giỗ ông nội, 15/3/2026\nGiỗ bà nội, 20/8/2026',
    bulkParsed: 'events ready',
    bulkCreate: 'Create all',

    signIn: 'Sign in with Google',
    signInPrompt: 'Sign in with Google before creating events.',
    signedInAs: 'Signed in as',
    signOut: 'Sign out',
    signedOut: 'Signed out.',
    editingNotice: 'Editing an existing event — saving updates it in place.',
    cancelEdit: 'Cancel',
    eventUpdated: 'Event updated',
    saveChanges: 'Save changes',
    holidayClamped: 'adjusted to the last day of that lunar month',
    confirmClearHistory: 'Clear the list of created events? This does not delete them from Google Calendar.',
    partialSuccess: 'created before the error',

    errRequired: 'Event title is required.',
    errTitleLong: 'Event title is too long (max 1024 characters).',
    errYearRequired: 'Enter a lunar year first.',
    errNoneSelected: 'Select at least one item.',
    errNoneResolved: 'None of the selected holidays could be resolved for that year.',
    errBulkLine: 'Could not read line',
    errRateLimited: 'Google is rate-limiting requests. Wait a moment and try again.',
    errSignInFirst: 'Please sign in first.',
  },

  vi: {
    appName: 'Lịch Việt',
    subtitle: 'Âm lịch → Google Calendar',

    navNew: 'Tạo mới',
    navHolidays: 'Ngày lễ',
    navHistory: 'Lịch sử',
    navSettings: 'Cài đặt',

    todayIs: 'Hôm nay',
    lunarLabel: 'âm lịch',

    modeLabel: 'Nhập ngày theo',
    modeLunar: 'Âm lịch',
    modeSolar: 'Dương lịch',
    modeBulk: 'Nhiều sự kiện',

    title: 'Tên sự kiện',
    titlePlaceholder: 'ví dụ: Giỗ ông nội',
    day: 'Ngày',
    month: 'Tháng',
    year: 'Năm',
    leapMonth: 'Đây là tháng nhuận',
    solarHint: 'Nhập ngày dương lịch bạn biết; hệ thống sẽ đổi sang âm lịch.',

    timeSection: 'Thời gian',
    allDay: 'Cả ngày',
    startTime: 'Giờ bắt đầu',
    tzNote: 'Giờ theo múi giờ của bạn:',

    repeats: 'Lặp lại',
    repeatNone: 'Không lặp lại',
    repeatYearly: 'Hằng năm (theo ngày âm lịch)',
    repeatMonthly: 'Hằng tháng âm lịch (Mùng 1 / Rằm)',

    reminder: 'Nhắc trước',
    reminderNone: 'Theo mặc định của lịch',
    reminderSameDay: 'Trong ngày',
    reminder1: 'Trước 1 ngày',
    reminder3: 'Trước 3 ngày',
    reminder7: 'Trước 1 tuần',

    calendar: 'Lịch',
    calendarLoading: 'Đang tải danh sách lịch…',
    createCalendar: 'Dùng lịch riêng "Lịch Âm"',
    calendarCreated: 'Đã tạo và chọn lịch.',
    calendarExisting: 'Đang dùng lịch "Lịch Âm" đã có của bạn.',
    calendarDuplicates:
      '⚠ Bạn có nhiều lịch trùng tên "Lịch Âm". Lịch đầu tiên đã được chọn. ' +
      'Hãy xóa các lịch thừa trong Google Calendar để tránh nhầm lẫn.',
    calendarNotVisible:
      '⚠ Không thể tự bật lịch này. Trong Google Calendar, hãy tích vào ô bên cạnh ' +
      'lịch ở mục "Lịch của tôi", nếu không sự kiện sẽ không hiển thị.',
    calendarMissing:
      'Lịch bạn đã chọn không còn tồn tại, hệ thống đã chuyển về lịch "Chính".',
    calendarMissingRetry:
      'Lịch bạn đã chọn không còn tồn tại. Đã chuyển về lịch "Chính" — ' +
      'hãy nhấn "Tạo sự kiện" lại, hoặc chọn lịch khác trong Cài đặt.',

    preview: 'Xem trước →',
    confirmTitle: 'Xác nhận sự kiện',
    fieldTitle: 'Tên',
    fieldLunar: 'Ngày âm lịch',
    fieldGregorian: 'Ngày dương lịch',
    fieldZodiac: 'Năm can chi',
    fieldRepeats: 'Lặp lại',
    fieldReminder: 'Nhắc nhở',
    fieldCalendar: 'Lịch',
    fieldTimezone: 'Múi giờ',
    upcomingLabel: 'Các lần tới (dương lịch):',
    willCreate: 'Sự kiện sẽ được tạo trong lịch ở trên.',
    back: '← Quay lại',
    create: 'Tạo sự kiện',
    creating: 'Đang tạo…',

    successTitle: 'Đã tạo sự kiện',
    successBody: 'Sự kiện đã được thêm vào Google Calendar.',
    openInCalendar: 'Mở trong Calendar',
    createAnother: 'Tạo sự kiện khác',

    holidaysIntro: 'Thêm các ngày lễ âm lịch cho một năm.',
    holidayYear: 'Năm âm lịch',
    selectAll: 'Chọn tất cả',
    addSelected: 'Thêm đã chọn',
    addingHolidays: 'Đang thêm…',
    holidaysAdded: 'ngày lễ đã được thêm.',

    historyEmpty: 'Chưa tạo sự kiện nào.',
    historyIntro: 'Các sự kiện đã tạo bằng tiện ích này.',
    delete: 'Xóa',
    deleting: 'Đang xóa…',
    edit: 'Sửa',
    deleted: 'Đã xóa.',
    clearHistory: 'Xóa danh sách',

    language: 'Ngôn ngữ',
    settingsSaved: 'Đã lưu.',
    defaultReminder: 'Nhắc nhở mặc định',
    color: 'Màu sắc',
    defaultColor: 'Màu mặc định',

    bulkHelp:
      'Mỗi dòng một sự kiện: tên, ngày/tháng[/năm]\nVí dụ: Giỗ ông nội, 15/3/2026',
    bulkPlaceholder: 'Giỗ ông nội, 15/3/2026\nGiỗ bà nội, 20/8/2026',
    bulkParsed: 'sự kiện sẵn sàng',
    bulkCreate: 'Tạo tất cả',

    signIn: 'Đăng nhập bằng Google',
    signInPrompt: 'Hãy đăng nhập bằng Google trước khi tạo sự kiện.',
    signedInAs: 'Đang đăng nhập với',
    signOut: 'Đăng xuất',
    signedOut: 'Đã đăng xuất.',
    editingNotice: 'Đang sửa một sự kiện đã có — lưu sẽ cập nhật trực tiếp.',
    cancelEdit: 'Hủy',
    eventUpdated: 'Đã cập nhật sự kiện',
    saveChanges: 'Lưu thay đổi',
    holidayClamped: 'đã chuyển sang ngày cuối của tháng âm lịch đó',
    confirmClearHistory: 'Xóa danh sách sự kiện đã tạo? Thao tác này không xóa chúng khỏi Google Calendar.',
    partialSuccess: 'đã được tạo trước khi xảy ra lỗi',

    errRequired: 'Vui lòng nhập tên sự kiện.',
    errTitleLong: 'Tên sự kiện quá dài (tối đa 1024 ký tự).',
    errYearRequired: 'Hãy nhập năm âm lịch trước.',
    errNoneSelected: 'Hãy chọn ít nhất một mục.',
    errNoneResolved: 'Không thể xác định ngày cho các ngày lễ đã chọn trong năm đó.',
    errBulkLine: 'Không đọc được dòng',
    errRateLimited: 'Google đang giới hạn số yêu cầu. Vui lòng đợi một lát rồi thử lại.',
    errSignInFirst: 'Vui lòng đăng nhập trước.',
  },
};

let current = 'en';

/** Set the active language ('en' | 'vi'). */
export function setLang(lang) {
  current = LANGS.includes(lang) ? lang : 'en';
  return current;
}

/** Current active language. */
export function getLang() {
  return current;
}

/** Translate a key; falls back to English, then to the key itself. */
export function t(key, lang = current) {
  const table = STRINGS[lang] || STRINGS.en;
  return table[key] ?? STRINGS.en[key] ?? key;
}

/**
 * Apply translations to a DOM tree. Elements opt in with:
 *   data-i18n="key"             -> textContent
 *   data-i18n-placeholder="key" -> placeholder attribute
 *   data-i18n-title="key"       -> title attribute
 */
export function applyTranslations(root = document) {
  for (const el of root.querySelectorAll('[data-i18n]')) {
    el.textContent = t(el.dataset.i18n);
  }
  for (const el of root.querySelectorAll('[data-i18n-placeholder]')) {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  }
  for (const el of root.querySelectorAll('[data-i18n-title]')) {
    el.title = t(el.dataset.i18nTitle);
  }
}
