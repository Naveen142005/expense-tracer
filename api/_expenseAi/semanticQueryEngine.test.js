import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSemanticPlan } from "./semanticPlanner.js";
import { applySemanticFilters, executeSemanticPlan } from "./semanticQueryEngine.js";
import { buildSemanticReply } from "./semanticResponseBuilder.js";

const expenses = [
  { date: "2026-06-01", period: "morning", type: "food", name: "Idly", price: 10, paymentType: "cash" },
  { date: "2026-06-02", period: "night", type: "food", name: "Idly", price: 20, paymentType: "gpay" },
  { date: "2026-06-03", period: "night", type: "food", name: "Dosa", price: 30, paymentType: "cash" },
  { date: "2026-07-01", period: "morning", type: "food", name: "Dosa", price: 40, paymentType: "gpay" },
  { date: "2026-07-02", period: "morning", type: "snacks", name: "Tea", price: 5, paymentType: "cash" },
];

function planFrom(raw, question = "test") {
  return normalizeSemanticPlan(raw, { question, knownItemNames: ["Idly", "Dosa", "Tea"] });
}

test("combines item, payment, period, type, date and price filters", () => {
  const plan = planFrom({
    domain: "expense",
    dateText: "June 2026",
    filters: { items: ["Idly"], types: ["food"], payments: ["gpay"], periods: ["night"], minPrice: 15 },
    operations: [{ kind: "aggregate", metric: "amount" }],
  }, "Idly food using gpay at night above 15 rupees in June 2026");
  const filtered = applySemanticFilters(expenses, plan);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].price, 20);
});

test("executes amount and frequency comparisons independently", () => {
  const amountPlan = planFrom({
    domain: "expense",
    defaultRange: "all-time",
    operations: [{ kind: "compare", metric: "amount", targets: [
      { dimension: "item", value: "Idly" },
      { dimension: "item", value: "Dosa" },
    ] }],
  }, "Compare Idly vs Dosa");
  const amount = executeSemanticPlan({ expenses, plan: amountPlan }).operationResults[0];
  assert.equal(amount.highest.label, "Dosa");
  assert.equal(amount.difference, 40);

  const countPlan = planFrom({
    domain: "expense",
    defaultRange: "all-time",
    operations: [{ kind: "compare", metric: "count", targets: [
      { dimension: "item", value: "Idly" },
      { dimension: "item", value: "Dosa" },
    ] }],
  }, "How many times: Idly vs Dosa?");
  const count = executeSemanticPlan({ expenses, plan: countPlan }).operationResults[0];
  assert.equal(count.tied, true);
});

test("supports rankings, unique items and monthly trends", () => {
  const plan = planFrom({
    domain: "expense",
    defaultRange: "all-time",
    operations: [
      { kind: "rank", metric: "amount", groupBy: "item", direction: "asc", limit: 2 },
      { kind: "unique", metric: "unique-count", groupBy: "item", limit: 10 },
      { kind: "trend", metric: "amount", groupBy: "month", limit: 12 },
    ],
  });
  const result = executeSemanticPlan({ expenses, plan });
  assert.equal(result.operationResults[0].rows[0].label, "Tea");
  assert.equal(result.baseStats.uniqueCount, 3);
  assert.equal(result.operationResults[2].rows.length, 2);
  assert.equal(result.operationResults[2].change, -15);
});

test("ranks item price trends across months", () => {
  const plan = planFrom({
    domain: "expense",
    defaultRange: "all-time",
    operations: [
      { kind: "trend", metric: "average", groupBy: "item", interval: "month", direction: "desc", limit: 5 },
    ],
  });
  const trend = executeSemanticPlan({ expenses, plan }).operationResults[0];
  assert.equal(trend.ranked, true);
  assert.equal(trend.rows[0].label, "Dosa");
  assert.equal(trend.rows[0].change, 10);
});

test("answers maximum price, weekday ranking and month comparisons", () => {
  const plan = planFrom({
    domain: "expense",
    defaultRange: "all-time",
    operations: [
      { kind: "aggregate", metric: "max", groupBy: "none" },
      { kind: "rank", metric: "amount", groupBy: "day-of-week", direction: "desc", limit: 7 },
      { kind: "compare", metric: "amount", targets: [
        { dimension: "month", value: "June 2026" },
        { dimension: "month", value: "July 2026" },
      ] },
    ],
  }, "Show maximum price, weekday ranking, and compare June vs July 2026");
  const result = executeSemanticPlan({ expenses, plan });
  assert.equal(result.operationResults[0].value, 40);
  assert.ok(result.operationResults[1].rows.length >= 1);
  assert.equal(result.operationResults[2].rows[0].value, 60);
  assert.equal(result.operationResults[2].rows[1].value, 45);
});

