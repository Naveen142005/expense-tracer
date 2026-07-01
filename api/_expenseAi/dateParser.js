import { MONTHS } from "./constants.js";
import {
  addDays,
  getKolkataTodayParts,
  getMonthRange,
  getWeekRange,
  normalizeMessage,
  toDateString,
} from "./utils.js";

const MONTH_PATTERN =
  "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";

function monthNumber(token) {
  return MONTHS[String(token || "").toLowerCase()] || null;
}

export function extractSingleDate(text, today = getKolkataTodayParts()) {
  const value = normalizeMessage(text);

  const isoDate = value.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (isoDate) return toDateString(Number(isoDate[1]), Number(isoDate[2]), Number(isoDate[3]));

  const dmyDate = value.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](20\d{2}))?\b/);
  if (dmyDate) return toDateString(Number(dmyDate[3] || today.year), Number(dmyDate[2]), Number(dmyDate[1]));

  const dayMonth = value.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_PATTERN})(?:\\s+(20\\d{2}))?\\b`));
  if (dayMonth) return toDateString(Number(dayMonth[3] || today.year), monthNumber(dayMonth[2]), Number(dayMonth[1]));

  const monthDay = value.match(new RegExp(`\\b(${MONTH_PATTERN})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+(20\\d{2}))?\\b`));
  if (monthDay) return toDateString(Number(monthDay[3] || today.year), monthNumber(monthDay[1]), Number(monthDay[2]));

  const dayOnly = value.match(/\b(\d{1,2})(?:st|nd|rd|th)\b/);
  if (dayOnly && !/\btop\s+\d+\b/.test(value)) {
    const day = Number(dayOnly[1]);
    if (day >= 1 && day <= 31) return toDateString(today.year, today.month, day);
  }

  return null;
}

function buildRangeFromTwoDates(leftText, rightText, today) {
  let startDate = extractSingleDate(leftText, today);
  let endDate = extractSingleDate(rightText, today);

  if (!startDate || !endDate) {
    const sharedMonth = normalizeMessage(`${leftText} ${rightText}`).match(new RegExp(`\\b(${MONTH_PATTERN})(?:\\s+(20\\d{2}))?\\b`));
    const leftDay = normalizeMessage(leftText).match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/);
    const rightDay = normalizeMessage(rightText).match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/);
    if (sharedMonth && leftDay && rightDay) {
      const month = monthNumber(sharedMonth[1]);
      const year = Number(sharedMonth[2] || today.year);
      startDate = toDateString(year, month, Number(leftDay[1]));
      endDate = toDateString(year, month, Number(rightDay[1]));
    }
  }

  if (startDate && endDate && startDate > endDate) {
    return { startDate: endDate, endDate: startDate, source: "custom-range" };
  }

  if (startDate && endDate) return { startDate, endDate, source: "custom-range" };
  return null;
}

export function parseDateRange(message) {
  const today = getKolkataTodayParts();
  const text = normalizeMessage(message);

  if (/\b(all time|overall|from beginning|entire|lifetime|life time|whole life|total ever|all records|ever)\b/.test(text)) {
    return { startDate: null, endDate: null, source: "all-time", explicit: true };
  }

  const between = text.match(/\bbetween\s+(.+?)\s+and\s+(.+?)(?:\s|$)/);
  if (between) {
    const range = buildRangeFromTwoDates(between[1], between[2], today);
    if (range) return { ...range, explicit: true };
  }

  const fromTo = text.match(/\bfrom\s+(.+?)\s+(?:to|until|till|-|through)\s+(.+?)(?=\s+(?:how|tell|show|and|with|using|for|cash|gpay|food|bus|snacks|type|period|payment|top|highest|lowest|give|compare|split|breakdown|summary)\b|$)/);
  if (fromTo) {
    const range = buildRangeFromTwoDates(fromTo[1], fromTo[2], today);
    if (range) return { ...range, explicit: true };
  }

  const simpleRange = text.match(new RegExp(`\\b(${MONTH_PATTERN})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:to|-|until|till|through)\\s*(?:(${MONTH_PATTERN})\\s*)?(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+(20\\d{2}))?\\b`));
  if (simpleRange) {
    const startMonth = monthNumber(simpleRange[1]);
    const endMonth = monthNumber(simpleRange[3] || simpleRange[1]);
    const year = Number(simpleRange[5] || today.year);
    return {
      startDate: toDateString(year, startMonth, Number(simpleRange[2])),
      endDate: toDateString(year, endMonth, Number(simpleRange[4])),
      source: "custom-range",
      explicit: true,
    };
  }

  const dayToDaySameMonth = text.match(new RegExp(`\\b(?:from\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:to|-|until|till|through)\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_PATTERN})(?:\\s+(20\\d{2}))?\\b`));
  if (dayToDaySameMonth) {
    const month = monthNumber(dayToDaySameMonth[3]);
    const year = Number(dayToDaySameMonth[4] || today.year);
    return {
      startDate: toDateString(year, month, Number(dayToDaySameMonth[1])),
      endDate: toDateString(year, month, Number(dayToDaySameMonth[2])),
      source: "custom-range",
      explicit: true,
    };
  }

  if (/\b(till today|until today|up to today|so far|till now|until now|month to date|mtd)\b/.test(text)) {
    return { ...getMonthRange(today.year, today.month, true), source: "month-to-date", explicit: true };
  }

  if (/\btoday\b/.test(text)) return { startDate: today.dateString, endDate: today.dateString, source: "today", explicit: true };

  if (/\byesterday\b/.test(text)) {
    const date = addDays(today.dateString, -1);
    return { startDate: date, endDate: date, source: "yesterday", explicit: true };
  }

  if (/\b(last|previous) week\b/.test(text)) return { ...getWeekRange(today.dateString, -1), source: "last-week", explicit: true };

  if (/\b(this|current) week\b/.test(text)) {
    return { ...getWeekRange(today.dateString, 0, /\b(so far|till|until|up to)\b/.test(text)), source: "this-week", explicit: true };
  }

  if (/\b(last|previous) month\b/.test(text)) {
    const lastMonth = today.month === 1 ? 12 : today.month - 1;
    const year = today.month === 1 ? today.year - 1 : today.year;
    return { ...getMonthRange(year, lastMonth), source: "last-month", explicit: true };
  }

  if (/\b(this|current) month\b/.test(text)) {
    return { ...getMonthRange(today.year, today.month, /\b(so far|till|until|up to)\b/.test(text)), source: "this-month", explicit: true };
  }

  if (/\b(last|previous) year\b/.test(text)) {
    const year = today.year - 1;
    return { startDate: `${year}-01-01`, endDate: `${year}-12-31`, source: "last-year", explicit: true };
  }

  if (/\b(this|current) year\b/.test(text)) {
    return { startDate: `${today.year}-01-01`, endDate: today.dateString, source: "this-year", explicit: true };
  }

  const exactDate = extractSingleDate(text, today);
  if (exactDate) return { startDate: exactDate, endDate: exactDate, source: "exact-date", explicit: true };

  const monthOnly = text.match(new RegExp(`\\b(${MONTH_PATTERN})(?:\\s+(20\\d{2}))?\\b`));
  if (monthOnly) {
    const month = monthNumber(monthOnly[1]);
    const year = Number(monthOnly[2] || today.year);
    return { ...getMonthRange(year, month), source: "month", explicit: true };
  }

  const yearOnly = text.match(/\b(20\d{2})\b/);
  if (yearOnly) {
    const year = Number(yearOnly[1]);
    return { startDate: `${year}-01-01`, endDate: `${year}-12-31`, source: "year", explicit: true };
  }

  return { ...getMonthRange(today.year, today.month, true), source: "default-current-month", explicit: false };
}

export function hasExplicitDateWords(message) {
  return parseDateRange(message).explicit;
}

export function stripDatePhrases(message) {
  return normalizeMessage(message)
    .replace(new RegExp(`\\bfrom\\s+.+?\\s+(?:to|until|till|-|through)\\s+.+?(?=\\s+(?:how|tell|show|and|with|using|for|cash|gpay|food|bus|snacks|type|period|payment|top|highest|lowest|give|compare|split|breakdown|summary)\\b|$)`, "g"), " ")
    .replace(new RegExp(`\\bbetween\\s+.+?\\s+and\\s+.+?(?=\\s|$)`, "g"), " ")
    .replace(/\b(today|yesterday|this month|current month|last month|previous month|this week|last week|previous week|this year|last year|previous year|till today|until today|till now|until now|so far|month to date|mtd|all time|overall|lifetime|life time|whole life|ever)\b/g, " ")
    .replace(/\b20\d{2}-\d{1,2}-\d{1,2}\b/g, " ")
    .replace(/\b\d{1,2}[/-]\d{1,2}(?:[/-]20\d{2})?\b/g, " ")
    .replace(new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(${MONTH_PATTERN})(?:\\s+20\\d{2})?\\b`, "g"), " ")
    .replace(new RegExp(`\\b(${MONTH_PATTERN})\\s+\\d{1,2}(?:st|nd|rd|th)?(?:\\s+20\\d{2})?\\b`, "g"), " ")
    .replace(new RegExp(`\\b(${MONTH_PATTERN})(?:\\s+20\\d{2})?\\b`, "g"), " ")
    .replace(/\b20\d{2}\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
