import { getTodayDate } from "./dateUtils";

export function hasUnsavedTodayDraft() {
  try {
    const savedDraft = localStorage.getItem(
      `expense_tracker_draft_${getTodayDate()}`
    );
    const parsedDraft = JSON.parse(savedDraft || "[]");
    return Array.isArray(parsedDraft) && parsedDraft.length > 0;
  } catch {
    return false;
  }
}
