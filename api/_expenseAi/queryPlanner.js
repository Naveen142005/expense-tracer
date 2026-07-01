import { PAYMENT_ALIASES, PERIOD_ALIASES, STOP_WORDS, TYPE_ALIASES } from "./constants.js";
import { parseDateRange, stripDatePhrases } from "./dateParser.js";
import { getItemKey, normalizeMessage } from "./utils.js";

function filtersAreAll(filters = {}) {
  return (
    (filters.type || "all") === "all" &&
    (filters.paymentType || "all") === "all" &&
    (filters.period || "all") === "all"
  );
}

function isFollowUpMessage(message) {
  const text = normalizeMessage(message);
  const wordCount = text ? text.split(" ").length : 0;
  return (
    /\b(how many|times|count|number of|how often|it|that|same|again|what about|and then|also|there|both|previous|above|which dates|cash or gpay|this one|that one|same one)\b/.test(text) ||
    (wordCount <= 5 && /\b(how much|what about|total|count|times|dates|cash|gpay)\b/.test(text) && !/\b(today|this month|this week|this year)\b/.test(text))
  );
}

function normalizeContextDateRange(dateRange) {
  if (!dateRange?.source && (!dateRange?.startDate || !dateRange?.endDate)) return null;
  if (dateRange.source === "all-time") return { startDate: null, endDate: null, source: "all-time", explicit: true };
  if (!dateRange?.startDate || !dateRange?.endDate) return null;
  return { startDate: dateRange.startDate, endDate: dateRange.endDate, source: dateRange.source || "context", explicit: true };
}

function detectTypeFilter(text) {
  if (/\b(compare|vs|versus|cash|gpay)\b/.test(text) && /\bfood\b.*\b(snack|snacks|bus|travel)\b|\b(snack|snacks|bus|travel)\b.*\bfood\b/.test(text)) {
    return "all";
  }

  if (/\b(?:on|for|only|type|category|category wise|spent on|spending on)\s+(food|foods|snack|snacks|bus|travel|transport|custom|other)\b/.test(text)) {
    return TYPE_ALIASES[RegExp.$1] || "all";
  }

  if (/\b(food|foods|snack|snacks|bus|travel|transport|custom|other)\s+(?:expense|expenses|spend|spent|spending|total|cost|amount)\b/.test(text)) {
    return TYPE_ALIASES[RegExp.$1] || "all";
  }

  if (/\b(food|foods|snack|snacks|bus|travel|transport|custom|other)\s+(?:using|by|through|with|via)\s+(?:cash|gpay|g pay|google pay|upi)\b/.test(text)) {
    return TYPE_ALIASES[RegExp.$1] || "all";
  }

  return "all";
}

function detectPaymentFilter(text) {
  // Metric phrases should not become filters.
  if (/\b(cash\s+(?:spend|spent|total|amount)|gpay\s+(?:spend|spent|total|amount)|split\s+by\s+(?:cash|payment)|cash\s+(?:and|vs|versus|or)\s+gpay|gpay\s+(?:and|vs|versus|or)\s+cash|cash\/gpay)\b/.test(text)) {
    return "all";
  }

  const filterPatterns = [
    /\b(?:using|by|through|via|with|paid by|paid through|paid using|payment by|payment through)\s+(cash|gpay|g pay|google pay|upi)\b/,
    /\b(cash|gpay|g pay|google pay|upi)\s+(?:only|payment only|payments only|expenses only|transactions only)\b/,
    /\bonly\s+(cash|gpay|g pay|google pay|upi)\b/,
  ];

  for (const pattern of filterPatterns) {
    const match = text.match(pattern);
    if (match) return PAYMENT_ALIASES[match[1]] || "all";
  }

  return "all";
}

