import { PAYMENT_LABELS, PERIOD_LABELS, TYPE_LABELS } from "./constants.js";
import {
  formatDate,
  formatMoney,
  labelPayment,
  labelPeriod,
  labelType,
  parseDateString,
  pluralize,
  roundMoney,
  sortObjectByValue,
} from "./utils.js";

function filtersLabel(filters = {}) {
  const parts = [];
  if ((filters.type || "all") !== "all") parts.push(labelType(filters.type));
  if ((filters.paymentType || "all") !== "all") parts.push(labelPayment(filters.paymentType));
  if ((filters.period || "all") !== "all") parts.push(labelPeriod(filters.period));
  return parts.join(" / ");
}

function subjectLabel(summary) {
  const label = filtersLabel(summary.filters);
  return label ? `${label} spending` : "spending";
}

function heading(title) {
  return `### ${title}`;
}

function bullet(label, value) {
  return `- **${label}:** ${value}`;
}

function numberedEntries(object = {}, limit = 5, labels = {}, valueFormatter = formatMoney) {
  const entries = Object.entries(object).slice(0, limit);
  if (!entries.length) return "No data found.";
  return entries
    .map(([key, value], index) => `${index + 1}. **${labels[key] || key}:** ${valueFormatter(value)}`)
    .join("\n");
}

function itemLines(items = [], limit = 5) {
  if (!items.length) return "No item data found.";
  return items
    .slice(0, limit)
    .map(
      (item, index) =>
        `${index + 1}. **${item.item}:** ${item.formattedAmount} (${item.count} ${pluralize(item.count, "time")})`
    )
    .join("\n");
}

function highestDateLine(summary, direction = "highest") {
  const entries = Object.entries(
    direction === "lowest" ? sortObjectByValue(summary.byDate, "asc") : summary.byDate
  ).filter(([date]) => date !== "unknown");
  if (!entries.length) return null;
  const [date, amount] = entries[0];
  return `${formatDate(date)} (${formatMoney(amount)})`;
}

function mostUsedPeriodLine(summary) {
  const entries = Object.entries(sortObjectByValue(summary.byPeriodCount));
  if (!entries.length) return null;
  const [period, count] = entries[0];
  return `${labelPeriod(period)} (${count} ${pluralize(count, "time")})`;
}

function topSpendingPeriodLine(summary) {
  const entries = Object.entries(summary.byPeriod);
  if (!entries.length) return null;
  const [period, amount] = entries[0];
  return `${labelPeriod(period)} (${formatMoney(amount)})`;
}

function deterministicSuggestion(summary) {
  if (!summary.count) return "Add more expenses first, then I can suggest where to reduce spending.";
  const topItem = summary.topItems[0];
  const topType = Object.entries(summary.byType)[0];
  if (topItem && topItem.amount >= summary.total * 0.25) {
    return `Your biggest item is **${topItem.item}** (${topItem.formattedAmount}). Try planning or reducing this item first.`;
  }
  if (topType) {
    return `Your highest category is **${labelType(topType[0])}** (${formatMoney(topType[1])}). Review that category first for possible savings.`;
  }
  return "Track small repeated expenses carefully; they usually become the easiest place to save money.";
}

function buildSpendOverview(summary, title) {
  return [
    heading(title),
    "",
    bullet("Total spend", summary.formattedTotal),
    bullet("Cash", summary.formattedCashTotal),
    bullet("GPay", summary.formattedGPayTotal),
    bullet("Entries", summary.count),
  ].join("\n");
}

export function buildBalanceReply(balance) {
  if (!balance.exists) return "I couldn't find your current balance record yet.";

  const lines = [heading("Current balance")];
  if (balance.gpayBalance > 0) {
    lines.push(
      "",
      bullet("Total balance", formatMoney(balance.totalBalance)),
      bullet("Cash", formatMoney(balance.cashBalance)),
      bullet("GPay", formatMoney(balance.gpayBalance))
    );
  } else {
    lines.push("", bullet("Cash balance", formatMoney(balance.cashBalance)));
  }
  return lines.join("\n");
}

