import { useEffect, useState } from "react";
import {
  subscribeToDailyTotal,
  subscribeToExpensesByDate,
  submitTodayExpenses,
  updateExpensesForDate,
} from "../firebase/expenseService";

export function useExpenses(date) {
  const [expenses, setExpenses] = useState([]);
  const [dailyTotal, setDailyTotal] = useState({
    date,
    total: 0,
    cashTotal: 0,
    gpayTotal: 0,
    cashBalanceImpact: 0,
    gpayBalanceImpact: 0,
    gpayBalanceShortfall: 0,
  });

  const [expensesLoading, setExpensesLoading] = useState(true);
  const [expensesError, setExpensesError] = useState("");

  useEffect(() => {
    setExpensesLoading(true);
    setExpensesError("");

    const unsubscribeExpenses = subscribeToExpensesByDate(
      date,
      (items) => {
        setExpenses(items);
        setExpensesLoading(false);
      },
      (error) => {
        console.error(error);
        setExpensesError("Failed to load expenses");
        setExpensesLoading(false);
      }
    );

    const unsubscribeTotal = subscribeToDailyTotal(
      date,
      (totalData) => {
        setDailyTotal(totalData);
      },
      (error) => {
        console.error(error);
        setExpensesError("Failed to load daily total");
      }
    );

    return () => {
      unsubscribeExpenses();
      unsubscribeTotal();
    };
  }, [date]);

  async function saveTodayExpenses(draftItems) {
    setExpensesError("");

    try {
      return await submitTodayExpenses({
        date,
        draftItems,
      });
    } catch (error) {
      console.error(error);
      setExpensesError("Failed to save expenses");
      throw error;
    }
  }

  async function updateDateExpenses(items) {
    setExpensesError("");

    try {
      return await updateExpensesForDate({
        date,
        items,
      });
    } catch (error) {
      console.error(error);
      setExpensesError("Failed to update expenses");
      throw error;
    }
  }

  return {
    expenses,
    dailyTotal,
    expensesLoading,
    expensesError,
    saveTodayExpenses,
    updateDateExpenses,
  };
}
