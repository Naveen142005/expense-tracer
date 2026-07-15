import {
  formatDate,
  formatMoney,
  labelPayment,
  labelPeriod,
  labelType,
  pluralize,
} from "./utils.js";

function metricLabel(metric) {
  if (metric === "count") return "Count";
  if (metric === "average") return "Average";
  if (metric === "min") return "Minimum";
  if (metric === "max") return "Maximum";
  if (metric === "unique-count") return "Unique items";
  return "Amount";
}

function formatMetric(value, metric) {
  if (["count", "unique-count"].includes(metric)) return String(value);
  return formatMoney(value);
}

function labelTarget(row) {
  const targetValue = row.targetValue ?? row.value;
  if (row.dimension === "type") return labelType(targetValue);
  if (row.dimension === "payment") return labelPayment(targetValue);
  if (row.dimension === "period") return labelPeriod(targetValue);
  return row.label || row.value;
}

function filterDescription(filters = {}) {
  const parts = [];
  if (filters.items?.length) parts.push(`items: ${filters.items.map((item) => item.label).join(", ")}`);
  if (filters.types?.length) parts.push(`types: ${filters.types.map(labelType).join(", ")}`);
  if (filters.paymentTypes?.length) parts.push(`payments: ${filters.paymentTypes.map(labelPayment).join(", ")}`);
  if (filters.periods?.length) parts.push(`periods: ${filters.periods.map(labelPeriod).join(", ")}`);
  if (filters.minPrice !== null && filters.minPrice !== undefined) parts.push(`minimum price: ${formatMoney(filters.minPrice)}`);
  if (filters.maxPrice !== null && filters.maxPrice !== undefined) parts.push(`maximum price: ${formatMoney(filters.maxPrice)}`);
  return parts.join("; ");
}

function aggregateReply(operation, rangeLabel) {
  if (operation.groupBy === "none") {
    const value = formatMetric(operation.value, operation.metric);
    const lines = [`### ${metricLabel(operation.metric)} for ${rangeLabel}`, "", `- **${metricLabel(operation.metric)}:** ${value}`];
    if (operation.metric !== "count") lines.push(`- **Entries:** ${operation.stats.count}`);
    return lines.join("\n");
  }
  if (!operation.rows.length) return `### ${metricLabel(operation.metric)} by ${operation.groupBy}\n\nNo matching data found.`;
  const rows = operation.rows.map(
    (row, index) => `${index + 1}. **${row.label}:** ${formatMetric(row.value, operation.metric)}${operation.metric === "amount" ? ` (${row.count} ${pluralize(row.count, "entry", "entries")})` : ""}`
  );
  return [`### ${metricLabel(operation.metric)} by ${operation.groupBy} for ${rangeLabel}`, "", ...rows].join("\n");
}

function rankReply(operation, rangeLabel) {
  const rankWord = operation.direction === "asc" ? "Lowest" : "Highest";
  if (!operation.rows.length) return `### ${rankWord} ${operation.groupBy}\n\nNo matching data found.`;
  const rows = operation.rows.map(
    (row, index) => `${index + 1}. **${row.label}:** ${formatMetric(row.value, operation.metric)}${operation.metric === "amount" ? ` (${row.count} ${pluralize(row.count, "entry", "entries")})` : ""}`
  );
  return [`### ${rankWord} ${operation.groupBy} by ${metricLabel(operation.metric).toLowerCase()} for ${rangeLabel}`, "", ...rows].join("\n");
}

function compareReply(operation, rangeLabel) {
  if (operation.rows.length < 2) return "I need at least two valid targets to make a comparison.";
  if (operation.rows.every((row) => row.count === 0)) {
    return [
      `### Comparison by ${metricLabel(operation.metric).toLowerCase()} for ${rangeLabel}`,
      "",
      `I couldn't find submitted expense records for **${operation.rows.map(labelTarget).join("** or **")}** in this period.`,
    ].join("\n");
  }
  const lines = operation.rows.map((row) =>
    `- **${labelTarget(row)}:** ${row.count === 0 ? "No submitted records" : formatMetric(row.value, operation.metric)}`
  );
  if (operation.tied) {
    lines.push("", `- **Result:** They are equal by ${metricLabel(operation.metric).toLowerCase()}.`);
  } else if (operation.highest) {
    lines.push(
      "",
      `- **Higher:** ${labelTarget(operation.highest)}`,
      `- **Difference:** ${formatMetric(operation.difference, operation.metric)}`
    );
  }
  return [`### Comparison by ${metricLabel(operation.metric).toLowerCase()} for ${rangeLabel}`, "", ...lines].join("\n");
}