export function buildBalanceHistoryReply(summary, intent = "balance-history") {
  if (intent === "balance-added") {
    return [
      heading(`Balance added for ${summary.range.label}`),
      "",
      bullet("Total added", summary.formattedAdded),
      bullet("Cash added", summary.formattedCashAdded),
      bullet("GPay added", summary.formattedGPayAdded),
    ].join("\n");
  }

  if (intent === "balance-reduced") {
    return [
      heading(`Balance reduced for ${summary.range.label}`),
      "",
      bullet("Total reduced", summary.formattedReduced),
      bullet("Cash reduced", summary.formattedCashReduced),
      bullet("GPay reduced", summary.formattedGPayReduced),
    ].join("\n");
  }

  if (!summary.count) return `I couldn't find any balance history records for **${summary.range.label}**.`;

  const lines = summary.recent.slice(0, 6).map((item) => {
    const action = item.action === "add" ? "Added" : item.action === "reduce" ? "Reduced" : "Updated";
    const type = labelPayment(item.balanceType || "cash");
    const amount = formatMoney(item.appliedAmount ?? item.amount ?? 0);
    const newBalance = item.newBalance !== undefined && item.newBalance !== null ? ` New ${type}: ${formatMoney(item.newBalance)}.` : "";
    return `- **${formatDate(item.date)}:** ${action} ${amount} ${item.action === "add" ? "to" : "from"} ${type}.${newBalance}`;
  });

  return [heading(`Balance history for ${summary.range.label}`), "", ...lines].join("\n");
}

function buildMetricsSummaryReply(summary, plan) {
  if (!summary.count) return `I couldn't find any ${subjectLabel(summary).toLowerCase()} for **${summary.range.label}**.`;

  const lines = [
    heading(`Spending for ${summary.range.label}`),
    "",
    bullet("Total spend", summary.formattedTotal),
    bullet("Cash", summary.formattedCashTotal),
    bullet("GPay", summary.formattedGPayTotal),
    bullet("Entries", summary.count),
  ];

  if (plan.metrics.has("top")) {
    lines.push("", `**Top ${summary.topLimit} items**`, itemLines(summary.topItems, summary.topLimit));
  }

  if (plan.metrics.has("dateBreakdown")) {
    const highestDate = highestDateLine(summary);
    if (highestDate) lines.push("", bullet("Highest spending date", highestDate));
  }

  if (plan.metrics.has("periodBreakdown")) {
    const mostUsed = mostUsedPeriodLine(summary);
    const topSpending = topSpendingPeriodLine(summary);
    if (/\bmost used period\b/.test(plan.normalizedMessage) && mostUsed) {
      lines.push(bullet("Most used period", mostUsed));
    } else if (topSpending) {
      lines.push(bullet("Highest spending period", topSpending));
    }
  }

  if (plan.metrics.has("typeBreakdown")) {
    lines.push("", "**Type-wise spend**", numberedEntries(summary.byType, 8, TYPE_LABELS));
  }

  if (plan.metrics.has("paymentBreakdown")) {
    lines.push("", "**Payment-wise spend**", numberedEntries(summary.byPaymentType, 5, PAYMENT_LABELS));
  }

  if (plan.metrics.has("advice")) {
    lines.push("", "**Suggestion**", deterministicSuggestion(summary));
  }

  return lines.join("\n");
}

function buildItemListReply(summary, plan) {
  if (!summary.count) return `I couldn't find any expense records for **${summary.range.label}**.`;

  const lines = [
    heading(`Items spent on for ${summary.range.label}`),
    "",
    bullet("Total spend", summary.formattedTotal),
    bullet("Cash", summary.formattedCashTotal),
    bullet("GPay", summary.formattedGPayTotal),
    bullet("Entries", summary.count),
    "",
    "**Items**",
  ];

  const isSingleDay = summary.range.startDate && summary.range.startDate === summary.range.endDate;

  if (isSingleDay) {
    const expenses = [...summary.recentExpenses].reverse();
    for (const expense of expenses.slice(0, 25)) {
      lines.push(`- **${expense.item}:** ${expense.formattedPrice} (${expense.paymentType})`);
    }
  } else {
    const limit = plan.topLimit || 20;
    for (const item of summary.topItems.slice(0, limit)) {
      lines.push(`- **${item.item}:** ${item.formattedAmount} (${item.count} ${pluralize(item.count, "time")})`);
    }
  }

  return lines.join("\n");
}

