import { useEffect } from "react";
import { createPortal } from "react-dom";
import Button from "./Button";

export function DetailModal({ isOpen, title, fields = [], onClose }) {
  useEffect(() => {
    if (!isOpen) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  function handleBackdropClick(event) {
    if (event.target === event.currentTarget) onClose();
  }

  return createPortal(
    <div
      className="modal-backdrop history-detail-backdrop"
      role="presentation"
      onMouseDown={handleBackdropClick}
    >
      <section
        className="modal-card history-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-detail-title"
      >
        <div className="history-detail-modal__header">
          <h3 id="history-detail-title">{title}</h3>
          <button
            type="button"
            className="history-detail-modal__close"
            onClick={onClose}
            aria-label="Close details"
            autoFocus
          >
            Close
          </button>
        </div>

        <dl className="history-detail-list">
          {fields.map((field) => (
            <div key={field.label} className="history-detail-list__row">
              <dt>{field.label}</dt>
              <dd>{field.value ?? "-"}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>,
    document.body
  );
}

function ConfirmModal({
  isOpen,
  title = "Confirm",
  message = "Are you sure?",
  confirmText = "Yes",
  cancelText = "No",
  loading = false,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape" && !loading) onCancel();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, loading, onCancel]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="modal-backdrop transaction-confirm-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) onCancel();
      }}
    >
      <div
        className="modal-card transaction-confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transaction-confirm-title"
      >
        <h3 id="transaction-confirm-title">{title}</h3>
        <p>{message}</p>

        <div className="modal-actions">
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelText}
          </Button>

          <Button variant="primary" onClick={onConfirm} loading={loading}>
            {confirmText}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default ConfirmModal;
