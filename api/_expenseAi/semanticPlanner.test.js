import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSemanticPlan, resolveKnownItem } from "./semanticPlanner.js";

test("resolves common spelling differences and small item typos", () => {
  assert.equal(resolveKnownItem("idli", ["Idly", "Dosa"]).label, "Idly");
  assert.equal(resolveKnownItem("dosaa", ["Idly", "Dosa"]).label, "Dosa");
});

test("normalizes a multi-operation filtered query plan", () => {
  const plan = normalizeSemanticPlan(
    {
      domain: "expense",
      dateText: "June 2026",
      filters: { items: ["idli"], types: ["meals"], payments: ["google pay"], periods: ["night"] },
      operations: [
        { kind: "aggregate", metric: "amount", groupBy: "none" },
        { kind: "rank", metric: "count", groupBy: "date", direction: "desc", limit: 3 },
      ],
      confidence: 0.95,
    },
    { question: "analyse food idli using google pay at night in June 2026", knownItemNames: ["Idly", "Dosa"] }
  );

  assert.equal(plan.dateRange.startDate, "2026-06-01");
  assert.deepEqual(plan.filters.items.map((item) => item.label), ["Idly"]);
  assert.deepEqual(plan.filters.types, ["food"]);
  assert.deepEqual(plan.filters.paymentTypes, ["gpay"]);
  assert.deepEqual(plan.filters.periods, ["night"]);
  assert.equal(plan.operations.length, 2);
  assert.equal(plan.operations[1].limit, 3);
});

test("requires clarification for incomplete comparisons and invalid dates", () => {
  const comparison = normalizeSemanticPlan(
    { domain: "expense", operations: [{ kind: "compare", metric: "amount", targets: ["Idly"] }] },
    { question: "compare idly", knownItemNames: ["Idly"] }
  );
  assert.match(comparison.clarification, /two items/i);

  const invalidDate = normalizeSemanticPlan(
    { domain: "expense", dateText: "31/02/2026", operations: [{ kind: "aggregate", metric: "amount" }] },
    { question: "total on 31/02/2026" }
  );
  assert.match(invalidDate.clarification, /date is not valid/i);
});

test("inherits filters, date range and operations for conversational follow-ups", () => {
  const context = {
    dateRange: { startDate: "2026-06-01", endDate: "2026-06-30", source: "month" },
    filters: { items: [{ key: "idly", label: "Idly" }], types: [], paymentTypes: [], periods: [] },
    operations: [{ kind: "aggregate", metric: "amount", groupBy: "none", direction: "desc", limit: 10, targets: [] }],
  };
  const plan = normalizeSemanticPlan(
    { domain: "expense", useContext: true, operations: [{ kind: "aggregate", metric: "count" }] },
    { question: "how many times?", knownItemNames: ["Idly", "Dosa"], context }
  );
  assert.equal(plan.dateRange.startDate, "2026-06-01");
  assert.equal(plan.filters.items[0].label, "Idly");
  assert.equal(plan.operations[0].metric, "count");
});

test("normalizes month and exact-date comparison targets", () => {
  const plan = normalizeSemanticPlan(
    {
      domain: "expense",
      defaultRange: "all-time",
      operations: [{ kind: "compare", metric: "amount", targets: [
        { dimension: "month", value: "June 2026" },
        { dimension: "month", value: "July 2026" },
      ] }],
    },
    { question: "compare June and July" }
  );
  assert.deepEqual(plan.operations[0].targets.map((target) => target.value), ["2026-06", "2026-07"]);
  assert.equal(plan.dateRange.source, "all-time");
});

test("does not let the model invent today or unrelated filters", () => {
  const plan = normalizeSemanticPlan(
    {
      domain: "expense",
      dateText: "today",
      defaultRange: "current-month",
      filters: {
        items: ["Idly", "Egg"],
        types: ["food"],
        payments: ["cash", "gpay"],
        periods: ["morning", "afternoon", "evening", "night", "other"],
        minPrice: 10,
      },
      operations: [{
        kind: "compare",
        metric: "amount",
        targets: [
          { dimension: "item", value: "Idly" },
          { dimension: "item", value: "Egg" },
        ],
      }],
    },
    { question: "Compare idli vs egg", knownItemNames: ["Idly", "Egg"] }
  );

  assert.equal(plan.dateRange.source, "all-time");
  assert.deepEqual(plan.filters.items.map((item) => item.label), ["Idly", "Egg"]);
  assert.deepEqual(plan.filters.types, []);
  assert.deepEqual(plan.filters.paymentTypes, []);
  assert.deepEqual(plan.filters.periods, []);
  assert.equal(plan.filters.minPrice, null);
  assert.deepEqual(plan.operations[0].targets.map((target) => target.label), ["Idly", "Egg"]);
});

test("honours only dates and filters explicitly written by the user", () => {
  const plan = normalizeSemanticPlan(
    {
      domain: "expense",
      dateText: "all time",
      filters: {
        types: ["food", "bus"],
        payments: ["cash", "gpay"],
        periods: ["morning", "night"],
      },
      operations: [{ kind: "aggregate", metric: "amount" }],
    },
    { question: "Food spending using cash in the morning today" }
  );

  assert.equal(plan.dateRange.source, "today");
  assert.deepEqual(plan.filters.types, ["food"]);
  assert.deepEqual(plan.filters.paymentTypes, ["cash"]);
  assert.deepEqual(plan.filters.periods, ["morning"]);
});

