import test from "node:test";
import assert from "node:assert/strict";
import {
  filterExpenseTemplates,
  filterSavedRecommendations,
  isRecentDuplicate,
  sanitizeExpenseItem,
  validateExpenseItem,
} from "./expenseWorkflow.js";

const validExpense = {
  period: "morning",
  type: "food",
  name: "Idly",
  description: "",
  customCategory: "",
  price: 40,
  paymentType: "cash",
};

test("validates required expense fields without a redundant custom category", () => {
  assert.equal(validateExpenseItem(validExpense), "");
  assert.match(
    validateExpenseItem({ ...validExpense, price: 0 }),
    /greater than zero/
  );
  assert.equal(
    validateExpenseItem({
      ...validExpense,
      type: "custom",
      name: "Tablet",
      customCategory: "",
    }),
    ""
  );
});

test("sanitizes whitespace and preserves explicit status", () => {
  assert.deepEqual(
    sanitizeExpenseItem(
      {
        ...validExpense,
        name: "  Chicken   Rice  ",
        price: "120.50",
      },
      "draft"
    ),
    {
      period: "morning",
      type: "food",
      name: "Chicken Rice",
      description: "",
      customCategory: "",
      price: 120.5,
      paymentType: "cash",
      status: "draft",
    }
  );
});

test("detects only matching duplicates inside the time window", () => {
  const now = 10_000;
  assert.equal(
    isRecentDuplicate(
      validExpense,
      { ...validExpense, draftAddedAt: 8_000 },
      5_000,
      now
    ),
    true
  );
  assert.equal(
    isRecentDuplicate(
      validExpense,
      { ...validExpense, price: 50, draftAddedAt: 8_000 },
      5_000,
      now
    ),
    false
  );
  assert.equal(
    isRecentDuplicate(
      validExpense,
      { ...validExpense, draftAddedAt: 1_000 },
      5_000,
      now
    ),
    false
  );
});

test("filters only manually saved recommendations for the selected type", () => {
  const recommendations = filterSavedRecommendations({
    type: "food",
    query: "do",
    recommendations: [
      { id: "1", type: "food", label: "Dosa" },
      { id: "2", type: "food", label: "Masala Dosa" },
      { id: "3", type: "snacks", label: "Doughnut" },
    ],
  });

  assert.deepEqual(
    recommendations.map((recommendation) => recommendation.label),
    ["Dosa", "Masala Dosa"]
  );
  assert.equal(recommendations[0].price, undefined);
  assert.equal(recommendations[0].paymentType, undefined);
});

test("filters complete templates by both period and expense type", () => {
  const templates = filterExpenseTemplates({
    period: "morning",
    type: "food",
    query: "id",
    templates: [
      { id: "1", period: "morning", type: "food", name: "Idly", price: 8 },
      { id: "2", period: "night", type: "food", name: "Idly", price: 21 },
      { id: "3", period: "morning", type: "snacks", name: "Idly", price: 10 },
      { id: "4", period: "morning", type: "food", name: "Dosa", price: 15 },
    ],
  });

  assert.equal(templates.length, 1);
  assert.equal(templates[0].period, "morning");
  assert.equal(templates[0].type, "food");
  assert.equal(templates[0].price, 8);
});
