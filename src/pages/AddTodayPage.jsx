import { useEffect, useMemo, useState } from "react";
import BalanceAdjustForm from "../components/balance/BalanceAdjustForm";
import BalanceCard from "../components/balance/BalanceCard";
import Button from "../components/common/Button";
import AppIcon from "../components/common/AppIcon";
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
import { EXPENSE_TYPES, PERIODS } from "../utils/constants";
import {
  getExpenseLabel,
  isRecentDuplicate,
  sanitizeExpenseItem,
  validateExpenseItem,
} from "../utils/expenseWorkflow";
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
  const [preferredPaymentType, setPreferredPaymentType] = useState("cash");

  const {
    draftItems,
    addDraftItem,
    updateDraftItem,
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

  useEffect(() => {
    if (draftItems.length === 0) return undefined;

    function warnBeforeUnload(event) {
      event.preventDefault();
      event.returnValue = "";
    }

    function warnBeforeInternalNavigation(event) {
      const anchor = event.target.closest?.("a[href]");
      if (
        !anchor ||
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey ||
        anchor.target === "_blank"
      ) {
        return;
      }

      const destination = new URL(anchor.href, window.location.href);
      const isDifferentPage =
        destination.origin === window.location.origin &&
        destination.pathname !== window.location.pathname;

      if (
        isDifferentPage &&
        !window.confirm(
          "You have unsaved draft items. Leave this page without submitting them?"
        )
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    window.addEventListener("beforeunload", warnBeforeUnload);
    document.addEventListener("click", warnBeforeInternalNavigation, true);

    return () => {
      window.removeEventListener("beforeunload", warnBeforeUnload);
      document.removeEventListener("click", warnBeforeInternalNavigation, true);
    };
  }, [draftItems.length]);

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

  const activePeriodLabel =
    PERIODS.find((period) => period.value === activePeriod)?.label || "Period";
  const selectedTypeLabel =
    EXPENSE_TYPES.find((type) => type.value === selectedType)?.label || "Type";

  async function handleAddItem(item) {
    if (!canEdit) {
      openUnlockDialog();
      return false;
    }

    const validationError = validateExpenseItem(item);
    if (validationError) {
      notify({
        type: "warning",
        title: "Check expense details",
        message: validationError,
      });
      return false;
    }

    const recentDuplicate = draftItems.find((draftItem) =>
      isRecentDuplicate(item, draftItem)
    );

    if (recentDuplicate) {
      const addDuplicate = await confirmAction({
        title: "Possible duplicate expense",
        message: `${getExpenseLabel(item)} with the same price and payment method was just added. Add it again?`,
        confirmText: "Add Again",
        cancelText: "Keep One",
        tone: "default",
      });

      if (!addDuplicate) return false;
    }

    const cleanItem = {
      ...sanitizeExpenseItem(item, "draft"),
      id: item.id || crypto.randomUUID(),
      isDraft: true,
      draftAddedAt: Date.now(),
    };

    addDraftItem(cleanItem);
    setPreferredPaymentType(cleanItem.paymentType);

    notify({
      type: "success",
      title: "Item added to draft",
      message: `${getExpenseLabel(cleanItem)} · ${activePeriodLabel} · ${selectedTypeLabel} · ${
        cleanItem.paymentType === "gpay" ? "GPay" : "Cash"
      } · ${formatCurrency(cleanItem.price)}`,
      duration: 6000,
      actionLabel: "Undo",
      onAction: () => deleteDraftItem(cleanItem.id),
    });

    return true;
  }

  function handleResetEntryContext() {
    setActivePeriod("");
    setSelectedType("");
  }

  function handleUpdateDraftItem(itemId, changes) {
    const currentItem = draftItems.find((item) => item.id === itemId);
    if (!currentItem) return false;

    const updatedItem = {
      ...currentItem,
      ...changes,
    };
    const validationError = validateExpenseItem(updatedItem);

    if (validationError) {
      notify({
        type: "warning",
        title: "Check expense details",
        message: validationError,
      });
      return false;
    }

    updateDraftItem(itemId, sanitizeExpenseItem(updatedItem, "draft"));
    notify({
      type: "success",
      title: "Draft item updated",
      message: `${getExpenseLabel(updatedItem)} was updated.`,
    });
    return true;
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
    <section className="app-workspace add-today-page">
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

      <div className="add-today-layout">
        <div className="card entry-context-card">
            <header className="entry-context-card__header">
              <div>
                <span className="entry-context-card__eyebrow">Entry context</span>
                <h3>Choose once, add continuously</h3>
                <p>Your period, type, and payment stay selected after each item.</p>
              </div>
              {activePeriod && selectedType && (
                <button
                  type="button"
                  className="entry-context-card__reset"
                  onClick={handleResetEntryContext}
                  disabled={!canEdit}
                >
                  Reset context
                </button>
              )}
            </header>

            <div className="entry-context-card__selectors">
              <section className="entry-context-card__group" aria-labelledby="entry-period-title">
                <div className="entry-context-card__group-title">
                  <span><AppIcon name="clock" size={17} /></span>
                  <h4 id="entry-period-title">Select Period</h4>
                </div>
                <PeriodTabs
                  activePeriod={activePeriod}
                  onChange={setActivePeriod}
                  disabled={!canEdit}
                />
              </section>

              <section className="entry-context-card__group" aria-labelledby="entry-type-title">
                <div className="entry-context-card__group-title">
                  <span><AppIcon name="sliders" size={17} /></span>
                  <h4 id="entry-type-title">Select Type</h4>
                </div>
                <ExpenseTypeSelector
                  selectedType={selectedType}
                  onChange={setSelectedType}
                  disabled={!canEdit}
                />
              </section>
            </div>

            {activePeriod && selectedType ? (
              <div className="entry-context-card__active" role="status">
                <span><AppIcon name="check" size={15} /> Active context</span>
                <strong>{activePeriodLabel} · {selectedTypeLabel} · {preferredPaymentType === "gpay" ? "GPay" : "Cash"}</strong>
              </div>
            ) : canEdit && selectionGuidance ? (
              <div className="entry-context-card__guidance" role="status">
                <AppIcon name="sparkle" size={16} />
                <span>{selectionGuidance}</span>
              </div>
            ) : null}
        </div>

        {activePeriod && selectedType && (
          <ExpenseEntryForm
            key={`${activePeriod}-${selectedType}`}
            activePeriod={activePeriod}
            selectedType={selectedType}
            onAddItem={handleAddItem}
            initialPaymentType={preferredPaymentType}
            onPaymentTypeChange={setPreferredPaymentType}
            disabled={!canEdit}
          />
        )}

        <div className="add-today-lower">
          <div className="add-today-draft-stack">
          <ExpenseDraftList
            draftItems={draftItems}
            onUpdateItem={handleUpdateDraftItem}
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

          <TodaySummaryCard
            savedTodayTotal={dailyTotal.total}
            savedTodayCashTotal={dailyTotal.cashTotal}
            savedTodayGPayTotal={dailyTotal.gpayTotal}
          />
        </div>

        <TodayOverviewTable items={savedTodayItems} />
      </div>

      <ConfirmModal
        isOpen={isConfirmOpen}
        title="Save Expenses"
        message={`Submit ${draftItems.length} item${
          draftItems.length === 1 ? "" : "s"
        }?\nTotal: ${formatCurrency(
          currentTransactionTotal
        )}\nCash: ${formatCurrency(
          currentTransactionCashTotal
        )}\nGPay: ${formatCurrency(currentTransactionGPayTotal)}`}
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
