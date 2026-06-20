import { createContext, useContext, useEffect, useRef, useState } from "react";
import EditAccessDialog from "../components/security/EditAccessDialog";
import EditPinSettingsDialog from "../components/security/EditPinSettingsDialog";
import {
  changeEditPin,
  removeEditPin,
  saveEditPin,
  subscribeToEditPinStatus,
  verifyEditPin,
} from "../firebase/editPinService";
import {
  clearEditSession,
  createUnlockedSessionValue,
  createViewSessionValue,
  readEditSession,
  writeEditSession,
} from "../utils/editSession";
import { useAuth } from "./AuthContext";

const EditLockContext = createContext(null);

export function EditLockProvider({ children }) {
  const { user } = useAuth();
  const previousUserId = useRef("");
  const [loadedUserId, setLoadedUserId] = useState("");
  const [pinConfigured, setPinConfigured] = useState(false);
  const [pinVersion, setPinVersion] = useState("");
  const [canEdit, setCanEdit] = useState(false);
  const [securityError, setSecurityError] = useState("");
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);
  const [loginPrompt, setLoginPrompt] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);

  useEffect(() => {
    const userId = user?.uid || "";

    if (!userId) {
      if (previousUserId.current) {
        clearEditSession(previousUserId.current);
      }

      previousUserId.current = "";
      setLoadedUserId("");
      setPinConfigured(false);
      setPinVersion("");
      setCanEdit(false);
      setSecurityError("");
      setAccessDialogOpen(false);
      setSettingsDialogOpen(false);
      return undefined;
    }

    previousUserId.current = userId;
    setSecurityError("");

    return subscribeToEditPinStatus(
      ({ pinConfigured: configured, pinVersion: version }) => {
        const sessionValue = readEditSession(userId);

        setPinConfigured(configured);
        setPinVersion(version);

        if (!configured) {
          writeEditSession(userId, "open");
          setCanEdit(true);
          setAccessDialogOpen(false);
          setLoginPrompt(false);
        } else if (sessionValue === createUnlockedSessionValue(version)) {
          setCanEdit(true);
          setAccessDialogOpen(false);
          setLoginPrompt(false);
        } else if (sessionValue === createViewSessionValue(version)) {
          setCanEdit(false);
          setAccessDialogOpen(false);
          setLoginPrompt(false);
        } else {
          setCanEdit(false);
          setLoginPrompt(true);
          setAccessDialogOpen(true);
        }

        setLoadedUserId(userId);
      },
      (error) => {
        console.error(error);
        setCanEdit(false);
        setSecurityError("Failed to load edit security. Please reload the page.");
        setLoadedUserId(userId);
      }
    );
  }, [user?.uid]);

  function continueInViewMode() {
    if (!user || !pinConfigured) return;

    writeEditSession(user.uid, createViewSessionValue(pinVersion));
    setCanEdit(false);
    setAccessDialogOpen(false);
    setLoginPrompt(false);
  }

  async function unlockEditing(pin) {
    if (!user) throw new Error("Log in before unlocking editing.");

    const verification = await verifyEditPin(pin);

    if (!verification.valid) {
      throw new Error("Incorrect edit PIN.");
    }

    writeEditSession(
      user.uid,
      createUnlockedSessionValue(verification.version)
    );
    setPinVersion(verification.version);
    setCanEdit(true);
    setAccessDialogOpen(false);
    setLoginPrompt(false);
  }

  function lockEditing() {
    if (!user || !pinConfigured) return;

    writeEditSession(user.uid, createViewSessionValue(pinVersion));
    setCanEdit(false);
  }

  async function setPin(pin) {
    if (!user) throw new Error("Log in before setting an edit PIN.");

    const version = await saveEditPin(pin);
    writeEditSession(user.uid, createUnlockedSessionValue(version));
    setPinConfigured(true);
    setPinVersion(version);
    setCanEdit(true);
    setAccessDialogOpen(false);
    setLoginPrompt(false);
  }

  async function changePin(currentPin, newPin) {
    if (!user) throw new Error("Log in before changing the edit PIN.");

    const version = await changeEditPin(currentPin, newPin);
    writeEditSession(user.uid, createUnlockedSessionValue(version));
    setPinVersion(version);
    setCanEdit(true);
  }

  async function removePin(currentPin) {
    if (!user) throw new Error("Log in before removing the edit PIN.");

    await removeEditPin(currentPin);
    writeEditSession(user.uid, "open");
    setPinConfigured(false);
    setPinVersion("");
    setCanEdit(true);
    setAccessDialogOpen(false);
    setLoginPrompt(false);
  }

  function openUnlockDialog() {
    if (!pinConfigured) return;
    setLoginPrompt(false);
    setAccessDialogOpen(true);
  }

  function closeUnlockDialog() {
    setAccessDialogOpen(false);
    setLoginPrompt(false);
  }

  function prepareForLogout() {
    if (user) clearEditSession(user.uid);
    setCanEdit(false);
    setAccessDialogOpen(false);
    setSettingsDialogOpen(false);
  }

  const value = {
    pinConfigured,
    canEdit,
    isViewMode: pinConfigured && !canEdit,
    openUnlockDialog,
    lockEditing,
    openPinSettings: () => setSettingsDialogOpen(true),
    prepareForLogout,
  };

  const securityReady = !user || loadedUserId === user.uid;

  if (!securityReady) {
    return <div className="edit-lock-loading">Loading edit security...</div>;
  }

  if (user && securityError) {
    return <div className="edit-lock-loading edit-lock-loading--error">{securityError}</div>;
  }

  return (
    <EditLockContext.Provider value={value}>
      {children}

      <EditAccessDialog
        open={accessDialogOpen}
        loginPrompt={loginPrompt}
        onUnlock={unlockEditing}
        onContinueView={continueInViewMode}
        onClose={closeUnlockDialog}
      />

      <EditPinSettingsDialog
        open={settingsDialogOpen}
        pinConfigured={pinConfigured}
        onSetPin={setPin}
        onChangePin={changePin}
        onRemovePin={removePin}
        onClose={() => setSettingsDialogOpen(false)}
      />
    </EditLockContext.Provider>
  );
}

export function useEditLock() {
  const context = useContext(EditLockContext);

  if (!context) {
    throw new Error("useEditLock must be used inside EditLockProvider.");
  }

  return context;
}
