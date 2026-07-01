import { MONTH_NAMES, PAYMENT_LABELS, PERIOD_LABELS, TYPE_LABELS } from "./constants.js";

export function normalizeMessage(message) {
  return String(message || "")
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[’`]/g, "'")
    .replace(/₹/g, " rupees ")
    .replace(/[^a-z0-9\s'./:-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function toNumber(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

export function roundMoney(value) {
  return Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;
}

export function formatMoney(value) {
  return `₹${roundMoney(value).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export function pad2(value) {
  return String(value).padStart(2, "0");
}

export function toDateString(year, month, day) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function parseDateString(dateString) {
  const value = String(dateString || "");
  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
  const dmy = value.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmy) return new Date(Date.UTC(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1])));
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function normalizeDateValue(value) {
  if (!value) return "";
  if (typeof value === "string") {
    const trimmed = value.trim();
    const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (iso) return toDateString(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    const dmy = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (dmy) return toDateString(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]));
  }
  if (value?.toDate) {
    const date = value.toDate();
    return toDateString(date.getFullYear(), date.getMonth() + 1, date.getDate());
  }
  if (value instanceof Date) return toDateString(value.getFullYear(), value.getMonth() + 1, value.getDate());
  return String(value);
}

export function addDays(dateString, days) {
  const date = parseDateString(dateString);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateString(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function compareDateStrings(left, right) {
  return String(left || "").localeCompare(String(right || ""));
}

export function getDaysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function getKolkataTodayParts() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date()).map((part) => [part.type, part.value])
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    dateString: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

export function getMonthRange(year, month, endAtToday = false) {
  const today = getKolkataTodayParts();
  const endDay =
    endAtToday && today.year === year && today.month === month
      ? today.day
      : getDaysInMonth(year, month);

  return {
    startDate: toDateString(year, month, 1),
    endDate: toDateString(year, month, endDay),
  };
}

export function getWeekRange(todayString, offsetWeeks = 0, endAtToday = false) {
  const date = parseDateString(todayString);
  const day = date.getUTCDay() || 7;
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() - day + 1 + offsetWeeks * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  const startDate = toDateString(
    monday.getUTCFullYear(),
    monday.getUTCMonth() + 1,
    monday.getUTCDate()
  );
  const naturalEndDate = toDateString(
    sunday.getUTCFullYear(),
    sunday.getUTCMonth() + 1,
    sunday.getUTCDate()
  );

  return {
    startDate,
    endDate: endAtToday ? todayString : naturalEndDate,
  };
}

export function isFullMonthRange(startDate, endDate) {
  const start = parseDateString(startDate);
  const end = parseDateString(endDate);
  if (!start || !end) return false;
  return (
    start.getUTCDate() === 1 &&
    start.getUTCFullYear() === end.getUTCFullYear() &&
    start.getUTCMonth() === end.getUTCMonth() &&
    end.getUTCDate() === getDaysInMonth(end.getUTCFullYear(), end.getUTCMonth() + 1)
  );
}

export function isYearRange(startDate, endDate) {
  const start = parseDateString(startDate);
  const end = parseDateString(endDate);
  if (!start || !end) return false;
  return (
    start.getUTCMonth() === 0 &&
    start.getUTCDate() === 1 &&
    end.getUTCMonth() === 11 &&
    end.getUTCDate() === 31 &&
    start.getUTCFullYear() === end.getUTCFullYear()
  );
}

export function formatDate(dateString) {
  const date = parseDateString(dateString);
  if (!date) return String(dateString || "unknown date");
  return `${date.getUTCDate()} ${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

export function labelForDateRange(startDate, endDate, source = "custom") {
  if (!startDate && !endDate) return "all time";
  if (startDate === endDate) return formatDate(startDate);
  if (source === "month-to-date") return `${formatDate(startDate)} to ${formatDate(endDate)}`;
  if (isFullMonthRange(startDate, endDate)) {
    const date = parseDateString(startDate);
    return `${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
  }
  if (isYearRange(startDate, endDate)) return String(parseDateString(startDate).getUTCFullYear());
  return `${formatDate(startDate)} to ${formatDate(endDate)}`;
}

export function getExpenseName(expense) {
  if (expense.type === "bus") return String(expense.description || expense.name || "Bus").trim() || "Bus";
  return String(expense.name || expense.description || TYPE_LABELS[expense.type] || "Expense").trim() || "Expense";
}

export function getExpenseAmount(expense = {}) {
  return roundMoney(expense.price ?? expense.amount ?? expense.total ?? 0);
}

export function getItemKey(itemName) {
  return normalizeMessage(itemName)
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function labelType(key) {
  return TYPE_LABELS[key] || key || "Type";
}

export function labelPayment(key) {
  return PAYMENT_LABELS[key] || key || "Payment";
}

export function labelPeriod(key) {
  return PERIOD_LABELS[key] || key || "Period";
}

export function addToMap(map, key, amount) {
  const cleanKey = key || "other";
  map[cleanKey] = roundMoney((map[cleanKey] || 0) + amount);
}

export function addCountToMap(map, key, count = 1) {
  const cleanKey = key || "other";
  map[cleanKey] = (map[cleanKey] || 0) + count;
}

export function sortObjectByValue(object = {}, direction = "desc") {
  return Object.fromEntries(
    Object.entries(object).sort((a, b) =>
      direction === "asc" ? a[1] - b[1] : b[1] - a[1]
    )
  );
}

export function pluralize(value, singular, plural = `${singular}s`) {
  return Number(value) === 1 ? singular : plural;
}
