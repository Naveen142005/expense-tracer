import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useFeedback } from "../../context/FeedbackContext";
import {
  deleteExpenseTemplate,
  saveExpenseTemplate,
  subscribeToExpenseTemplates,
} from "../../firebase/expenseService";
import {
  FOOD_SUGGESTIONS,
  PAYMENT_TYPES,
  SNACK_SUGGESTIONS,
} from "../../utils/constants";
import { formatCurrency } from "../../utils/totalUtils";
import Button from "../common/Button";
import Input from "../common/Input";
import Select from "../common/Select";

function getLabelByType(type) {
  if (type === "food") return "Food Name";
  if (type === "snacks") return "Snack Name";
  if (type === "bus") return "Description";
  return "Name / Description";
}

function getPlaceholderByType(type) {
  if (type === "food") return "Example: idly";
  if (type === "snacks") return "Example: biscuit";
  if (type === "bus") return "Example: Bus to office";
  return "Example: recharge, medicine, college";
}

function getTemplateLabel(template) {
  return template.type === "bus" ? template.description : template.name;
}

function getUniqueSuggestions(items) {
  const seen = new Set();

  return items.filter((item) => {
    const normalized = String(item || "").trim().toLowerCase();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function TemplateManagerModal({
  open,
  selectedType,
  templates,
  disabled,
  onUse,
  onUpdate,
  onDelete,
  onClose,
}) {
  const [editingId, setEditingId] = useState("");
  const [draft, setDraft] = useState({
    label: "",
    price: "",
    paymentType: "cash",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape" && !saving) onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, saving, onClose]);

  useEffect(() => {
    setEditingId("");
    setDraft({ label: "", price: "", paymentType: "cash" });
  }, [open, selectedType]);

  if (!open) return null;

  function startEditing(template) {
    setEditingId(template.id);
    setDraft({
      label: getTemplateLabel(template) || "",
      price: String(template.price ?? ""),
      paymentType: template.paymentType || "cash",
    });
  }

  async function handleUpdate(event) {
    event.preventDefault();
    const label = draft.label.trim();
    const price = Number(draft.price);

    if (!label || !price || price <= 0) return;

    try {
      setSaving(true);
      await onUpdate({
        id: editingId,
        type: selectedType,
        name: selectedType === "bus" ? "" : label,
        description: selectedType === "bus" ? label : "",
        price,
        paymentType: draft.paymentType,
      });
      setEditingId("");
    } catch {
      // The parent reports the error and keeps the editor open for retry.
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="modal-backdrop template-manager-backdrop" role="presentation">
      <section
        className="modal-card template-manager-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-manager-title"
      >
        <div className="template-manager-modal__header">
          <div>
            <h3 id="template-manager-title">Manage Templates</h3>
            <p>Templates for the selected expense type.</p>
          </div>
          <button
            type="button"
            className="template-manager-close"
            onClick={onClose}
            disabled={saving}
          >
            Close
          </button>
        </div>

        {editingId && (
          <form className="template-manager-edit" onSubmit={handleUpdate}>
            <Input
              label={selectedType === "bus" ? "Description" : "Name"}
              name="templateEditLabel"
              value={draft.label}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  label: event.target.value,
                }))
              }
              required
              disabled={saving}
            />
            <Input
              label="Price"
              name="templateEditPrice"
              type="number"
              min="1"
              step="1"
              value={draft.price}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  price: event.target.value,
                }))
              }
              required
              disabled={saving}
            />
            <Select
              label="Payment"
              name="templateEditPayment"
              value={draft.paymentType}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  paymentType: event.target.value,
                }))
              }
              options={PAYMENT_TYPES}
              disabled={saving}
            />
            <div className="template-manager-edit__actions">
              <button
                type="button"
                className="template-action-btn"
                onClick={() => setEditingId("")}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="template-action-btn template-action-btn--primary"
                disabled={saving || disabled}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        )}

        <div className="template-manager-list">
          {templates.length === 0 ? (
            <div className="template-manager-empty">
              No templates saved for this type.
            </div>
          ) : (
            templates.map((template) => (
              <article key={template.id} className="template-manager-item">
                <div className="template-manager-item__content">
                  <strong>{getTemplateLabel(template)}</strong>
                  <span>
                    {formatCurrency(template.price)} -{" "}
                    {template.paymentType === "gpay" ? "GPay" : "Cash"}
                  </span>
                </div>
                <div className="template-manager-item__actions">
                  <button
                    type="button"
                    className="template-action-btn"
                    onClick={() => onUse(template)}
                  >
                    Use
                  </button>
                  <button
                    type="button"
                    className="template-action-btn"
                    onClick={() => startEditing(template)}
                    disabled={disabled}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="template-action-btn template-action-btn--danger"
                    onClick={() => onDelete(template)}
                    disabled={disabled}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>,
    document.body
  );
}

function ExpenseEntryForm({
  activePeriod,
  selectedType,
  onAddItem,
  disabled = false,
}) {
  const { notify, confirmAction } = useFeedback();
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    paymentType: "cash",
  });
  const [templates, setTemplates] = useState([]);
  const [templateSearch, setTemplateSearch] = useState("");
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);

  useEffect(() => {
    return subscribeToExpenseTemplates(setTemplates, (error) => {
      console.error(error);
      notify({
        type: "error",
        title: "Templates unavailable",
        message: "Saved templates could not be loaded.",
      });
    });
  }, [notify]);

  useEffect(() => {
    setForm({
      name: "",
      description: "",
      price: "",
      paymentType: "cash",
    });
    setTemplateSearch("");
    setSaveAsTemplate(false);
    setManagerOpen(false);
  }, [selectedType]);

  const typeTemplates = useMemo(
    () => templates.filter((template) => template.type === selectedType),
    [templates, selectedType]
  );

  const matchingTemplates = useMemo(() => {
    const search = templateSearch.trim().toLowerCase();

    return typeTemplates
      .filter((template) => {
        if (!search) return true;
        const text = `${getTemplateLabel(template)} ${template.price} ${
          template.paymentType
        }`.toLowerCase();
        return text.includes(search);
      })
      .slice(0, 8);
  }, [typeTemplates, templateSearch]);

  const savedTypeSuggestions = typeTemplates.map(getTemplateLabel);
  const nameSuggestions = getUniqueSuggestions([
    ...(selectedType === "food" ? FOOD_SUGGESTIONS : []),
    ...(selectedType === "snacks" ? SNACK_SUGGESTIONS : []),
    ...savedTypeSuggestions,
  ]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  function useTemplate(template) {
    setForm({
      name: template.type === "bus" ? "" : template.name || "",
      description:
        template.type === "bus" ? template.description || "" : "",
      price: String(template.price ?? ""),
      paymentType: template.paymentType || "cash",
    });
    setTemplateSearch(getTemplateLabel(template) || "");
    setTemplatePickerOpen(false);
    setManagerOpen(false);
    setSaveAsTemplate(false);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const price = Number(form.price);
    const textValue =
      selectedType === "bus"
        ? form.description.trim()
        : form.name.trim();

    if (!textValue) {
      notify({
        type: "warning",
        title: selectedType === "bus" ? "Description required" : "Item name required",
        message: "Enter a name or description for this expense.",
      });
      return;
    }

    if (!price || price <= 0) {
      notify({
        type: "warning",
        title: "Invalid price",
        message: "Enter a price greater than zero.",
      });
      return;
    }

    const expenseItem = {
      id: crypto.randomUUID(),
      period: activePeriod,
      type: selectedType,
      name: selectedType === "bus" ? "" : textValue,
      description: selectedType === "bus" ? textValue : "",
      price,
      paymentType: form.paymentType,
      isDraft: true,
    };

    onAddItem(expenseItem);

    if (saveAsTemplate) {
      const existingTemplate = typeTemplates.find(
        (template) =>
          String(getTemplateLabel(template) || "").trim().toLowerCase() ===
          textValue.toLowerCase()
      );

      try {
        setTemplateSaving(true);
        await saveExpenseTemplate({
          id: existingTemplate?.id,
          type: selectedType,
          name: expenseItem.name,
          description: expenseItem.description,
          price,
          paymentType: form.paymentType,
        });
        notify({
          type: "success",
          title: existingTemplate ? "Template updated" : "Template saved",
          message: `${textValue} is ready for future expenses.`,
        });
      } catch (error) {
        console.error(error);
        notify({
          type: "error",
          title: "Template not saved",
          message: "The expense was added, but its template could not be saved.",
        });
      } finally {
        setTemplateSaving(false);
      }
    }

    setForm({
      name: "",
      description: "",
      price: "",
      paymentType: "cash",
    });
    setTemplateSearch("");
    setSaveAsTemplate(false);
  }

  async function handleUpdateTemplate(template) {
    try {
      await saveExpenseTemplate(template);
      notify({
        type: "success",
        title: "Template updated",
        message: `${getTemplateLabel(template)} was updated.`,
      });
    } catch (error) {
      console.error(error);
      notify({
        type: "error",
        title: "Update failed",
        message: error.message || "The template could not be updated.",
      });
      throw error;
    }
  }

  async function handleDeleteTemplate(template) {
    const confirmed = await confirmAction({
      title: "Delete template?",
      message: `Delete ${getTemplateLabel(template)} from your saved templates?`,
      confirmText: "Delete",
      cancelText: "Keep Template",
      tone: "danger",
    });

    if (!confirmed) return;

    try {
      await deleteExpenseTemplate(template.id);
      notify({
        type: "success",
        title: "Template deleted",
        message: `${getTemplateLabel(template)} was removed.`,
      });
    } catch (error) {
      console.error(error);
      notify({
        type: "error",
        title: "Delete failed",
        message: "The template could not be deleted.",
      });
    }
  }

  const inputLabel = getLabelByType(selectedType);
  const inputPlaceholder = getPlaceholderByType(selectedType);
  const formDisabled = disabled || templateSaving;

  return (
    <>
      <form className="card expense-entry-form" onSubmit={handleSubmit}>
        <div className="expense-entry-form__header">
          <h3>Add Expense Item</h3>
          <button
            type="button"
            className="manage-templates-btn"
            onClick={() => setManagerOpen(true)}
          >
            Manage Templates
          </button>
        </div>

        <div className="template-picker form-field">
          <label htmlFor="templateSearch">Quick Template (optional)</label>
          <input
            id="templateSearch"
            type="search"
            className="input"
            value={templateSearch}
            onChange={(event) => {
              setTemplateSearch(event.target.value);
              setTemplatePickerOpen(true);
            }}
            onFocus={() => setTemplatePickerOpen(true)}
            onBlur={() =>
              window.setTimeout(() => setTemplatePickerOpen(false), 120)
            }
            placeholder="Search saved templates..."
            autoComplete="off"
          />

          {templatePickerOpen && (
            <div className="template-picker__results">
              {matchingTemplates.length === 0 ? (
                <div className="template-picker__empty">
                  No matching templates.
                </div>
              ) : (
                matchingTemplates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    className="template-picker__result"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => useTemplate(template)}
                  >
                    <span>{getTemplateLabel(template)}</span>
                    <small>
                      {formatCurrency(template.price)} -{" "}
                      {template.paymentType === "gpay" ? "GPay" : "Cash"}
                    </small>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="form-grid">
          <>
            <Input
              label={inputLabel}
              name={selectedType === "bus" ? "description" : "name"}
              value={
                selectedType === "bus" ? form.description : form.name
              }
              onChange={handleChange}
              placeholder={inputPlaceholder}
              list="expense-name-suggestions"
              required
              disabled={formDisabled}
            />

            <datalist id="expense-name-suggestions">
              {nameSuggestions.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </>

          <Input
            label="Price"
            name="price"
            type="number"
            value={form.price}
            onChange={handleChange}
            placeholder="Enter price"
            min="1"
            step="1"
            required
            disabled={formDisabled}
          />

          <Select
            label="Payment Type"
            name="paymentType"
            value={form.paymentType}
            onChange={handleChange}
            options={PAYMENT_TYPES}
            disabled={formDisabled}
          />
        </div>

        <label className="save-template-toggle">
          <input
            type="checkbox"
            checked={saveAsTemplate}
            onChange={(event) => setSaveAsTemplate(event.target.checked)}
            disabled={formDisabled}
          />
          <span>Save these details as a reusable template</span>
        </label>

        <Button type="submit" loading={templateSaving} disabled={formDisabled}>
          Add Item
        </Button>
      </form>

      <TemplateManagerModal
        open={managerOpen}
        selectedType={selectedType}
        templates={typeTemplates}
        disabled={disabled}
        onUse={useTemplate}
        onUpdate={handleUpdateTemplate}
        onDelete={handleDeleteTemplate}
        onClose={() => setManagerOpen(false)}
      />
    </>
  );
}

export default ExpenseEntryForm;
