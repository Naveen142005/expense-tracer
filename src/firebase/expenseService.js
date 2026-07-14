import {
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { BALANCE_ACTIONS, PERIODS } from "../utils/constants";
import {
  reconcileCashBalance,
  reconcileGPayBalance,
} from "../utils/balanceReconciliation";
import {
  calculateCashTotal,
  calculateGPayTotal,
  calculateTotal,
  toNumber,
} from "../utils/totalUtils";
import { assertClientEditAccess } from "../utils/editSession";
import { getTodayDate } from "../utils/dateUtils";
import {
  getExpenseLabel,
  normalizeText,
  sanitizeExpenseItem,
  validateExpenseItem,
} from "../utils/expenseWorkflow";
import { db } from "./firebaseConfig";
import {
  getUserCollection,
  getUserDocument,
  requireUserId,
} from "./userDataRefs";
import {
  applyPreparedReportStatsUpdate,
  prepareReportStatsUpdate,
} from "./reportStatsService";

const BALANCE_MODEL_VERSION = 2;
const EXPENSE_TEMPLATE_TYPES = ["food", "snacks", "bus", "custom"];
const EXPENSE_TEMPLATE_PERIODS = PERIODS.map((period) => period.value);

export function subscribeToExpenseTemplates(callback, errorCallback) {
  return onSnapshot(
    getUserCollection("expenseTemplates"),
    (snapshot) => {
      const templates = snapshot.docs
        .map((templateDoc) => ({
          id: templateDoc.id,
          ...templateDoc.data(),
        }))
        .sort((a, b) => {
          const aLabel = a.type === "bus" ? a.description : a.name;
          const bLabel = b.type === "bus" ? b.description : b.name;
          return String(aLabel || "").localeCompare(String(bLabel || ""));
        });

      callback(templates);
    },
    errorCallback
  );
}

export async function saveExpenseTemplate({
  id,
  period,
  type,
  name,
  description,
  customCategory,
  price,
  paymentType,
}) {
  assertClientEditAccess(requireUserId());

  const cleanName = type === "bus" ? "" : String(name || "").trim();
  const cleanDescription =
    type === "bus" ? String(description || "").trim() : "";
  const templateLabel = type === "bus" ? cleanDescription : cleanName;
  const cleanCustomCategory =
    type === "custom" ? normalizeText(customCategory) : "";
  const priceNumber = toNumber(price);

  if (!EXPENSE_TEMPLATE_PERIODS.includes(period)) {
    throw new Error("Template period is invalid.");
  }

  if (!EXPENSE_TEMPLATE_TYPES.includes(type)) {
    throw new Error("Template expense type is invalid.");
  }

  if (!templateLabel) {
    throw new Error("Template name or description is required.");
  }

  if (priceNumber <= 0) {
    throw new Error("Template price must be greater than zero.");
  }

  if (!["cash", "gpay"].includes(paymentType)) {
    throw new Error("Template payment type is invalid.");
  }

  const existingTemplatesSnapshot = await getDocs(
    query(getUserCollection("expenseTemplates"), where("type", "==", type))
  );
  const normalizedLabel = templateLabel.toLowerCase();
  const duplicateTemplate = existingTemplatesSnapshot.docs.find(
    (templateDoc) =>
      templateDoc.id !== id &&
      templateDoc.data().period === period &&
      getExpenseLabel(templateDoc.data()).toLowerCase() === normalizedLabel
  );

  if (duplicateTemplate) {
    throw new Error(
      "A template with this name already exists for this period and type."
    );
  }

  const templateRef = id
    ? getUserDocument("expenseTemplates", id)
    : doc(getUserCollection("expenseTemplates"));

  await setDoc(
    templateRef,
    {
      period,
      type,
      name: cleanName,
      description: cleanDescription,
      customCategory: cleanCustomCategory,
      price: priceNumber,
      paymentType,
      ...(id ? {} : { createdAt: serverTimestamp() }),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return templateRef.id;
}

export async function deleteExpenseTemplate(templateId) {
  assertClientEditAccess(requireUserId());

  if (!templateId) throw new Error("Template ID is required.");
  await deleteDoc(getUserDocument("expenseTemplates", templateId));
}

export function subscribeToExpenseRecommendations(callback, errorCallback) {
  return onSnapshot(
    getUserCollection("expenseRecommendations"),
    (snapshot) => {
      const recommendations = snapshot.docs
        .map((recommendationDoc) => ({
          id: recommendationDoc.id,
          ...recommendationDoc.data(),
        }))
        .sort(
          (a, b) =>
            String(a.type || "").localeCompare(String(b.type || "")) ||
            String(a.label || "").localeCompare(String(b.label || ""), undefined, {
              sensitivity: "base",
            })
        );

      callback(recommendations);
    },
    errorCallback
  );
}

export async function saveExpenseRecommendation({ id, type, label }) {
  assertClientEditAccess(requireUserId());

  const cleanType = normalizeText(type).toLowerCase();
  const cleanLabel = normalizeText(label);

  if (!EXPENSE_TEMPLATE_TYPES.includes(cleanType)) {
    throw new Error("Recommendation expense type is invalid.");
  }

  if (!cleanLabel) {
    throw new Error("Recommendation name or description is required.");
  }

  const existingRecommendationsSnapshot = await getDocs(
    query(
      getUserCollection("expenseRecommendations"),
      where("type", "==", cleanType)
    )
  );
  const normalizedLabel = cleanLabel.toLowerCase();
  const duplicateRecommendation = existingRecommendationsSnapshot.docs.find(
    (recommendationDoc) =>
      recommendationDoc.id !== id &&
      normalizeText(recommendationDoc.data().label).toLowerCase() ===
        normalizedLabel
  );

  if (duplicateRecommendation) {
    throw new Error("This recommendation already exists for this type.");
  }

  const recommendationRef = id
    ? getUserDocument("expenseRecommendations", id)
    : doc(getUserCollection("expenseRecommendations"));

  await setDoc(
    recommendationRef,
    {
      type: cleanType,
      label: cleanLabel,
      ...(id ? {} : { createdAt: serverTimestamp() }),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return recommendationRef.id;
}

export async function deleteExpenseRecommendation(recommendationId) {
  assertClientEditAccess(requireUserId());

  if (!recommendationId) throw new Error("Recommendation ID is required.");
  await deleteDoc(
    getUserDocument("expenseRecommendations", recommendationId)
  );
}

function getWalletBalances(data = {}) {
  const cashBalance =
    data.cashBalance === undefined
      ? toNumber(data.currentBalance)
      : toNumber(data.cashBalance);

  const gpayBalance = Math.max(0, toNumber(data.gpayBalance));

  return {
    cashBalance,
    gpayBalance,
    totalBalance: cashBalance + gpayBalance,
  };
}

function getDailyBalanceImpact(data = {}) {
  const cashTotal = toNumber(data.cashTotal);
  const gpayTotal = toNumber(data.gpayTotal);
  const usesCurrentModel =
    toNumber(data.balanceModelVersion) >= BALANCE_MODEL_VERSION;

  if (!usesCurrentModel) {
    return {
      cashBalanceImpact: cashTotal,
      gpayBalanceImpact: 0,
      gpayBalanceShortfall: gpayTotal,
    };
  }

  const gpayBalanceImpact = Math.min(
    gpayTotal,
    Math.max(0, toNumber(data.gpayBalanceImpact))
  );

  return {
    cashBalanceImpact: Math.max(
      0,
      toNumber(data.cashBalanceImpact)
    ),
    gpayBalanceImpact,
    gpayBalanceShortfall: Math.max(0, gpayTotal - gpayBalanceImpact),
  };
}

export function subscribeToExpensesByDate(date, callback, errorCallback) {
  const expensesQuery = query(
    getUserCollection("expenses"),
    where("date", "==", date)
  );

  return onSnapshot(
    expensesQuery,
    (snapshot) => {
      const items = snapshot.docs
        .map((expenseDoc) => ({
          id: expenseDoc.id,
          ...expenseDoc.data(),
          status: expenseDoc.data().status || "submitted",
          isDraft: false,
        }))
        .filter((item) => item.status === "submitted");

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
        callback({
          date,
          total: 0,
          cashTotal: 0,
          gpayTotal: 0,
          cashBalanceImpact: 0,
          gpayBalanceImpact: 0,
          gpayBalanceShortfall: 0,
        });
        return;
      }

      const data = snapshot.data();

      callback({
        date,
        total: toNumber(data.total),
        cashTotal: toNumber(data.cashTotal),
        gpayTotal: toNumber(data.gpayTotal),
        ...getDailyBalanceImpact(data),
      });
    },
    errorCallback
  );
}

export async function submitTodayExpenses({ date, draftItems }) {
  assertClientEditAccess(requireUserId());

  if (!Array.isArray(draftItems) || draftItems.length === 0) {
    throw new Error("Add at least one valid expense before submitting.");
  }

  const cleanedDraftItems = draftItems.map((item) => {
    const validationError = validateExpenseItem(item);
    if (validationError) throw new Error(validationError);
    return sanitizeExpenseItem(item, "submitted");
  });

  const settingsRef = getUserDocument("settings", "app");
  const dailyTotalRef = getUserDocument("dailyTotals", date);

  const currentTransactionTotal = calculateTotal(cleanedDraftItems);
  const currentTransactionCashTotal = calculateCashTotal(cleanedDraftItems);
  const currentTransactionGPayTotal = calculateGPayTotal(cleanedDraftItems);
  const cashHistoryRef =
    currentTransactionCashTotal > 0
      ? doc(getUserCollection("balanceHistory"))
      : null;
  const gpayHistoryRef =
    currentTransactionGPayTotal > 0
      ? doc(getUserCollection("balanceHistory"))
      : null;
  let gpayDeductedAmount = 0;
  let gpayShortfall = 0;

  await runTransaction(db, async (transaction) => {
    const settingsSnap = await transaction.get(settingsRef);
    const dailyTotalSnap = await transaction.get(dailyTotalRef);
    const preparedReportStats = await prepareReportStatsUpdate(
      transaction,
      [],
      cleanedDraftItems
    );

    const settingsData = settingsSnap.exists() ? settingsSnap.data() : {};

    const oldCashBalance =
      settingsData.cashBalance === undefined
        ? toNumber(settingsData.currentBalance)
        : toNumber(settingsData.cashBalance);

    const oldGPayBalance = Math.max(0, toNumber(settingsData.gpayBalance));
    const oldTotalBalance = oldCashBalance + oldGPayBalance;

    const oldDailyTotal = dailyTotalSnap.exists()
      ? toNumber(dailyTotalSnap.data().total)
      : 0;

    const oldDailyCashTotal = dailyTotalSnap.exists()
      ? toNumber(dailyTotalSnap.data().cashTotal)
      : 0;

    const oldDailyGPayTotal = dailyTotalSnap.exists()
      ? toNumber(dailyTotalSnap.data().gpayTotal)
      : 0;

    const oldDailyImpact = getDailyBalanceImpact(
      dailyTotalSnap.exists() ? dailyTotalSnap.data() : {}
    );

    const newCashBalance = oldCashBalance - currentTransactionCashTotal;
    gpayDeductedAmount = Math.min(
      oldGPayBalance,
      currentTransactionGPayTotal
    );
    gpayShortfall = Math.max(
      0,
      currentTransactionGPayTotal - gpayDeductedAmount
    );
    const newGPayBalance = Math.max(
      0,
      oldGPayBalance - currentTransactionGPayTotal
    );
    const newTotalBalance = newCashBalance + newGPayBalance;

    cleanedDraftItems.forEach((item) => {
      const expenseRef = doc(getUserCollection("expenses"));

      transaction.set(expenseRef, {
        date,
        period: item.period,
        type: item.type,
        name: item.name || "",
        description: item.description || "",
        customCategory: item.customCategory || "",
        price: toNumber(item.price),
        paymentType: item.paymentType,
        status: "submitted",
        submittedAt: serverTimestamp(),
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
        cashBalanceImpact:
          oldDailyImpact.cashBalanceImpact + currentTransactionCashTotal,
        gpayBalanceImpact:
          oldDailyImpact.gpayBalanceImpact + gpayDeductedAmount,
        gpayBalanceShortfall:
          oldDailyImpact.gpayBalanceShortfall + gpayShortfall,
        balanceModelVersion: BALANCE_MODEL_VERSION,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    transaction.set(
      settingsRef,
      {
        cashBalance: newCashBalance,
        gpayBalance: newGPayBalance,
        // Temporary legacy mirror for older deployed clients.
        currentBalance: newCashBalance,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    if (cashHistoryRef) {
      transaction.set(cashHistoryRef, {
        date,
        balanceType: "cash",
        action: BALANCE_ACTIONS.EXPENSE_CASH_DEDUCTION,
        amount: currentTransactionCashTotal,
        appliedAmount: currentTransactionCashTotal,
        shortfall: 0,
        reason: `Cash expense deduction for ${date}`,
        oldBalance: oldCashBalance,
        newBalance: newCashBalance,
        oldTotalBalance,
        newTotalBalance,
        createdAt: serverTimestamp(),
      });
    }

    if (gpayHistoryRef) {
      transaction.set(gpayHistoryRef, {
        date,
        balanceType: "gpay",
        action: BALANCE_ACTIONS.EXPENSE_GPAY_DEDUCTION,
        amount: currentTransactionGPayTotal,
        appliedAmount: gpayDeductedAmount,
        shortfall: gpayShortfall,
        reason: `GPay expense deduction for ${date}`,
        oldBalance: oldGPayBalance,
        newBalance: newGPayBalance,
        oldTotalBalance,
        newTotalBalance,
        createdAt: serverTimestamp(),
      });
    }

    applyPreparedReportStatsUpdate(transaction, preparedReportStats);
  });

  return {
    total: currentTransactionTotal,
    cashTotal: currentTransactionCashTotal,
    gpayTotal: currentTransactionGPayTotal,
    gpayDeductedAmount,
    gpayShortfall,
  };
}

export async function updateExpensesForDate({ date, items }) {
  assertClientEditAccess(requireUserId());

  if (!date || date > getTodayDate()) {
    throw new Error("Expenses cannot be edited for a future date.");
  }

  const expensesQuery = query(
    getUserCollection("expenses"),
    where("date", "==", date)
  );

  const existingSnapshot = await getDocs(expensesQuery);
  const existingItems = existingSnapshot.docs.map((expenseDoc) =>
    expenseDoc.data()
  );
  const cleanedItems = items.map((item) => {
    const validationError = validateExpenseItem(item);
    if (validationError) throw new Error(validationError);

    return {
      ...sanitizeExpenseItem(item, "submitted"),
      submittedAt: item.submittedAt || item.createdAt || serverTimestamp(),
      createdAt: item.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
  });
  const newTotal = calculateTotal(cleanedItems);
  const newCashTotal = calculateCashTotal(cleanedItems);
  const newGPayTotal = calculateGPayTotal(cleanedItems);
  const dailyTotalRef = getUserDocument("dailyTotals", date);
  const settingsRef = getUserDocument("settings", "app");
  const cashHistoryRef = doc(getUserCollection("balanceHistory"));
  const gpayHistoryRef = doc(getUserCollection("balanceHistory"));
  const newExpenseRefs = cleanedItems.map(() =>
    doc(getUserCollection("expenses"))
  );

  return runTransaction(db, async (transaction) => {
    const settingsSnap = await transaction.get(settingsRef);
    const dailyTotalSnap = await transaction.get(dailyTotalRef);
    const preparedReportStats = await prepareReportStatsUpdate(
      transaction,
      existingItems,
      cleanedItems
    );
    const walletBalances = getWalletBalances(
      settingsSnap.exists() ? settingsSnap.data() : {}
    );

    const dailyData = dailyTotalSnap.exists() ? dailyTotalSnap.data() : {};
    const oldCashTotal = dailyTotalSnap.exists()
      ? toNumber(dailyData.cashTotal)
      : calculateCashTotal(existingItems);
    const oldGPayTotal = dailyTotalSnap.exists()
      ? toNumber(dailyData.gpayTotal)
      : calculateGPayTotal(existingItems);
    const oldDailyImpact = dailyTotalSnap.exists()
      ? getDailyBalanceImpact(dailyData)
      : {
          cashBalanceImpact: oldCashTotal,
          gpayBalanceImpact: 0,
          gpayBalanceShortfall: oldGPayTotal,
        };

    const cashReconciliation = reconcileCashBalance({
      oldExpenseTotal: oldCashTotal,
      newExpenseTotal: newCashTotal,
      currentBalance: walletBalances.cashBalance,
    });
    const gpayReconciliation = reconcileGPayBalance({
      oldExpenseTotal: oldGPayTotal,
      newExpenseTotal: newGPayTotal,
      oldBalanceImpact: oldDailyImpact.gpayBalanceImpact,
      currentBalance: walletBalances.gpayBalance,
    });
    const cashExpenseDifference = cashReconciliation.expenseDifference;
    const gpayExpenseDifference = gpayReconciliation.expenseDifference;
    const newCashBalance = cashReconciliation.newBalance;
    const newGPayBalance = gpayReconciliation.newBalance;
    const newGPayBalanceImpact = gpayReconciliation.balanceImpact;
    const newGPayBalanceShortfall = gpayReconciliation.shortfall;
    const gpayAppliedAmount = gpayReconciliation.appliedAmount;
    const gpayRefundedAmount = gpayReconciliation.refundedAmount;
    const gpayShortfallAdded = gpayReconciliation.shortfallAdded;
    const gpayShortfallResolved = gpayReconciliation.shortfallResolved;

    const oldTotalBalance = walletBalances.totalBalance;
    const newTotalBalance = newCashBalance + newGPayBalance;

    existingSnapshot.docs.forEach((expenseDoc) => {
      transaction.delete(expenseDoc.ref);
    });

    cleanedItems.forEach((item, index) => {
      transaction.set(newExpenseRefs[index], { date, ...item });
    });

    transaction.set(
      dailyTotalRef,
      {
        date,
        total: newTotal,
        cashTotal: newCashTotal,
        gpayTotal: newGPayTotal,
        cashBalanceImpact: newCashTotal,
        gpayBalanceImpact: newGPayBalanceImpact,
        gpayBalanceShortfall: newGPayBalanceShortfall,
        balanceModelVersion: BALANCE_MODEL_VERSION,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    transaction.set(
      settingsRef,
      {
        cashBalance: newCashBalance,
        gpayBalance: newGPayBalance,
        currentBalance: newCashBalance,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    if (cashExpenseDifference !== 0) {
      transaction.set(cashHistoryRef, {
        date,
        balanceType: "cash",
        action:
          cashExpenseDifference > 0
            ? BALANCE_ACTIONS.EDIT_CASH_DEDUCTION
            : BALANCE_ACTIONS.EDIT_CASH_REFUND,
        amount: Math.abs(cashExpenseDifference),
        appliedAmount: Math.abs(cashExpenseDifference),
        shortfall: 0,
        reason: `Cash balance reconciliation after editing ${date}`,
        oldBalance: walletBalances.cashBalance,
        newBalance: newCashBalance,
        oldTotalBalance,
        newTotalBalance,
        createdAt: serverTimestamp(),
      });
    }

    if (gpayExpenseDifference !== 0) {
      transaction.set(gpayHistoryRef, {
        date,
        balanceType: "gpay",
        action:
          gpayExpenseDifference > 0
            ? BALANCE_ACTIONS.EDIT_GPAY_DEDUCTION
            : BALANCE_ACTIONS.EDIT_GPAY_REFUND,
        amount: Math.abs(gpayExpenseDifference),
        appliedAmount:
          gpayExpenseDifference > 0
            ? gpayAppliedAmount
            : gpayRefundedAmount,
        shortfall: gpayShortfallAdded,
        shortfallResolved: gpayShortfallResolved,
        reason: `GPay balance reconciliation after editing ${date}`,
        oldBalance: walletBalances.gpayBalance,
        newBalance: newGPayBalance,
        oldTotalBalance,
        newTotalBalance,
        createdAt: serverTimestamp(),
      });
    }

    applyPreparedReportStatsUpdate(transaction, preparedReportStats);

    return {
      total: newTotal,
      cashTotal: newCashTotal,
      gpayTotal: newGPayTotal,
      cashExpenseDifference,
      gpayExpenseDifference,
      cashBalanceChange: newCashBalance - walletBalances.cashBalance,
      gpayBalanceChange: newGPayBalance - walletBalances.gpayBalance,
      gpayAppliedAmount,
      gpayRefundedAmount,
      gpayShortfallAdded,
      gpayShortfallResolved,
    };
  });
}

export async function getAllExpenses() {
  const snapshot = await getDocs(getUserCollection("expenses"));

  const items = snapshot.docs
    .map((expenseDoc) => ({
      id: expenseDoc.id,
      ...expenseDoc.data(),
      status: expenseDoc.data().status || "submitted",
      isDraft: false,
    }))
    .filter((item) => item.status === "submitted");

  return items.sort((a, b) => {
    if (a.date === b.date) {
      const aTime = a.createdAt?.seconds || 0;
      const bTime = b.createdAt?.seconds || 0;
      return bTime - aTime;
    }

    return b.date.localeCompare(a.date);
  });
}
