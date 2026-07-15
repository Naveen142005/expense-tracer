import {
  formatDate,
  formatMoney,
  getExpenseAmount,
  getExpenseName,
  getItemKey,
  labelForDateRange,
  labelPayment,
  labelPeriod,
  labelType,
  parseDateString,
  roundMoney,
  toDateString,
} from "./utils.js";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function inRange(date, dateRange) {
  if (!dateRange?.startDate || !dateRange?.endDate || dateRange.source === "all-time") return true;
  return date >= dateRange.startDate && date <= dateRange.endDate;
}

export function applySemanticFilters(expenses = [], plan = {}) {
  const filters = plan.filters || {};
  const itemKeys = new Set((filters.items || []).map((item) => item.key));
  const types = new Set(filters.types || []);
  const payments = new Set(filters.paymentTypes || []);
  const periods = new Set(filters.periods || []);

  return expenses.filter((expense) => {
    if (!inRange(expense.date, plan.dateRange)) return false;
    if (itemKeys.size && !itemKeys.has(getItemKey(getExpenseName(expense)))) return false;
    if (types.size && !types.has(expense.type)) return false;
    if (payments.size && !payments.has(expense.paymentType)) return false;
    if (periods.size && !periods.has(expense.period)) return false;
    const amount = getExpenseAmount(expense);
    if (filters.minPrice !== null && filters.minPrice !== undefined && amount < filters.minPrice) return false;
    if (filters.maxPrice !== null && filters.maxPrice !== undefined && amount > filters.maxPrice) return false;
    return true;
  });
}

