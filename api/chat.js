import { getAdminAuth } from "./_expenseAi/firebaseAdmin.js";
import { buildExpenseSummary, buildBalanceHistorySummary } from "./_expenseAi/calculator.js";
import { getDomainDecision, genericReply, outOfDomainReply } from "./_expenseAi/domainGuard.js";
import { callLlamaForAdvice, callLlamaForQueryPlan } from "./_expenseAi/llamaClient.js";
import { buildClarification, buildNextContext, buildQueryPlan, needsClarification } from "./_expenseAi/queryPlanner.js";
import { fetchAllExpenseItemNames, fetchBalanceHistory, fetchCurrentBalance, fetchExpenses } from "./_expenseAi/repositories.js";
import { buildBalanceHistoryReply, buildBalanceReply, buildDeterministicReply, compactSummaryForLlama } from "./_expenseAi/responseBuilder.js";
import { getKolkataTodayParts } from "./_expenseAi/utils.js";
import { buildNextSemanticContext, normalizeSemanticPlan } from "./_expenseAi/semanticPlanner.js";
import { executeSemanticPlan, semanticResultForAdvice } from "./_expenseAi/semanticQueryEngine.js";
import { buildSemanticReply } from "./_expenseAi/semanticResponseBuilder.js";

function sendCorsHeaders(req, res) {
  const allowedOrigin = process.env.CLIENT_URL || req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function getAuthToken(req) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || "";
}

function parseBody(req) {
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  return req.body || {};
}

function contextFromBody(body) {
  return body.context && typeof body.context === "object" ? body.context : {};
}

