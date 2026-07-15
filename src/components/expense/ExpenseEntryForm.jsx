import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useFeedback } from "../../context/FeedbackContext";
import {
  deleteExpenseRecommendation,
  deleteExpenseTemplate,
  saveExpenseRecommendation,
  saveExpenseTemplate,
  subscribeToExpenseRecommendations,
  subscribeToExpenseTemplates,
} from "../../firebase/expenseService";
import { EXPENSE_TYPES, PAYMENT_TYPES, PERIODS } from "../../utils/constants";
import {
  filterExpenseTemplates,
  filterSavedRecommendations,
  getExpenseLabel,
  normalizeText,
  sanitizeExpenseItem,
} from "../../utils/expenseWorkflow";
import { formatCurrency } from "../../utils/totalUtils";
import Button from "../common/Button";
import AppIcon from "../common/AppIcon";
import Input from "../common/Input";
import Select from "../common/Select";

function getOptionLabel(options, value) {
  return options.find((option) => option.value === value)?.label || value;
}

function getLabelByType(type) {
  if (type === "food") return "Food Name";
  if (type === "snacks") return "Snack Name";
  if (type === "bus" || type === "custom") return "Description";
  return "Item Name";
}

function getPlaceholderByType(type) {
  if (type === "food") return "Example: idly";
  if (type === "snacks") return "Example: biscuit";
  if (type === "bus") return "Example: Bus to office";
  if (type === "custom") return "Example: Medicine, recharge, notebook";
  return "Example: tablet, recharge, notebook";
}

function createEmptyForm(paymentType = "cash") {
  return {
    name: "",
    description: "",
    price: "",
    paymentType,
  };
}

function createEmptyTemplate(paymentType = "cash") {
  return {
    label: "",
    price: "",
    paymentType,
  };
}

function getEntryFieldErrors(expense = {}) {
  const cleanExpense = sanitizeExpenseItem(expense);
  const errors = {};

  if (cleanExpense.type === "bus") {
    if (!cleanExpense.description) {
      errors.description = "Enter a description for the bus expense.";
    }
  } else if (!cleanExpense.name) {
    errors.name = "Enter an item name.";
  }

  if (!Number.isFinite(cleanExpense.price) || cleanExpense.price <= 0) {
    errors.price = "Enter a price greater than zero.";
  }

  if (
    !PAYMENT_TYPES.some(
      (paymentType) => paymentType.value === cleanExpense.paymentType
    )
  ) {
    errors.paymentType = "Select a valid payment type.";
  }

  return errors;
}

