import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const TIME_ZONE = "Asia/Kolkata";
const REQUIRED_PERIODS = ["morning", "afternoon", "night"];

function formatPeriod(period) {
  return `${period.charAt(0).toUpperCase()}${period.slice(1)}`;
}

function getRequiredEnvironmentValue(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getAdminApp() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  return initializeApp({
    credential: cert({
      projectId: getRequiredEnvironmentValue("FIREBASE_PROJECT_ID"),
      clientEmail: getRequiredEnvironmentValue("FIREBASE_CLIENT_EMAIL"),
      privateKey: getRequiredEnvironmentValue("FIREBASE_PRIVATE_KEY").replace(
        /\\n/g,
        "\n"
      ),
    }),
  });
}

function getDateInTimeZone(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function isAuthorized(request) {
  const secret = process.env.CRON_SECRET;

  return Boolean(
    secret && request.headers.get("authorization") === `Bearer ${secret}`
  );
}

async function sendReminderEmail({ email, name, date, missingPeriods }) {
  const apiKey = getRequiredEnvironmentValue("RESEND_API_KEY");
  const from =
    process.env.REMINDER_FROM_EMAIL?.trim() ||
    "Naveen's Tracker <onboarding@resend.dev>";
  const displayName = name?.trim() || "there";
  const missingPeriodText = missingPeriods.map(formatPeriod).join(", ");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Expense reminder: some periods are missing",
      text: `Hi ${displayName}, expense entries are still missing for ${missingPeriodText} on ${date}. Open Naveen's Tracker and add the missing entries.`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#172033">
          <h2 style="margin:0 0 12px">Daily expense reminder</h2>
          <p>Hi ${displayName},</p>
          <p>Expense entries are still missing for <strong>${missingPeriodText}</strong> on <strong>${date}</strong>.</p>
          <p>Open Naveen's Tracker and add the missing entries.</p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Resend request failed (${response.status}): ${details}`);
  }

  return response.json();
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const app = getAdminApp();
    const auth = getAuth(app);
    const db = getFirestore(app);
    const userEmail = getRequiredEnvironmentValue("REMINDER_USER_EMAIL").toLowerCase();
    const user = await auth.getUserByEmail(userEmail);
    const recipientEmail =
      process.env.REMINDER_TO_EMAIL?.trim().toLowerCase() || user.email;

    if (!recipientEmail) {
      throw new Error("The configured Firebase user does not have an email.");
    }

    const date = getDateInTimeZone();
    const userRef = db.doc(`users/${user.uid}`);
    const expensesQuery = userRef.collection("expenses").where("date", "==", date);
    const reminderRef = userRef.collection("emailReminders").doc(date);
    const expensesSnapshot = await expensesQuery.get();
    const submittedPeriods = new Set(
      expensesSnapshot.docs
        .map((expenseDoc) => String(expenseDoc.data()?.period || "").toLowerCase())
        .filter(Boolean)
    );
    const missingPeriods = REQUIRED_PERIODS.filter(
      (period) => !submittedPeriods.has(period)
    );

    if (missingPeriods.length === 0) {
      return Response.json({
        success: true,
        sent: false,
        reason: "All required periods submitted",
        date,
      });
    }

    const claim = await db.runTransaction(async (transaction) => {
      const reminderSnapshot = await transaction.get(reminderRef);
      const reminderStatus = reminderSnapshot.data()?.status;

      if (reminderStatus === "sent" || reminderStatus === "processing") {
        return { claimed: false, reason: "Reminder already sent or processing" };
      }

      transaction.set(
        reminderRef,
        {
          date,
          status: "processing",
          missingPeriods,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return { claimed: true, reason: "" };
    });

    if (!claim.claimed) {
      return Response.json({
        success: true,
        sent: false,
        reason: claim.reason,
        date,
      });
    }

    let emailResult;

    try {
      emailResult = await sendReminderEmail({
        email: recipientEmail,
        name: user.displayName,
        date,
        missingPeriods,
      });

      await reminderRef.set(
        {
          date,
          status: "sent",
          missingPeriods,
          emailId: emailResult.id || "",
          sentAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } catch (emailError) {
      await reminderRef.set(
        {
          date,
          status: "failed",
          error: emailError instanceof Error ? emailError.message : "Email failed",
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      throw emailError;
    }

    return Response.json({ success: true, sent: true, date });
  } catch (error) {
    console.error("Daily expense reminder failed", error);

    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown reminder error",
      },
      { status: 500 }
    );
  }
}
