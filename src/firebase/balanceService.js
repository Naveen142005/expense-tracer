import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebaseConfig";
import { BALANCE_ACTIONS } from "../utils/constants";
import { getTodayDate } from "../utils/dateUtils";
import { toNumber } from "../utils/totalUtils";

const SETTINGS_DOC_ID = "app";

export function subscribeToBalance(callback, errorCallback) {
  const settingsRef = doc(db, "settings", SETTINGS_DOC_ID);

  return onSnapshot(
    settingsRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        callback(0);
        return;
      }

      callback(toNumber(snapshot.data().currentBalance));
    },
    errorCallback
  );
}

export async function adjustBalance({ action, amount, reason }) {
  const settingsRef = doc(db, "settings", SETTINGS_DOC_ID);
  const historyRef = doc(collection(db, "balanceHistory"));

  await runTransaction(db, async (transaction) => {
    const settingsSnap = await transaction.get(settingsRef);

    const oldBalance = settingsSnap.exists()
      ? toNumber(settingsSnap.data().currentBalance)
      : 0;

    const amountNumber = toNumber(amount);

    const newBalance =
      action === BALANCE_ACTIONS.ADD
        ? oldBalance + amountNumber
        : oldBalance - amountNumber;

    transaction.set(
      settingsRef,
      {
        currentBalance: newBalance,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    transaction.set(historyRef, {
      date: getTodayDate(),
      action,
      amount: amountNumber,
      reason: reason || "Manual balance adjustment",
      oldBalance,
      newBalance,
      createdAt: serverTimestamp(),
    });
  });
}

export async function getAllBalanceHistory() {
  const snapshot = await getDocs(collection(db, "balanceHistory"));

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