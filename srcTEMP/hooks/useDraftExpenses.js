import { useEffect, useState } from "react";

function getStorageKey(date) {
  return `expense_tracker_draft_${date}`;
}

function getInitialDraft(date) {
  try {
    const savedDraft = localStorage.getItem(getStorageKey(date));

    if (!savedDraft) {
      return [];
    }

    const parsedDraft = JSON.parse(savedDraft);

    if (!Array.isArray(parsedDraft)) {
      return [];
    }

    return parsedDraft;
  } catch (error) {
    console.error("Failed to read draft from localStorage:", error);
    return [];
  }
}

export function useDraftExpenses(date) {
  const [draftItems, setDraftItems] = useState(() => getInitialDraft(date));

  useEffect(() => {
    localStorage.setItem(getStorageKey(date), JSON.stringify(draftItems));
  }, [date, draftItems]);

  function addDraftItem(item) {
    setDraftItems((prev) => [...prev, item]);
  }

  function deleteDraftItem(itemId) {
    setDraftItems((prev) => prev.filter((item) => item.id !== itemId));
  }

  function clearDraftItems() {
    setDraftItems([]);
    localStorage.removeItem(getStorageKey(date));
  }

  return {
    draftItems,
    addDraftItem,
    deleteDraftItem,
    clearDraftItems,
  };
}