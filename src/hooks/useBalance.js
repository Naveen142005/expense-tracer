import { useEffect, useState } from "react";
import { adjustBalance, subscribeToBalance } from "../firebase/balanceService";

const initialBalance = {
  totalBalance: 0,
  cashBalance: 0,
  gpayBalance: 0,
};

export function useBalance() {
  const [balance, setBalance] = useState(initialBalance);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [balanceError, setBalanceError] = useState("");

  useEffect(() => {
    const unsubscribe = subscribeToBalance(
      (currentBalance) => {
        setBalance(currentBalance);
        setBalanceLoading(false);
      },
      (error) => {
        console.error(error);
        setBalanceError("Failed to load balance");
        setBalanceLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  async function updateBalanceManually(payload) {
    setBalanceError("");

    try {
      return await adjustBalance(payload);
    } catch (error) {
      console.error(error);
      setBalanceError("Failed to update balance");
      throw error;
    }
  }

  return {
    balance,
    balanceLoading,
    balanceError,
    updateBalanceManually,
  };
}
