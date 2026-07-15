import { PAYMENT_ALIASES, PERIOD_ALIASES, TYPE_ALIASES } from "./constants.js";
import { parseDateRange } from "./dateParser.js";
import { getItemKey, normalizeMessage } from "./utils.js";

const DOMAINS = new Set(["expense", "balance", "mixed", "clarify", "out-of-domain"]);
const OPERATION_KINDS = new Set([
  "aggregate",
  "list",
  "rank",
  "compare",
  "trend",
  "unique",
  "balance-current",
  "balance-history",
  "balance-at-date",
  "advice",
]);
const METRICS = new Set(["amount", "count", "average", "min", "max", "unique-count"]);
const GROUPS = new Set(["none", "item", "date", "day-of-week", "week", "month", "period", "type", "payment"]);
const DIRECTIONS = new Set(["asc", "desc"]);
const TARGET_DIMENSIONS = new Set(["item", "type", "payment", "period", "date", "month", "day-of-week"]);

function cleanArray(value) {
  return [...new Set((Array.isArray(value) ? value : value ? [value] : [])
    .map((entry) => normalizeMessage(entry))
    .filter(Boolean))];
}

function finiteOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function levenshtein(left = "", right = "") {
  const a = getItemKey(left);
  const b = getItemKey(right);
  if (!a) return b.length;
  if (!b) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const saved = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        previous + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      previous = saved;
    }
  }
  return row[b.length];
}

export function resolveKnownItem(value, knownItemNames = []) {
  const key = getItemKey(value);
  if (!key) return null;
  const exact = knownItemNames.find((item) => getItemKey(item) === key);
  if (exact) return { key: getItemKey(exact), label: exact, matched: true, confidence: 1 };

  const spellingAliases = {
    idli: "idly",
    idly: "idli",
    dosa: "dosai",
    dosai: "dosa",
    gpay: "google pay",
  };
  const aliasKey = spellingAliases[key];
  const alias = aliasKey && knownItemNames.find((item) => getItemKey(item) === aliasKey);
  if (alias) return { key: getItemKey(alias), label: alias, matched: true, confidence: 0.96 };

  const candidates = knownItemNames
    .map((item) => ({ item, key: getItemKey(item), distance: levenshtein(key, item) }))
    .filter((candidate) => candidate.key)
    .sort((a, b) => a.distance - b.distance || a.key.length - b.key.length);
  const best = candidates[0];
  const second = candidates[1];
  const allowedDistance = key.length <= 4 ? 1 : key.length <= 8 ? 2 : 3;
  if (best && best.distance <= allowedDistance && (!second || second.distance > best.distance)) {
    return { key: best.key, label: best.item, matched: true, confidence: 0.82 };
  }
  return { key, label: String(value).trim(), matched: false, confidence: 0.5 };
}

function normalizeTypes(values) {
  const normalized = cleanArray(values)
    .map((value) => TYPE_ALIASES[value] || TYPE_ALIASES[value.replace(/s$/, "")] || value)
    .filter((value) => ["food", "snacks", "bus", "custom"].includes(value));
  return [...new Set(normalized)];
}

function normalizePayments(values) {
  const normalized = cleanArray(values)
    .map((value) => PAYMENT_ALIASES[value] || PAYMENT_ALIASES[value.replace(/\s+/g, " ")] || value.replace(/\s+/g, ""))
    .filter((value) => ["cash", "gpay"].includes(value));
  return [...new Set(normalized)];
}

function normalizePeriods(values) {
  const normalized = cleanArray(values)
    .map((value) => PERIOD_ALIASES[value] || value)
    .filter((value) => ["morning", "afternoon", "evening", "night", "other"].includes(value));
  return [...new Set(normalized)];
}

function collapseCompleteDimension(values, totalOptions) {
  return values.length === totalOptions ? [] : values;
}

function phraseAppears(text, phrase) {
  const cleanText = getItemKey(text);
  const cleanPhrase = getItemKey(phrase);
  return Boolean(cleanPhrase) && ` ${cleanText} `.includes(` ${cleanPhrase} `);
}

function dimensionValueAppears(question, value, aliases) {
  const text = normalizeMessage(question);
  return Object.entries(aliases).some(([alias, normalized]) =>
    normalized === value && phraseAppears(text, alias)
  );
}

function itemAppears(question, item) {
  const text = normalizeMessage(question);
  const key = getItemKey(item?.key || item?.label || item);
  const spellings = {
    idli: ["idli", "idly"],
    idly: ["idli", "idly"],
    dosa: ["dosa", "dosai"],
    dosai: ["dosa", "dosai"],
  };
  return (spellings[key] || [key]).some((candidate) => phraseAppears(text, candidate));
}