function buildItemReply(summary, plan) {
  const item = summary.focusedItem;
  if (!item) return null;

  if (!item.count) return `I couldn't find any **${item.item}** expense for **${summary.range.label}**.`;

  if (plan.intent === "item-count") {
    return [
      heading(`${item.item} count for ${summary.range.label}`),
      "",
      bullet("Times", item.count),
      bullet("Total amount", item.formattedAmount),
    ].join("\n");
  }

  if (/\bwhich dates|dates|date\b/.test(plan.normalizedMessage) && plan.followUp) {
    const lines = Object.entries(item.dateAmounts)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(
        ([date, amount]) =>
          `- **${formatDate(date)}:** ${formatMoney(amount)} (${item.dates[date]} ${pluralize(item.dates[date], "time")})`
      )
      .join("\n");
    return [heading(`${item.item} dates for ${summary.range.label}`), "", lines].join("\n");
  }

  if (/\bcash or gpay|payment|cash|gpay\b/.test(plan.normalizedMessage) && plan.followUp) {
    return [
      heading(`${item.item} payment split for ${summary.range.label}`),
      "",
      bullet("Cash", `${formatMoney(item.paymentTotals.cash || 0)} (${item.paymentCounts.cash || 0} ${pluralize(item.paymentCounts.cash || 0, "time")})`),
      bullet("GPay", `${formatMoney(item.paymentTotals.gpay || 0)} (${item.paymentCounts.gpay || 0} ${pluralize(item.paymentCounts.gpay || 0, "time")})`),
    ].join("\n");
  }

  return [
    heading(`${item.item} spending for ${summary.range.label}`),
    "",
    bullet("Total amount", item.formattedAmount),
    bullet("Times", item.count),
    bullet("Cash", formatMoney(item.paymentTotals.cash || 0)),
    bullet("GPay", formatMoney(item.paymentTotals.gpay || 0)),
  ].join("\n");
}

function buildRankReply(summary, plan) {
  const isLowest = plan.intent.startsWith("lowest-");
  const dimension = plan.intent.replace("top-", "").replace("lowest-", "");
  const direction = isLowest ? "asc" : "desc";
  const rankWord = isLowest ? "lowest" : "highest";
  const limit = plan.topLimit || 5;

  if (!summary.count) return `I couldn't find any expense records for **${summary.range.label}**.`;

  if (dimension === "item") {
    const items = [...summary.topItems]
      .sort((a, b) => (direction === "asc" ? a.amount - b.amount : b.amount - a.amount))
      .slice(0, limit);
    const title = limit === 1 ? `Your ${rankWord} spending item for ${summary.range.label}` : `Your ${rankWord} spending items for ${summary.range.label}`;
    return [heading(title), "", itemLines(items, limit)].join("\n");
  }

  if (dimension === "date") {
    const object = sortObjectByValue(summary.byDate, direction);
    const lines = Object.entries(object)
      .slice(0, limit)
      .map(([date, amount], index) => `${index + 1}. **${formatDate(date)}:** ${formatMoney(amount)}`)
      .join("\n");
    return [heading(`Your ${rankWord} spending dates for ${summary.range.label}`), "", lines].join("\n");
  }

  if (dimension === "period") {
    return [heading(`Your ${rankWord} spending periods for ${summary.range.label}`), "", numberedEntries(sortObjectByValue(summary.byPeriod, direction), limit, PERIOD_LABELS)].join("\n");
  }
  if (dimension === "payment") {
    return [heading(`Your ${rankWord} payment spending for ${summary.range.label}`), "", numberedEntries(sortObjectByValue(summary.byPaymentType, direction), limit, PAYMENT_LABELS)].join("\n");
  }
  return [heading(`Your ${rankWord} spending types for ${summary.range.label}`), "", numberedEntries(sortObjectByValue(summary.byType, direction), limit, TYPE_LABELS)].join("\n");
}

function buildCountReply(summary) {
  if (!summary.count) return `I couldn't find any ${subjectLabel(summary).toLowerCase()} records for **${summary.range.label}**.`;
  return [
    heading(`Expense count for ${summary.range.label}`),
    "",
    bullet("Entries", `${summary.count} ${pluralize(summary.count, "entry", "entries")}`),
    bullet("Total spend", summary.formattedTotal),
    bullet("Cash", summary.formattedCashTotal),
    bullet("GPay", summary.formattedGPayTotal),
  ].join("\n");
}

