import { labelForDateRange } from "./utils.js";
import {
  addCountToMap,
  addToMap,
  compareDateStrings,
  formatMoney,
  getExpenseAmount,
  getExpenseName,
  getItemKey,
  labelPayment,
  labelPeriod,
  labelType,
  pluralize,
  roundMoney,
  sortObjectByValue,
} from "./utils.js";

export function applyFilters(expenses, filters = {}) {
  return expenses.filter((expense) => {
    if ((filters.type || "all") !== "all" && expense.type !== filters.type) return false;
    if ((filters.paymentType || "all") !== "all" && expense.paymentType !== filters.paymentType) return false;
    if ((filters.period || "all") !== "all" && expense.period !== filters.period) return false;
    return true;
  });
}

function buildItemStats(expenses) {
  const itemMap = new Map();

  for (const expense of expenses) {
    const item = getExpenseName(expense);
    const key = getItemKey(item);
    if (!key) continue;

    const amount = getExpenseAmount(expense);
    const current = itemMap.get(key) || {
      key,
      item,
      amount: 0,
      count: 0,
      dates: {},
      dateAmounts: {},
      paymentTotals: {},
      paymentCounts: {},
      records: [],
    };

    current.amount = roundMoney(current.amount + amount);
    current.count += 1;
    addCountToMap(current.dates, expense.date || "unknown", 1);
    addToMap(current.dateAmounts, expense.date || "unknown", amount);
    addToMap(current.paymentTotals, expense.paymentType || "cash", amount);
    addCountToMap(current.paymentCounts, expense.paymentType || "cash", 1);
    current.records.push({
      date: expense.date,
      item,
      period: expense.period,
      type: expense.type,
      paymentType: expense.paymentType,
      price: amount,
    });
    itemMap.set(key, current);
  }

  return [...itemMap.values()].sort((a, b) => b.amount - a.amount || b.count - a.count);
}

function recentExpenses(expenses, limit = 25) {
  return [...expenses]
    .sort((a, b) => {
      const dateCompare = compareDateStrings(b.date, a.date);
      if (dateCompare !== 0) return dateCompare;
      return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
    })
    .slice(0, limit)
    .map((expense) => ({
      date: expense.date,
      period: labelPeriod(expense.period),
      type: labelType(expense.type),
      item: getExpenseName(expense),
      paymentType: labelPayment(expense.paymentType),
      price: getExpenseAmount(expense),
      formattedPrice: formatMoney(getExpenseAmount(expense)),
    }));
}

