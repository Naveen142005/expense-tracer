# Daily Expense Email Reminder Setup

The Vercel cron runs once per day at 16:30 UTC, which is 10:00 PM in
Asia/Kolkata. Vercel Hobby may invoke a daily cron at any point within the
scheduled hour.

## 1. Create a Firebase service account

1. Open Firebase Console.
2. Select `expense-tracker-b652e`.
3. Open Project settings > Service accounts.
4. Select Generate new private key.
5. Keep the downloaded JSON private. Do not commit it.

## 2. Create a Resend API key

1. Open Resend > API Keys.
2. Create a key with sending access.
3. Keep the key private.

The default sender is `onboarding@resend.dev`. Resend normally restricts this
sender to the email address associated with your Resend account. Verify your
own domain in Resend before sending reminders to other addresses.

## 3. Add Vercel environment variables

Open Vercel > Project > Settings > Environment Variables and add these values
for Production:

- `CRON_SECRET`: a random secret containing at least 16 characters
- `FIREBASE_PROJECT_ID`: `project_id` from the service-account JSON
- `FIREBASE_CLIENT_EMAIL`: `client_email` from the service-account JSON
- `FIREBASE_PRIVATE_KEY`: `private_key` from the service-account JSON
- `RESEND_API_KEY`: the Resend API key
- `REMINDER_USER_EMAIL`: the Firebase login email whose expenses are checked
- `REMINDER_TO_EMAIL`: optional reminder recipient; defaults to the login email
- `REMINDER_FROM_EMAIL`: optional; use a verified sender when you have one

Paste `FIREBASE_PRIVATE_KEY` as the complete value, including its BEGIN and END
lines. Never prefix these server secrets with `VITE_`.

## 4. Install and deploy

Run:

```bash
npm install
npm run build
git add .
git commit -m "add daily expense email reminder"
git push
```

After Vercel finishes deploying, open Project > Settings > Cron Jobs and verify
that `/api/daily-expense-reminder` is listed.

## 5. Test manually

Run the following command, replacing the domain and secret:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://YOUR_DOMAIN.vercel.app/api/daily-expense-reminder
```

Expected results:

- No expense today: `sent` is `true` and one email is delivered.
- Expense exists today: `sent` is `false` with `Expenses already submitted`.
- Already reminded today: `sent` is `false` with `Reminder already sent`.
