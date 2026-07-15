import test from "node:test";
import assert from "node:assert/strict";
import { buildQueryPlan } from "./queryPlanner.js";

test("fallback planner reaches advice intent", () => {
  const plan = buildQueryPlan("Give me saving advice based on my expenses", {}, []);
  assert.equal(plan.intent, "advice");
});

test("fallback planner preserves lowest and top-N ranking intents", () => {
  const lowest = buildQueryPlan("lowest spending date this month", {}, []);
  assert.equal(lowest.intent, "lowest-date");

  const top = buildQueryPlan("top 3 dates this month", {}, []);
  assert.equal(top.intent, "top-date");
  assert.equal(top.topLimit, 3);
});

test("fallback planner understands type and payment aliases as filters", () => {
  const meals = buildQueryPlan("how much did I spend on meals this month", {}, []);
  assert.equal(meals.filters.type, "food");

  const cash = buildQueryPlan("how many cash expenses this month", {}, []);
  assert.equal(cash.filters.paymentType, "cash");
});

