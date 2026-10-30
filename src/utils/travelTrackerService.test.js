import test from "node:test";
import assert from "node:assert/strict";
import {
  transformTripToExpense,
  mergeExpensesWithTravel,
  getTravelExpensesOnly,
} from "../services/travelTrackerService.js";

test("transformTripToExpense correctly maps a travel trip to an expense record", () => {
  const mockTrip = {
    id: "42",
    date: "2026-10-15",
    from: "Srivi",
    to: "Trichy",
    mode: "Train",
    status: "Completed",
    cost: 180,
    favorite: true,
    legs: [{ from: "Srivi", to: "Trichy", mode: "Train" }],
    notes: "Express train journey",
  };

  const expense = transformTripToExpense(mockTrip);

  assert.equal(expense.id, "travel_42");
  assert.equal(expense.originalTripId, "42");
  assert.equal(expense.name, "Trip: Srivi → Trichy");
  assert.equal(expense.price, 180);
  assert.equal(expense.date, "2026-10-15");
  assert.equal(expense.isTravelLog, true);
  assert.equal(expense.paymentType, "gpay");
  assert.equal(expense.travelDetails.mode, "Train");
  assert.equal(expense.travelDetails.status, "Completed");
});

test("mergeExpensesWithTravel correctly combines and sorts expenses chronologically", () => {
  const regularExpenses = [
    { id: "e1", date: "2026-10-14", name: "Lunch", price: 120 },
    { id: "e2", date: "2026-10-16", name: "Groceries", price: 300 },
  ];

  const travelTrips = [
    {
      id: "t1",
      date: "2026-10-15",
      from: "Srivi",
      to: "Madurai",
      cost: 50,
      mode: "Bus",
    },
  ];

  const merged = mergeExpensesWithTravel(regularExpenses, travelTrips);

  assert.equal(merged.length, 3);
  assert.equal(merged[0].date, "2026-10-16");
  assert.equal(merged[0].name, "Groceries");
  assert.equal(merged[1].date, "2026-10-15");
  assert.equal(merged[1].isTravelLog, true);
  assert.equal(merged[2].date, "2026-10-14");
  assert.equal(merged[2].name, "Lunch");
});

test("getTravelExpensesOnly returns only travel items sorted newest first", () => {
  const trips = [
    { id: "1", date: "2026-10-10", from: "Trichy", to: "Madurai", cost: 90, mode: "Mixed" },
    { id: "2", date: "2026-10-20", from: "Madurai", to: "Srivi", cost: 45, mode: "Bus" },
  ];

  const travelOnly = getTravelExpensesOnly(trips);

  assert.equal(travelOnly.length, 2);
  assert.equal(travelOnly[0].id, "travel_2");
  assert.equal(travelOnly[0].date, "2026-10-20");
  assert.equal(travelOnly[1].id, "travel_1");
  assert.equal(travelOnly[1].type, "mixed");
  assert.equal(travelOnly[1].travelDetails.displayType, "Mixed (Multi-leg)");
});

