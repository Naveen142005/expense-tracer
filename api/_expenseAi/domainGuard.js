import { normalizeMessage } from "./utils.js";

const GENERIC_CHAT_PATTERNS = [
  /^(hi|hello|hey|hai|hii|hey there)$/,
  /^(thanks|thank you|thank u|ty|tnx|thanks bro|thank you bro|thanks da|thank you da)$/,
  /^(ok|okay|kk|fine|done|got it|cool|super|nice)$/,
  /^(bye|goodbye|see you|see ya)$/,
  /^(who are you|what are you)$/,
  /^(what can you do|help|help me|how can you help)$/,
];

const EXPENSE_KEYWORDS = [
  "expense",
  "expenses",
  "spend",
  "spent",
  "spending",
  "balance",
  "wallet",
  "cash",
  "gpay",
  "google pay",
  "upi",
  "payment",
  "paid",
  "purchase",
  "purchased",
  "buy",
  "bought",
  "costly",
  "expensive",
  "cheap",
  "cheapest",
  "frequent",
  "frequently",
  "trend",
  "increase",
  "decrease",
  "price",
  "amount",
  "total",
  "item",
  "items",
  "food",
  "snack",
  "snacks",
  "bus",
  "travel",
  "period",
  "morning",
  "afternoon",
  "evening",
  "night",
  "report",
  "summary",
  "saving",
  "save",
  "budget",
  "reduce",
  "highest",
  "lowest",
  "top",
  "average",
  "count",
  "times",
  "lifetime",
  "life time",
  "overall",
  "previous",
  "last",
  "today",
  "yesterday",
  "month",
  "week",
  "year",
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

const BLOCKED_TOPIC_PATTERNS = [
  /\b(write|generate|create|give|show)\s+(?:me\s+)?(?:a\s+)?(?:c|c\+\+|java|python|javascript|html|css|react|sql)\s+(?:code|program|function|script)\b/,
  /\b(code|program|algorithm|leetcode|compiler|debug|syntax|array|string|loop|function|class|variable)\b/,
  /\b(weather|news|movie|song|lyrics|politics|medical|doctor|medicine|legal|court|stock|crypto|sports|recipe|essay|story|poem|joke)\b/,
];

export function getDomainDecision(message, context = {}) {
  const text = normalizeMessage(message);
  if (!String(message || "").trim()) return { allowed: false, reason: "empty" };
  if (!text) return { allowed: true, kind: "candidate" };

  if (GENERIC_CHAT_PATTERNS.some((pattern) => pattern.test(text))) {
    return { allowed: true, kind: "generic" };
  }

  const hasExpenseKeyword = EXPENSE_KEYWORDS.some((keyword) => text.includes(keyword));
  const hasStrongExpenseKeyword = /\b(expense|expenses|spend|spent|spending|balance|wallet|cash|gpay|upi|payment|paid|price|amount|item|items|purchase|purchased|budget)\b/.test(text);
  const isFollowUp = /^(how much|how many|how many times|count|times|which dates|cash or gpay|what about that|what about it|what about this|and that|there|that one|this one|same|again)$/i.test(text);

  if (isFollowUp && (context.focusItem || context.lastIntent || context.filters || context.dateRange)) {
    return { allowed: true, kind: "expense" };
  }

  if (BLOCKED_TOPIC_PATTERNS.some((pattern) => pattern.test(text)) && !hasStrongExpenseKeyword) {
    return { allowed: false, reason: "out-of-domain" };
  }

  if (hasExpenseKeyword) return { allowed: true, kind: "expense" };

  // Let the semantic planner classify natural expense wording and follow-ups
  // that are not covered by the fast keyword guard.
  return { allowed: true, kind: "candidate" };
}

export function outOfDomainReply() {
  return "I can only help with your expense tracker, spending, balance, reports, and saving advice. Try asking: “How much did I spend this month?” or “What is my current balance?”";
}

export function genericReply(message = "") {
  const text = normalizeMessage(message);

  if (/^(thanks|thank you|thank u|ty|tnx)/.test(text)) {
    return "You're welcome! Ask me anytime about your expenses, balance, reports, or saving advice.";
  }

  if (/^(ok|okay|kk|fine|done|got it|cool|super|nice)$/.test(text)) {
    return "Okay. I’m here whenever you want to check your expenses.";
  }

  if (/^(bye|goodbye|see you|see ya)$/.test(text)) {
    return "Bye! Keep tracking your expenses consistently.";
  }

  if (/^(who are you|what are you)$/.test(text)) {
    return "I’m your AI Expense Adviser. I can help with spending totals, current balance, date-wise reports, item analysis, Cash/GPay split, and saving advice.";
  }

  if (/^(what can you do|help|help me|how can you help)$/.test(text)) {
    return [
      "I can help with your expense tracker.",
      "",
      "Try asking:",
      "- How much did I spend today?",
      "- What is my current balance?",
      "- Which item did I spend the most on?",
      "- Show my Cash and GPay split for June 2026.",
      "- Give me saving advice based on my expenses.",
    ].join("\n");
  }

  return "Hi! I can help you check your expenses, current balance, date-wise spending, Cash/GPay split, top items, reports, and saving advice.";
}
