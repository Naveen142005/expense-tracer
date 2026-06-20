import { useMemo, useState } from "react";
import BalanceAdjustForm from "../components/balance/BalanceAdjustForm";
import BalanceCard from "../components/balance/BalanceCard";
import Button from "../components/common/Button";
import ConfirmModal from "../components/common/ConfirmModal";
import Loading from "../components/common/Loading";
import ExpenseDraftList from "../components/expense/ExpenseDraftList";
import ExpenseEntryForm from "../components/expense/ExpenseEntryForm";
import ExpenseTypeSelector from "../components/expense/ExpenseTypeSelector";
import PeriodTabs from "../components/expense/PeriodTabs";
import TodayOverviewTable from "../components/expense/TodayOverviewTable";
import TodaySummaryCard from "../components/expense/TodaySummaryCard";
import { useBalance } from "../hooks/useBalance";
import { useDraftExpenses } from "../hooks/useDraftExpenses";
import { useExpenses } from "../hooks/useExpenses";
import { getTodayDate } from "../utils/dateUtils";
import {
  calculateCashTotal,
  calculateGPayTotal,
  calculateTotal,
  formatCurrency,
} from "../utils/totalUtils";

function AddTodayPage() {
  const todayDate = getTodayDate();

  const [activePeriod, setActivePeriod] = useState("morning");
  const [selectedType, setSelectedType] = useState("food");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [balanceAdjustLoading, setBalanceAdjustLoading] = useState(false);

  const {
    draftItems,
    addDraftItem,
    deleteDraftItem,
    clearDraftItems,
  } = useDraftExpenses(todayDate);

  const {
    balance,
    balanceLoading,
    balanceError,
    updateBalanceManually,
  } = useBalance();

  const {
    expenses: savedTodayItems,
    dailyTotal,
    expensesLoading,
    expensesError,
    saveTodayExpenses,
  } = useExpenses(todayDate);

  const currentTransactionTotal = useMemo(
    () => calculateTotal(draftItems),
    [draftItems]
  );

  const currentTransactionCashTotal = useMemo(
    () => calculateCashTotal(draftItems),
    [draftItems]
  );

  const currentTransactionGPayTotal = useMemo(
    () => calculateGPayTotal(draftItems),
    [draftItems]
  );

  const overviewItems = useMemo(
    () => [...savedTodayItems, ...draftItems],
    [savedTodayItems, draftItems]
  );

  function handleAddItem(item) {
    addDraftItem(item);
  }

  async function handleAdjustBalance(payload) {
    try {
      setBalanceAdjustLoading(true);
      await updateBalanceManually(payload);
    } catch {
      alert("Failed to update balance");
    } finally {
      setBalanceAdjustLoading(false);
    }
  }

  function handleSubmitClick() {
    if (draftItems.length === 0) {
      alert("Add at least one expense item");
      return;
    }

    setIsConfirmOpen(true);
  }

  async function handleConfirmSubmit() {
    try {
      setSubmitLoading(true);

      const result = await saveTodayExpenses(draftItems);

      clearDraftItems();
      setIsConfirmOpen(false);

      alert(
        `Saved successfully.\n\nToday transaction: ${formatCurrency(
          result.total
        )}\nCash reduced: ${formatCurrency(
          result.cashTotal
        )}\nGPay included in report: ${formatCurrency(result.gpayTotal)}`
      );
    } catch {
      alert("Failed to save expenses");
    } finally {
      setSubmitLoading(false);
    }
  }

  function handleClearDraft() {
    const confirmClear = window.confirm(
      "Are you sure you want to clear all draft items?"
    );

    if (confirmClear) {
      clearDraftItems();
    }
  }

  if (balanceLoading || expensesLoading) {
    return <Loading message="Loading expense tracker..." />;
  }

  return (
    <section>
      <div className="page-heading">
        <div>
          <h2 className="page-title">Add Today Expense</h2>
          <p className="page-subtitle">Today: {todayDate}</p>
        </div>
      </div>

      {(balanceError || expensesError) && (
        <div className="error-box">
          {balanceError && <p>{balanceError}</p>}
          {expensesError && <p>{expensesError}</p>}
        </div>
      )}

      <div className="balance-grid">
        <BalanceCard balance={balance} />

        <BalanceAdjustForm
          onAdjustBalance={handleAdjustBalance}
          loading={balanceAdjustLoading}
        />
      </div>

      <div className="add-today-grid">
        <div className="left-column">
          <div className="card">
            <h3>Select Period</h3>
            <PeriodTabs
              activePeriod={activePeriod}
              onChange={setActivePeriod}
            />
          </div>

          <div className="card">
            <h3>Select Type</h3>
            <ExpenseTypeSelector
              selectedType={selectedType}
              onChange={setSelectedType}
            />
          </div>

          <ExpenseEntryForm
            activePeriod={activePeriod}
            selectedType={selectedType}
            onAddItem={handleAddItem}
          />

          <ExpenseDraftList
            draftItems={draftItems}
            onDeleteItem={deleteDraftItem}
            onClearAll={handleClearDraft}
          />

          <div className="submit-area">
            <Button
              size="lg"
              fullWidth
              onClick={handleSubmitClick}
              disabled={submitLoading}
            >
              Submit Today Transaction
            </Button>
          </div>
        </div>

        <div className="right-column">
          <TodaySummaryCard
            savedTodayTotal={dailyTotal.total}
            currentTransactionTotal={currentTransactionTotal}
            currentTransactionCashTotal={currentTransactionCashTotal}
            currentTransactionGPayTotal={currentTransactionGPayTotal}
          />

          <TodayOverviewTable items={overviewItems} />
        </div>
      </div>

      <ConfirmModal
        isOpen={isConfirmOpen}
        title="Save Expenses"
        message="Are you sure you want to save these expense items?"
        confirmText="Yes, Save"
        cancelText="No"
        loading={submitLoading}
        onCancel={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirmSubmit}
      />
    </section>
  );
}

export default AddTodayPage;