import {
  deleteField,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { getUserDocument } from "./userDataRefs";

const PIN_LENGTH = 6;
const HASH_ITERATIONS = 150000;

function bytesToBase64(bytes) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function validatePin(pin) {
  if (!new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin)) {
    throw new Error(`PIN must contain exactly ${PIN_LENGTH} digits.`);
  }
}

async function derivePinHash(pin, salt) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations: HASH_ITERATIONS,
    },
    keyMaterial,
    256
  );

  return bytesToBase64(new Uint8Array(bits));
}

function securityDocument() {
  return getUserDocument("settings", "security");
}

export function subscribeToEditPinStatus(callback, errorCallback) {
  return onSnapshot(
    securityDocument(),
    (snapshot) => {
      const editPin = snapshot.data()?.editPin;

      callback({
        pinConfigured: Boolean(editPin?.hash && editPin?.salt),
        pinVersion: editPin?.version || "",
      });
    },
    errorCallback
  );
}

export async function saveEditPin(pin) {
  validatePin(pin);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePinHash(pin, salt);
  const version = crypto.randomUUID();

  await setDoc(
    securityDocument(),
    {
      editPin: {
        hash,
        salt: bytesToBase64(salt),
        version,
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return version;
}

export async function verifyEditPin(pin) {
  validatePin(pin);

  const snapshot = await getDoc(securityDocument());
  const editPin = snapshot.data()?.editPin;

  if (!editPin?.hash || !editPin?.salt || !editPin?.version) {
    return { valid: false, version: "" };
  }

  const candidateHash = await derivePinHash(pin, base64ToBytes(editPin.salt));

  return {
    valid: candidateHash === editPin.hash,
    version: editPin.version,
  };
}

export async function changeEditPin(currentPin, newPin) {
  const verification = await verifyEditPin(currentPin);

  if (!verification.valid) {
    throw new Error("Current PIN is incorrect.");
  }

  return saveEditPin(newPin);
}

export async function removeEditPin(currentPin) {
  const verification = await verifyEditPin(currentPin);

  if (!verification.valid) {
    throw new Error("Current PIN is incorrect.");
  }

  await setDoc(
    securityDocument(),
    {
      editPin: deleteField(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
