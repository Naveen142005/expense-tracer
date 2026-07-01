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