const CANONICAL_DIMENSION_ALIASES = {
  type: new Set(["food", "snacks", "bus", "custom"]),
  payment: new Set(["cash", "gpay", "g pay", "google pay"]),
  period: new Set(["morning", "afternoon", "evening", "night", "other"]),
};

function isExactKnownItem(value, knownItemNames = []) {
  const key = getItemKey(value);
  return Boolean(key) && knownItemNames.some((item) => getItemKey(item) === key);
}

function isCanonicalDimensionAlias(value, dimension = null) {
  const key = normalizeMessage(value);
  if (dimension) return CANONICAL_DIMENSION_ALIASES[dimension]?.has(key) || false;
  return Object.values(CANONICAL_DIMENSION_ALIASES).some((values) => values.has(key));
}

function isReservedDimensionPhrase(value, knownItemNames = []) {
  const key = normalizeMessage(value);
  const reserved = Boolean(TYPE_ALIASES[key] || PAYMENT_ALIASES[key] || PERIOD_ALIASES[key]);
  if (!reserved) return false;

  // A saved item called "Breakfast" or "Chips" is still an item even though
  // those words can be category aliases. The actual UI category labels remain
  // authoritative when they are written literally.
  return !isExactKnownItem(value, knownItemNames) || isCanonicalDimensionAlias(value);
}

function explicitDimensionValues(question, aliases, dimension, knownItemNames = []) {
  return [...new Set(
    Object.entries(aliases)
      .filter(([alias]) =>
        phraseAppears(question, alias) &&
        (!isExactKnownItem(alias, knownItemNames) || isCanonicalDimensionAlias(alias, dimension))
      )
      .map(([, normalized]) => normalized)
  )];
}

function explicitTargetsForDimension(question, aliases, dimension, knownItemNames = []) {
  const values = explicitDimensionValues(question, aliases, dimension, knownItemNames);
  if (values.length < 2) return [];
  return values.map((value) => ({ dimension, value, label: value, matched: true }));
}

function explicitItemTargets(question, knownItemNames = []) {
  const items = knownItemNames
    .filter((item) => itemAppears(question, item))
    .map((item) => ({ dimension: "item", value: getItemKey(item), label: item, matched: true }));
  return items.length >= 2 ? items : [];
}

function deterministicComparisonTargets(question, knownItemNames = []) {
  const groups = [
    explicitTargetsForDimension(question, TYPE_ALIASES, "type", knownItemNames),
    explicitTargetsForDimension(question, PAYMENT_ALIASES, "payment", knownItemNames),
    explicitTargetsForDimension(question, PERIOD_ALIASES, "period", knownItemNames),
    explicitItemTargets(question, knownItemNames),
  ].filter((targets) => targets.length >= 2);

  // One clear dimension can safely correct a model mistake such as treating
  // Food and Bus as literal item names. Multi-dimensional comparisons remain
  // with the semantic plan so ambiguity can be handled explicitly.
  return groups.length === 1 ? groups[0] : [];
}

const DIMENSION_ALIASES = {
  type: TYPE_ALIASES,
  payment: PAYMENT_ALIASES,
  period: PERIOD_ALIASES,
};

function comparisonTargetAliases(question, operations = []) {
  const aliasesByDimension = new Map();
  for (const operation of operations) {
    if (operation.kind !== "compare" || operation.targets.length < 2) continue;
    const dimensions = new Set(operation.targets.map((target) => target.dimension));
    if (dimensions.size !== 1) continue;
    const [dimension] = dimensions;
    const aliases = DIMENSION_ALIASES[dimension];
    if (!aliases) continue;
    const targetValues = new Set(operation.targets.map((target) => target.value));
    const usedAliases = new Set(
      Object.entries(aliases)
        .filter(([alias, normalized]) => targetValues.has(normalized) && phraseAppears(question, alias))
        .map(([alias]) => normalizeMessage(alias))
    );
    aliasesByDimension.set(dimension, usedAliases);
  }
  return aliasesByDimension;
}

function removeCrossTargetAliases(values, question, aliases, dimension, targetAliases) {
  const foreignAliases = new Set(
    [...targetAliases.entries()]
      .filter(([targetDimension]) => targetDimension !== dimension)
      .flatMap(([, entries]) => [...entries])
  );
  if (!foreignAliases.size) return values;
  return values.filter((value) => {
    const writtenAliases = Object.entries(aliases)
      .filter(([alias, normalized]) => normalized === value && phraseAppears(question, alias))
      .map(([alias]) => normalizeMessage(alias));
    return !writtenAliases.length || writtenAliases.some((alias) => !foreignAliases.has(alias));
  });
}

