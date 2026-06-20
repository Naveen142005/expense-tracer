export const PERIODS = [
  { label: "Morning", value: "morning" },
  { label: "Afternoon", value: "afternoon" },
  { label: "Evening", value: "evening" },
  { label: "Night", value: "night" },
  { label: "Other", value: "other" },
];

export const EXPENSE_TYPES = [
  { label: "Food", value: "food" },
  { label: "Snacks", value: "snacks" },
  { label: "Bus", value: "bus" },
  { label: "Custom", value: "custom" },
];

export const PAYMENT_TYPES = [
  { label: "Cash", value: "cash" },
  { label: "GPay", value: "gpay" },
];

export const FOOD_SUGGESTIONS = [
  "idly",
  "dosa",
  "poori",
  "porota",
  "sapati",
  "egg",
  "chicken rice",
  "egg rice",
  "chicken briyani",
  "mini-tiffin",
];

export const SNACK_SUGGESTIONS = ["biscuit", "poori"];

export const DEFAULT_EXPENSE_ITEM = {
  period: "morning",
  type: "food",
  name: "",
  description: "",
  price: "",
  paymentType: "cash",
};

export const BALANCE_ACTIONS = {
  ADD: "add",
  REDUCE: "reduce",
  EXPENSE_CASH_DEDUCTION: "expense_cash_deduction",
  EXPENSE_GPAY_DEDUCTION: "expense_gpay_deduction",
  EDIT_CASH_DEDUCTION: "edit_cash_deduction",
  EDIT_CASH_REFUND: "edit_cash_refund",
  EDIT_GPAY_DEDUCTION: "edit_gpay_deduction",
  EDIT_GPAY_REFUND: "edit_gpay_refund",
};

export const BALANCE_TYPES = [
  { label: "Cash Balance", value: "cash" },
  { label: "GPay Balance", value: "gpay" },
];
