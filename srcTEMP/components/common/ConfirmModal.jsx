import Button from "./Button";

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
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <h3>{title}</h3>
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
    </div>
  );
}

export default ConfirmModal;