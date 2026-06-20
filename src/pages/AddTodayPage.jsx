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
import { useEditLock } from "../context/EditLockContext";
import { useFeedback } from "../context/FeedbackContext";
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
  const { canEdit, isViewMode, openUnlockDialog } = useEditLock();
  const { notify, confirmAction } = useFeedback();

  const [activePeriod, setActivePeriod] = useState("");
  const [selectedType, setSelectedType] = useState("");
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

  const selectionGuidance = useMemo(() => {
    if (!activePeriod && !selectedType) {
      return "Please select a period and expense type to add an item.";
    }

    if (!activePeriod) {
      return "Expense type selected. Now select a period to continue.";
    }

    if (!selectedType) {
      return "Period selected. Now select an expense type to continue.";
    }

    return "";
  }, [activePeriod, selectedType]);

  function handleAddItem(item) {
    if (!canEdit) {
      openUnlockDialog();
      return;
    }

    addDraftItem(item);
  }

  async function handleAdjustBalance(payload) {
    if (!canEdit) {
      openUnlockDialog();
      return;
    }

    try {
      setBalanceAdjustLoading(true);
      const result = await updateBalanceManually(payload);

      if (result?.shortfall > 0) {
        notify({
          type: "warning",
          title: "GPay balance reached zero",
          message: `Only ${formatCurrency(
            result.appliedAmount
          )} was applied. Shortfall: ${formatCurrency(result.shortfall)}.`,
        });
      } else {
        notify({
          type: "success",
          title: "Balance updated",
          message: `${result.balanceType === "gpay" ? "GPay" : "Cash"} Balance is now ${formatCurrency(
            result.newBalance
          )}.`,
        });
      }
      return true;
    } catch (error) {
      notify({
        type: "error",
        title: "Balance update failed",
        message: error.message || "Please try again.",
      });
      return false;
    } finally {
      setBalanceAdjustLoading(false);
    }
  }

  function handleSubmitClick() {
    if (!canEdit) {
      openUnlockDialog();
      return;
    }

    if (draftItems.length === 0) {
      notify({
        type: "warning",
        title: "No expense items",
        message: "Add at least one expense item before submitting.",
      });
      return;
    }

    setIsConfirmOpen(true);
  }

  async function handleConfirmSubmit() {
    if (!canEdit) {
      setIsConfirmOpen(false);
      openUnlockDialog();
      return;
    }

    try {
      setSubmitLoading(true);

      const result = await saveTodayExpenses(draftItems);

      clearDraftItems();
      setIsConfirmOpen(false);

      if (result.gpayShortfall > 0) {
        notify({
          type: "warning",
          title: "Expenses saved with GPay shortfall",
          message: `Transaction: ${formatCurrency(
            result.total
          )}\nCash reduced: ${formatCurrency(
            result.cashTotal
          )}\nGPay applied: ${formatCurrency(
            result.gpayDeductedAmount
          )}\nGPay shortfall: ${formatCurrency(result.gpayShortfall)}`,
        });
      } else {
        notify({
          type: "success",
          title: "Expenses saved",
          message: `Transaction: ${formatCurrency(
            result.total
          )}\nCash reduced: ${formatCurrency(
            result.cashTotal
          )}\nGPay reduced: ${formatCurrency(result.gpayTotal)}`,
        });
      }
    } catch (error) {
      notify({
        type: "error",
        title: "Unable to save expenses",
        message: error.message || "Please try again.",
      });
    } finally {
      setSubmitLoading(false);
    }
  }

  async function handleClearDraft() {
    if (!canEdit) {
      openUnlockDialog();
      return;
    }

    const confirmClear = await confirmAction({
      title: "Clear all draft items?",
      message: "This removes every unsaved item from the current draft.",
      confirmText: "Clear Draft",
      cancelText: "Keep Items",
      tone: "danger",
    });

    if (confirmClear) {
      clearDraftItems();
      notify({
        type: "info",
        title: "Draft cleared",
        message: "All unsaved expense items were removed.",
      });
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

      {isViewMode && (
        <div className="view-mode-notice">
          <span>View Mode is active. Expense changes are locked.</span>
          <button type="button" onClick={openUnlockDialog}>
            Unlock Editing
          </button>
        </div>
      )}

      {(balanceError || expensesError) && (
        <div className="error-box">
          {balanceError && <p>{balanceError}</p>}
          {expensesError && <p>{expensesError}</p>}
        </div>
      )}

      <div className="balance-grid balance-grid--wallets">
        <BalanceCard balance={balance} />

        <BalanceAdjustForm
          onAdjustBalance={handleAdjustBalance}
          loading={balanceAdjustLoading}
          disabled={!canEdit}
        />
      </div>

      <div className="add-today-grid">
        <div className="left-column">
          <div className="card">
            <h3>Select Period</h3>
            <PeriodTabs
              activePeriod={activePeriod}
              onChange={setActivePeriod}
              disabled={!canEdit}
            />
          </div>

          <div className="card">
            <h3>Select Type</h3>
            <ExpenseTypeSelector
              selectedType={selectedType}
              onChange={setSelectedType}
              disabled={!canEdit}
            />
          </div>

          {canEdit && selectionGuidance && (
            <div className="expense-selection-guide" role="status">
              <span className="expense-selection-guide__icon" aria-hidden="true">
                i
              </span>
              <div>
                <strong>Please Select Your Selection</strong>
                <p>{selectionGuidance}</p>
              </div>
            </div>
          )}

          {activePeriod && selectedType && (
            <ExpenseEntryForm
              activePeriod={activePeriod}
              selectedType={selectedType}
              onAddItem={handleAddItem}
              disabled={!canEdit}
            />
          )}

          <ExpenseDraftList
            draftItems={draftItems}
            onDeleteItem={deleteDraftItem}
            onClearAll={handleClearDraft}
            disabled={!canEdit}
          />

          <div className="submit-area">
            <Button
              size="lg"
              fullWidth
              onClick={handleSubmitClick}
              disabled={submitLoading || !canEdit}
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
