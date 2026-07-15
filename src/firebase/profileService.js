import {
  deleteDoc,
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { auth, db } from "./firebaseConfig";

function requireUser() {
  const user = auth.currentUser;
  if (!user) throw new Error("You must be logged in to update your profile.");
  return user;
}

function normalizeUsername(value = "") {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

export function validateUsername(value) {
  const username = normalizeUsername(value);

  if (!username) return "Enter a username.";
  if (username.length < 3 || username.length > 24) {
    return "Username must contain 3 to 24 characters.";
  }
  if (!/^[a-z0-9._]+$/.test(username)) {
    return "Use only letters, numbers, dots, and underscores.";
  }
  if (username.startsWith(".") || username.endsWith(".")) {
    return "Username cannot start or end with a dot.";
  }

  return "";
}

export function subscribeToUserProfile(userId, onValue, onError) {
  return onSnapshot(
    doc(db, "users", userId),
    (snapshot) => onValue(snapshot.exists() ? snapshot.data() : {}),
    onError
  );
}

export async function updateProfileDetails({ name, username }) {
  const user = requireUser();
  const cleanName = name.trim();
  const cleanUsername = normalizeUsername(username);
  const usernameError = validateUsername(cleanUsername);

  if (cleanName.length < 2 || cleanName.length > 60) {
    throw new Error("Name must contain 2 to 60 characters.");
  }
  if (usernameError) throw new Error(usernameError);

  const userRef = doc(db, "users", user.uid);
  const nextUsernameRef = doc(db, "usernames", cleanUsername);

  await runTransaction(db, async (transaction) => {
    const [profileSnapshot, usernameSnapshot] = await Promise.all([
      transaction.get(userRef),
      transaction.get(nextUsernameRef),
    ]);
    const previousUsername = normalizeUsername(
      profileSnapshot.data()?.username || ""
    );
    const usernameOwner = usernameSnapshot.data()?.ownerUid;

    if (usernameOwner && usernameOwner !== user.uid) {
      throw new Error("That username is already being used.");
    }

    if (previousUsername && previousUsername !== cleanUsername) {
      const previousUsernameRef = doc(db, "usernames", previousUsername);
      const previousSnapshot = await transaction.get(previousUsernameRef);
      if (previousSnapshot.data()?.ownerUid === user.uid) {
        transaction.delete(previousUsernameRef);
      }
    }

    transaction.set(
      nextUsernameRef,
      { ownerUid: user.uid, updatedAt: serverTimestamp() },
      { merge: true }
    );
    transaction.set(
      userRef,
      {
        name: cleanName,
        username: cleanUsername,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  });

  return { name: cleanName, username: cleanUsername };
}

export async function uploadProfilePhoto(imageBlob) {
  const user = requireUser();
  const token = await user.getIdToken();
  const signatureResponse = await fetch("/api/cloudinary-signature", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const signatureData = await signatureResponse.json().catch(() => ({}));

  if (!signatureResponse.ok) {
    throw new Error(signatureData.error || "Unable to prepare the photo upload.");
  }

  const formData = new FormData();
  formData.append("file", imageBlob, "avatar.webp");
  formData.append("api_key", signatureData.apiKey);
  formData.append("signature", signatureData.signature);
  Object.entries(signatureData.parameters || {}).forEach(([key, value]) => {
    formData.append(key, String(value));
  });

  const uploadResponse = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(
      signatureData.cloudName
    )}/image/upload`,
    { method: "POST", body: formData }
  );
  const uploadResult = await uploadResponse.json().catch(() => ({}));

  if (!uploadResponse.ok || !uploadResult.secure_url || !uploadResult.public_id) {
    throw new Error(uploadResult.error?.message || "Cloudinary could not upload the photo.");
  }

  await setDoc(
    doc(db, "users", user.uid),
    {
      customPhotoURL: uploadResult.secure_url,
      customPhotoPublicId: uploadResult.public_id,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return uploadResult.secure_url;
}

export async function removeProfilePhoto() {
  const user = requireUser();
  const token = await user.getIdToken();
  const deleteResponse = await fetch("/api/cloudinary-delete", {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  const deleteResult = await deleteResponse.json().catch(() => ({}));

  if (!deleteResponse.ok) {
    throw new Error(deleteResult.error || "Unable to remove the profile photo.");
  }

  await setDoc(
    doc(db, "users", user.uid),
    {
      customPhotoURL: "",
      customPhotoPublicId: "",
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function removeUsernameReservation(username) {
  const user = requireUser();
  const normalized = normalizeUsername(username);
  if (!normalized) return;

  const usernameRef = doc(db, "usernames", normalized);
  await deleteDoc(usernameRef);
  await setDoc(
    doc(db, "users", user.uid),
    { username: "", updatedAt: serverTimestamp() },
    { merge: true }
  );
}
