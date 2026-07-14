import { useMemo, useState } from "react";
import { EXPENSE_TYPES, PAYMENT_TYPES, PERIODS } from "../../utils/constants";
import {
  calculateCashTotal,
  calculateGPayTotal,
  calculateTotal,
  formatCurrency,
} from "../../utils/totalUtils";
import Button from "../common/Button";
import EmptyState from "../common/EmptyState";

function DraftItem({ item, onUpdateItem, onDeleteItem, disabled }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item);

  const textField = draft.type === "bus" ? "description" : "name";
  const textValue = draft.type === "bus" ? draft.description : draft.name;

  function handleChange(field, value) {
    setDraft((current) => {
      if (field !== "type") return { ...current, [field]: value };

      if (value === "bus") {
        return {
          ...current,
          type: value,
          description: current.description || current.name || "",
          name: "",
          customCategory: "",
        };
      }

      return {
        ...current,
        type: value,
        name: current.name || current.description || "",
        description: "",
        customCategory:
          value === "custom" ? current.customCategory || "" : "",
      };
    });
  }

  function saveChanges() {
    if (onUpdateItem(item.id, draft)) setEditing(false);
  }

  function cancelEditing() {
    setDraft(item);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="draft-item draft-item--editing">
        <div className="draft-edit-grid">
          <label>
            <span>Period</span>
            <select
              value={draft.period}
              onChange={(event) => handleChange("period", event.target.value)}
              disabled={disabled}
            >
              {PERIODS.map((period) => (
                <option key={period.value} value={period.value}>
                  {period.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Type</span>
            <select
              value={draft.type}
              onChange={(event) => handleChange("type", event.target.value)}
              disabled={disabled}
            >
              {EXPENSE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>

          {draft.type === "custom" && (
            <label>
              <span>Custom Category</span>
              <input
                value={draft.customCategory || ""}
                onChange={(event) =>
                  handleChange("customCategory", event.target.value)
                }
                placeholder="Example: Medicine"
                disabled={disabled}
              />
            </label>
          )}

          <label>
            <span>{draft.type === "bus" ? "Description" : "Item Name"}</span>
            <input
              value={textValue || ""}
              onChange={(event) => handleChange(textField, event.target.value)}
              placeholder="Expense details"
              disabled={disabled}
            />
          </label>

          <label>
            <span>Payment</span>
            <select
              value={draft.paymentType}
              onChange={(event) =>
                handleChange("paymentType", event.target.value)
              }
              disabled={disabled}
            >
              {PAYMENT_TYPES.map((payment) => (
                <option key={payment.value} value={payment.value}>
                  {payment.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Price</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={draft.price}
              onChange={(event) => handleChange("price", event.target.value)}
              disabled={disabled}
            />
          </label>
        </div>

        <div className="draft-item__edit-actions">
          <Button
            variant="secondary"
            size="sm"
            onClick={cancelEditing}
            disabled={disabled}
          >
            Cancel
          </Button>
          <Button size="sm" onClick={saveChanges} disabled={disabled}>
            Save Changes
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="draft-item">
      <div>
        <strong>{item.name || item.description || "-"}</strong>
        <p>
          {item.period} • {item.type}
          {item.type === "custom" && item.customCategory
            ? ` (${item.customCategory})`
            : ""}
          {` • ${item.paymentType}`}
        </p>
      </div>

      <div className="draft-item__right">
        <strong>{formatCurrency(item.price)}</strong>
        <div className="draft-item__actions">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setDraft(item);
              setEditing(true);
            }}
            disabled={disabled}
          >
            Edit
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => onDeleteItem(item.id)}
            disabled={disabled}
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

function ExpenseDraftList({
  draftItems = [],
  onUpdateItem,
  onDeleteItem,
  onClearAll,
  disabled = false,
}) {
  const summary = useMemo(
    () => ({
      total: calculateTotal(draftItems),
      cashTotal: calculateCashTotal(draftItems),
      gpayTotal: calculateGPayTotal(draftItems),
    }),
    [draftItems]
  );

  return (
    <div className="card expense-draft-card">
      <div className="card-header draft-card-header">
        <div>
          <h3>Current Draft Items</h3>
          {draftItems.length > 0 && (
            <span className="draft-status-pill">
              {draftItems.length} unsaved · {formatCurrency(summary.total)}
            </span>
          )}
        </div>

        {draftItems.length > 0 && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onClearAll}
            disabled={disabled}
          >
            Clear All
          </Button>
        )}
      </div>

      {draftItems.length === 0 ? (
        <EmptyState
          title="No draft items"
          message="Add expenses before submitting. Drafts are not included in Today Summary."
        />
      ) : (
        <>
          <div className="draft-summary-strip" aria-label="Draft totals">
            <span>
              Draft Total <strong>{formatCurrency(summary.total)}</strong>
            </span>
            <span>
              Cash <strong>{formatCurrency(summary.cashTotal)}</strong>
            </span>
            <span>
              GPay <strong>{formatCurrency(summary.gpayTotal)}</strong>
            </span>
          </div>

          <div className="draft-list">
            {draftItems.map((item) => (
              <DraftItem
                key={item.id}
                item={item}
                onUpdateItem={onUpdateItem}
                onDeleteItem={onDeleteItem}
                disabled={disabled}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default ExpenseDraftList;
