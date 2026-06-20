const SESSION_PREFIX = "expense-tracker-edit-mode";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function getEditSessionKey(userId) {
  return `${SESSION_PREFIX}:${userId}`;
}

function getStoredSession(userId) {
  if (!userId) return null;

  const key = getEditSessionKey(userId);
  const savedSession = localStorage.getItem(key);

  if (!savedSession) return null;

  try {
    const parsedSession = JSON.parse(savedSession);

    if (
      !parsedSession.value ||
      !parsedSession.expiresAt ||
      Date.now() >= parsedSession.expiresAt
    ) {
      localStorage.removeItem(key);
      return null;
    }

    return parsedSession;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

export function readEditSession(userId) {
  return getStoredSession(userId)?.value || "";
}

export function getEditSessionExpiry(userId) {
  return getStoredSession(userId)?.expiresAt || 0;
}

export function writeEditSession(userId, value) {
  if (!userId) return;

  localStorage.setItem(
    getEditSessionKey(userId),
    JSON.stringify({
      value,
      expiresAt: Date.now() + ONE_DAY_MS,
    })
  );

  // Remove any old sessionStorage version.
  sessionStorage.removeItem(getEditSessionKey(userId));
}

export function clearEditSession(userId) {
  if (!userId) return;

  localStorage.removeItem(getEditSessionKey(userId));
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

  return (
    sessionValue === "open" ||
    sessionValue.startsWith("unlocked:")
  );
}

export function assertClientEditAccess(userId) {
  if (!hasClientEditAccess(userId)) {
    throw new Error("Editing is locked. Enter the edit PIN to continue.");
  }
}