function detectPeriodFilter(text) {
  if (/\b(compare|vs|versus)\b/.test(text) && /\b(morning|afternoon|evening|night)\b/.test(text)) return "all";

  if (/\b(?:in|during|at|period|only)\s+(morning|afternoon|evening|night|other)\b/.test(text)) {
    return PERIOD_ALIASES[RegExp.$1] || "all";
  }

  if (/\b(morning|afternoon|evening|night|other)\s+(?:expense|expenses|spend|spent|spending|total|cost|amount)\b/.test(text)) {
    return PERIOD_ALIASES[RegExp.$1] || "all";
  }

  return "all";
}

function parseFilters(message) {
  const text = stripDatePhrases(message);
  return {
    type: detectTypeFilter(text),
    paymentType: detectPaymentFilter(text),
    period: detectPeriodFilter(text),
  };
}

function detectMetrics(message) {
  const text = normalizeMessage(message);
  const metrics = new Set();

  if (/\b(current balance|my balance|wallet balance|available balance|remaining balance|balance amount|money left|left balance)\b/.test(text) || (/\bbalance\b/.test(text) && !/\bhistory|adjustment|changed|changes|add|added|reduce|reduced\b/.test(text))) metrics.add("currentBalance");
  if (/\bbalance\s+(?:history|adjustment|changes|updates)|wallet history\b/.test(text)) metrics.add("balanceHistory");
  if (/\b(balance|wallet)\b.*\b(add|added|increase|credited)\b|\b(add|added)\b.*\b(balance|wallet)\b/.test(text)) metrics.add("balanceAdded");
  if (/\b(balance|wallet)\b.*\b(reduce|reduced|deduct|deducted|spent from|decrease)\b|\b(reduce|reduced|deducted)\b.*\b(balance|wallet)\b/.test(text)) metrics.add("balanceReduced");

  const asksForRankedItem = /\b(top|highest|most|maximum|biggest|lowest|least|minimum|smallest|more spent|spent more|cost more)\b/.test(text);
  if (!asksForRankedItem && (/\b(what|which)\s+(?:are\s+)?(?:the\s+)?(?:item|items|things|expenses|purchases)\b/.test(text) || /\b(item|items|things|expenses|purchases)\s+(?:i\s+)?(?:spent|bought|purchased|paid|added)\b/.test(text) || /\bwhat\s+did\s+i\s+(?:spend|buy|purchase|pay for)\b/.test(text))) metrics.add("itemList");

  if (/\b(total|how much|amount|spent|spend|expense|expenses|summary|cash and gpay combined|combined)\b/.test(text)) metrics.add("totalSpend");
  if (/\bcash\s+(?:spend|spent|total|amount)|(?:spent|spend|total).*\bcash\b|split\s+by\s+(?:cash|payment)|cash\s+(?:and|vs|versus|or)\s+gpay|cash\/gpay\b/.test(text)) metrics.add("cashSpend");
  if (/\bgpay\s+(?:spend|spent|total|amount)|(?:spent|spend|total).*\bgpay\b|(?:google pay|upi)\s+(?:spend|spent|total|amount)|split\s+by\s+(?:gpay|payment)|cash\s+(?:and|vs|versus|or)\s+gpay|cash\/gpay\b/.test(text)) metrics.add("gpaySpend");

  if (/\b(how many|times|count|number of|how often|entries|transactions)\b/.test(text)) metrics.add("count");
  if (/\b(top|highest|most|maximum|biggest|more spent|spent more|cost more)\b/.test(text)) metrics.add("top");
  if (/\b(lowest|least|minimum|smallest)\b/.test(text)) metrics.add("lowest");
  if (/\b(recent|latest|last entries|last expenses|newest)\b/.test(text)) metrics.add("recent");
  if (/\b(average|avg|per day|daily average)\b/.test(text)) metrics.add("average");
  if (/\b(compare|vs|versus|difference|between|which is more|which one|higher than|more than|less than|which is higher|which is lower|higher|lower)\b/.test(text) && (/\b(or|vs|versus|than|between|compare)\b/.test(text) || /\b(cash|gpay|food|snacks|bus|morning|afternoon|evening|night)\b/.test(text))) metrics.add("compare");
  if (/\b(type wise|type-wise|category wise|category-wise|by type|types?)\b/.test(text)) metrics.add("typeBreakdown");
  if (/\b(payment wise|payment-wise|by payment|cash.*gpay|gpay.*cash|split by payment)\b/.test(text)) metrics.add("paymentBreakdown");
  if (/\b(period wise|period-wise|by period|most used period|morning|afternoon|evening|night)\b/.test(text)) metrics.add("periodBreakdown");
  if (/\b(date wise|date-wise|by date|daily|which date|which dates|which day|which days|dates?|highest spending date|lowest spending date)\b/.test(text)) metrics.add("dateBreakdown");
  if (/\b(advice|advise|suggest|reduce|save|saving|control|budget|improve|recommendation|tips)\b/.test(text)) metrics.add("advice");

  if (!metrics.size) metrics.add("summary");
  return metrics;
}

