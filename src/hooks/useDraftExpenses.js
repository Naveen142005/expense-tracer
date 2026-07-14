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

    return parsedDraft.map((item) => ({
      ...item,
      status: "draft",
      isDraft: true,
    }));
  } catch (error) {
    console.error("Failed to read draft from localStorage:", error);
    return [];
  }
}

export function useDraftExpenses(date) {
  const [draftItems, setDraftItems] = useState(() => getInitialDraft(date));

  useEffect(() => {
    if (draftItems.length === 0) {
      localStorage.removeItem(getStorageKey(date));
      return;
    }

    localStorage.setItem(getStorageKey(date), JSON.stringify(draftItems));
  }, [date, draftItems]);

  function addDraftItem(item) {
    setDraftItems((prev) => [
      ...prev,
      {
        ...item,
        status: "draft",
        isDraft: true,
        draftAddedAt: item.draftAddedAt || Date.now(),
      },
    ]);
  }

  function updateDraftItem(itemId, changes) {
    setDraftItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              ...changes,
              status: "draft",
              isDraft: true,
              draftUpdatedAt: Date.now(),
            }
          : item
      )
    );
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
    updateDraftItem,
    deleteDraftItem,
    clearDraftItems,
  };
}
