import {
  count,
  getAggregateFromServer,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  serverTimestamp,
  sum,
  where,
  writeBatch,
} from "firebase/firestore";
import { getTodayDate } from "../utils/dateUtils";
import { toNumber } from "../utils/totalUtils";
import { db } from "./firebaseConfig";
import {
  getUserCollection,
  getUserDocument,
  requireUserId,
} from "./userDataRefs";

const REPORT_STATS_VERSION = 1;
const REPORT_STATS_DOC_ID = "overview";
const MAX_BATCH_OPERATIONS = 400;
const initializationPromises = new Map();

function getExpenseLabel(item = {}) {
  return String(item.name || item.description || "unknown").trim() || "unknown";
}

function getItemStatId(label) {
  const encoded = encodeURIComponent(label);

  if (encoded.length <= 1200) return encoded;

  let hash = 2166136261;
  for (let index = 0; index < label.length; index += 1) {
    hash ^= label.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `${(hash >>> 0).toString(36)}-${encoded.slice(0, 1100)}`;
}

function aggregateExpenses(items = []) {
  return items.reduce(
    (result, item) => {
      const price = toNumber(item.price);
      const type = item.type || "unknown";
      const period = item.period || "unknown";
      const label = getExpenseLabel(item);
      const itemStat = result.itemStats.get(label) || { count: 0, total: 0 };

      result.expenseCount += 1;
      result.total += price;
      if (item.paymentType === "cash") result.cashTotal += price;
      if (item.paymentType === "gpay") result.gpayTotal += price;
      result.typeTotals[type] = (result.typeTotals[type] || 0) + price;
      result.periodTotals[period] = (result.periodTotals[period] || 0) + price;
      itemStat.count += 1;
      itemStat.total += price;
      result.itemStats.set(label, itemStat);

      return result;
    },
    {
      expenseCount: 0,
      total: 0,
      cashTotal: 0,
      gpayTotal: 0,
      typeTotals: {},
      periodTotals: {},
      itemStats: new Map(),
    }
  );
}

function subtractMaps(newValues, oldValues) {
  const result = {};
  const keys = new Set([
    ...Object.keys(oldValues || {}),
    ...Object.keys(newValues || {}),
  ]);

  keys.forEach((key) => {
    const difference = toNumber(newValues?.[key]) - toNumber(oldValues?.[key]);
    if (difference !== 0) result[key] = difference;
  });

  return result;
}

function buildStatsDelta(oldItems = [], newItems = []) {
  const oldStats = aggregateExpenses(oldItems);
  const newStats = aggregateExpenses(newItems);
  const itemDeltas = new Map();
  const labels = new Set([
    ...oldStats.itemStats.keys(),
    ...newStats.itemStats.keys(),
  ]);

  labels.forEach((label) => {
    const oldItem = oldStats.itemStats.get(label) || { count: 0, total: 0 };
    const newItem = newStats.itemStats.get(label) || { count: 0, total: 0 };
    const countDifference = newItem.count - oldItem.count;
    const totalDifference = newItem.total - oldItem.total;

    if (countDifference !== 0 || totalDifference !== 0) {
      itemDeltas.set(label, {
        count: countDifference,
        total: totalDifference,
      });
    }
  });

  return {
    expenseCount: newStats.expenseCount - oldStats.expenseCount,
    total: newStats.total - oldStats.total,
    cashTotal: newStats.cashTotal - oldStats.cashTotal,
    gpayTotal: newStats.gpayTotal - oldStats.gpayTotal,
    typeTotals: subtractMaps(newStats.typeTotals, oldStats.typeTotals),
    periodTotals: subtractMaps(newStats.periodTotals, oldStats.periodTotals),
    itemDeltas,
  };
}

async function commitOperations(operations) {
  for (let index = 0; index < operations.length; index += MAX_BATCH_OPERATIONS) {
    const batch = writeBatch(db);
    operations
      .slice(index, index + MAX_BATCH_OPERATIONS)
      .forEach((operation) => operation(batch));
    await batch.commit();
  }
}

async function rebuildReportStats() {
  const expenseSnapshot = await getDocs(getUserCollection("expenses"));
  const expenses = expenseSnapshot.docs.map((expenseDoc) => expenseDoc.data());
  const stats = aggregateExpenses(expenses);
  const existingItemStats = await getDocs(getUserCollection("reportItemStats"));

  await commitOperations(
    existingItemStats.docs.map(
      (itemDoc) => (batch) => batch.delete(itemDoc.ref)
    )
  );

  const itemOperations = [...stats.itemStats.entries()].map(
    ([label, itemStat]) => (batch) => {
      batch.set(getUserDocument("reportItemStats", getItemStatId(label)), {
        label,
        count: itemStat.count,
        total: itemStat.total,
        updatedAt: serverTimestamp(),
      });
    }
  );

  await commitOperations(itemOperations);

  await writeBatch(db)
    .set(getUserDocument("reportStats", REPORT_STATS_DOC_ID), {
      schemaVersion: REPORT_STATS_VERSION,
      expenseCount: stats.expenseCount,
      total: stats.total,
      cashTotal: stats.cashTotal,
      gpayTotal: stats.gpayTotal,
      typeTotals: stats.typeTotals,
      periodTotals: stats.periodTotals,
      rebuiltAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    .commit();

  return stats;
}

export async function ensureReportStats() {
  const userId = requireUserId();
  const existingPromise = initializationPromises.get(userId);
  if (existingPromise) return existingPromise;

  const initializationPromise = (async () => {
    const overviewRef = getUserDocument("reportStats", REPORT_STATS_DOC_ID);
    const overviewSnapshot = await getDoc(overviewRef);

    if (
      overviewSnapshot.exists() &&
      toNumber(overviewSnapshot.data().schemaVersion) === REPORT_STATS_VERSION
    ) {
      return overviewSnapshot.data();
    }

    return rebuildReportStats();
  })();

  initializationPromises.set(userId, initializationPromise);

  try {
    return await initializationPromise;
  } catch (error) {
    initializationPromises.delete(userId);
    throw error;
  }
}

export async function prepareReportStatsUpdate(
  transaction,
  oldItems = [],
  newItems = []
) {
  const overviewRef = getUserDocument("reportStats", REPORT_STATS_DOC_ID);
  const overviewSnapshot = await transaction.get(overviewRef);
  const initialized =
    overviewSnapshot.exists() &&
    toNumber(overviewSnapshot.data().schemaVersion) === REPORT_STATS_VERSION;

  return {
    initialized,
    overviewRef,
    delta: initialized ? buildStatsDelta(oldItems, newItems) : null,
  };
}

export function applyPreparedReportStatsUpdate(transaction, preparedUpdate) {
  if (!preparedUpdate?.initialized) return;

  const { overviewRef, delta } = preparedUpdate;
  const overviewUpdate = {
    expenseCount: increment(delta.expenseCount),
    total: increment(delta.total),
    cashTotal: increment(delta.cashTotal),
    gpayTotal: increment(delta.gpayTotal),
    updatedAt: serverTimestamp(),
  };

  Object.entries(delta.typeTotals).forEach(([key, value]) => {
    overviewUpdate[`typeTotals.${key}`] = increment(value);
  });

  Object.entries(delta.periodTotals).forEach(([key, value]) => {
    overviewUpdate[`periodTotals.${key}`] = increment(value);
  });

  transaction.update(overviewRef, overviewUpdate);

  delta.itemDeltas.forEach((itemDelta, label) => {
    transaction.set(
      getUserDocument("reportItemStats", getItemStatId(label)),
      {
        label,
        count: increment(itemDelta.count),
        total: increment(itemDelta.total),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  });
}

function getMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export async function getReportOverview() {
  await ensureReportStats();

  const today = new Date();
  const todayKey = getTodayDate();
  const monthStart = `${getMonthKey(today)}-01`;
  const yearStart = `${today.getFullYear()}-01-01`;
  const dailyTotals = getUserCollection("dailyTotals");

  const [
    overviewSnapshot,
    todaySnapshot,
    monthAggregate,
    yearAggregate,
    highestDaySnapshot,
    mostUsedItemSnapshot,
  ] = await Promise.all([
    getDoc(getUserDocument("reportStats", REPORT_STATS_DOC_ID)),
    getDoc(getUserDocument("dailyTotals", todayKey)),
    getAggregateFromServer(
      query(
        dailyTotals,
        where("date", ">=", monthStart),
        where("date", "<=", todayKey)
      ),
      { total: sum("total") }
    ),
    getAggregateFromServer(
      query(
        dailyTotals,
        where("date", ">=", yearStart),
        where("date", "<=", todayKey)
      ),
      { total: sum("total") }
    ),
    getDocs(query(dailyTotals, orderBy("total", "desc"), limit(1))),
    getDocs(
      query(
        getUserCollection("reportItemStats"),
        where("count", ">", 0),
        orderBy("count", "desc"),
        limit(1)
      )
    ),
  ]);

  const overview = overviewSnapshot.exists() ? overviewSnapshot.data() : {};
  const highestDay = highestDaySnapshot.docs[0]?.data();
  const mostUsedItem = mostUsedItemSnapshot.docs[0]?.data();

  return {
    expenseCount: toNumber(overview.expenseCount),
    lifetimeTotal: toNumber(overview.total),
    lifetimeCashTotal: toNumber(overview.cashTotal),
    lifetimeGPayTotal: toNumber(overview.gpayTotal),
    todayTotal: toNumber(todaySnapshot.data()?.total),
    monthTotal: toNumber(monthAggregate.data().total),
    yearTotal: toNumber(yearAggregate.data().total),
    mostSpentDay: {
      date: highestDay?.date || "",
      total: toNumber(highestDay?.total),
    },
    mostUsedItem: {
      name: mostUsedItem?.label || "",
      count: toNumber(mostUsedItem?.count),
    },
    typeTotals: overview.typeTotals || {},
    periodTotals: overview.periodTotals || {},
  };
}

export async function getReportRecordCounts() {
  const [expenseAggregate, balanceAggregate] = await Promise.all([
    getAggregateFromServer(getUserCollection("expenses"), {
      total: count(),
    }),
    getAggregateFromServer(getUserCollection("balanceHistory"), {
      total: count(),
    }),
  ]);

  return {
    expenses: toNumber(expenseAggregate.data().total),
    balanceHistory: toNumber(balanceAggregate.data().total),
  };
}