function TemplateManagerModal({
  open,
  activePeriod,
  selectedType,
  templates,
  disabled,
  onUse,
  onSave,
  onDelete,
  onClose,
}) {
  const [editorMode, setEditorMode] = useState("");
  const [editingId, setEditingId] = useState("");
  const [draft, setDraft] = useState(createEmptyTemplate());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const periodLabel = getOptionLabel(PERIODS, activePeriod);
  const typeLabel = getOptionLabel(EXPENSE_TYPES, selectedType);

  useEffect(() => {
    if (!open) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape" && !saving) onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, saving, onClose]);

  if (!open) return null;

  function beginAdding() {
    setEditorMode("add");
    setEditingId("");
    setDraft(createEmptyTemplate());
    setError("");
  }

  function beginEditing(template) {
    setEditorMode("edit");
    setEditingId(template.id);
    setDraft({
      label: getExpenseLabel(template),
      price: String(template.price ?? ""),
      paymentType: template.paymentType || "cash",
    });
    setError("");
  }

  function closeEditor() {
    setEditorMode("");
    setEditingId("");
    setDraft(createEmptyTemplate());
    setError("");
  }

  async function handleSave(event) {
    event.preventDefault();
    const label = normalizeText(draft.label);
    const price = Number(draft.price);

    if (!label) {
      setError("Enter a template name or description.");
      return;
    }

    if (!Number.isFinite(price) || price <= 0) {
      setError("Enter a valid price greater than zero.");
      return;
    }

    const duplicate = templates.some(
      (template) =>
        template.id !== editingId &&
        getExpenseLabel(template).toLowerCase() === label.toLowerCase()
    );

    if (duplicate) {
      setError(
        "A template with this name already exists for this period and type."
      );
      return;
    }

    try {
      setSaving(true);
      setError("");
      await onSave({
        id: editingId || undefined,
        period: activePeriod,
        type: selectedType,
        name: selectedType === "bus" ? "" : label,
        description: selectedType === "bus" ? label : "",
        customCategory: "",
        price,
        paymentType: draft.paymentType,
      });
      closeEditor();
    } catch (saveError) {
      setError(saveError.message || "The template could not be saved.");
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
            <p>
              Full presets for <strong>{periodLabel}</strong> +{" "}
              <strong>{typeLabel}</strong> only.
            </p>
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

        {!editorMode && (
          <button
            type="button"
            className="template-add-btn"
            onClick={beginAdding}
            disabled={disabled}
          >
            + Add New {periodLabel} {typeLabel} Template
          </button>
        )}

        {editorMode && (
          <form className="template-manager-edit" onSubmit={handleSave}>
            <div className="template-editor-heading">
              <strong>
                {editorMode === "add" ? "Add Template" : "Edit Template"}
              </strong>
              <span>This preset includes the item, price, and payment type.</span>
            </div>

            <Input
              label={
                selectedType === "bus" || selectedType === "custom"
                  ? "Description"
                  : "Item Name"
              }
              name="templateLabel"
              value={draft.label}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  label: event.target.value,
                }))
              }
              required
              disabled={saving}
              autoFocus
            />

            <Input
              label="Price"
              name="templatePrice"
              type="number"
              min="0.01"
              step="0.01"
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
              name="templatePayment"
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

            {error && <p className="template-manager-error">{error}</p>}

            <div className="template-manager-edit__actions">
              <button
                type="button"
                className="template-action-btn"
                onClick={closeEditor}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="template-action-btn template-action-btn--primary"
                disabled={saving || disabled}
              >
                {saving
                  ? "Saving..."
                  : editorMode === "add"
                  ? "Add Template"
                  : "Save Changes"}
              </button>
            </div>
          </form>
        )}

        <div className="template-manager-list">
          {templates.length === 0 ? (
            <div className="template-manager-empty">
              No templates saved for {periodLabel} + {typeLabel}.
            </div>
          ) : (
            templates.map((template) => (
              <article key={template.id} className="template-manager-item">
                <div className="template-manager-item__content">
                  <strong>{getExpenseLabel(template)}</strong>
                  <span>
                    {formatCurrency(template.price)} ·{" "}
                    {template.paymentType === "gpay" ? "GPay" : "Cash"}
                  </span>
                </div>
                <div className="template-manager-item__actions">
                  <button
                    type="button"
                    className="template-action-btn template-action-btn--primary"
                    onClick={() => onUse(template)}
                  >
                    Use Template
                  </button>
                  <button
                    type="button"
                    className="template-action-btn"
                    onClick={() => beginEditing(template)}
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

function RecommendationManagerModal({
  open,
  selectedType,
  recommendations,
  disabled,
  onUse,
  onSave,
  onDelete,
  onClose,
}) {
  const [editorMode, setEditorMode] = useState("");
  const [editingId, setEditingId] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const typeLabel = getOptionLabel(EXPENSE_TYPES, selectedType);

  useEffect(() => {
    if (!open) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape" && !saving) onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, saving, onClose]);

  if (!open) return null;

  function beginAdding() {
    setEditorMode("add");
    setEditingId("");
    setLabel("");
    setError("");
  }

  function beginEditing(recommendation) {
    setEditorMode("edit");
    setEditingId(recommendation.id);
    setLabel(recommendation.label);
    setError("");
  }

  function closeEditor() {
    setEditorMode("");
    setEditingId("");
    setLabel("");
    setError("");
  }

  async function handleSave(event) {
    event.preventDefault();
    const cleanLabel = normalizeText(label);

    if (!cleanLabel) {
      setError("Enter a recommendation name or description.");
      return;
    }

    const duplicate = recommendations.some(
      (recommendation) =>
        recommendation.id !== editingId &&
        normalizeText(recommendation.label).toLowerCase() ===
          cleanLabel.toLowerCase()
    );

    if (duplicate) {
      setError("This recommendation already exists for this type.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      await onSave({
        id: editingId || undefined,
        type: selectedType,
        label: cleanLabel,
      });
      closeEditor();
    } catch (saveError) {
      setError(saveError.message || "The recommendation could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="modal-backdrop template-manager-backdrop" role="presentation">
      <section
        className="modal-card template-manager-modal recommendation-manager-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recommendation-manager-title"
      >
        <div className="template-manager-modal__header">
          <div>
            <h3 id="recommendation-manager-title">Manage Recommendations</h3>
            <p>
              Saved {typeLabel} names only. They never change price or payment.
            </p>
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

        {!editorMode && (
          <button
            type="button"
            className="template-add-btn"
            onClick={beginAdding}
            disabled={disabled}
          >
            + Add New {typeLabel} Recommendation
          </button>
        )}

        {editorMode && (
          <form
            className="template-manager-edit recommendation-manager-edit"
            onSubmit={handleSave}
          >
            <div className="template-editor-heading">
              <strong>
                {editorMode === "add"
                  ? "Add Recommendation"
                  : "Edit Recommendation"}
              </strong>
              <span>Only this name or description will be suggested.</span>
            </div>
            <Input
              label={getLabelByType(selectedType)}
              name="recommendationLabel"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              required
              disabled={saving}
              autoFocus
            />

            {error && <p className="template-manager-error">{error}</p>}

            <div className="template-manager-edit__actions">
              <button
                type="button"
                className="template-action-btn"
                onClick={closeEditor}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="template-action-btn template-action-btn--primary"
                disabled={saving || disabled}
              >
                {saving
                  ? "Saving..."
                  : editorMode === "add"
                  ? "Add Recommendation"
                  : "Save Changes"}
              </button>
            </div>
          </form>
        )}

        <div className="template-manager-list recommendation-manager-list">
          {recommendations.length === 0 ? (
            <div className="template-manager-empty">
              No saved {typeLabel} recommendations yet.
            </div>
          ) : (
            recommendations.map((recommendation) => (
              <article
                key={recommendation.id}
                className="template-manager-item recommendation-manager-item"
              >
                <div className="template-manager-item__content">
                  <strong>{recommendation.label}</strong>
                  <span>Name-only suggestion</span>
                </div>
                <div className="template-manager-item__actions">
                  <button
                    type="button"
                    className="template-action-btn template-action-btn--primary"
                    onClick={() => onUse(recommendation)}
                  >
                    Use Name
                  </button>
                  <button
                    type="button"
                    className="template-action-btn"
                    onClick={() => beginEditing(recommendation)}
                    disabled={disabled}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="template-action-btn template-action-btn--danger"
                    onClick={() => onDelete(recommendation)}
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
  initialPaymentType = "cash",
  onPaymentTypeChange,
  disabled = false,
}) {
  const { notify, confirmAction } = useFeedback();
  const [form, setForm] = useState(() => createEmptyForm(initialPaymentType));
  const [templates, setTemplates] = useState([]);
  const [savedRecommendations, setSavedRecommendations] = useState([]);
  const [templateSearch, setTemplateSearch] = useState("");
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [recommendationsOpen, setRecommendationsOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [savingQuickRecommendation, setSavingQuickRecommendation] =
    useState(false);
  const [templateManagerOpen, setTemplateManagerOpen] = useState(false);
  const [recommendationManagerOpen, setRecommendationManagerOpen] =
    useState(false);
  const [managerMenuOpen, setManagerMenuOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [shakeSubmit, setShakeSubmit] = useState(false);
  const managerMenuRef = useRef(null);
  const formRef = useRef(null);
  const itemInputRef = useRef(null);

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
    if (!managerMenuOpen) return undefined;

    function handlePointerDown(event) {
      if (!managerMenuRef.current?.contains(event.target)) {
        setManagerMenuOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") setManagerMenuOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [managerMenuOpen]);

  useEffect(() => {
    return subscribeToExpenseRecommendations(
      setSavedRecommendations,
      (error) => {
        console.error(error);
        notify({
          type: "error",
          title: "Recommendations unavailable",
          message: "Saved typing recommendations could not be loaded.",
        });
      }
    );
  }, [notify]);

  const typeTemplates = useMemo(
    () =>
      filterExpenseTemplates({
        templates,
        period: activePeriod,
        type: selectedType,
        limit: Number.MAX_SAFE_INTEGER,
      }),
    [activePeriod, selectedType, templates]
  );

  const matchingTemplates = useMemo(
    () =>
      filterExpenseTemplates({
        templates,
        period: activePeriod,
        type: selectedType,
        query: templateSearch,
      }),
    [activePeriod, selectedType, templateSearch, templates]
  );

  const typeRecommendations = useMemo(
    () =>
      filterSavedRecommendations({
        recommendations: savedRecommendations,
        type: selectedType,
        limit: Number.MAX_SAFE_INTEGER,
      }),
    [savedRecommendations, selectedType]
  );

  const textField = selectedType === "bus" ? "description" : "name";
  const textValue = selectedType === "bus" ? form.description : form.name;
  const matchingRecommendations = useMemo(
    () =>
      filterSavedRecommendations({
        recommendations: savedRecommendations,
        type: selectedType,
        query: textValue,
      }),
    [savedRecommendations, selectedType, textValue]
  );
  const hasExactRecommendation = useMemo(() => {
    const normalizedValue = normalizeText(textValue).toLowerCase();
    return typeRecommendations.some(
      (recommendation) =>
        normalizeText(recommendation.label).toLowerCase() === normalizedValue
    );
  }, [textValue, typeRecommendations]);

  const currentExpense = {
    period: activePeriod,
    type: selectedType,
    ...form,
  };
  const formDisabled = disabled || adding;
  const periodLabel = getOptionLabel(PERIODS, activePeriod);
  const typeLabel = getOptionLabel(EXPENSE_TYPES, selectedType);

  function handleChange(event) {
    const { name, value } = event.target;
    const nextForm = { ...form, [name]: value };
    setForm(nextForm);

    if (fieldErrors[name]) {
      const nextErrors = getEntryFieldErrors({
        period: activePeriod,
        type: selectedType,
        ...nextForm,
      });
      setFieldErrors((current) => {
        const updated = { ...current };
        if (nextErrors[name]) updated[name] = nextErrors[name];
        else delete updated[name];
        return updated;
      });
    }

    if (name === "paymentType") onPaymentTypeChange?.(value);
  }

  function applyRecommendation(recommendation) {
    setForm((current) => ({
      ...current,
      name: selectedType === "bus" ? "" : recommendation.label,
      description: selectedType === "bus" ? recommendation.label : "",
    }));
    setFieldErrors((current) => {
      const updated = { ...current };
      delete updated[textField];
      return updated;
    });
    setRecommendationsOpen(false);
  }

  function useRecommendationFromManager(recommendation) {
    applyRecommendation(recommendation);
    setRecommendationManagerOpen(false);
  }

  function applyTemplate(template) {
    setForm({
      name: template.type === "bus" ? "" : template.name || "",
      description:
        template.type === "bus" ? template.description || "" : "",
      price: String(template.price ?? ""),
      paymentType: template.paymentType || "cash",
    });
    setTemplateSearch(getExpenseLabel(template));
    setFieldErrors({});
    onPaymentTypeChange?.(template.paymentType || "cash");
    setTemplatePickerOpen(false);
    setTemplateManagerOpen(false);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const nextErrors = getEntryFieldErrors(currentExpense);
    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setShakeSubmit(true);
      window.requestAnimationFrame(() => {
        formRef.current
          ?.querySelector('[aria-invalid="true"]')
          ?.focus({ preventScroll: false });
      });
      return;
    }

    setFieldErrors({});

    let added;

    try {
      setAdding(true);
      added = await onAddItem({
        id: crypto.randomUUID(),
        ...sanitizeExpenseItem(currentExpense, "draft"),
        isDraft: true,
      });
    } finally {
      setAdding(false);
    }

    if (added) {
      setForm((current) => createEmptyForm(current.paymentType));
      setFieldErrors({});
      setTemplateSearch("");
      setRecommendationsOpen(false);
      window.requestAnimationFrame(() => itemInputRef.current?.focus());
    }
  }

  async function handleSaveTemplate(template) {
    try {
      await saveExpenseTemplate(template);
      notify({
        type: "success",
        title: template.id ? "Template updated" : "Template added",
        message: `${getExpenseLabel(template)} is ready for ${periodLabel} + ${typeLabel}.`,
      });
    } catch (error) {
      console.error(error);
      notify({
        type: "error",
        title: template.id ? "Update failed" : "Template not added",
        message: error.message || "The template could not be saved.",
      });
      throw error;
    }
  }

  async function handleDeleteTemplate(template) {
    const confirmed = await confirmAction({
      title: "Delete template?",
      message: `Delete ${getExpenseLabel(template)} from ${periodLabel} + ${typeLabel} templates?`,
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
        message: `${getExpenseLabel(template)} was removed.`,
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

  async function handleSaveRecommendation(recommendation) {
    try {
      await saveExpenseRecommendation(recommendation);
      notify({
        type: "success",
        title: recommendation.id
          ? "Recommendation updated"
          : "Recommendation added",
        message: `${recommendation.label} will appear while typing ${typeLabel} items.`,
      });
    } catch (error) {
      console.error(error);
      notify({
        type: "error",
        title: recommendation.id ? "Update failed" : "Recommendation not added",
        message: error.message || "The recommendation could not be saved.",
      });
      throw error;
    }
  }

  async function handleQuickSaveRecommendation() {
    const label = normalizeText(textValue);
    if (!label || hasExactRecommendation) return;

    try {
      setSavingQuickRecommendation(true);
      await handleSaveRecommendation({ type: selectedType, label });
      setRecommendationsOpen(false);
    } catch {
      // handleSaveRecommendation already provides the actionable message.
    } finally {
      setSavingQuickRecommendation(false);
    }
  }

  async function handleDeleteRecommendation(recommendation) {
    const confirmed = await confirmAction({
      title: "Delete recommendation?",
      message: `Delete ${recommendation.label} from ${typeLabel} typing recommendations?`,
      confirmText: "Delete",
      cancelText: "Keep Recommendation",
      tone: "danger",
    });

    if (!confirmed) return;

    try {
      await deleteExpenseRecommendation(recommendation.id);
      notify({
        type: "success",
        title: "Recommendation deleted",
        message: `${recommendation.label} was removed.`,
      });
    } catch (error) {
      console.error(error);
      notify({
        type: "error",
        title: "Delete failed",
        message: "The recommendation could not be deleted.",
      });
    }
  }

  return (
    <>
      <form
        ref={formRef}
        className="card expense-entry-form"
        onSubmit={handleSubmit}
        noValidate
      >
        <div className="expense-entry-form__header">
          <h3>Add Expense Item</h3>
          <div className="expense-entry-form__manager-actions">
            <button
              type="button"
              className="manage-templates-btn"
              onClick={() => setRecommendationManagerOpen(true)}
              disabled={formDisabled}
            >
              <AppIcon name="sparkle" size={16} />
              <span>Manage Recommendations</span>
            </button>
            <button
              type="button"
              className="manage-templates-btn"
              onClick={() => setTemplateManagerOpen(true)}
              disabled={formDisabled}
            >
              <AppIcon name="template" size={16} />
              <span>Manage Templates</span>
            </button>
          </div>
          <div
            ref={managerMenuRef}
            className="expense-entry-form__mobile-menu"
          >
            <button
              type="button"
              className="expense-entry-form__more-btn"
              aria-label="Open expense item options"
              aria-expanded={managerMenuOpen}
              aria-controls="expense-entry-manager-menu"
              onClick={() => setManagerMenuOpen((current) => !current)}
              disabled={formDisabled}
            >
              <span aria-hidden="true">⋮</span>
            </button>

            {managerMenuOpen && (
              <div
                id="expense-entry-manager-menu"
                className="expense-entry-form__more-menu"
                role="menu"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setManagerMenuOpen(false);
                    setRecommendationManagerOpen(true);
                  }}
                >
                  <span className="expense-entry-form__more-icon" aria-hidden="true">
                    <AppIcon name="sparkle" size={16} />
                  </span>
                  <span>
                    <strong>Manage Recommendations</strong>
                    <small>Add or edit typing suggestions</small>
                  </span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setManagerMenuOpen(false);
                    setTemplateManagerOpen(true);
                  }}
                >
                  <span className="expense-entry-form__more-icon" aria-hidden="true">
                    <AppIcon name="template" size={16} />
                  </span>
                  <span>
                    <strong>Manage Templates</strong>
                    <small>Add or edit complete presets</small>
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="quick-template-field">
          <label htmlFor="quickTemplateSearch">Quick Template (optional)</label>
          <input
            id="quickTemplateSearch"
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
            placeholder={`Search ${periodLabel} + ${typeLabel} templates...`}
            autoComplete="off"
            disabled={formDisabled}
          />

          {templatePickerOpen && (
            <div className="quick-template-results" role="listbox">
              {matchingTemplates.length === 0 ? (
                <div className="expense-recommendations__empty">
                  No matching template for {periodLabel} + {typeLabel}. Use
                  Manage Templates to add one.
                </div>
              ) : (
                matchingTemplates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    className="quick-template-result"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => applyTemplate(template)}
                  >
                    <span>
                      <strong>{getExpenseLabel(template)}</strong>
                      <small>Full template</small>
                    </span>
                    <span>
                      {formatCurrency(template.price)} ·{" "}
                      {template.paymentType === "gpay" ? "GPay" : "Cash"}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="form-grid">
          <div className="form-field expense-recommendation-field">
            <label htmlFor="expenseItemText">
              {getLabelByType(selectedType)} <span className="required">*</span>
            </label>
            <input
              ref={itemInputRef}
              id="expenseItemText"
              name={textField}
              className={fieldErrors[textField] ? "input input--error" : "input"}
              value={textValue}
              onChange={(event) => {
                handleChange(event);
                setRecommendationsOpen(true);
              }}
              onFocus={() => {
                if (normalizeText(textValue)) setRecommendationsOpen(true);
              }}
              onBlur={() =>
                window.setTimeout(() => setRecommendationsOpen(false), 120)
              }
              placeholder={getPlaceholderByType(selectedType)}
              autoComplete="off"
              autoFocus
              disabled={formDisabled}
              aria-invalid={fieldErrors[textField] ? "true" : undefined}
              aria-describedby={
                fieldErrors[textField] ? "expenseItemText-error" : undefined
              }
            />

            {fieldErrors[textField] && (
              <small
                id="expenseItemText-error"
                className="error-text expense-entry-form__field-error"
                role="alert"
              >
                {fieldErrors[textField]}
              </small>
            )}

            {recommendationsOpen && normalizeText(textValue) && (
              <div className="expense-recommendations" role="listbox">
                {matchingRecommendations.length === 0 ? (
                  <div className="expense-recommendations__empty">
                    No saved recommendation matches. You can still use this as
                    the item name.
                  </div>
                ) : (
                  matchingRecommendations.map((recommendation) => (
                    <button
                      key={recommendation.id}
                      type="button"
                      className="expense-recommendation"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => applyRecommendation(recommendation)}
                    >
                      <span>
                        <strong>{recommendation.label}</strong>
                        <small>Saved name recommendation</small>
                      </span>
                      <span className="expense-recommendation__details">
                        Name only
                      </span>
                    </button>
                  ))
                )}

                {!hasExactRecommendation && (
                  <button
                    type="button"
                    className="expense-recommendation expense-recommendation--add"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={handleQuickSaveRecommendation}
                    disabled={savingQuickRecommendation || disabled}
                  >
                    <span>
                      <strong>
                        {savingQuickRecommendation
                          ? "Saving..."
                          : `+ Save “${normalizeText(
                              textValue
                            )}” as a recommendation`}
                      </strong>
                      <small>For {typeLabel} typing suggestions only</small>
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>

          <Input
            label="Price"
            name="price"
            type="number"
            value={form.price}
            onChange={handleChange}
            placeholder="Enter price"
            min="0.01"
            step="0.01"
            required
            disabled={formDisabled}
            error={fieldErrors.price}
          />

          <Select
            label="Payment Type"
            name="paymentType"
            value={form.paymentType}
            onChange={handleChange}
            options={PAYMENT_TYPES}
            disabled={formDisabled}
            error={fieldErrors.paymentType}
          />
        </div>

        <div
          className={
            shakeSubmit
              ? "expense-entry-form__submit expense-entry-form__submit--shake"
              : "expense-entry-form__submit"
          }
          onAnimationEnd={() => setShakeSubmit(false)}
        >
          <Button type="submit" disabled={formDisabled}>
            {adding ? "Adding..." : "Add Item"}
          </Button>
        </div>
      </form>

      {templateManagerOpen && (
        <TemplateManagerModal
          open
          activePeriod={activePeriod}
          selectedType={selectedType}
          templates={typeTemplates}
          disabled={disabled}
          onUse={applyTemplate}
          onSave={handleSaveTemplate}
          onDelete={handleDeleteTemplate}
          onClose={() => setTemplateManagerOpen(false)}
        />
      )}

      {recommendationManagerOpen && (
        <RecommendationManagerModal
          open
          selectedType={selectedType}
          recommendations={typeRecommendations}
          disabled={disabled}
          onUse={useRecommendationFromManager}
          onSave={handleSaveRecommendation}
          onDelete={handleDeleteRecommendation}
          onClose={() => setRecommendationManagerOpen(false)}
        />
      )}
    </>
  );
}

export default ExpenseEntryForm;
