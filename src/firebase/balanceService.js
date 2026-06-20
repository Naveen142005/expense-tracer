import {
  doc,
  getDocs,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { BALANCE_ACTIONS, BALANCE_TYPES } from "../utils/constants";
import { getTodayDate } from "../utils/dateUtils";
import { assertClientEditAccess } from "../utils/editSession";
import { toNumber } from "../utils/totalUtils";
import { db } from "./firebaseConfig";
import {
  getUserCollection,
  getUserDocument,
  requireUserId,
} from "./userDataRefs";

const SETTINGS_DOC_ID = "app";
const validBalanceTypes = BALANCE_TYPES.map((type) => type.value);

function getBalances(data = {}) {
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

export function subscribeToBalance(callback, errorCallback) {
  const settingsRef = getUserDocument("settings", SETTINGS_DOC_ID);

  return onSnapshot(
    settingsRef,
    (snapshot) => {
      callback(snapshot.exists() ? getBalances(snapshot.data()) : getBalances());
    },
    errorCallback
  );
}

export async function adjustBalance({
  balanceType,
  action,
  amount,
  reason,
}) {
  assertClientEditAccess(requireUserId());

  if (!validBalanceTypes.includes(balanceType)) {
    throw new Error("Select Cash Balance or GPay Balance.");
  }

  if (![BALANCE_ACTIONS.ADD, BALANCE_ACTIONS.REDUCE].includes(action)) {
    throw new Error("Invalid balance action.");
  }

  const amountNumber = toNumber(amount);

  if (amountNumber <= 0) {
    throw new Error("Balance adjustment amount must be greater than zero.");
  }

  const settingsRef = getUserDocument("settings", SETTINGS_DOC_ID);
  const historyRef = doc(getUserCollection("balanceHistory"));

  return runTransaction(db, async (transaction) => {
    const settingsSnap = await transaction.get(settingsRef);
    const oldBalances = getBalances(
      settingsSnap.exists() ? settingsSnap.data() : {}
    );

    const selectedOldBalance =
      balanceType === "cash"
        ? oldBalances.cashBalance
        : oldBalances.gpayBalance;

    const calculatedNewBalance =
      action === BALANCE_ACTIONS.ADD
        ? selectedOldBalance + amountNumber
        : selectedOldBalance - amountNumber;

    const selectedNewBalance =
      balanceType === "gpay"
        ? Math.max(0, calculatedNewBalance)
        : calculatedNewBalance;

    const appliedAmount =
      action === BALANCE_ACTIONS.ADD
        ? amountNumber
        : selectedOldBalance - selectedNewBalance;

    const shortfall =
      action === BALANCE_ACTIONS.REDUCE
        ? Math.max(0, amountNumber - appliedAmount)
        : 0;

    const newCashBalance =
      balanceType === "cash"
        ? selectedNewBalance
        : oldBalances.cashBalance;

    const newGPayBalance =
      balanceType === "gpay"
        ? selectedNewBalance
        : oldBalances.gpayBalance;

    const newTotalBalance = newCashBalance + newGPayBalance;

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

    transaction.set(historyRef, {
      date: getTodayDate(),
      balanceType,
      action,
      amount: amountNumber,
      appliedAmount,
      shortfall,
      reason: reason || "Manual balance adjustment",
      oldBalance: selectedOldBalance,
      newBalance: selectedNewBalance,
      oldTotalBalance: oldBalances.totalBalance,
      newTotalBalance,
      createdAt: serverTimestamp(),
    });

    return {
      balanceType,
      action,
      amount: amountNumber,
      appliedAmount,
      shortfall,
      newBalance: selectedNewBalance,
      newTotalBalance,
    };
  });
}

export async function getAllBalanceHistory() {
  const snapshot = await getDocs(getUserCollection("balanceHistory"));

  const items = snapshot.docs.map((historyDoc) => ({
    id: historyDoc.id,
    ...historyDoc.data(),
  }));

  return items.sort((a, b) => {
    const aTime = a.createdAt?.seconds || 0;
    const bTime = b.createdAt?.seconds || 0;
    return bTime - aTime;
  });
}
