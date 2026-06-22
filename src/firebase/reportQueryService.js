import {
  count,
  documentId,
  endBefore,
  getAggregateFromServer,
  getDocs,
  limit,
  limitToLast,
  orderBy,
  query,
  startAfter,
  sum,
  where,
} from "firebase/firestore";
import { toNumber } from "../utils/totalUtils";
import { getUserCollection } from "./userDataRefs";

function normalizeFilters(filters = {}) {
  return {
    startDate: filters.startDate || "",
    endDate: filters.endDate || "",
    type: filters.type || "all",
    paymentType: filters.paymentType || "all",
    period: filters.period || "all",
  };
}

function buildExpenseWhereConstraints(filters = {}) {
  const normalized = normalizeFilters(filters);
  const constraints = [
    where("date", ">=", normalized.startDate || "0000-01-01"),
    where("date", "<=", normalized.endDate || "9999-12-31"),
  ];
  if (normalized.type !== "all") {
    constraints.push(where("type", "==", normalized.type));
  }
  if (normalized.paymentType !== "all") {
    constraints.push(where("paymentType", "==", normalized.paymentType));
  }
  if (normalized.period !== "all") {
    constraints.push(where("period", "==", normalized.period));
  }

  return constraints;
}

function buildBalanceWhereConstraints(filters = {}) {
  const normalized = normalizeFilters(filters);
  const constraints = [
    where("date", ">=", normalized.startDate || "0000-01-01"),
    where("date", "<=", normalized.endDate || "9999-12-31"),
  ];
  if (normalized.paymentType !== "all") {
    constraints.push(where("balanceType", "==", normalized.paymentType));
  }

  return constraints;
}

function buildPageConstraint({ direction, firstDocument, lastDocument, pageSize }) {
  if (direction === "next" && lastDocument) {
    return [startAfter(lastDocument), limit(pageSize)];
  }

  if (direction === "previous" && firstDocument) {
    return [endBefore(firstDocument), limitToLast(pageSize)];
  }

  if (direction === "last") {
    return [limitToLast(pageSize)];
  }

  return [limit(pageSize)];
}

function mapSnapshot(snapshot) {
  return {
    items: snapshot.docs.map((itemDoc) => ({
      id: itemDoc.id,
      ...itemDoc.data(),
    })),
    firstDocument: snapshot.docs[0] || null,
    lastDocument: snapshot.docs[snapshot.docs.length - 1] || null,
  };
}

export async function getExpenseHistoryPage({
  filters,
  pageSize,
  direction = "first",
  firstDocument = null,
  lastDocument = null,
}) {
  const pageQuery = query(
    getUserCollection("expenses"),
    ...buildExpenseWhereConstraints(filters),
    orderBy("date", "desc"),
    orderBy("createdAt", "desc"),
    orderBy(documentId(), "desc"),
    ...buildPageConstraint({
      direction,
      firstDocument,
      lastDocument,
      pageSize,
    })
  );

  return mapSnapshot(await getDocs(pageQuery));
}

export async function getExpenseHistoryMetrics(filters) {
  const metricsQuery = query(
    getUserCollection("expenses"),
    ...buildExpenseWhereConstraints(filters)
  );
  const aggregate = await getAggregateFromServer(metricsQuery, {
    totalItems: count(),
    filteredTotal: sum("price"),
  });

  return {
    totalItems: toNumber(aggregate.data().totalItems),
    filteredTotal: toNumber(aggregate.data().filteredTotal),
  };
}

export async function getAllExpensesForReport(filters = {}) {
  const expensesQuery = query(
    getUserCollection("expenses"),
    ...buildExpenseWhereConstraints(filters),
    orderBy("date", "desc"),
    orderBy("createdAt", "desc"),
    orderBy(documentId(), "desc")
  );
  const snapshot = await getDocs(expensesQuery);

  return snapshot.docs.map((expenseDoc) => ({
    id: expenseDoc.id,
    ...expenseDoc.data(),
  }));
}

export async function getBalanceHistoryPage({
  filters,
  pageSize,
  direction = "first",
  firstDocument = null,
  lastDocument = null,
}) {
  const pageQuery = query(
    getUserCollection("balanceHistory"),
    ...buildBalanceWhereConstraints(filters),
    orderBy("date", "desc"),
    orderBy("createdAt", "desc"),
    orderBy(documentId(), "desc"),
    ...buildPageConstraint({
      direction,
      firstDocument,
      lastDocument,
      pageSize,
    })
  );

  return mapSnapshot(await getDocs(pageQuery));
}

export async function getBalanceHistoryCount(filters) {
  const countQuery = query(
    getUserCollection("balanceHistory"),
    ...buildBalanceWhereConstraints(filters)
  );
  const aggregate = await getAggregateFromServer(countQuery, {
    totalItems: count(),
  });

  return toNumber(aggregate.data().totalItems);
}

export async function getAllBalanceHistoryForReport(filters = {}) {
  const balanceQuery = query(
    getUserCollection("balanceHistory"),
    ...buildBalanceWhereConstraints(filters),
    orderBy("date", "desc"),
    orderBy("createdAt", "desc"),
    orderBy(documentId(), "desc")
  );
  const snapshot = await getDocs(balanceQuery);

  return snapshot.docs.map((historyDoc) => ({
    id: historyDoc.id,
    ...historyDoc.data(),
  }));
}
