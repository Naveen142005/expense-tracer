import { getAdminDb } from "./firebaseAdmin.js";
import { normalizeDateValue, roundMoney, toNumber } from "./utils.js";

function normalizePaymentType(value) {
  const text = String(value || "cash").toLowerCase().replace(/\s+/g, "");
  if (text === "gpay" || text === "googlepay" || text === "upi") return "gpay";
  return "cash";
}

function normalizeExpenseData(id, data = {}) {
  return {
    id,
    ...data,
    date: normalizeDateValue(data.date || data.createdAt),
    type: String(data.type || "custom").toLowerCase(),
    period: String(data.period || "other").toLowerCase(),
    paymentType: normalizePaymentType(data.paymentType || data.payment || "cash"),
    price: roundMoney(data.price ?? data.amount ?? data.total ?? 0),
  };
}

export async function fetchExpenses(uid, dateRange) {
  const db = getAdminDb();
  const expensesRef = db.collection("users").doc(uid).collection("expenses");
  let snapshot;

  // For the user's current scale, range query is accurate and cheaper than all-time reads.
  // If no explicit range is requested, the planner defaults to current month-to-date.
  if (dateRange?.source === "all-time" || !dateRange?.startDate || !dateRange?.endDate) {
    snapshot = await expensesRef.get();
  } else {
    snapshot = await expensesRef
      .where("date", ">=", dateRange.startDate)
      .where("date", "<=", dateRange.endDate)
      .get();
  }

  return snapshot.docs.map((doc) => normalizeExpenseData(doc.id, doc.data()));
}

export async function fetchAllExpenseItemNames(uid) {
  const db = getAdminDb();
  const snapshot = await db.collection("users").doc(uid).collection("expenses").get();
  const names = new Map();

  for (const doc of snapshot.docs) {
    const item = normalizeExpenseData(doc.id, doc.data());
    const label = item.type === "bus" ? item.description || item.name || "Bus" : item.name || item.description || "Expense";
    const clean = String(label || "").trim();
    if (clean) names.set(clean.toLowerCase(), clean);
  }

  return [...names.values()];
}

function normalizeBalanceData(data = {}) {
  const hasCashBalance = data.cashBalance !== undefined && data.cashBalance !== null;
  const hasCurrentBalance = data.currentBalance !== undefined && data.currentBalance !== null;
  const cashBalance = hasCashBalance
    ? roundMoney(data.cashBalance)
    : hasCurrentBalance
      ? roundMoney(data.currentBalance)
      : 0;
  const gpayBalance = Math.max(0, roundMoney(data.gpayBalance));

  return {
    cashBalance,
    gpayBalance,
    totalBalance: roundMoney(cashBalance + gpayBalance),
    currentBalance: cashBalance,
    updatedAt: data.updatedAt || null,
  };
}

export async function fetchCurrentBalance(uid) {
  const db = getAdminDb();
  const settingsRef = db.collection("users").doc(uid).collection("settings").doc("app");
  const settingsSnap = await settingsRef.get();

  if (!settingsSnap.exists) {
    return { exists: false, cashBalance: 0, gpayBalance: 0, totalBalance: 0, currentBalance: 0, updatedAt: null };
  }

  return { exists: true, ...normalizeBalanceData(settingsSnap.data()) };
}

export async function fetchBalanceHistory(uid) {
  const db = getAdminDb();
  const snapshot = await db.collection("users").doc(uid).collection("balanceHistory").get();
  return snapshot.docs
    .map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: normalizeDateValue(data.date || data.createdAt),
        balanceType: String(data.balanceType || "cash").toLowerCase(),
        action: String(data.action || "").toLowerCase(),
        amount: roundMoney(data.amount),
        appliedAmount: roundMoney(data.appliedAmount ?? data.amount),
        shortfall: roundMoney(data.shortfall),
        oldBalance: toNumber(data.oldBalance),
        newBalance: toNumber(data.newBalance),
        oldTotalBalance: toNumber(data.oldTotalBalance),
        newTotalBalance: toNumber(data.newTotalBalance),
      };
    })
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")) || (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}
