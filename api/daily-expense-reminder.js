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
      subject: "Action required: expense entries are incomplete",
      text: `Hi ${displayName}, expense entries are still missing for ${missingPeriodText} on ${date}. Open Naveen's Tracker: https://expense-tracer-seven.vercel.app/`,
      html: `
    <div style="margin:0;padding:32px 16px;background:#f4f7fb;font-family:Arial,sans-serif;color:#172033;">
      <table role="presentation" style="width:100%;max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #dfe5ee;border-radius:10px;border-collapse:separate;">
        <tr>
          <td style="padding:28px 32px 20px;background:#172033;border-radius:10px 10px 0 0;">
            <p style="margin:0 0 6px;color:#8db7ff;font-size:12px;font-weight:700;text-transform:uppercase;">
              Naveen's Tracker
            </p>
            <h1 style="margin:0;color:#ffffff;font-size:22px;">
              Daily expense reminder
            </h1>
          </td>
        </tr>

        <tr>
          <td style="padding:28px 32px;">
            <p style="margin:0 0 16px;font-size:16px;">
              Hi ${displayName},
            </p>

            <p style="margin:0 0 18px;color:#526078;font-size:15px;line-height:1.7;">
              Your expense entries for the following periods are still missing:
            </p>

            <div style="margin:0 0 22px;padding:14px 16px;background:#eef5ff;border-left:4px solid #2563eb;border-radius:6px;">
              <strong style="color:#174ea6;">${missingPeriodText}</strong>
              <span style="display:block;margin-top:5px;color:#64748b;font-size:13px;">
                Date: ${date}
              </span>
            </div>

            <a
              href="https://expense-tracer-seven.vercel.app/"
              target="_blank"
              style="display:inline-block;padding:12px 20px;background:#2563eb;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;border-radius:6px;"
            >
              Open Expense Tracker
            </a>
          </td>
        </tr>

        <tr>
          <td style="padding:18px 32px;border-top:1px solid #e5eaf1;color:#7a8699;font-size:12px;line-height:1.5;">
            This is an automatic reminder from Naveen's Tracker.
          </td>
        </tr>
      </table>
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
