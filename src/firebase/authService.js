import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  getAdditionalUserInfo,
  GoogleAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  reload,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateEmail,
  updatePassword,
  updateProfile,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "./firebaseConfig";

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export function observeAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function registerUser({ name, email, password }) {
  const normalizedEmail = email.trim().toLowerCase();
  const credential = await createUserWithEmailAndPassword(
    auth,
    normalizedEmail,
    password
  );

  await updateProfile(credential.user, {
    displayName: name.trim(),
  });

  await setDoc(
    doc(db, "users", credential.user.uid),
    {
      name: name.trim(),
      email: normalizedEmail,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return credential.user;
}

export function loginUser({ email, password }) {
  return signInWithEmailAndPassword(
    auth,
    email.trim().toLowerCase(),
    password
  );
}

export async function loginWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  const isNewUser = getAdditionalUserInfo(result)?.isNewUser;
  const profile = {
    name: result.user.displayName || "",
    email: result.user.email || "",
    photoURL: result.user.photoURL || "",
    updatedAt: serverTimestamp(),
  };

  if (isNewUser) {
    profile.createdAt = serverTimestamp();
  }

  await setDoc(doc(db, "users", result.user.uid), profile, { merge: true });

  return result.user;
}

export function logoutUser() {
  return signOut(auth);
}

export function resetUserPassword(email) {
  return sendPasswordResetEmail(auth, email.trim().toLowerCase());
}

export async function updateUserDisplayName(name) {
  if (!auth.currentUser) throw new Error("You must be logged in.");
  await updateProfile(auth.currentUser, { displayName: name.trim() });
  await reload(auth.currentUser);
  return auth.currentUser;
}

async function reauthenticatePasswordUser(currentPassword) {
  const user = auth.currentUser;
  if (!user?.email) throw new Error("Your account email is unavailable.");
  if (!currentPassword) throw new Error("Enter your current password.");

  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  return user;
}

export async function changeUserEmail({ email, currentPassword }) {
  const user = await reauthenticatePasswordUser(currentPassword);
  const normalizedEmail = email.trim().toLowerCase();
  await updateEmail(user, normalizedEmail);
  await setDoc(
    doc(db, "users", user.uid),
    { email: normalizedEmail, updatedAt: serverTimestamp() },
    { merge: true }
  );
  await reload(user);
  return user;
}

export async function changeUserPassword({ currentPassword, newPassword }) {
  const user = await reauthenticatePasswordUser(currentPassword);
  await updatePassword(user, newPassword);
  await reload(user);
}

export function getAuthErrorMessage(error) {
  const messages = {
    "auth/email-already-in-use": "An account already exists with this email.",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/account-exists-with-different-credential":
      "This email already uses another sign-in method. Log in with that method first.",
    "auth/missing-password": "Enter your password.",
    "auth/popup-blocked": "The Google sign-in popup was blocked by your browser.",
    "auth/popup-closed-by-user": "Google sign-in was cancelled.",
    "auth/too-many-requests": "Too many attempts. Please try again later.",
    "auth/user-disabled": "This account has been disabled.",
    "auth/weak-password": "Use a stronger password with at least 6 characters.",
    "auth/requires-recent-login":
      "For security, sign in again before changing this information.",
    "auth/wrong-password": "Your current password is incorrect.",
  };

  return messages[error?.code] || "Something went wrong. Please try again.";
}
