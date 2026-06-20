import { useEffect, useState } from "react";

const emptyForm = {
  currentPin: "",
  newPin: "",
  confirmPin: "",
};

function EditPinSettingsDialog({
  open,
  pinConfigured,
  onSetPin,
  onChangePin,
  onRemovePin,
  onClose,
}) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [loadingAction, setLoadingAction] = useState("");

  useEffect(() => {
    if (open) {
      setForm(emptyForm);
      setError("");
      setLoadingAction("");
    }
  }, [open, pinConfigured]);

  if (!open) return null;

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((previous) => ({
      ...previous,
      [name]: value.replace(/\D/g, "").slice(0, 6),
    }));
  }

  function validateNewPin() {
    if (form.newPin.length !== 6) {
      return "New PIN must contain exactly 6 digits.";
    }

    if (form.newPin !== form.confirmPin) {
      return "New PIN and confirmation do not match.";
    }

    return "";
  }

  async function handleSave(event) {
    event.preventDefault();
    setError("");

    const validationError = validateNewPin();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (pinConfigured && form.currentPin.length !== 6) {
      setError("Enter your current 6-digit PIN.");
      return;
    }

    try {
      setLoadingAction("save");

      if (pinConfigured) {
        await onChangePin(form.currentPin, form.newPin);
      } else {
        await onSetPin(form.newPin);
      }

      onClose();
    } catch (saveError) {
      setError(saveError.message || "Unable to save the edit PIN.");
    } finally {
      setLoadingAction("");
    }
  }

  async function handleRemove() {
    setError("");

    if (form.currentPin.length !== 6) {
      setError("Enter your current 6-digit PIN before removing it.");
      return;
    }

    const confirmed = window.confirm(
      "Remove the edit PIN? Everyone using this login will be able to edit."
    );

    if (!confirmed) return;

    try {
      setLoadingAction("remove");
      await onRemovePin(form.currentPin);
      onClose();
    } catch (removeError) {
      setError(removeError.message || "Unable to remove the edit PIN.");
    } finally {
      setLoadingAction("");
    }
  }

  const busy = Boolean(loadingAction);

  return (
    <div className="edit-lock-backdrop" role="presentation">
      <section
        className="edit-lock-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pin-settings-title"
      >
        <div className="edit-lock-dialog__header">
          <div>
            <span className="edit-lock-dialog__eyebrow">Optional security</span>
            <h2 id="pin-settings-title">
              {pinConfigured ? "Edit PIN Settings" : "Set Edit PIN"}
            </h2>
          </div>

          <button
            type="button"
            className="edit-lock-dialog__close"
            onClick={onClose}
            disabled={busy}
          >
            Close
          </button>
        </div>

        <p className="edit-lock-dialog__description">
          {pinConfigured
            ? "Change or remove the PIN that protects editing."
            : "Without a PIN, everyone using this account has full editing access."}
        </p>

        <form className="edit-lock-form" onSubmit={handleSave}>
          {error && <div className="edit-lock-message edit-lock-message--error">{error}</div>}

          {pinConfigured && (
            <label className="edit-lock-field">
              <span>Current PIN</span>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                name="currentPin"
                value={form.currentPin}
                onChange={handleChange}
                placeholder="Current 6-digit PIN"
                maxLength="6"
                disabled={busy}
              />
            </label>
          )}

          <label className="edit-lock-field">
            <span>{pinConfigured ? "New PIN" : "Create PIN"}</span>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              name="newPin"
              value={form.newPin}
              onChange={handleChange}
              placeholder="6 digits"
              maxLength="6"
              disabled={busy}
            />
          </label>

          <label className="edit-lock-field">
            <span>Confirm new PIN</span>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              name="confirmPin"
              value={form.confirmPin}
              onChange={handleChange}
              placeholder="Enter the PIN again"
              maxLength="6"
              disabled={busy}
            />
          </label>

          <button className="edit-lock-primary" type="submit" disabled={busy}>
            {loadingAction === "save"
              ? "Saving PIN..."
              : pinConfigured
              ? "Change PIN"
              : "Set Edit PIN"}
          </button>

          {pinConfigured && (
            <button
              className="edit-lock-danger"
              type="button"
              onClick={handleRemove}
              disabled={busy}
            >
              {loadingAction === "remove" ? "Removing PIN..." : "Remove PIN"}
            </button>
          )}
        </form>
      </section>
    </div>
  );
}

export default EditPinSettingsDialog;