function onlyExplicitDimensionValues(values, question, aliases, useContext) {
  if (useContext) return values;
  return values.filter((value) => dimensionValueAppears(question, value, aliases));
}

function normalizeTargets(targets, knownItemNames) {
  return (Array.isArray(targets) ? targets : [])
    .map((target) => {
      const raw = typeof target === "string" ? { dimension: "item", value: target } : target || {};
      const dimension = TARGET_DIMENSIONS.has(raw.dimension) ? raw.dimension : "item";
      const value = normalizeMessage(raw.value || raw.key || raw.label);
      if (!value) return null;
      if (dimension === "item") {
        if (isReservedDimensionPhrase(value, knownItemNames)) return null;
        const item = resolveKnownItem(value, knownItemNames);
        return item ? { dimension, value: item.key, label: item.label, matched: item.matched } : null;
      }
      if (dimension === "type") {
        const normalized = normalizeTypes([value])[0];
        return normalized ? { dimension, value: normalized, label: normalized } : null;
      }
      if (dimension === "payment") {
        const normalized = normalizePayments([value])[0];
        return normalized ? { dimension, value: normalized, label: normalized } : null;
      }
      if (dimension === "period") {
        const normalized = normalizePeriods([value])[0];
        return normalized ? { dimension, value: normalized, label: normalized } : null;
      }
      if (dimension === "date") {
        const range = parseDateRange(value);
        return range.startDate && range.startDate === range.endDate
          ? { dimension, value: range.startDate, label: value }
          : null;
      }
      if (dimension === "month") {
        const range = parseDateRange(value);
        return range.startDate
          ? { dimension, value: range.startDate.slice(0, 7), label: value }
          : null;
      }
      if (dimension === "day-of-week") {
        const day = value.replace(/s$/, "");
        return { dimension, value: day, label: day };
      }
      return { dimension, value, label: value };
    })
    .filter(Boolean)
    .filter((target, index, list) =>
      list.findIndex((entry) => entry.dimension === target.dimension && entry.value === target.value) === index
    );
}

function normalizeOperation(operation = {}, knownItemNames = [], question = "", useContext = false) {
  const kind = OPERATION_KINDS.has(operation.kind) ? operation.kind : "aggregate";
  const defaultMetric = kind === "unique" ? "unique-count" : "amount";
  const metric = METRICS.has(operation.metric) ? operation.metric : defaultMetric;
  let groupBy = GROUPS.has(operation.groupBy) ? operation.groupBy : kind === "unique" || kind === "rank" ? "item" : kind === "trend" ? "month" : "none";
  if (kind === "rank" && groupBy === "none") groupBy = "item";
  const interval = ["date", "week", "month"].includes(operation.interval)
    ? operation.interval
    : ["date", "week", "month"].includes(groupBy)
      ? groupBy
      : "month";
  const direction = DIRECTIONS.has(operation.direction) ? operation.direction : "desc";
  const limit = Math.max(1, Math.min(Number(operation.limit) || (kind === "list" ? 25 : 10), 50));
  const correctedTargets = kind === "compare" ? deterministicComparisonTargets(question, knownItemNames) : [];
  const targets = (correctedTargets.length ? correctedTargets : normalizeTargets(operation.targets, knownItemNames)).filter((target) => {
    if (useContext) return true;
    if (target.dimension === "item") return itemAppears(question, target);
    if (target.dimension === "type") return dimensionValueAppears(question, target.value, TYPE_ALIASES);
    if (target.dimension === "payment") return dimensionValueAppears(question, target.value, PAYMENT_ALIASES);
    if (target.dimension === "period") return dimensionValueAppears(question, target.value, PERIOD_ALIASES);
    const text = normalizeMessage(question);
    const label = normalizeMessage(target.label || target.value);
    const labelWithoutYear = label.replace(/\b20\d{2}\b/g, " ").replace(/\s+/g, " ").trim();
    return phraseAppears(text, label) || phraseAppears(text, labelWithoutYear);
  });
  const asksForCount = /\b(how many|how often|times|count|frequency|number of)\b/.test(normalizeMessage(question));
  return {
    kind,
    metric: asksForCount ? "count" : metric,
    groupBy,
    interval,
    direction,
    limit,
    targets,
  };
}

