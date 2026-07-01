# AI Expense Query Engine Setup

This version uses a safer architecture than a normal chatbot.

## Flow

React chatbot widget -> `/api/chat` -> Expense Query Engine -> Firestore exact calculation -> optional Groq Llama advice.

Exact finance answers are calculated by backend code. Groq/Llama is used only for advice wording, not for deciding totals.

## What this version improves

- Renders AI replies with `react-markdown`, so bold labels, headings, and bullet lists show cleanly in the chatbot UI.
- Uses consistent formatted answers for exact questions.
- Shows AI advice only when the user asks for advice, suggestions, analysis, or summary insight.
- Fixes `previous month` / `last month` date handling so it does not reuse the old `today` context.
- Prevents unrelated questions such as coding/general questions.
- Separates Current Balance from Total Spend.
- Understands date ranges like `June 20 to June 30`, `For June 2026`, `today`, `till today`, `this month`, and `all time`.
- Avoids treating date phrases as item names.
- Separates metrics from filters:
  - `using GPay` = payment filter
  - `GPay spend` = requested metric, not a filter
- Calculates total spend, Cash spend, GPay spend, counts, top items, highest date, most used period, recent expenses, averages, and comparisons using JavaScript.
- Handles follow-up questions using context:
  - `How much did I spend on idly?`
  - `how many times?`
  - `which dates?`
  - `cash or gpay?`
- Asks clarification instead of guessing when the question is unclear.

## Required environment variables

Frontend Firebase variables:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=expense-tracker-b652e.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=expense-tracker-b652e
VITE_FIREBASE_STORAGE_BUCKET=expense-tracker-b652e.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...
```

Server-side Firebase Admin variables:

```env
FIREBASE_PROJECT_ID=expense-tracker-b652e
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Groq variables:

```env
LLAMA_API_KEY=your_groq_api_key
LLAMA_BASE_URL=https://api.groq.com/openai/v1
LLAMA_MODEL=llama-3.1-8b-instant
```

Do not prefix `LLAMA_API_KEY`, `FIREBASE_CLIENT_EMAIL`, or `FIREBASE_PRIVATE_KEY` with `VITE_`.

## Install dependencies

This version adds `react-markdown` for better chatbot formatting. After replacing files, run:

```bash
npm install
```

## Local testing

If Vercel sensitive variables pull as empty values, fill `.env.local` manually. Do not run `vercel env pull` after manual editing because it can overwrite your local secret values.

```bash
vercel dev
```

If Git Bash does not load `.env.local` properly, run:

```bash
set -a && source .env.local && set +a && vercel dev
```

## Good test questions

```txt
How much did I spend from June 20 to June 30?
```

```txt
For June 2026, tell me my total spend, cash spend, GPay spend, top 5 items, highest spending date, most used period, and one suggestion to reduce spending.
```

```txt
How much did I spend on idly?
```

Then ask:

```txt
how many times?
which dates?
cash or gpay?
```

Irrelevant questions should be blocked:

```txt
write C code for sum of 2 numbers
```

Expected reply:

```txt
I can only help with your expense tracker, spending, balance, reports, and saving advice.
```
