function ToastViewport({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-viewport" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`app-toast app-toast--${toast.type}`}
          role={toast.type === "error" ? "alert" : "status"}
        >
          <span className="app-toast__indicator" aria-hidden="true" />

          <div className="app-toast__content">
            <strong>{toast.title}</strong>
            {toast.message && <p>{toast.message}</p>}
          </div>

          {toast.actionLabel && typeof toast.onAction === "function" && (
            <button
              type="button"
              className="app-toast__action"
              onClick={() => {
                toast.onAction();
                onDismiss(toast.id);
              }}
            >
              {toast.actionLabel}
            </button>
          )}

          <button
            type="button"
            className="app-toast__close"
            onClick={() => onDismiss(toast.id)}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export default ToastViewport;
