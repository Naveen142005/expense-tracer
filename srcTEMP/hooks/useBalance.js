import { useEffect, useState } from "react";
import { adjustBalance, subscribeToBalance } from "../firebase/balanceService";

export function useBalance() {
  const [balance, setBalance] = useState(0);
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
      await adjustBalance(payload);
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