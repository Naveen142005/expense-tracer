import { collection, doc } from "firebase/firestore";
import { auth, db } from "./firebaseConfig";

export function requireUserId() {
  const userId = auth.currentUser?.uid;

  if (!userId) {
    throw new Error("You must be logged in to access expense data.");
  }

  return userId;
}

export function getUserCollection(collectionName) {
  return collection(db, "users", requireUserId(), collectionName);
}

export function getUserDocument(collectionName, documentId) {
  return doc(db, "users", requireUserId(), collectionName, documentId);
}
