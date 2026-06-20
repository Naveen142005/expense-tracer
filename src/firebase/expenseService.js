import {
  doc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { BALANCE_ACTIONS } from "../utils/constants";
import { getTodayDate } from "../utils/dateUtils";
import {
  calculateCashTotal,
  calculateGPayTotal,
  calculateTotal,
  toNumber,
} from "../utils/totalUtils";
import { assertClientEditAccess } from "../utils/editSession";
import { db } from "./firebaseConfig";
import {
  getUserCollection,
  getUserDocument,
  requireUserId,
} from "./userDataRefs";

export function subscribeToExpensesByDate(date, callback, errorCallback) {
  const expensesQuery = query(
    getUserCollection("expenses"),
    where("date", "==", date)
  );

  return onSnapshot(
    expensesQuery,
    (snapshot) => {
      const items = snapshot.docs.map((expenseDoc) => ({
        id: expenseDoc.id,
        ...expenseDoc.data(),
        isDraft: false,
      }));

      const sortedItems = items.sort((a, b) => {
        const aTime = a.createdAt?.seconds || 0;
        const bTime = b.createdAt?.seconds || 0;
        return aTime - bTime;
      });

      callback(sortedItems);
    },
    errorCallback
  );
}

export function subscribeToDailyTotal(date, callback, errorCallback) {
  const totalRef = getUserDocument("dailyTotals", date);

  return onSnapshot(
    totalRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        callback({ date, total: 0, cashTotal: 0, gpayTotal: 0 });
        return;
      }

      const data = snapshot.data();

      callback({
        date,
        total: toNumber(data.total),
        cashTotal: toNumber(data.cashTotal),
        gpayTotal: toNumber(data.gpayTotal),
      });
    },
    errorCallback
  );
}

export async function submitTodayExpenses({ date, draftItems }) {
  assertClientEditAccess(requireUserId());

  const settingsRef = getUserDocument("settings", "app");
  const dailyTotalRef = getUserDocument("dailyTotals", date);
  const balanceHistoryRef = doc(getUserCollection("balanceHistory"));

  const currentTransactionTotal = calculateTotal(draftItems);
  const currentTransactionCashTotal = calculateCashTotal(draftItems);
  const currentTransactionGPayTotal = calculateGPayTotal(draftItems);

  await runTransaction(db, async (transaction) => {
    const settingsSnap = await transaction.get(settingsRef);
    const dailyTotalSnap = await transaction.get(dailyTotalRef);

    const oldBalance = settingsSnap.exists()
      ? toNumber(settingsSnap.data().currentBalance)
      : 0;

    const oldDailyTotal = dailyTotalSnap.exists()
      ? toNumber(dailyTotalSnap.data().total)
      : 0;

    const oldDailyCashTotal = dailyTotalSnap.exists()
      ? toNumber(dailyTotalSnap.data().cashTotal)
      : 0;

    const oldDailyGPayTotal = dailyTotalSnap.exists()
      ? toNumber(dailyTotalSnap.data().gpayTotal)
      : 0;

    const newBalance = oldBalance - currentTransactionCashTotal;

    draftItems.forEach((item) => {
      const expenseRef = doc(getUserCollection("expenses"));

      transaction.set(expenseRef, {
        date,
        period: item.period,
        type: item.type,
        name: item.name || "",
        description: item.description || "",
        price: toNumber(item.price),
        paymentType: item.paymentType,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    transaction.set(
      dailyTotalRef,
      {
        date,
        total: oldDailyTotal + currentTransactionTotal,
        cashTotal: oldDailyCashTotal + currentTransactionCashTotal,
        gpayTotal: oldDailyGPayTotal + currentTransactionGPayTotal,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    transaction.set(
      settingsRef,
      {
        currentBalance: newBalance,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    if (currentTransactionCashTotal > 0) {
      transaction.set(balanceHistoryRef, {
        date: getTodayDate(),
        action: BALANCE_ACTIONS.EXPENSE_CASH_DEDUCTION,
        amount: currentTransactionCashTotal,
        reason: `Cash expense deduction for ${date}`,
        oldBalance,
        newBalance,
        createdAt: serverTimestamp(),
      });
    }
  });

  return {
    total: currentTransactionTotal,
    cashTotal: currentTransactionCashTotal,
    gpayTotal: currentTransactionGPayTotal,
  };
}

export async function updateExpensesForDate({ date, items }) {
  assertClientEditAccess(requireUserId());

  const expensesQuery = query(
    getUserCollection("expenses"),
    where("date", "==", date)
  );

  const existingSnapshot = await getDocs(expensesQuery);
  const batch = writeBatch(db);

  existingSnapshot.docs.forEach((expenseDoc) => {
    batch.delete(expenseDoc.ref);
  });

  const cleanedItems = items.map((item) => ({
    period: item.period,
    type: item.type,
    name: item.type === "bus" ? "" : item.name || "",
    description: item.type === "bus" ? item.description || "" : "",
    price: toNumber(item.price),
    paymentType: item.paymentType,
    createdAt: item.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));

  cleanedItems.forEach((item) => {
    const expenseRef = doc(getUserCollection("expenses"));
    batch.set(expenseRef, { date, ...item });
  });

  const total = calculateTotal(cleanedItems);
  const cashTotal = calculateCashTotal(cleanedItems);
  const gpayTotal = calculateGPayTotal(cleanedItems);
  const dailyTotalRef = getUserDocument("dailyTotals", date);

  batch.set(
    dailyTotalRef,
    {
      date,
      total,
      cashTotal,
      gpayTotal,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  await batch.commit();

  return { total, cashTotal, gpayTotal };
}

export async function getAllExpenses() {
  const snapshot = await getDocs(getUserCollection("expenses"));

  const items = snapshot.docs.map((expenseDoc) => ({
    id: expenseDoc.id,
    ...expenseDoc.data(),
  }));

  return items.sort((a, b) => {
    if (a.date === b.date) {
      const aTime = a.createdAt?.seconds || 0;
      const bTime = b.createdAt?.seconds || 0;
      return bTime - aTime;
    }

    return b.date.localeCompare(a.date);
  });
}
