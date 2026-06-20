export function reconcileCashBalance({
  oldExpenseTotal,
  newExpenseTotal,
  currentBalance,
}) {
  const expenseDifference = newExpenseTotal - oldExpenseTotal;
  const newBalance = currentBalance - expenseDifference;

  return {
    expenseDifference,
    newBalance,
    balanceChange: newBalance - currentBalance,
    balanceImpact: newExpenseTotal,
  };
}

export function reconcileGPayBalance({
  oldExpenseTotal,
  newExpenseTotal,
  oldBalanceImpact,
  currentBalance,
}) {
  const normalizedOldTotal = Math.max(0, oldExpenseTotal);
  const normalizedNewTotal = Math.max(0, newExpenseTotal);
  const normalizedOldImpact = Math.min(
    normalizedOldTotal,
    Math.max(0, oldBalanceImpact)
  );
  const normalizedOldShortfall = Math.max(
    0,
    normalizedOldTotal - normalizedOldImpact
  );
  const normalizedCurrentBalance = Math.max(0, currentBalance);
  const expenseDifference = normalizedNewTotal - normalizedOldTotal;

  let newBalance = normalizedCurrentBalance;
  let balanceImpact = normalizedOldImpact;
  let shortfall = normalizedOldShortfall;
  let appliedAmount = 0;
  let refundedAmount = 0;
  let shortfallAdded = 0;
  let shortfallResolved = 0;

  if (expenseDifference > 0) {
    appliedAmount = Math.min(normalizedCurrentBalance, expenseDifference);
    shortfallAdded = Math.max(0, expenseDifference - appliedAmount);
    newBalance = normalizedCurrentBalance - appliedAmount;
    balanceImpact += appliedAmount;
    shortfall += shortfallAdded;
  } else if (expenseDifference < 0) {
    const expenseReduction = Math.abs(expenseDifference);
    shortfallResolved = Math.min(shortfall, expenseReduction);
    const refundableReduction = expenseReduction - shortfallResolved;
    refundedAmount = Math.min(balanceImpact, refundableReduction);
    newBalance = normalizedCurrentBalance + refundedAmount;
    balanceImpact -= refundedAmount;
    shortfall -= shortfallResolved;
  }

  return {
    expenseDifference,
    newBalance,
    balanceChange: newBalance - normalizedCurrentBalance,
    balanceImpact,
    shortfall,
    appliedAmount,
    refundedAmount,
    shortfallAdded,
    shortfallResolved,
  };
}