function buildRecentReply(summary) {
  if (!summary.recentExpenses.length) return `I couldn't find any recent expenses for **${summary.range.label}**.`;
  const lines = summary.recentExpenses
    .slice(0, 10)
    .map((expense) => `- **${formatDate(expense.date)}:** ${expense.formattedPrice} for ${expense.item} (${expense.paymentType})`);
  return [heading(`Recent expenses for ${summary.range.label}`), "", lines.join("\n")].join("\n");
}

function buildAverageReply(summary) {
  if (!summary.count) return `I couldn't find any expense records for **${summary.range.label}**.`;
  let days = 1;
  if (summary.range.source === "all-time") {
    days = Math.max(1, Object.keys(summary.byDate).filter((date) => date !== "unknown").length);
  } else {
    const start = parseDateString(summary.range.startDate);
    const end = parseDateString(summary.range.endDate);
    days = Math.max(1, Math.round((end - start) / 86400000) + 1);
  }
  const averagePerDay = roundMoney(summary.total / days);
  const averagePerEntry = roundMoney(summary.total / summary.count);
  return [
    heading(`Average spending for ${summary.range.label}`),
    "",
    bullet("Per day", formatMoney(averagePerDay)),
    bullet("Per expense entry", formatMoney(averagePerEntry)),
    bullet("Total spend", summary.formattedTotal),
  ].join("\n");
}

function valueForTarget(summary, target) {
  if (target.dimension === "type") return summary.byType[target.key] || 0;
  if (target.dimension === "payment") return summary.byPaymentType[target.key] || 0;
  if (target.dimension === "period") return summary.byPeriod[target.key] || 0;
  if (target.dimension === "item") {
    const item = summary.topItems.find((entry) => entry.key === target.key);
    return item?.amount || 0;
  }
  return 0;
}

function labelForTarget(target) {
  if (target.dimension === "type") return labelType(target.key);
  if (target.dimension === "payment") return labelPayment(target.key);
  if (target.dimension === "period") return labelPeriod(target.key);
  return target.label || target.key;
}

function buildCompareReply(summary, plan) {
  const targets = plan.compareTargets.slice(0, 6);
  if (targets.length < 2) return null;
  const groups = targets.map((target) => ({
    ...target,
    amount: roundMoney(valueForTarget(summary, target)),
    displayLabel: labelForTarget(target),
  }));
  const highest = [...groups].sort((a, b) => b.amount - a.amount)[0];
  const lines = groups.map((target) => bullet(target.displayLabel, formatMoney(target.amount)));
  return [heading(`Comparison for ${summary.range.label}`), "", ...lines, "", bullet("Highest", `${highest.displayLabel} (${formatMoney(highest.amount)})`)].join("\n");
}

export function buildDeterministicReply(summary, plan) {
  if (plan.intent === "compare") return buildCompareReply(summary, plan);

  const itemReply = buildItemReply(summary, plan);
  if (itemReply) return itemReply;
  if (plan.intent === "item-list") return buildItemListReply(summary, plan);
  if (plan.intent === "recent") return buildRecentReply(summary);
  if (plan.intent === "average") return buildAverageReply(summary);
  if (plan.intent.startsWith("top-") || plan.intent.startsWith("lowest-")) return buildRankReply(summary, plan);
  if (plan.intent === "count") return buildCountReply(summary);
  if (plan.intent === "metrics-summary" || plan.intent === "summary" || plan.intent === "advice") return buildMetricsSummaryReply(summary, plan);

  if (!summary.count) return `I couldn't find any ${subjectLabel(summary).toLowerCase()} for **${summary.range.label}**.`;
  return buildSpendOverview(summary, `Spending for ${summary.range.label}`);
}

export function compactSummaryForLlama(summary) {
  return {
    range: summary.range,
    filters: summary.filters,
    count: summary.count,
    total: summary.total,
    cashTotal: summary.cashTotal,
    gpayTotal: summary.gpayTotal,
    byType: summary.byType,
    byPaymentType: summary.byPaymentType,
    byPeriod: summary.byPeriod,
    byPeriodCount: summary.byPeriodCount,
    byDate: Object.fromEntries(Object.entries(summary.byDate).slice(0, 10)),
    topItems: summary.topItems.slice(0, 8),
  };
}