function mondayForDate(dateString) {
  const date = parseDateString(dateString);
  if (!date) return dateString || "unknown";
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return toDateString(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function groupIdentity(expense, groupBy) {
  if (groupBy === "item") {
    return { key: getItemKey(getExpenseName(expense)), label: getExpenseName(expense) };
  }
  if (groupBy === "date") return { key: expense.date || "unknown", label: formatDate(expense.date) };
  if (groupBy === "day-of-week") {
    const date = parseDateString(expense.date);
    const label = date ? DAY_NAMES[date.getUTCDay()] : "Unknown";
    return { key: label.toLowerCase(), label };
  }
  if (groupBy === "week") {
    const key = mondayForDate(expense.date);
    return { key, label: `Week of ${formatDate(key)}` };
  }
  if (groupBy === "month") {
    const key = String(expense.date || "").slice(0, 7) || "unknown";
    const date = key !== "unknown" ? parseDateString(`${key}-01`) : null;
    const label = date
      ? new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(date)
      : "Unknown";
    return { key, label };
  }
  if (groupBy === "period") return { key: expense.period || "other", label: labelPeriod(expense.period) };
  if (groupBy === "type") return { key: expense.type || "custom", label: labelType(expense.type) };
  if (groupBy === "payment") return { key: expense.paymentType || "cash", label: labelPayment(expense.paymentType) };
  return { key: "all", label: "All expenses" };
}

function statsForExpenses(expenses = []) {
  const amounts = expenses.map(getExpenseAmount);
  const total = roundMoney(amounts.reduce((sum, amount) => sum + amount, 0));
  const count = expenses.length;
  return {
    total,
    count,
    average: count ? roundMoney(total / count) : 0,
    min: count ? Math.min(...amounts) : 0,
    max: count ? Math.max(...amounts) : 0,
    uniqueCount: new Set(expenses.map((expense) => getItemKey(getExpenseName(expense))).filter(Boolean)).size,
  };
}

function valueForMetric(stats, metric) {
  if (metric === "count") return stats.count;
  if (metric === "average") return stats.average;
  if (metric === "min") return stats.min;
  if (metric === "max") return stats.max;
  if (metric === "unique-count") return stats.uniqueCount;
  return stats.total;
}

function groupedStats(expenses, groupBy, metric) {
  const groups = new Map();
  for (const expense of expenses) {
    const identity = groupIdentity(expense, groupBy);
    if (!identity.key) continue;
    const current = groups.get(identity.key) || { ...identity, expenses: [] };
    current.expenses.push(expense);
    groups.set(identity.key, current);
  }
  return [...groups.values()].map((group) => {
    const stats = statsForExpenses(group.expenses);
    return { key: group.key, label: group.label, ...stats, value: valueForMetric(stats, metric) };
  });
}

function sortRows(rows, direction = "desc", chronological = false) {
  if (chronological) return [...rows].sort((a, b) => a.key.localeCompare(b.key));
  return [...rows].sort((a, b) =>
    direction === "asc" ? a.value - b.value || a.label.localeCompare(b.label) : b.value - a.value || a.label.localeCompare(b.label)
  );
}

function expensesForTarget(expenses, target) {
  return expenses.filter((expense) => {
    if (target.dimension === "item") return getItemKey(getExpenseName(expense)) === target.value;
    if (target.dimension === "type") return expense.type === target.value;
    if (target.dimension === "payment") return expense.paymentType === target.value;
    if (target.dimension === "period") return expense.period === target.value;
    if (target.dimension === "date") return expense.date === target.value;
    if (target.dimension === "month") return String(expense.date || "").startsWith(target.value);
    if (target.dimension === "day-of-week") return groupIdentity(expense, "day-of-week").key === target.value;
    return false;
  });
}

function executeExpenseOperation(expenses, operation) {
  if (operation.kind === "aggregate") {
    if (operation.groupBy === "none") {
      const stats = statsForExpenses(expenses);
      return { kind: "aggregate", metric: operation.metric, groupBy: "none", stats, value: valueForMetric(stats, operation.metric) };
    }
    const rows = sortRows(groupedStats(expenses, operation.groupBy, operation.metric), operation.direction)
      .slice(0, operation.limit);
    return { kind: "aggregate", metric: operation.metric, groupBy: operation.groupBy, rows };
  }

  if (operation.kind === "rank" || operation.kind === "unique") {
    const groupBy = operation.kind === "unique" && operation.groupBy === "none" ? "item" : operation.groupBy;
    const rows = sortRows(groupedStats(expenses, groupBy, operation.metric), operation.direction)
      .slice(0, operation.limit);
    return { kind: operation.kind, metric: operation.metric, groupBy, direction: operation.direction, rows };
  }

  if (operation.kind === "compare") {
    const rows = operation.targets.map((target) => {
      const records = expensesForTarget(expenses, target);
      const stats = statsForExpenses(records);
      return {
        ...target,
        targetValue: target.value,
        ...stats,
        value: valueForMetric(stats, operation.metric),
      };
    });
    const sorted = sortRows(rows, "desc");
    const difference = sorted.length >= 2 ? roundMoney(sorted[0].value - sorted[1].value) : 0;
    const tied = sorted.length >= 2 && sorted[0].value === sorted[1].value;
    return { kind: "compare", metric: operation.metric, rows, highest: sorted[0] || null, difference, tied };
  }

  if (operation.kind === "trend") {
    const interval = operation.interval || "month";
    if (["date", "week", "month"].includes(operation.groupBy)) {
      const rows = sortRows(groupedStats(expenses, operation.groupBy, operation.metric), "asc", true);
      const first = rows[0]?.value || 0;
      const last = rows.at(-1)?.value || 0;
      const change = roundMoney(last - first);
      const percentChange = first ? roundMoney((change / first) * 100) : null;
      return { kind: "trend", metric: operation.metric, groupBy: operation.groupBy, interval, rows: rows.slice(-operation.limit), change, percentChange };
    }

    const parentGroups = new Map();
    for (const expense of expenses) {
      const identity = groupIdentity(expense, operation.groupBy);
      const current = parentGroups.get(identity.key) || { ...identity, expenses: [] };
      current.expenses.push(expense);
      parentGroups.set(identity.key, current);
    }
    const rows = [...parentGroups.values()].map((group) => {
      const series = sortRows(groupedStats(group.expenses, interval, operation.metric), "asc", true);
      const first = series[0]?.value || 0;
      const last = series.at(-1)?.value || 0;
      const change = roundMoney(last - first);
      return {
        key: group.key,
        label: group.label,
        value: change,
        change,
        percentChange: first ? roundMoney((change / first) * 100) : null,
        first,
        last,
        series,
      };
    });
    return {
      kind: "trend",
      metric: operation.metric,
      groupBy: operation.groupBy,
      interval,
      ranked: true,
      rows: sortRows(rows, operation.direction).slice(0, operation.limit),
    };
  }

  if (operation.kind === "list") {
    const rows = [...expenses]
      .sort((a, b) => {
        if (operation.metric === "min") return getExpenseAmount(a) - getExpenseAmount(b);
        if (operation.metric === "max" || operation.direction === "desc" && operation.groupBy === "item") return getExpenseAmount(b) - getExpenseAmount(a);
        return String(b.date || "").localeCompare(String(a.date || "")) || (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
      })
      .slice(0, operation.limit)
      .map((expense) => ({
        date: expense.date,
        item: getExpenseName(expense),
        type: expense.type,
        period: expense.period,
        paymentType: expense.paymentType,
        amount: getExpenseAmount(expense),
      }));
    return { kind: "list", metric: operation.metric, rows };
  }

  return null;
}

function filteredBalanceHistory(history, dateRange) {
  return history.filter((item) => inRange(item.date, dateRange));
}

function balanceHistoryStats(history) {
  const result = { added: 0, reduced: 0, cashAdded: 0, cashReduced: 0, gpayAdded: 0, gpayReduced: 0 };
  for (const item of history) {
    const amount = roundMoney(item.appliedAmount ?? item.amount ?? 0);
    const type = item.balanceType === "gpay" ? "gpay" : "cash";
    if (item.action === "add") {
      result.added = roundMoney(result.added + amount);
      result[`${type}Added`] = roundMoney(result[`${type}Added`] + amount);
    } else if (item.action === "reduce") {
      result.reduced = roundMoney(result.reduced + amount);
      result[`${type}Reduced`] = roundMoney(result[`${type}Reduced`] + amount);
    }
  }
  return result;
}

function historicalBalance(currentBalance, history, dateRange) {
  const targetDate = dateRange?.endDate;
  if (!targetDate || !currentBalance?.exists) return null;
  let cash = roundMoney(currentBalance?.cashBalance || 0);
  let gpay = roundMoney(currentBalance?.gpayBalance || 0);
  for (const item of history) {
    if (!item.date || item.date <= targetDate) continue;
    const amount = roundMoney(item.appliedAmount ?? item.amount ?? 0);
    const key = item.balanceType === "gpay" ? "gpay" : "cash";
    const reverseAmount = item.action === "add" ? -amount : item.action === "reduce" ? amount : 0;
    if (key === "gpay") gpay = roundMoney(gpay + reverseAmount);
    else cash = roundMoney(cash + reverseAmount);
  }
  return { date: targetDate, cashBalance: cash, gpayBalance: gpay, totalBalance: roundMoney(cash + gpay) };
}

function executeBalanceOperation(operation, plan, balanceHistory, currentBalance) {
  if (operation.kind === "balance-current") {
    return { kind: operation.kind, balance: currentBalance };
  }
  if (operation.kind === "balance-at-date") {
    return { kind: operation.kind, balance: historicalBalance(currentBalance, balanceHistory, plan.dateRange) };
  }
  if (operation.kind === "balance-history") {
    const rows = filteredBalanceHistory(balanceHistory, plan.dateRange);
    return {
      kind: operation.kind,
      stats: balanceHistoryStats(rows),
      rows: rows.slice(0, operation.limit),
    };
  }
  return null;
}

export function executeSemanticPlan({
  expenses = [],
  balanceHistory = [],
  currentBalance = null,
  plan,
}) {
  const filteredExpenses = applySemanticFilters(expenses, plan);
  const baseStats = statsForExpenses(filteredExpenses);
  const operationResults = plan.operations
    .map((operation) =>
      operation.kind.startsWith("balance-")
        ? executeBalanceOperation(operation, plan, balanceHistory, currentBalance)
        : operation.kind === "advice"
          ? { kind: "advice" }
          : executeExpenseOperation(filteredExpenses, operation)
    )
    .filter(Boolean);

  const rangeLabel = labelForDateRange(plan.dateRange?.startDate, plan.dateRange?.endDate, plan.dateRange?.source);
  return {
    engine: plan.engine,
    range: { ...plan.dateRange, label: rangeLabel },
    filters: plan.filters,
    baseStats,
    operationResults,
    contextSummary: {
      rangeLabel,
      count: baseStats.count,
      total: baseStats.total,
      items: plan.filters.items.map((item) => item.label),
    },
  };
}

export function semanticResultForAdvice(result) {
  return {
    range: result.range,
    filters: result.filters,
    count: result.baseStats.count,
    total: result.baseStats.total,
    formattedTotal: formatMoney(result.baseStats.total),
    operations: result.operationResults.slice(0, 10),
  };
}