function trendReply(operation, rangeLabel) {
  if (!operation.rows.length) return `### Trend for ${rangeLabel}\n\nNo matching data found.`;
  if (operation.ranked) {
    const rows = operation.rows.map((row, index) => {
      const direction = row.change > 0 ? "increased" : row.change < 0 ? "decreased" : "unchanged";
      const change = row.change === 0 ? "" : ` by ${formatMetric(Math.abs(row.change), operation.metric)}`;
      const percent = row.percentChange === null ? "" : ` (${Math.abs(row.percentChange)}%)`;
      return `${index + 1}. **${row.label}:** ${direction}${change}${percent}`;
    });
    return [`### ${operation.groupBy} trends by ${metricLabel(operation.metric).toLowerCase()} for ${rangeLabel}`, "", ...rows].join("\n");
  }
  const rows = operation.rows.map((row) => `- **${row.label}:** ${formatMetric(row.value, operation.metric)}`);
  const direction = operation.change > 0 ? "increased" : operation.change < 0 ? "decreased" : "did not change";
  const changeText = operation.change === 0
    ? `It ${direction}.`
    : `It ${direction} by ${formatMetric(Math.abs(operation.change), operation.metric)}${operation.percentChange === null ? "" : ` (${Math.abs(operation.percentChange)}%)`}.`;
  return [`### ${metricLabel(operation.metric)} trend for ${rangeLabel}`, "", ...rows, "", `- **Change:** ${changeText}`].join("\n");
}

function listReply(operation, rangeLabel) {
  if (!operation.rows.length) return `### Expense records for ${rangeLabel}\n\nNo matching records found.`;
  const rows = operation.rows.map(
    (row) => `- **${formatDate(row.date)} — ${row.item}:** ${formatMoney(row.amount)} · ${labelPeriod(row.period)} · ${labelPayment(row.paymentType)}`
  );
  return [`### Expense records for ${rangeLabel}`, "", ...rows].join("\n");
}

function balanceReply(operation, rangeLabel) {
  if (operation.kind === "balance-current") {
    if (!operation.balance?.exists) return "I couldn't find the current balance record.";
    return [
      "### Current balance",
      "",
      `- **Total:** ${formatMoney(operation.balance.totalBalance)}`,
      `- **Cash:** ${formatMoney(operation.balance.cashBalance)}`,
      `- **GPay:** ${formatMoney(operation.balance.gpayBalance)}`,
    ].join("\n");
  }
  if (operation.kind === "balance-at-date") {
    if (!operation.balance) return "I need a valid date to calculate the historical balance.";
    return [
      `### Balance on ${formatDate(operation.balance.date)}`,
      "",
      `- **Total:** ${formatMoney(operation.balance.totalBalance)}`,
      `- **Cash:** ${formatMoney(operation.balance.cashBalance)}`,
      `- **GPay:** ${formatMoney(operation.balance.gpayBalance)}`,
      "",
      "_Calculated by reversing balance changes recorded after this date._",
    ].join("\n");
  }
  const stats = operation.stats;
  const lines = [
    `### Balance activity for ${rangeLabel}`,
    "",
    `- **Added:** ${formatMoney(stats.added)}`,
    `- **Reduced:** ${formatMoney(stats.reduced)}`,
    `- **Cash added / reduced:** ${formatMoney(stats.cashAdded)} / ${formatMoney(stats.cashReduced)}`,
    `- **GPay added / reduced:** ${formatMoney(stats.gpayAdded)} / ${formatMoney(stats.gpayReduced)}`,
  ];
  if (operation.rows.length) {
    lines.push("", "**Recent matching changes**");
    for (const row of operation.rows.slice(0, 8)) {
      lines.push(`- **${formatDate(row.date)}:** ${row.action === "add" ? "Added" : "Reduced"} ${formatMoney(row.appliedAmount ?? row.amount)} ${labelPayment(row.balanceType)}`);
    }
  }
  return lines.join("\n");
}

function deterministicAdvice(result) {
  const rank = result.operationResults.find((operation) => operation.rows?.length && ["rank", "aggregate"].includes(operation.kind));
  const top = rank?.rows?.[0];
  if (top) return `Your largest visible spending area is **${top.label}**. Review its repeated entries first and set a realistic limit for the next period.`;
  if (result.baseStats.count) return "Review repeated small purchases and compare this period with the previous one before choosing a reduction target.";
  return "Add more submitted expenses before requesting personalised saving advice.";
}

export function buildSemanticReply(result, plan) {
  const sections = [];
  const filterText = filterDescription(plan.filters);
  if (filterText) sections.push(`_Applied filters: ${filterText}._`);

  for (const operation of result.operationResults) {
    let section = "";
    if (operation.kind === "aggregate") section = aggregateReply(operation, result.range.label);
    else if (["rank", "unique"].includes(operation.kind)) section = rankReply(operation, result.range.label);
    else if (operation.kind === "compare") section = compareReply(operation, result.range.label);
    else if (operation.kind === "trend") section = trendReply(operation, result.range.label);
    else if (operation.kind === "list") section = listReply(operation, result.range.label);
    else if (operation.kind.startsWith("balance-")) section = balanceReply(operation, result.range.label);
    else if (operation.kind === "advice") section = `### Saving insight\n\n${deterministicAdvice(result)}`;
    if (section && !sections.includes(section)) sections.push(section);
  }

  if (!sections.length) {
    return result.baseStats.count
      ? `### Spending for ${result.range.label}\n\n- **Total:** ${formatMoney(result.baseStats.total)}\n- **Entries:** ${result.baseStats.count}`
      : `I couldn't find matching expense records for **${result.range.label}**.`;
  }
  return sections.join("\n\n");
}