test("lists matching records without losing their dimensions", () => {
  const plan = planFrom({
    domain: "expense",
    dateText: "June 2026",
    filters: { types: ["food"] },
    operations: [{ kind: "list", metric: "amount", limit: 10 }],
  }, "List food expenses in June 2026");
  const rows = executeSemanticPlan({ expenses, plan }).operationResults[0].rows;
  assert.equal(rows.length, 3);
  assert.deepEqual(Object.keys(rows[0]).sort(), ["amount", "date", "item", "paymentType", "period", "type"]);
});

test("reconstructs historical cash and gpay balances", () => {
  const plan = planFrom({
    domain: "balance",
    dateText: "1 July 2026",
    operations: [{ kind: "balance-at-date" }],
  }, "What was my balance on 1 July 2026?");
  const balanceHistory = [
    { date: "2026-07-03", action: "add", balanceType: "cash", appliedAmount: 100 },
    { date: "2026-07-04", action: "reduce", balanceType: "gpay", appliedAmount: 20 },
  ];
  const currentBalance = { exists: true, cashBalance: 500, gpayBalance: 100, totalBalance: 600 };
  const result = executeSemanticPlan({ expenses: [], balanceHistory, currentBalance, plan });
  const historical = result.operationResults[0].balance;
  assert.equal(historical.cashBalance, 400);
  assert.equal(historical.gpayBalance, 120);
  assert.equal(historical.totalBalance, 520);
});

test("does not call two missing comparison targets equal", () => {
  const plan = planFrom({
    domain: "expense",
    defaultRange: "all-time",
    filters: { items: ["Poori", "Egg"] },
    operations: [{ kind: "compare", metric: "amount", targets: [
      { dimension: "item", value: "Poori" },
      { dimension: "item", value: "Egg" },
    ] }],
  }, "Compare Poori vs Egg");
  const result = executeSemanticPlan({ expenses, plan });
  const reply = buildSemanticReply(result, plan);
  assert.match(reply, /couldn't find submitted expense records/i);
  assert.doesNotMatch(reply, /they are equal/i);
});

test("regression: date-free Idly versus Egg compares all submitted history", () => {
  const userExpenses = [
    { date: "2026-06-10", period: "morning", type: "food", name: "Idly", price: 8, paymentType: "cash" },
    { date: "2026-07-13", period: "night", type: "food", name: "Idly", price: 21, paymentType: "gpay" },
    { date: "2026-06-15", period: "morning", type: "food", name: "Egg", price: 12, paymentType: "cash" },
  ];
  const plan = normalizeSemanticPlan({
    domain: "expense",
    dateText: "14 July 2026",
    defaultRange: "current-month",
    filters: {
      items: ["idly", "Egg"],
      types: ["food"],
      payments: ["cash", "gpay"],
      periods: ["morning", "afternoon", "evening", "night", "other"],
    },
    operations: [{ kind: "compare", metric: "amount", targets: [
      { dimension: "item", value: "idly" },
      { dimension: "item", value: "Egg" },
    ] }],
  }, { question: "Compare idly vs egg.", knownItemNames: ["Idly", "Egg"] });

  const result = executeSemanticPlan({ expenses: userExpenses, plan });
  assert.equal(result.range.source, "all-time");
  assert.deepEqual(result.operationResults[0].rows.map((row) => row.value), [29, 12]);
  assert.equal(result.operationResults[0].highest.label, "Idly");
});

test("regression: Food versus Bus compares type totals for the whole requested month", () => {
  const userExpenses = [
    { date: "2026-07-01", period: "morning", type: "food", name: "Idly", price: 8, paymentType: "cash" },
    { date: "2026-07-08", period: "afternoon", type: "bus", name: "To Office", price: 12, paymentType: "cash" },
    { date: "2026-07-13", period: "night", type: "food", name: "Dosa", price: 21, paymentType: "gpay" },
    { date: "2026-06-30", period: "night", type: "bus", name: "To Room", price: 100, paymentType: "gpay" },
  ];
  const plan = normalizeSemanticPlan({
    domain: "expense",
    dateText: "this month",
    filters: { items: ["food", "bus"] },
    operations: [{ kind: "compare", metric: "amount", targets: [
      { dimension: "item", value: "food" },
      { dimension: "item", value: "bus" },
    ] }],
  }, {
    question: "Compare food and bus spending this month.",
    knownItemNames: ["Idly", "Dosa", "To Office", "To Room"],
  });

  const result = executeSemanticPlan({ expenses: userExpenses, plan });
  assert.equal(result.range.source, "this-month");
  assert.deepEqual(result.operationResults[0].rows.map((row) => row.value), [29, 12]);
  assert.equal(result.operationResults[0].highest.label, "food");
  const reply = buildSemanticReply(result, plan);
  assert.match(reply, /Food:\*\* ₹29(?:\.00)?/i);
  assert.match(reply, /Bus:\*\* ₹12(?:\.00)?/i);
  assert.doesNotMatch(reply, /items: food, bus/i);
});
