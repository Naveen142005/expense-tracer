export async function callLlamaForAdvice({ question, calculatedSummary }) {
  const apiKey = process.env.LLAMA_API_KEY;
  const model = process.env.LLAMA_MODEL;
  if (!apiKey || !model) return null;

  const baseUrl = (process.env.LLAMA_BASE_URL || "https://api.groq.com/openai/v1").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.15,
      max_tokens: 300,
      messages: [
        {
          role: "system",
          content:
            "You are an expense adviser inside a personal expense tracker. Use only backend-calculated data. Never invent or recalculate values. Do not answer unrelated questions. Give short, practical advice in simple English. Use Indian Rupees only when the value is already provided. Use clean Markdown with short headings and bullets. No tables.",
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              question,
              calculatedSummary,
              instruction:
                "Give one concise spending insight and 2 practical saving suggestions. Do not change any number. Keep it short. Use Markdown bullets.",
            },
            null,
            2
          ),
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Llama API failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content?.trim() || null;
}

function parseJsonContent(content = "") {
  const clean = String(content)
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  if (!clean) return null;
  return JSON.parse(clean);
}

export async function callLlamaForQueryPlan({
  question,
  today,
  knownItemNames = [],
  context = {},
  history = [],
}) {
  const apiKey = process.env.LLAMA_API_KEY;
  const model = process.env.LLAMA_MODEL;
  if (!apiKey || !model) return null;

  const baseUrl = (process.env.LLAMA_BASE_URL || "https://api.groq.com/openai/v1").replace(/\/$/, "");
  const requestBody = {
    model,
    temperature: 0,
    max_tokens: 1400,
    response_format: { type: "json_object" },
    messages: [
        {
          role: "system",
          content: [
            "You are the query planner for a personal expense tracker.",
            "You never calculate financial values and never invent records.",
            "Convert any question answerable from expense or balance data into strict JSON.",
            "Expense fields: date, period(morning/afternoon/evening/night/other), type(food/snacks/bus/custom), item name or bus description, price, paymentType(cash/gpay).",
            "Balance fields: date, action(add/reduce), balanceType(cash/gpay), amount, reason, oldBalance, newBalance.",
            "Supported operation kinds: aggregate, list, rank, compare, trend, unique, balance-current, balance-history, balance-at-date, advice.",
            "Supported metrics: amount, count, average, min, max, unique-count.",
            "Supported groupBy values: none, item, date, day-of-week, week, month, period, type, payment.",
            "Use metric=count for frequency/how often/how many times and metric=amount for money/spending.",
            "Use rank direction=asc for lowest/least/cheapest and desc for highest/top/most expensive.",
            "For multi-part questions return multiple operations in the required order.",
            "dateText must contain only the user's date phrase, such as today, last 7 days, June 2026, 20 June to 30 June, or all time. Use null when no date was stated.",
            "Never insert today, the current date, or any other date unless the user explicitly wrote that date or date phrase.",
            "defaultRange must be all-time for item lifetime totals, rankings without a date, comparisons without a date, and recent/latest records. Otherwise use current-month.",
            "Filters may contain multiple items, types, payments and periods, but include only values explicitly written by the user. Never infer Food from an item name and never fill filters with every possible option.",
            "Comparison targets must be objects with dimension(item/type/payment/period/date/month/day-of-week) and value.",
            "If the request is about expense data but essential information is ambiguous, use domain=clarify and provide clarification.",
            "If unrelated to the expense tracker, use domain=out-of-domain.",
            "For trend operations, groupBy may be item/type/period/payment for trend ranking and interval must be date/week/month.",
            "Example: 'Compare idly vs egg' has dateText=null, defaultRange=all-time, only the two item filters/targets, and one compare operation with metric=amount.",
            "Return exactly this JSON shape: {domain, dateText, defaultRange, useContext, filters:{items,types,payments,periods,minPrice,maxPrice}, operations:[{kind,metric,groupBy,interval,direction,limit,targets}], wantsAdvice, clarification, confidence}.",
          ].join(" "),
        },
        {
          role: "user",
          content: JSON.stringify({
            today,
            question,
            knownItemNames: knownItemNames.slice(0, 500),
            previousContext: context,
            recentConversation: history.slice(-6),
          }),
        },
    ],
  };
  const request = (body) => fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  let response = await request(requestBody);
  if (response.status === 400) {
    // Some compatible providers/models do not expose JSON mode. The prompt
    // still requires JSON, so retry once without response_format.
    const compatibleBody = { ...requestBody };
    delete compatibleBody.response_format;
    response = await request(compatibleBody);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Llama query planner failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return parseJsonContent(data?.choices?.[0]?.message?.content || "");
}
