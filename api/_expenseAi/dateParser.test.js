import test from "node:test";
import assert from "node:assert/strict";
import { parseDateRange } from "./dateParser.js";
import { addDays, getKolkataTodayParts } from "./utils.js";

test("parses between ranges without collapsing to the first date", () => {
  assert.deepEqual(parseDateRange("between June 20 2026 and June 30 2026"), {
    startDate: "2026-06-20",
    endDate: "2026-06-30",
    source: "custom-range",
    explicit: true,
  });
});

test("supports rolling day and relative-day ranges", () => {
  const today = getKolkataTodayParts().dateString;
  assert.deepEqual(parseDateRange("last 7 days"), {
    startDate: addDays(today, -6),
    endDate: today,
    source: "last-n-days",
    explicit: true,
  });
  assert.deepEqual(parseDateRange("2 days ago"), {
    startDate: addDays(today, -2),
    endDate: addDays(today, -2),
    source: "days-ago",
    explicit: true,
  });
});

test("rejects impossible calendar dates", () => {
  const result = parseDateRange("31/02/2026");
  assert.equal(result.invalid, true);
  assert.equal(result.source, "invalid-date");
});

test("supports week, year and quarter to-date periods", () => {
  assert.equal(parseDateRange("week to date").source, "week-to-date");
  assert.equal(parseDateRange("year to date").source, "year-to-date");
  assert.equal(parseDateRange("this quarter").source, "this-quarter");
  assert.equal(parseDateRange("last quarter").source, "last-quarter");
});