export function buildExpenseSummary(rawExpenses, plan) {
  const expenses = applyFilters(rawExpenses, plan.filters);
  const byType = {};
  const byTypeCount = {};
  const byPaymentType = {};
  const byPaymentCount = {};
  const byPeriod = {};
  const byPeriodCount = {};
  const byDate = {};
  const byDateCount = {};

  let total = 0;
  let cashTotal = 0;
  let gpayTotal = 0;

  for (const expense of expenses) {
    const amount = getExpenseAmount(expense);
    total = roundMoney(total + amount);
    if (expense.paymentType === "cash") cashTotal = roundMoney(cashTotal + amount);
    if (expense.paymentType === "gpay") gpayTotal = roundMoney(gpayTotal + amount);

    addToMap(byType, expense.type || "custom", amount);
    addCountToMap(byTypeCount, expense.type || "custom");
    addToMap(byPaymentType, expense.paymentType || "cash", amount);
    addCountToMap(byPaymentCount, expense.paymentType || "cash");
    addToMap(byPeriod, expense.period || "other", amount);
    addCountToMap(byPeriodCount, expense.period || "other");
    addToMap(byDate, expense.date || "unknown", amount);
    addCountToMap(byDateCount, expense.date || "unknown");
  }

  const itemStats = buildItemStats(expenses);
  const focusedItem = plan.focusItem
    ? itemStats.find((item) => item.key === plan.focusItem.key) || {
        key: plan.focusItem.key,
        item: plan.focusItem.item || plan.focusItem.key,
        amount: 0,
        count: 0,
        dates: {},
        dateAmounts: {},
        paymentTotals: {},
        paymentCounts: {},
        records: [],
      }
    : null;

  const range = {
    startDate: plan.dateRange.startDate,
    endDate: plan.dateRange.endDate,
    source: plan.dateRange.source,
    label: labelForDateRange(plan.dateRange.startDate, plan.dateRange.endDate, plan.dateRange.source),
  };

  return {
    intent: plan.intent,
    metrics: [...plan.metrics],
    range,
    filters: plan.filters,
    count: expenses.length,
    total: roundMoney(total),
    formattedTotal: formatMoney(total),
    cashTotal: roundMoney(cashTotal),
    formattedCashTotal: formatMoney(cashTotal),
    gpayTotal: roundMoney(gpayTotal),
    formattedGPayTotal: formatMoney(gpayTotal),
    byType: sortObjectByValue(byType),
    byTypeCount: sortObjectByValue(byTypeCount),
    byPaymentType: sortObjectByValue(byPaymentType),
    byPaymentCount: sortObjectByValue(byPaymentCount),
    byPeriod: sortObjectByValue(byPeriod),
    byPeriodCount: sortObjectByValue(byPeriodCount),
    byDate: sortObjectByValue(byDate),
    byDateCount: sortObjectByValue(byDateCount),
    topItems: itemStats.slice(0, 20).map((item) => ({
      key: item.key,
      item: item.item,
      amount: roundMoney(item.amount),
      formattedAmount: formatMoney(item.amount),
      count: item.count,
      paymentTotals: item.paymentTotals,
      paymentCounts: item.paymentCounts,
      dates: item.dates,
      dateAmounts: item.dateAmounts,
    })),
    focusedItem: focusedItem
      ? {
          key: focusedItem.key,
          item: focusedItem.item,
          amount: roundMoney(focusedItem.amount),
          formattedAmount: formatMoney(focusedItem.amount),
          count: focusedItem.count,
          dates: focusedItem.dates,
          dateAmounts: focusedItem.dateAmounts,
          paymentTotals: focusedItem.paymentTotals,
          paymentCounts: focusedItem.paymentCounts,
          records: focusedItem.records.slice(0, 25),
        }
      : null,
    recentExpenses: recentExpenses(expenses, 25),
    topLimit: plan.topLimit || 5,
    rawCountBeforeFilters: rawExpenses.length,
  };
}

export function filterBalanceHistory(items, dateRange) {
  return items.filter((item) => {
    if (!item.date) return false;
    if (dateRange?.source === "all-time" || !dateRange?.startDate || !dateRange?.endDate) return true;
    return item.date >= dateRange.startDate && item.date <= dateRange.endDate;
  });
}

export function buildBalanceHistorySummary(items, plan) {
  const filtered = filterBalanceHistory(items, plan.dateRange);
  let added = 0;
  let reduced = 0;
  let cashAdded = 0;
  let cashReduced = 0;
  let gpayAdded = 0;
  let gpayReduced = 0;

  for (const item of filtered) {
    const amount = roundMoney(item.appliedAmount ?? item.amount ?? 0);
    if (item.action === "add") {
      added = roundMoney(added + amount);
      if (item.balanceType === "gpay") gpayAdded = roundMoney(gpayAdded + amount);
      else cashAdded = roundMoney(cashAdded + amount);
    }
    if (item.action === "reduce") {
      reduced = roundMoney(reduced + amount);
      if (item.balanceType === "gpay") gpayReduced = roundMoney(gpayReduced + amount);
      else cashReduced = roundMoney(cashReduced + amount);
    }
  }

  return {
    range: {
      startDate: plan.dateRange.startDate,
      endDate: plan.dateRange.endDate,
      source: plan.dateRange.source,
      label: labelForDateRange(plan.dateRange.startDate, plan.dateRange.endDate, plan.dateRange.source),
    },
    count: filtered.length,
    added,
    formattedAdded: formatMoney(added),
    reduced,
    formattedReduced: formatMoney(reduced),
    cashAdded,
    formattedCashAdded: formatMoney(cashAdded),
    cashReduced,
    formattedCashReduced: formatMoney(cashReduced),
    gpayAdded,
    formattedGPayAdded: formatMoney(gpayAdded),
    gpayReduced,
    formattedGPayReduced: formatMoney(gpayReduced),
    recent: filtered.slice(0, 8),
  };
}

export function countLabel(count) {
  return `${count} ${pluralize(count, "entry", "entries")}`;
}
