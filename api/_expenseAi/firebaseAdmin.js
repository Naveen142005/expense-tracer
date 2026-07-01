import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} environment variable is missing.`);
  return value;
}

export function ensureAdminApp() {
  if (getApps().length) return;

  initializeApp({
    credential: cert({
      projectId: getRequiredEnv("FIREBASE_PROJECT_ID"),
      clientEmail: getRequiredEnv("FIREBASE_CLIENT_EMAIL"),
      privateKey: getRequiredEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
    }),
  });
}

export function getAdminDb() {
  ensureAdminApp();
  return getFirestore();
}

export function getAdminAuth() {
  ensureAdminApp();
  return getAuth();
}