test("defaults item totals to all time and generic totals to this month", () => {
  const itemPlan = normalizeSemanticPlan(
    {
      domain: "expense",
      dateText: "today",
      defaultRange: "current-month",
      filters: { items: ["Idly"] },
      operations: [{ kind: "aggregate", metric: "amount" }],
    },
    { question: "How much did I spend on idli?", knownItemNames: ["Idly"] }
  );
  assert.equal(itemPlan.dateRange.source, "all-time");

  const totalPlan = normalizeSemanticPlan(
    {
      domain: "expense",
      dateText: "today",
      defaultRange: "current-month",
      operations: [{ kind: "aggregate", metric: "amount" }],
    },
    { question: "How much did I spend?" }
  );
  assert.equal(totalPlan.dateRange.source, "default-current-month");
});

test("forces frequency questions to use count", () => {
  const plan = normalizeSemanticPlan(
    {
      domain: "expense",
      defaultRange: "all-time",
      filters: { items: ["Idly"] },
      operations: [{ kind: "aggregate", metric: "amount" }],
    },
    { question: "How many times did I buy idli?", knownItemNames: ["Idly"] }
  );
  assert.equal(plan.operations[0].metric, "count");
});

test("does not inherit old filters for a standalone count question", () => {
  const context = {
    dateRange: { startDate: "2026-06-01", endDate: "2026-06-30", source: "month" },
    filters: {
      items: [{ key: "idly", label: "Idly" }],
      types: ["food"],
      paymentTypes: ["cash"],
      periods: ["night"],
    },
  };
  const plan = normalizeSemanticPlan(
    {
      domain: "expense",
      useContext: true,
      operations: [{ kind: "aggregate", metric: "amount" }],
    },
    { question: "How many expenses today?", context, knownItemNames: ["Idly"] }
  );

  assert.equal(plan.usedContext, false);
  assert.equal(plan.dateRange.source, "today");
  assert.deepEqual(plan.filters.items, []);
  assert.deepEqual(plan.filters.paymentTypes, []);
  assert.equal(plan.operations[0].metric, "count");
});

test("uses all time for trends and balance history without a date", () => {
  const trend = normalizeSemanticPlan(
    { domain: "expense", operations: [{ kind: "trend", metric: "amount", groupBy: "month" }] },
    { question: "Show my spending trend" }
  );
  assert.equal(trend.dateRange.source, "all-time");

  const history = normalizeSemanticPlan(
    { domain: "balance", operations: [{ kind: "balance-history" }] },
    { question: "Show my balance history" }
  );
  assert.equal(history.dateRange.source, "all-time");
});

test("requires a date for historical balance", () => {
  const plan = normalizeSemanticPlan(
    { domain: "balance", operations: [{ kind: "balance-at-date" }] },
    { question: "What was my old balance?" }
  );
  assert.match(plan.clarification, /which date/i);
});

test("corrects Food versus Bus when the model misclassifies types as items", () => {
  const plan = normalizeSemanticPlan(
    {
      domain: "expense",
      dateText: "this month",
      filters: { items: ["food", "bus"] },
      operations: [{ kind: "compare", metric: "amount", targets: [
        { dimension: "item", value: "food" },
        { dimension: "item", value: "bus" },
      ] }],
    },
    { question: "Compare food and bus spending this month.", knownItemNames: ["Idly", "To Office"] }
  );

  assert.equal(plan.dateRange.source, "this-month");
  assert.deepEqual(plan.filters.items, []);
  assert.deepEqual(plan.operations[0].targets.map((target) => target.dimension), ["type", "type"]);
  assert.deepEqual(plan.operations[0].targets.map((target) => target.value), ["food", "bus"]);
});

test("corrects payment and period comparisons independently of the model", () => {
  const payment = normalizeSemanticPlan(
    {
      domain: "expense",
      filters: { items: ["cash", "gpay"] },
      operations: [{ kind: "compare", metric: "amount", targets: ["cash", "gpay"] }],
    },
    { question: "Compare Cash vs GPay" }
  );
  assert.deepEqual(payment.operations[0].targets.map((target) => target.dimension), ["payment", "payment"]);
  assert.deepEqual(payment.filters.items, []);

  const period = normalizeSemanticPlan(
    {
      domain: "expense",
      filters: { items: ["morning", "night"] },
      operations: [{ kind: "compare", metric: "amount", targets: ["morning", "night"] }],
    },
    { question: "Compare Morning and Night spending" }
  );
  assert.deepEqual(period.operations[0].targets.map((target) => target.dimension), ["period", "period"]);
  assert.deepEqual(period.filters.items, []);
});

test("does not turn the shared word Other into a cross-dimension filter", () => {
  const periods = normalizeSemanticPlan(
    {
      domain: "expense",
      filters: { types: ["custom"] },
      operations: [{ kind: "compare", metric: "amount", targets: ["morning", "other"] }],
    },
    { question: "Compare Morning vs Other" }
  );
  assert.deepEqual(periods.operations[0].targets.map((target) => target.dimension), ["period", "period"]);
  assert.deepEqual(periods.filters.types, []);

  const types = normalizeSemanticPlan(
    {
      domain: "expense",
      filters: { periods: ["other"] },
      operations: [{ kind: "compare", metric: "amount", targets: ["food", "other"] }],
    },
    { question: "Compare Food vs Other type" }
  );
  assert.deepEqual(types.operations[0].targets.map((target) => target.dimension), ["type", "type"]);
  assert.deepEqual(types.filters.periods, []);
});

test("derives an explicitly written category when the model puts it in the wrong filter", () => {
  const plan = normalizeSemanticPlan(
    {
      domain: "expense",
      filters: { items: ["food"] },
      operations: [{ kind: "aggregate", metric: "amount" }],
    },
    { question: "How much was food spending this month?" }
  );

  assert.deepEqual(plan.filters.items, []);
  assert.deepEqual(plan.filters.types, ["food"]);
  assert.equal(plan.dateRange.source, "this-month");
});
