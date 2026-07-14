/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import FeedbackConfirmDialog from "../components/common/FeedbackConfirmDialog";
import ToastViewport from "../components/common/ToastViewport";

const FeedbackContext = createContext(null);

const defaultDurations = {
  success: 4000,
  error: 5500,
  warning: 5500,
  info: 4000,
};

export function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmation, setConfirmation] = useState(null);
  const toastTimers = useRef(new Map());
  const confirmationResolver = useRef(null);

  const dismissToast = useCallback((toastId) => {
    const timer = toastTimers.current.get(toastId);

    if (timer) {
      clearTimeout(timer);
      toastTimers.current.delete(toastId);
    }

    setToasts((current) => current.filter((toast) => toast.id !== toastId));
  }, []);

  const notify = useCallback(
    ({
      type = "info",
      title,
      message = "",
      duration,
      actionLabel = "",
      onAction,
    }) => {
      const id = crypto.randomUUID();
      const toastDuration = duration ?? defaultDurations[type] ?? 4000;

      setToasts((current) => [
        ...current,
        {
          id,
          type,
          title: title || "Notification",
          message,
          actionLabel,
          onAction,
        },
      ]);

      const timer = setTimeout(() => dismissToast(id), toastDuration);
      toastTimers.current.set(id, timer);

      return id;
    },
    [dismissToast]
  );

  const confirmAction = useCallback((options) => {
    if (confirmationResolver.current) {
      confirmationResolver.current(false);
    }

    return new Promise((resolve) => {
      confirmationResolver.current = resolve;
      setConfirmation({
        title: options.title || "Confirm action",
        message: options.message || "Are you sure?",
        confirmText: options.confirmText || "Confirm",
        cancelText: options.cancelText || "Cancel",
        tone: options.tone || "default",
      });
    });
  }, []);

  const resolveConfirmation = useCallback((confirmed) => {
    confirmationResolver.current?.(confirmed);
    confirmationResolver.current = null;
    setConfirmation(null);
  }, []);

  useEffect(() => {
    const timers = toastTimers.current;

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
      confirmationResolver.current?.(false);
    };
  }, []);

  const value = useMemo(
    () => ({ notify, confirmAction }),
    [notify, confirmAction]
  );

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
      <FeedbackConfirmDialog
        confirmation={confirmation}
        onResolve={resolveConfirmation}
      />
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const context = useContext(FeedbackContext);

  if (!context) {
    throw new Error("useFeedback must be used inside FeedbackProvider.");
  }

  return context;
}