function looksLikeFollowUp(question = "") {
  const text = normalizeMessage(question);
  if (text.split(" ").length > 9) return false;
  return (
    /\b(it|that|those|them|same|again|what about|which dates|cash or gpay|then|also|continue|previous|above)\b/.test(text) ||
    /^(?:and\s+)?(?:how many(?: times| entries| transactions)?|how often|which dates|cash or gpay)[? ]*$/.test(text)
  );
}

function resolveDateRange(rawPlan, question, context, operations, hasItemFilter, useContext) {
  const parsedQuestion = parseDateRange(question);

  // A comparison between months/dates needs records from every target. The
  // target itself is not a global date filter (for example, "June vs July").
  const comparesTimeTargets = operations.some((operation) =>
    operation.kind === "compare" &&
    operation.targets.length >= 2 &&
    operation.targets.every((target) => ["month", "date"].includes(target.dimension))
  );
  if (comparesTimeTargets) {
    return { startDate: null, endDate: null, source: "all-time", explicit: false };
  }

  // Dates are authoritative only when the user's own sentence contains one.
  // This prevents a model-generated `dateText: today` from narrowing an
  // otherwise all-time question.
  if (parsedQuestion.explicit) return parsedQuestion;

  if (useContext && context?.dateRange) {
    return { ...context.dateRange, explicit: false, source: context.dateRange.source || "context" };
  }

  const naturallyAllTime = operations.some((operation) =>
    ["compare", "rank", "unique", "list", "trend", "balance-history"].includes(operation.kind) ||
    operation.kind === "aggregate" && operation.groupBy !== "none"
  );
  if (rawPlan.defaultRange === "all-time" || naturallyAllTime || hasItemFilter) {
    return { startDate: null, endDate: null, source: "all-time", explicit: false };
  }
  return parsedQuestion;
}

