export function getTodayDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function formatDisplayDate(dateString) {
  if (!dateString) return "-";

  const [year, month, day] = dateString.split("-");

  if (!year || !month || !day) return dateString;

  return `${day}-${month}-${year}`;
}

export function getCurrentMonthKey() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

export function getCurrentYear() {
  return String(new Date().getFullYear());
}

export function isSameMonth(dateString, monthKey) {
  return dateString?.startsWith(monthKey);
}

export function isSameYear(dateString, year) {
  return dateString?.startsWith(year);
}

export function getMonthKeyFromDate(dateString) {
  if (!dateString) return "unknown";
  return dateString.slice(0, 7);
}

export function isDateInRange(dateString, startDate, endDate) {
  if (!dateString) return false;

  if (startDate && dateString < startDate) {
    return false;
  }

  if (endDate && dateString > endDate) {
    return false;
  }

  return true;
}