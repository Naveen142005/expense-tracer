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
  "Idly",
  "Dosa",
  "Poori",
  "Porota",
  "Sapati",
  "Egg",
  "Chicken rice",
  "Egg rice",
  "Chicken briyani",
  "Mini-tiffin",
];

export const SNACK_SUGGESTIONS = ["Biscuit", "Chips"];

export const DEFAULT_EXPENSE_ITEM = {
  period: "Morning",
  type: "Food",
  name: "",
  description: "",
  price: "",
  paymentType: "Cash",
};

export const BALANCE_ACTIONS = {
  ADD: "Add",
  REDUCE: "Reduce",
  EXPENSE_CASH_DEDUCTION: "Expense_cash_deduction",
};