export function normalizeSemanticPlan(rawPlan = {}, {
  question = "",
  knownItemNames = [],
  context = {},
} = {}) {
  const domain = DOMAINS.has(rawPlan.domain) ? rawPlan.domain : "expense";
  // Conversation context is applied only when the user's text is genuinely
  // referential. A model cannot force an unrelated standalone question to
  // inherit the previous query's filters.
  const useContext = looksLikeFollowUp(question);
  const rawFilters = rawPlan.filters || {};
  const contextFilters = useContext ? context.filters || {} : {};
  const rawItems = Array.isArray(rawFilters.items) && rawFilters.items.length
    ? rawFilters.items
    : contextFilters.items || [];
  const itemFilters = rawItems
    .map((item) => typeof item === "string" ? item : item?.label || item?.key)
    .filter(Boolean)
    .filter((item) => !isReservedDimensionPhrase(item, knownItemNames))
    .map((item) => resolveKnownItem(item, knownItemNames))
    .filter(Boolean)
    .filter((item) => useContext || itemAppears(question, item));
  const rawOperations = Array.isArray(rawPlan.operations) && rawPlan.operations.length
    ? rawPlan.operations
    : useContext && Array.isArray(context.operations)
      ? context.operations
      : [];
  const operations = rawOperations
    .map((operation) => normalizeOperation(operation, knownItemNames, question, useContext));

  if (!operations.length && !["clarify", "out-of-domain"].includes(domain)) {
    operations.push(normalizeOperation({ kind: domain === "balance" ? "balance-current" : "aggregate", metric: "amount" }, knownItemNames, question, useContext));
  }

  const explicitTypes = explicitDimensionValues(question, TYPE_ALIASES, "type", knownItemNames);
  const explicitPayments = explicitDimensionValues(question, PAYMENT_ALIASES, "payment", knownItemNames);
  const explicitPeriods = explicitDimensionValues(question, PERIOD_ALIASES, "period", knownItemNames);
  const rawNormalizedTypes = onlyExplicitDimensionValues(
    normalizeTypes(rawFilters.types?.length ? rawFilters.types : contextFilters.types),
    question,
    TYPE_ALIASES,
    useContext
  );
  const rawNormalizedPayments = onlyExplicitDimensionValues(
    normalizePayments(
      (rawFilters.payments || rawFilters.paymentTypes)?.length
        ? rawFilters.payments || rawFilters.paymentTypes
        : contextFilters.paymentTypes
    ),
    question,
    PAYMENT_ALIASES,
    useContext
  );
  const rawNormalizedPeriods = onlyExplicitDimensionValues(
    normalizePeriods(rawFilters.periods?.length ? rawFilters.periods : contextFilters.periods),
    question,
    PERIOD_ALIASES,
    useContext
  );
  const targetAliases = comparisonTargetAliases(question, operations);
  const selectedTypes = rawNormalizedTypes.length || useContext || explicitTypes.length !== 1
    ? rawNormalizedTypes
    : explicitTypes;
  const selectedPayments = rawNormalizedPayments.length || useContext || explicitPayments.length !== 1
    ? rawNormalizedPayments
    : explicitPayments;
  const selectedPeriods = rawNormalizedPeriods.length || useContext || explicitPeriods.length !== 1
    ? rawNormalizedPeriods
    : explicitPeriods;
  const normalizedTypes = collapseCompleteDimension(
    removeCrossTargetAliases(selectedTypes, question, TYPE_ALIASES, "type", targetAliases),
    4
  );
  const normalizedPayments = collapseCompleteDimension(
    removeCrossTargetAliases(selectedPayments, question, PAYMENT_ALIASES, "payment", targetAliases),
    2
  );
  const normalizedPeriods = collapseCompleteDimension(
    removeCrossTargetAliases(selectedPeriods, question, PERIOD_ALIASES, "period", targetAliases),
    5
  );
  const hasPriceConstraint = /(?:\b(?:price|cost|amount|rupees?|rs)\b[^\d]{0,20}\d|\d[^a-z]{0,10}\b(?:rupees?|rs)\b)/.test(
    normalizeMessage(question)
  );

  const plan = {
    engine: "semantic-v1",
    originalMessage: question,
    normalizedMessage: normalizeMessage(question),
    domain,
    dateRange: resolveDateRange(rawPlan, question, context, operations, itemFilters.length > 0, useContext),
    filters: {
      items: itemFilters,
      types: normalizedTypes,
      paymentTypes: normalizedPayments,
      periods: normalizedPeriods,
      minPrice: useContext || hasPriceConstraint
        ? finiteOrNull(rawFilters.minPrice ?? contextFilters.minPrice)
        : null,
      maxPrice: useContext || hasPriceConstraint
        ? finiteOrNull(rawFilters.maxPrice ?? contextFilters.maxPrice)
        : null,
    },
    operations,
    wantsAdvice: Boolean(rawPlan.wantsAdvice) || operations.some((operation) => operation.kind === "advice"),
    clarification: String(rawPlan.clarification || "").trim(),
    confidence: Math.max(0, Math.min(1, Number(rawPlan.confidence) || 0.7)),
    usedContext: useContext,
  };

  const compareWithoutTargets = plan.operations.some(
    (operation) => operation.kind === "compare" && operation.targets.length < 2
  );
  if (compareWithoutTargets && !plan.clarification) {
    plan.clarification = "What two items, types, payment methods, periods, or dates should I compare?";
  }
  const compareAcrossDimensions = plan.operations.some((operation) =>
    operation.kind === "compare" &&
    new Set(operation.targets.map((target) => target.dimension)).size > 1
  );
  if (compareAcrossDimensions && !plan.clarification) {
    plan.clarification = "Please compare one kind of value at a time: two items, two types, two payment methods, two periods, or two dates.";
  }
  const balanceAtDateWithoutDate = plan.operations.some(
    (operation) => operation.kind === "balance-at-date"
  ) && !plan.dateRange?.explicit && !useContext;
  if (balanceAtDateWithoutDate && !plan.clarification) {
    plan.clarification = "Which date should I use to calculate your historical balance?";
  }
  const hasUnsupportedOperation = Array.isArray(rawPlan.operations) && rawPlan.operations.some(
    (operation) => operation?.kind && !OPERATION_KINDS.has(operation.kind)
  );
  if (hasUnsupportedOperation && !plan.clarification) {
    plan.clarification = "I understood the topic but not the requested calculation. Please say whether you want a total, count, average, list, ranking, comparison, trend, or balance check.";
  }
  if (plan.dateRange?.invalid && !plan.clarification) {
    plan.clarification = "That date is not valid. Please enter a real date, for example 28 February 2026 or 2026-02-28.";
  }
  if (plan.confidence < 0.45 && !plan.clarification) {
    plan.clarification = "I’m not fully sure what you want to analyse. Please mention the item or field and whether you want an amount, count, comparison, list, or trend.";
  }
  return plan;
}

export function buildNextSemanticContext(plan, result = null) {
  return {
    engine: plan.engine,
    dateRange: plan.dateRange,
    filters: plan.filters,
    operations: plan.operations,
    focusItems: plan.filters.items,
    lastResultSummary: result?.contextSummary || null,
    lastIntent: plan.domain,
  };
}