function detectRankDimension(message) {
  const text = normalizeMessage(message);
  if (/\b(day|date|daily)\b/.test(text)) return "date";
  if (/\bperiod|morning|afternoon|evening|night\b/.test(text)) return "period";
  if (/\bpayment|cash|gpay|upi\b/.test(text)) return "payment";
  if (/\btype|category|categories|food|snacks|bus|custom\b/.test(text)) return "type";
  return "item";
}

function getTopLimit(message, defaultLimit = 5) {
  const text = normalizeMessage(message);
  const match = text.match(/\btop\s+(\d{1,2})\b/);
  if (match) return Math.max(1, Math.min(Number(match[1]), 20));

  // Questions like "which item did I spend the most on?" expect one best answer, not a list.
  if (/\b(which|what)\s+(?:item|date|day|type|category|period|payment)\b/.test(text) && /\b(most|highest|biggest|maximum|lowest|least|smallest|minimum)\b/.test(text)) {
    return 1;
  }

  return defaultLimit;
}

function detectCompareTargets(message, itemNames = []) {
  const text = normalizeMessage(message);
  const targets = [];

  for (const [word, key] of Object.entries(TYPE_ALIASES)) {
    if (new RegExp(`\\b${word}\\b`).test(text) && !targets.some((target) => target.dimension === "type" && target.key === key)) {
      targets.push({ dimension: "type", key, label: key });
    }
  }

  for (const [word, key] of Object.entries(PAYMENT_ALIASES)) {
    if (new RegExp(`\\b${word.replace(/\s+/g, "\\s+")}\\b`).test(text) && !targets.some((target) => target.dimension === "payment" && target.key === key)) {
      targets.push({ dimension: "payment", key, label: key });
    }
  }

  for (const [word, key] of Object.entries(PERIOD_ALIASES)) {
    if (new RegExp(`\\b${word}\\b`).test(text) && !targets.some((target) => target.dimension === "period" && target.key === key)) {
      targets.push({ dimension: "period", key, label: key });
    }
  }

  const sortedItemNames = [...itemNames].sort((a, b) => b.length - a.length);
  for (const itemName of sortedItemNames) {
    const key = getItemKey(itemName);
    if (key && ` ${text} `.includes(` ${key} `) && !targets.some((target) => target.dimension === "item" && target.key === key)) {
      targets.push({ dimension: "item", key, label: itemName });
    }
  }

  if (targets.length < 2 && /\b(or|vs|versus)\b/.test(text)) {
    const cleaned = text
      .replace(/\b(which is higher|which is lower|which one is higher|which one is lower|compare|spending|spend|spent|total|amount|cost|price|higher|lower|more|less|is|which)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const rawParts = cleaned.split(/\b(?:or|vs|versus)\b/).map((part) => part.trim()).filter(Boolean);
    for (const part of rawParts.slice(0, 4)) {
      const key = getItemKey(part);
      if (
        key &&
        key.length >= 2 &&
        !TYPE_ALIASES[key] &&
        !PAYMENT_ALIASES[key] &&
        !PERIOD_ALIASES[key] &&
        !targets.some((target) => target.dimension === "item" && target.key === key)
      ) {
        targets.push({ dimension: "item", key, label: part });
      }
    }
  }

  return targets.slice(0, 6);
}

function extractExplicitItemCandidate(message) {
  let text = stripDatePhrases(message);
  text = text
    .replace(/\b(?:how much|how many|times|count|total|spent|spend|expense|expenses|amount|price|cost|paid|till now|until now|so far|this month|today|entries|transactions)\b/g, " ")
    .replace(/\b(?:using|by|through|via|with)\s+(?:cash|gpay|g pay|google pay|upi)\b/g, " ")
    .replace(/\b(?:in|during|at)\s+(?:morning|afternoon|evening|night|other)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const explicit = text.match(/\b(?:on|for|of|item|buy|bought|ate|eat)\s+(.+)$/);
  let candidate = explicit?.[1] || "";

  if (!candidate && /\b(item|items|top|highest|lowest|summary|compare|cash|gpay|food|snacks|bus|period|type|payment|date|day)\b/.test(text)) {
    return null;
  }

  if (!candidate) {
    candidate = text
      .split(" ")
      .filter((word) => word && !STOP_WORDS.has(word) && !TYPE_ALIASES[word] && !PAYMENT_ALIASES[word] && !PERIOD_ALIASES[word])
      .join(" ");
  }

  candidate = candidate
    .split(" ")
    .filter((word) => word && !STOP_WORDS.has(word) && !TYPE_ALIASES[word] && !PAYMENT_ALIASES[word] && !PERIOD_ALIASES[word])
    .join(" ")
    .trim();

  if (!candidate || candidate.length < 2 || /^\d+$/.test(candidate)) return null;
  if (/\b(tell|show|give|top|highest|lowest|summary|suggestion|reduce|spending|spend|cash|gpay|period|date|type|payment|total|count|entries|compare|split|breakdown|month|year)\b/.test(candidate)) return null;
  return getItemKey(candidate);
}

function detectItemFocus(message, itemNames = [], context = {}) {
  const text = normalizeMessage(message);
  const sortedItemNames = [...itemNames].sort((a, b) => b.length - a.length);

  for (const itemName of sortedItemNames) {
    const key = getItemKey(itemName);
    if (key && ` ${text} `.includes(` ${key} `)) return { key, item: itemName, source: "matched-known-item" };
  }

  const shouldReuseContextItem = /^(how many|how many times|times|count|number of|how often|which dates|dates|cash or gpay|payment|what about it|what about that|what about this|same|again|there|that one|this one)$/i.test(text)
    || (/\b(it|that|this|same one|that one|this one)\b/.test(text) && !/\b(today|yesterday|month|week|year|january|february|march|april|may|june|july|august|september|october|november|december)\b/.test(text));

  if (context.focusItem?.key && isFollowUpMessage(message) && shouldReuseContextItem) {
    return { key: context.focusItem.key, item: context.focusItem.item || context.focusItem.key, source: "context" };
  }

  const candidateKey = extractExplicitItemCandidate(message);
  if (!candidateKey) return null;

  const knownItem = sortedItemNames.find((itemName) => getItemKey(itemName) === candidateKey);
  if (knownItem) return { key: candidateKey, item: knownItem, source: "matched-extracted-item" };

  // Only keep an unmatched item when the user clearly used item language.
  if (/\b(on|for|of|item|buy|bought|ate|eat)\b/.test(normalizeMessage(message))) {
    return { key: candidateKey, item: candidateKey, source: "unmatched-explicit-item" };
  }

  return null;
}

function isMultiMetricSummary(metrics) {
  // totalSpend often appears in rank questions because of words like "spent".
  // Do not let that alone convert "which item did I spend most on" into a generic summary.
  const broadMetrics = [
    "cashSpend",
    "gpaySpend",
    "typeBreakdown",
    "paymentBreakdown",
    "periodBreakdown",
    "dateBreakdown",
    "advice",
    "average",
    "count",
    "itemList",
  ];
  return broadMetrics.some((metric) => metrics.has(metric));
}

function classifyIntent(message, metrics, focusItem) {
  if (metrics.has("currentBalance")) return "current-balance";
  if (metrics.has("balanceHistory")) return "balance-history";
  if (metrics.has("balanceAdded")) return "balance-added";
  if (metrics.has("balanceReduced")) return "balance-reduced";
  if (metrics.has("compare")) return "compare";
  if (metrics.has("lowest") && !isMultiMetricSummary(metrics)) return `lowest-${detectRankDimension(message)}`;
  if (metrics.has("top") && !isMultiMetricSummary(metrics)) return `top-${detectRankDimension(message)}`;
  if (metrics.has("advice") && !isMultiMetricSummary(metrics)) return "advice";
  if (metrics.has("itemList")) return "item-list";
  if (metrics.has("recent")) return "recent";
  if (metrics.has("average")) return "average";
  if (metrics.has("count")) return focusItem ? "item-count" : "count";
  if (focusItem && (metrics.has("totalSpend") || metrics.has("summary") || metrics.has("dateBreakdown") || metrics.has("paymentBreakdown") || metrics.has("cashSpend") || metrics.has("gpaySpend"))) return "item-total";
  if (metrics.has("summary") && metrics.size === 1) return "summary";
  return "metrics-summary";
}

function confidenceForPlan(plan) {
  let confidence = 0.75;
  if (plan.dateRange.explicit) confidence += 0.08;
  if (!filtersAreAll(plan.filters)) confidence += 0.05;
  if (plan.focusItem) confidence += 0.07;
  if (plan.intent === "summary" && !plan.metrics.has("summary")) confidence -= 0.15;
  if (plan.intent === "compare" && plan.compareTargets.length < 2) confidence -= 0.35;
  if (plan.intent === "count" && filtersAreAll(plan.filters) && !plan.focusItem && !plan.dateRange.explicit) confidence -= 0.25;
  return Math.max(0, Math.min(1, confidence));
}

function metricsFromContext(context = {}) {
  if (!Array.isArray(context.lastMetrics) || !context.lastMetrics.length) return null;
  const blocked = new Set(["advice"]);
  const values = context.lastMetrics.filter((metric) => !blocked.has(metric));
  return values.length ? new Set(values) : null;
}

function isDateOnlyFollowUp(message, parsedDateRange) {
  if (!parsedDateRange?.explicit) return false;
  const stripped = stripDatePhrases(message)
    .replace(/\b(previous|last|this|current|month|week|year|today|yesterday|life|time|lifetime|overall|all|ever|so|far|only|not|for|in|on|my|me|the)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return !stripped || stripped.split(" ").length <= 2;
}

function shouldDefaultRankToAllTime(intent, parsedDateRange) {
  return !parsedDateRange?.explicit && /^(top|lowest)-/.test(intent);
}

function shouldDefaultFocusedItemToAllTime(intent, parsedDateRange, focusItem) {
  return !parsedDateRange?.explicit && Boolean(focusItem) && ["item-total", "item-count", "compare"].includes(intent);
}

export function buildQueryPlan(message, context = {}, itemNames = []) {
  const parsedDateRange = parseDateRange(message);
  const followUp = isFollowUpMessage(message);
  let dateRange = parsedDateRange;

  let metrics = detectMetrics(message);

  // Very short date-only follow-ups such as "previous month?" should reuse the
  // previous question type, but the new date must override the old date.
  const contextMetrics = metricsFromContext(context);
  let inheritedMetrics = false;
  if (followUp && contextMetrics && metrics.size === 1 && metrics.has("summary")) {
    metrics = contextMetrics;
    inheritedMetrics = true;
  }
  if (isDateOnlyFollowUp(message, parsedDateRange) && metrics.size === 1 && metrics.has("summary")) {
    metrics = contextMetrics || new Set(["totalSpend", "cashSpend", "gpaySpend"]);
    inheritedMetrics = Boolean(contextMetrics);
  }

  const contextDateRange = normalizeContextDateRange(context.dateRange || context.range);
  if (followUp && !parsedDateRange.explicit && contextDateRange) {
    dateRange = { ...contextDateRange, explicit: false, source: contextDateRange.source || "context" };
  }

  let filters = parseFilters(message);
  if (followUp && filtersAreAll(filters) && context.filters && !filtersAreAll(context.filters)) {
    filters = {
      type: context.filters.type || "all",
      paymentType: context.filters.paymentType || "all",
      period: context.filters.period || "all",
    };
  }

  const focusItem = detectItemFocus(message, itemNames, context);
  const compareTargets = detectCompareTargets(message, itemNames);
  const intent = classifyIntent(message, metrics, focusItem);

  // Ranking questions without a date should use lifetime data. Users normally
  // expect "Which item did I spend the most on?" to mean overall, not just today/current month.
  if (shouldDefaultRankToAllTime(intent, parsedDateRange) || shouldDefaultFocusedItemToAllTime(intent, parsedDateRange, focusItem)) {
    dateRange = { startDate: null, endDate: null, source: "all-time", explicit: false };
  }

  const plan = {
    originalMessage: message,
    normalizedMessage: normalizeMessage(message),
    dateRange,
    filters,
    metrics,
    focusItem,
    compareTargets,
    intent,
    topLimit: inheritedMetrics && context.lastTopLimit ? context.lastTopLimit : getTopLimit(message, metrics.has("top") || metrics.has("lowest") ? 5 : 8),
    followUp,
  };
  plan.confidence = confidenceForPlan(plan);
  return plan;
}

export function needsClarification(plan, context = {}) {
  const text = plan.normalizedMessage;

  if (plan.intent === "compare" && plan.compareTargets.length < 2) {
    return { needed: true, reason: "missing-compare-targets" };
  }

  if (/\b(there|that item|that one|this one|same one)\b/.test(text) && !plan.focusItem && !context.focusItem) {
    return { needed: true, reason: "unclear-reference" };
  }

  const onlyFollowUp = /^(how many|how many times|times|count|how much|total|which dates|cash or gpay|what about that|what about it|what about this|and that|there|that one|this one)$/i.test(text);
  if (onlyFollowUp && !plan.focusItem && !context.lastIntent) {
    return { needed: true, reason: plan.metrics.has("count") ? "unclear-count" : "unclear-reference" };
  }

  if (/\b(more|higher|less|lower|better)\b/.test(text) && plan.intent !== "compare" && !/\b(top|highest|lowest|least|most)\b/.test(text)) {
    return { needed: true, reason: "missing-compare-targets" };
  }

  if (plan.confidence < 0.5) return { needed: true, reason: "low-confidence" };
  return { needed: false };
}

export function buildClarification(plan, reason) {
  if (reason === "missing-compare-targets") return "What should I compare? Example: Cash vs GPay, Food vs Snacks, idly vs egg, or Morning vs Night.";
  if (reason === "unclear-count") return "What do you want me to count? Tell me an item, type, payment method, period, or date. Example: “How many times did I buy idly this month?”";
  if (reason === "unclear-reference") return "I’m not sure what you are referring to. Tell me the item, date, type, payment method, or period you want to check.";
  return "I’m not fully sure what you want to check. Do you mean current balance, total spending, item count, payment-wise total, or a specific date?";
}

export function buildNextContext(plan, summary = null) {
  const topItemContext =
    !plan.focusItem && plan.intent === "top-item" && summary?.topItems?.[0]
      ? { key: summary.topItems[0].key, item: summary.topItems[0].item, source: "top-result" }
      : null;

  return {
    dateRange: summary?.range || plan.dateRange,
    filters: plan.filters,
    focusItem: plan.focusItem || topItemContext || null,
    lastIntent: plan.intent,
    lastMetrics: [...plan.metrics],
    lastTopLimit: plan.topLimit,
  };
}
