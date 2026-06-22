# Firestore deployment

Deploy the included rules and composite indexes before publishing the updated app:

```bash
firebase login
firebase use expense-tracker-b652e
firebase deploy --only firestore:rules,firestore:indexes
```

Wait until the Firebase console shows every index as `Enabled`, then deploy the web app.

The first optimized Reports load creates user-scoped `reportStats` and
`reportItemStats` data from the existing expense history. Later expense additions
and edits maintain those statistics automatically.
