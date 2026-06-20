const SESSION_PREFIX = "expense-tracker-edit-mode";

export function getEditSessionKey(userId) {
  return `${SESSION_PREFIX}:${userId}`;
}

export function readEditSession(userId) {
  if (!userId) return "";
  return sessionStorage.getItem(getEditSessionKey(userId)) || "";
}

export function writeEditSession(userId, value) {
  if (!userId) return;
  sessionStorage.setItem(getEditSessionKey(userId), value);
}

export function clearEditSession(userId) {
  if (!userId) return;
  sessionStorage.removeItem(getEditSessionKey(userId));
}

export function createUnlockedSessionValue(pinVersion) {
  return `unlocked:${pinVersion}`;
}

export function createViewSessionValue(pinVersion) {
  return `view:${pinVersion}`;
}

export function hasClientEditAccess(userId) {
  const sessionValue = readEditSession(userId);
  return sessionValue === "open" || sessionValue.startsWith("unlocked:");
}

export function assertClientEditAccess(userId) {
  if (!hasClientEditAccess(userId)) {
    throw new Error("Editing is locked. Enter the edit PIN to continue.");
  }
}
