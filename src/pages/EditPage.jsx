import { useEffect, useMemo, useState } from "react";
import Button from "../components/common/Button";
import ConfirmModal from "../components/common/ConfirmModal";
import Loading from "../components/common/Loading";
import DateSelector from "../components/edit/DateSelector";
import EditExpenseSection from "../components/edit/EditExpenseSection";
import EditSummaryCard from "../components/edit/EditSummaryCard";
import { useEditLock } from "../context/EditLockContext";
import { useFeedback } from "../context/FeedbackContext";
import { useExpenses } from "../hooks/useExpenses";
import { getTodayDate } from "../utils/dateUtils";
import {
  calculateCashTotal,
  calculateGPayTotal,
  calculateTotal,
  formatCurrency,
} from "../utils/totalUtils";

function createNewEditItem(period) {
  return {
    id: crypto.randomUUID(),
    period,
    type: "food",
    name: "",
    description: "",
    price: "",
    paymentType: "cash",
    isNew: true,
  };
}

function EditPage() {
  const todayDate = getTodayDate();
  const { canEdit, isViewMode, openUnlockDialog } = useEditLock();
  const { notify, confirmAction } = useFeedback();

  const [selectedDate, setSelectedDate] = useState(todayDate);
  const [loadedDate, setLoadedDate] = useState(todayDate);
  const [activePeriod, setActivePeriod] = useState("all");
  const [editableItems, setEditableItems] = useState([]);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);

  const {
    expenses,
    expensesLoading,
    expensesError,
    updateDateExpenses,
  } = useExpenses(loadedDate);

  useEffect(() => {
    setEditableItems(expenses);
  }, [expenses, loadedDate]);

  const editTotal = useMemo(
    () => calculateTotal(editableItems),
    [editableItems]
  );

  const editCashTotal = useMemo(
    () => calculateCashTotal(editableItems),
    [editableItems]
  );

  const editGPayTotal = useMemo(
    () => calculateGPayTotal(editableItems),
    [editableItems]
  );

  function handleShowData() {
    if (!selectedDate) {
      notify({
        type: "warning",
        title: "Date required",
        message: "Select a date before loading expenses.",
      });
      return;
    }

    setLoadedDate(selectedDate);
    setActivePeriod("all");
  }

  function handleAddItem() {
    if (!canEdit) {
      openUnlockDialog();
      return;
    }

    setEditableItems((prev) => [...prev, createNewEditItem(activePeriod)]);
  }

  async function handleDeleteItem(itemId) {
    if (!canEdit) {
      openUnlockDialog();
      return;
    }

    const confirmDelete = await confirmAction({
      title: "Delete this expense?",
      message:
        "The matching Cash or GPay balance will be reconciled when you update this date.",
      confirmText: "Delete Item",
      cancelText: "Keep Item",
      tone: "danger",
    });

    if (!confirmDelete) return;

    setEditableItems((prev) => prev.filter((item) => item.id !== itemId));
  }

  function handleChangeItem(itemId, field, value) {
    if (!canEdit) {
      openUnlockDialog();
      return;
    }

    setEditableItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) {
          return item;
        }

        if (field === "type") {
          if (value === "bus") {
            return {
              ...item,
              type: value,
              description: item.description || item.name || "",
              name: "",
            };
          }

          if (item.type === "bus") {
            return {
              ...item,
              type: value,
              name: item.name || item.description || "",
              description: "",
            };
          }

          return {
            ...item,
            type: value,
          };
        }

        return {
          ...item,
          [field]: value,
        };
      })
    );
  }

  function validateItems() {
    for (const item of editableItems) {
      const price = Number(item.price);

      if (!price || price <= 0) {
        return "Every item must have valid price.";
      }

      if (item.type !== "bus" && !item.name.trim()) {
        return "Food, Snacks, and Custom items must have name/description.";
      }

      if (!item.period || !item.type || !item.paymentType) {
        return "Every item must have period, type, and payment type.";
      }
    }

    return "";
  }

  function handleUpdateClick() {
    if (!canEdit) {
      openUnlockDialog();
      return;
    }

    const validationError = validateItems();

    if (validationError) {
      notify({
        type: "warning",
        title: "Check expense details",
        message: validationError,
      });
      return;
    }

    setIsConfirmOpen(true);
  }

  async function handleConfirmUpdate() {
    if (!canEdit) {
      setIsConfirmOpen(false);
      openUnlockDialog();
      return;
    }

    try {
      setUpdateLoading(true);

      const result = await updateDateExpenses(editableItems);

      setIsConfirmOpen(false);

      const balanceChanges = [];

      if (result.cashBalanceChange < 0) {
        balanceChanges.push(
          `Cash reduced: ${formatCurrency(Math.abs(result.cashBalanceChange))}`
        );
      } else if (result.cashBalanceChange > 0) {
        balanceChanges.push(
          `Cash refunded: ${formatCurrency(result.cashBalanceChange)}`
        );
      }

      if (result.gpayBalanceChange < 0) {
        balanceChanges.push(
          `GPay reduced: ${formatCurrency(Math.abs(result.gpayBalanceChange))}`
        );
      } else if (result.gpayBalanceChange > 0) {
        balanceChanges.push(
          `GPay refunded: ${formatCurrency(result.gpayBalanceChange)}`
        );
      }

      if (result.gpayShortfallResolved > 0) {
        balanceChanges.push(
          `GPay shortfall resolved: ${formatCurrency(
            result.gpayShortfallResolved
          )}`
        );
      }

      if (result.gpayShortfallAdded > 0) {
        balanceChanges.push(
          `New GPay shortfall: ${formatCurrency(result.gpayShortfallAdded)}`
        );
      }

      notify({
        type: result.gpayShortfallAdded > 0 ? "warning" : "success",
        title:
          result.gpayShortfallAdded > 0
            ? "Expenses updated with GPay shortfall"
            : "Expenses and balances updated",
        message:
          balanceChanges.length > 0
            ? balanceChanges.join("\n")
            : "Expense details were updated. Wallet balances were unchanged.",
      });
    } catch (error) {
      notify({
        type: "error",
        title: "Update failed",
        message: error.message || "Unable to update the selected date.",
      });
    } finally {
      setUpdateLoading(false);
    }
  }

  return (
    <section className="app-workspace edit-page">
      <div className="page-heading">
        <div>
          <h2 className="page-title">Edit Expense</h2>
          <p className="page-subtitle">
            Cash and GPay balances automatically reconcile with your changes.
          </p>
        </div>
      </div>

      {isViewMode && (
        <div className="view-mode-notice">
          <span>View Mode is active. Saved expenses cannot be changed.</span>
          <button type="button" onClick={openUnlockDialog}>
            Unlock Editing
          </button>
        </div>
      )}

      <DateSelector
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        onShowData={handleShowData}
        loading={expensesLoading}
      />

      {expensesError && (
        <div className="error-box">
          <p>{expensesError}</p>
        </div>
      )}

      {expensesLoading ? (
        <Loading message="Loading selected date expenses..." />
      ) : (
        <>
          <div className="edit-info-box">
            Showing data for: <strong>{loadedDate}</strong>
          </div>

          <div className="edit-grid">
            <div className="left-column">
              <EditExpenseSection
                activePeriod={activePeriod}
                onPeriodChange={setActivePeriod}
                items={editableItems}
                onChangeItem={handleChangeItem}
                onDeleteItem={handleDeleteItem}
                onAddItem={handleAddItem}
                disabled={!canEdit}
              />

              <div className="submit-area">
                <Button
                  size="lg"
                  fullWidth
                  onClick={handleUpdateClick}
                  loading={updateLoading}
                  disabled={!canEdit}
                >
                  Update Selected Date
                </Button>
              </div>
            </div>

            <div className="right-column">
              <EditSummaryCard
                total={editTotal}
                cashTotal={editCashTotal}
                gpayTotal={editGPayTotal}
                count={editableItems.length}
              />
            </div>
          </div>
        </>
      )}

      <ConfirmModal
        isOpen={isConfirmOpen}
        title="Update Expenses"
        message="Update this date and reconcile the matching Cash and GPay balances?"
        confirmText="Yes, Update"
        cancelText="No"
        loading={updateLoading}
        onCancel={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirmUpdate}
      />
    </section>
  );
}

export default EditPage;
