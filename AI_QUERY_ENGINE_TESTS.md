# AI Expense Query Engine Test Matrix

Use these tests after running `set -a && source .env.local && set +a && vercel dev`.

## Exact spend
- how much today?
- how much did I spend today, split by cash and gpay?
- how much did I spend from June 20 to June 30?
- how much did I spend on 23rd June?
- previous month?
- how much spend on previous month?
- how much did I spend this month?

## Item list and item totals
- what are item I spent on today?
- what did I spend today?
- what items did I buy today?
- how much did I spend on idly?
- how many times did I buy idly?
- which dates did I buy idly?
- cash or gpay?  (ask this after an item question)

## Lifetime/ranking
- which item did I spend the most on?
- which item did I spend the most on my life time?
- top 5 items in June 2026
- which date had highest spending this month?
- which period has the highest spending?

## Complex summary
- For June 2026, tell me my total spend, cash spend, GPay spend, top 5 items, highest spending date, most used period, and one suggestion to reduce spending.
- Compare food and bus spending this month.
- Compare idly vs egg.
- Cash spend and GPay spend for June 2026.

## Clarification / blocked
- how much did I spend there?
- compare both
- write C code for sum of 2 numbers
- tell me weather today

Expected behavior:
- Exact numbers are calculated by backend code.
- Markdown appears formatted in the chatbot UI.
- Unrelated questions are blocked.
- Unclear questions ask clarification.
- New date phrases override old chat context.
- Lifetime/ranking questions use all-time data when no date is specified.
