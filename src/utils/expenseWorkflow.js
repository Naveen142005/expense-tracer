import { EXPENSE_TYPES, PAYMENT_TYPES, PERIODS } from "./constants.js";

const VALID_PERIODS = new Set(PERIODS.map((period) => period.value));
const VALID_TYPES = new Set(EXPENSE_TYPES.map((type) => type.value));
const VALID_PAYMENTS = new Set(
  PAYMENT_TYPES.map((paymentType) => paymentType.value)
);

export function normalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

export function getExpenseLabel(item = {}) {
  return normalizeText(item.type === "bus" ? item.description : item.name);
}

export function sanitizeExpenseItem(item = {}, status = item.status) {
  const type = normalizeText(item.type).toLowerCase();
  const cleanItem = {
    period: normalizeText(item.period).toLowerCase(),
    type,
    name: type === "bus" ? "" : normalizeText(item.name),
    description: type === "bus" ? normalizeText(item.description) : "",
    customCategory:
      type === "custom" ? normalizeText(item.customCategory) : "",
    price: Number(item.price),
    paymentType: normalizeText(item.paymentType).toLowerCase(),
  };

  if (status) cleanItem.status = status;
  return cleanItem;
}

export function validateExpenseItem(item = {}) {
  const cleanItem = sanitizeExpenseItem(item);

  if (!VALID_PERIODS.has(cleanItem.period)) {
    return "Select a valid period.";
  }

  if (!VALID_TYPES.has(cleanItem.type)) {
    return "Select a valid expense type.";
  }

  if (!VALID_PAYMENTS.has(cleanItem.paymentType)) {
    return "Select a valid payment type.";
  }

  if (!Number.isFinite(cleanItem.price) || cleanItem.price <= 0) {
    return "Enter a valid price greater than zero.";
  }

  if (cleanItem.type === "bus" && !cleanItem.description) {
    return "Enter a description for the bus expense.";
  }

  if (cleanItem.type !== "bus" && !cleanItem.name) {
    return "Enter an item name.";
  }

  if (cleanItem.type === "custom" && !cleanItem.customCategory) {
    return "Enter a custom category.";
  }

  return "";
}

export function isRecentDuplicate(
  candidate,
  existingItem,
  windowMs = 5000,
  now = Date.now()
) {
  const candidateItem = sanitizeExpenseItem(candidate);
  const savedItem = sanitizeExpenseItem(existingItem);
  const addedAt = Number(existingItem?.draftAddedAt);

  if (!Number.isFinite(addedAt) || now - addedAt > windowMs) return false;

  return (
    candidateItem.period === savedItem.period &&
    candidateItem.type === savedItem.type &&
    candidateItem.paymentType === savedItem.paymentType &&
    candidateItem.price === savedItem.price &&
    candidateItem.name.toLowerCase() === savedItem.name.toLowerCase() &&
    candidateItem.description.toLowerCase() ===
      savedItem.description.toLowerCase() &&
    candidateItem.customCategory.toLowerCase() ===
      savedItem.customCategory.toLowerCase()
  );
}

function searchScore(label, search) {
  if (!search) return 100;

  const normalizedLabel = label.toLowerCase();
  if (normalizedLabel === search) return 400;
  if (normalizedLabel.startsWith(search)) return 300;
  if (normalizedLabel.includes(search)) return 200;
  return -1;
}

export function filterSavedRecommendations({
  recommendations = [],
  type,
  query = "",
  limit = 8,
}) {
  const search = normalizeText(query).toLowerCase();

  return recommendations
    .filter(
      (recommendation) =>
        recommendation.type === type && normalizeText(recommendation.label)
    )
    .map((recommendation) => {
      const label = normalizeText(recommendation.label);
      return {
        ...recommendation,
        label,
        score: searchScore(label, search),
      };
    })
    .filter((recommendation) => recommendation.score >= 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.label.localeCompare(b.label, undefined, { sensitivity: "base" })
    )
    .slice(0, limit);
}

export function filterExpenseTemplates({
  templates = [],
  period,
  type,
  query = "",
  limit = 8,
}) {
  const search = normalizeText(query).toLowerCase();

  return templates
    .filter(
      (template) => template.period === period && template.type === type
    )
    .map((template) => {
      const label = getExpenseLabel(template);
      return {
        ...template,
        score: searchScore(label, search),
      };
    })
    .filter((template) => template.score >= 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        getExpenseLabel(a).localeCompare(getExpenseLabel(b), undefined, {
          sensitivity: "base",
        })
    )
    .slice(0, limit);
}