export default async function handler(req, res) {
  sendCorsHeaders(req, res);

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = parseBody(req);
    const message = String(body.message || "").trim().slice(0, 2000);
    if (!message) return res.status(400).json({ error: "Message is required." });

    const token = getAuthToken(req);
    if (!token) return res.status(401).json({ error: "Login token is missing." });

    const context = contextFromBody(body);
    const domain = getDomainDecision(message, context);

    if (!domain.allowed) {
      return res.status(200).json({
        reply: outOfDomainReply(),
        summary: { intent: "out-of-domain", reason: domain.reason },
        context: { ...context, lastIntent: "out-of-domain" },
        usedFallback: false,
      });
    }

    if (domain.kind === "generic") {
      return res.status(200).json({
        reply: genericReply(message),
        summary: { intent: "generic" },
        context: { ...context, lastIntent: "generic" },
        usedFallback: false,
      });
    }

    const decodedToken = await getAdminAuth().verifyIdToken(token);
    const uid = decodedToken.uid;

    const history = Array.isArray(body.history)
      ? body.history.slice(-6).map((entry) => ({
          role: entry?.role === "ai" ? "assistant" : "user",
          text: String(entry?.text || "").slice(0, 1000),
        }))
      : [];

    let semanticPlannerFailed = false;
    let knownItemNames = [];
    try {
      knownItemNames = await fetchAllExpenseItemNames(uid);
      const rawSemanticPlan = await callLlamaForQueryPlan({
        question: message,
        today: getKolkataTodayParts().dateString,
        knownItemNames,
        context,
        history,
      });

      if (rawSemanticPlan) {
        const semanticPlan = normalizeSemanticPlan(rawSemanticPlan, {
          question: message,
          knownItemNames,
          context,
        });

        if (semanticPlan.domain === "out-of-domain") {
          return res.status(200).json({
            reply: outOfDomainReply(),
            summary: { intent: "out-of-domain", engine: semanticPlan.engine },
            context: { ...context, lastIntent: "out-of-domain" },
            usedFallback: false,
          });
        }

        if (semanticPlan.domain === "clarify" || semanticPlan.clarification) {
          return res.status(200).json({
            reply: semanticPlan.clarification || "Please clarify what expense or balance information you want me to analyse.",
            summary: { intent: "clarification-needed", engine: semanticPlan.engine, confidence: semanticPlan.confidence },
            context,
            usedFallback: false,
          });
        }

        const needsExpenses = semanticPlan.operations.some((operation) => !operation.kind.startsWith("balance-") && operation.kind !== "advice")
          || semanticPlan.wantsAdvice;
        const needsBalance = semanticPlan.operations.some((operation) => operation.kind.startsWith("balance-"));
        const needsBalanceHistory = semanticPlan.operations.some((operation) => ["balance-history", "balance-at-date"].includes(operation.kind));

        const [expenses, balanceHistory, currentBalance] = await Promise.all([
          needsExpenses ? fetchExpenses(uid, semanticPlan.dateRange) : Promise.resolve([]),
          needsBalanceHistory ? fetchBalanceHistory(uid) : Promise.resolve([]),
          needsBalance ? fetchCurrentBalance(uid) : Promise.resolve(null),
        ]);

        const semanticResult = executeSemanticPlan({
          expenses,
          balanceHistory,
          currentBalance,
          plan: semanticPlan,
        });
        let reply = buildSemanticReply(semanticResult, semanticPlan);
        let usedFallback = false;

        if (semanticPlan.wantsAdvice && semanticResult.baseStats.count > 0) {
          try {
            const aiAdvice = await callLlamaForAdvice({
              question: message,
              calculatedSummary: semanticResultForAdvice(semanticResult),
            });
            if (aiAdvice) reply = `${reply}\n\n### AI advice\n${aiAdvice}`;
          } catch (error) {
            usedFallback = true;
            console.error("Llama advice failed:", error);
          }
        }

        return res.status(200).json({
          reply,
          summary: semanticResult,
          plan: semanticPlan,
          context: buildNextSemanticContext(semanticPlan, semanticResult),
          usedFallback,
        });
      }
      semanticPlannerFailed = true;
    } catch (error) {
      semanticPlannerFailed = true;
      console.error("Semantic query planner failed; using deterministic fallback:", error);
    }

    if (domain.kind === "candidate") {
      return res.status(200).json({
        reply: "I couldn't confidently connect that question to your expense or balance data. Please mention the item, date, amount, payment method, period, type, balance, or comparison you want to analyse.",
        summary: { intent: "clarification-needed", reason: "semantic-planner-unavailable" },
        context,
        usedFallback: true,
      });
    }

    // Safe fallback when the semantic model is unavailable.
    const plan = buildQueryPlan(message, context, knownItemNames);

    if (plan.intent === "current-balance") {
      const balance = await fetchCurrentBalance(uid);
      return res.status(200).json({
        reply: buildBalanceReply(balance),
        summary: { intent: plan.intent, balance },
        context: buildNextContext(plan, null),
        usedFallback: semanticPlannerFailed,
      });
    }

    if (["balance-history", "balance-added", "balance-reduced"].includes(plan.intent)) {
      const history = await fetchBalanceHistory(uid);
      const balanceSummary = buildBalanceHistorySummary(history, plan);
      return res.status(200).json({
        reply: buildBalanceHistoryReply(balanceSummary, plan.intent),
        summary: { intent: plan.intent, ...balanceSummary },
        context: buildNextContext(plan, null),
        usedFallback: semanticPlannerFailed,
      });
    }

    const clarification = needsClarification(plan, context);

    if (clarification.needed) {
      return res.status(200).json({
        reply: buildClarification(plan, clarification.reason),
        summary: { intent: "clarification-needed", reason: clarification.reason, confidence: plan.confidence },
        context: { ...context, pendingClarification: clarification.reason },
        usedFallback: semanticPlannerFailed,
      });
    }

    const expenses = await fetchExpenses(uid, plan.dateRange);
    const summary = buildExpenseSummary(expenses, plan);
    let reply = buildDeterministicReply(summary, plan);
    let usedFallback = semanticPlannerFailed;

    // Exact numbers always come from code. Groq is used only to improve advice wording.
    if (plan.intent === "advice" && summary.count > 0) {
      try {
        const aiAdvice = await callLlamaForAdvice({
          question: message,
          calculatedSummary: compactSummaryForLlama(summary),
        });
        if (aiAdvice) reply = `${reply}\n\n### AI advice\n${aiAdvice}`;
      } catch (error) {
        usedFallback = true;
        console.error("Llama advice failed:", error);
      }
    }

    return res.status(200).json({
      reply,
      summary,
      plan: {
        intent: plan.intent,
        metrics: [...plan.metrics],
        dateRange: plan.dateRange,
        filters: plan.filters,
        focusItem: plan.focusItem,
        compareTargets: plan.compareTargets,
        confidence: plan.confidence,
      },
      context: buildNextContext(plan, summary),
      usedFallback,
    });
  } catch (error) {
    console.error("AI chat API error:", error);
    return res.status(500).json({
      error: "AI chat failed. Please check the server configuration and try again.",
    });
  }
}
