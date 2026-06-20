import { useEffect, useRef, useState } from "react";

function EditAccessDialog({
  open,
  loginPrompt,
  onUnlock,
  onContinueView,
  onClose,
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const checkingPin = useRef(false);

  useEffect(() => {
    if (open) {
      setPin("");
      setError("");
      setLoading(false);
      checkingPin.current = false;
    }
  }, [open]);

  async function checkPinAutomatically(pinValue) {
    if (checkingPin.current || pinValue.length !== 6) {
      return;
    }

    try {
      checkingPin.current = true;
      setLoading(true);
      setError("");

      await onUnlock(pinValue);
    } catch (unlockError) {
      setError(unlockError.message || "Incorrect edit PIN.");
      setPin("");
    } finally {
      checkingPin.current = false;
      setLoading(false);
    }
  }

  function handlePinChange(event) {
    const nextPin = event.target.value
      .replace(/\D/g, "")
      .slice(0, 6);

    setPin(nextPin);
    setError("");

    if (nextPin.length === 6) {
      checkPinAutomatically(nextPin);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    checkPinAutomatically(pin);
  }

  function handleClose() {
    if (loginPrompt) {
      onContinueView();
      return;
    }

    onClose();
  }

  if (!open) return null;

  return (
    <div className="edit-lock-backdrop" role="presentation">
      <section
        className="edit-lock-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-access-title"
      >
        <div className="edit-lock-dialog__header">
          <div>
            <span className="edit-lock-dialog__eyebrow">
              Protected editing
            </span>

            <h2 id="edit-access-title">Edit Access</h2>
          </div>

          {!loginPrompt && (
            <button
              type="button"
              className="edit-lock-dialog__close"
              onClick={onClose}
              disabled={loading}
            >
              Close
            </button>
          )}
        </div>

        <p className="edit-lock-dialog__description">
          Enter the edit PIN to add or change expenses. You can continue
          without it in View Mode.
        </p>

        <form className="edit-lock-form" onSubmit={handleSubmit}>
          {error && (
            <div className="edit-lock-message edit-lock-message--error">
              {error}
            </div>
          )}

          <label className="edit-lock-field">
            <span>6-digit PIN</span>

            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={pin}
              onChange={handlePinChange}
              placeholder={loading ? "Checking PIN..." : "Enter PIN"}
              maxLength="6"
              autoFocus
              disabled={loading}
            />
          </label>

          <button
            className="edit-lock-secondary"
            type="button"
            onClick={handleClose}
            disabled={loading}
          >
            {loginPrompt ? "Continue in View Mode" : "Cancel"}
          </button>
        </form>
      </section>
    </div>
  );
}

export default EditAccessDialog;