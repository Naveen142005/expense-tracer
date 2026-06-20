import Button from "./Button";

function FeedbackConfirmDialog({ confirmation, onResolve }) {
  if (!confirmation) return null;

  return (
    <div className="feedback-confirm-backdrop" role="presentation">
      <section
        className="feedback-confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-confirm-title"
      >
        <h2 id="feedback-confirm-title">{confirmation.title}</h2>
        <p>{confirmation.message}</p>

        <div className="feedback-confirm-actions">
          <Button
            variant="secondary"
            onClick={() => onResolve(false)}
          >
            {confirmation.cancelText}
          </Button>

          <Button
            variant={confirmation.tone === "danger" ? "danger" : "primary"}
            onClick={() => onResolve(true)}
          >
            {confirmation.confirmText}
          </Button>
        </div>
      </section>
    </div>
  );
}

export default FeedbackConfirmDialog;
