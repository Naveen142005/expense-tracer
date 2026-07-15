import { useMemo, useRef, useState } from "react";
import AppIcon from "../components/common/AppIcon";
import Button from "../components/common/Button";
import Input from "../components/common/Input";
import ProfileAvatar from "../components/profile/ProfileAvatar";
import { useAuth } from "../context/AuthContext";
import { useEditLock } from "../context/EditLockContext";
import { useFeedback } from "../context/FeedbackContext";
import { getAuthErrorMessage } from "../firebase/authService";
import {
  removeProfilePhoto,
  uploadProfilePhoto,
  validateUsername,
} from "../firebase/profileService";
import { hasUnsavedTodayDraft } from "../utils/draftStorage";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

function formatMemberSince(value) {
  if (!value) return "Account member";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Account member";
  return `Member since ${new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(date)}`;
}

async function prepareProfileImage(file) {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    throw new Error("Choose a JPG, PNG, or WebP image.");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Choose an image smaller than 5 MB.");
  }

  const objectURL = URL.createObjectURL(file);

  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("The selected image could not be opened."));
      element.src = objectURL;
    });
    const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
    const sourceX = (image.naturalWidth - sourceSize) / 2;
    const sourceY = (image.naturalHeight - sourceSize) / 2;
    const outputSize = Math.min(720, sourceSize);
    const canvas = document.createElement("canvas");
    canvas.width = outputSize;
    canvas.height = outputSize;
    const context = canvas.getContext("2d");
    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      outputSize,
      outputSize
    );

    return await new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("The image could not be prepared."))),
        "image/webp",
        0.86
      );
    });
  } finally {
    URL.revokeObjectURL(objectURL);
  }
}

function ProfilePage() {
  const {
    user,
    logout,
    saveProfile,
    updateEmail,
    updatePassword,
  } = useAuth();
  const { prepareForLogout } = useEditLock();
  const { notify, confirmAction } = useFeedback();
  const imageInputRef = useRef(null);
  const [profileForm, setProfileForm] = useState({
    name: user?.displayName || "",
    username: user?.username || "",
  });
  const [emailForm, setEmailForm] = useState({
    email: user?.email || "",
    currentPassword: "",
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [profileErrors, setProfileErrors] = useState({});

  const isPasswordAccount = useMemo(
    () => user?.providerIds?.includes("password"),
    [user?.providerIds]
  );
  const providerLabel = user?.providerIds?.includes("google.com")
    ? "Google account"
    : "Email account";

  async function handleProfileSubmit(event) {
    event.preventDefault();
    const errors = {};
    if (profileForm.name.trim().length < 2) {
      errors.name = "Enter at least 2 characters.";
    }
    const usernameError = validateUsername(profileForm.username);
    if (usernameError) errors.username = usernameError;
    setProfileErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      setSavingProfile(true);
      await saveProfile(profileForm);
      notify({
        type: "success",
        title: "Profile updated",
        message: "Your name and username were saved.",
      });
    } catch (error) {
      notify({
        type: "error",
        title: "Profile not updated",
        message: error.message || "Please try again.",
      });
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePhotoChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      setSavingPhoto(true);
      const imageBlob = await prepareProfileImage(file);
      await uploadProfilePhoto(imageBlob);
      notify({
        type: "success",
        title: "Profile photo updated",
        message: "Your new photo is now visible across the application.",
      });
    } catch (error) {
      notify({
        type: "error",
        title: "Photo not updated",
        message: error.message || "Please choose another image.",
      });
    } finally {
      setSavingPhoto(false);
    }
  }

  async function handleRemovePhoto() {
    const confirmed = await confirmAction({
      title: "Remove profile photo?",
      message: user?.googlePhotoURL
        ? "Your Google account photo will be shown instead."
        : "Your initials will be shown instead.",
      confirmText: "Remove Photo",
      cancelText: "Keep Photo",
      tone: "danger",
    });
    if (!confirmed) return;

    try {
      setSavingPhoto(true);
      await removeProfilePhoto();
      notify({
        type: "success",
        title: "Profile photo removed",
        message: user?.googlePhotoURL
          ? "Your Google photo is active again."
          : "Your initials are active now.",
      });
    } catch (error) {
      notify({
        type: "error",
        title: "Photo not removed",
        message: error.message || "Please try again.",
      });
    } finally {
      setSavingPhoto(false);
    }
  }

  async function handleEmailSubmit(event) {
    event.preventDefault();
    if (!isPasswordAccount) return;

    try {
      setSavingEmail(true);
      await updateEmail(emailForm);
      setEmailForm((current) => ({ ...current, currentPassword: "" }));
      notify({
        type: "success",
        title: "Email updated",
        message: "Use your new email the next time you sign in.",
      });
    } catch (error) {
      notify({
        type: "error",
        title: "Email not updated",
        message: getAuthErrorMessage(error),
      });
    } finally {
      setSavingEmail(false);
    }
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();
    if (!isPasswordAccount) return;

    if (passwordForm.newPassword.length < 8) {
      notify({
        type: "warning",
        title: "Use a stronger password",
        message: "Your new password must contain at least 8 characters.",
      });
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      notify({
        type: "warning",
        title: "Passwords do not match",
        message: "Re-enter the same new password in both fields.",
      });
      return;
    }

    try {
      setSavingPassword(true);
      await updatePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      notify({
        type: "success",
        title: "Password changed",
        message: "Your account is now using the new password.",
      });
    } catch (error) {
      notify({
        type: "error",
        title: "Password not changed",
        message: getAuthErrorMessage(error),
      });
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleLogout() {
    const confirmed = await confirmAction(
      hasUnsavedTodayDraft()
        ? {
            title: "Unsaved draft items",
            message: "Your current draft has not been submitted. Log out and leave it on this device?",
            confirmText: "Logout Anyway",
            cancelText: "Keep Working",
            tone: "danger",
          }
        : {
            title: "Log out of your account?",
            message: "Your submitted expenses remain safely stored in Firebase.",
            confirmText: "Logout",
            cancelText: "Stay Logged In",
            tone: "danger",
          }
    );
    if (!confirmed) return;

    try {
      setLoggingOut(true);
      prepareForLogout();
      await logout();
    } catch (error) {
      notify({
        type: "error",
        title: "Logout failed",
        message: error.message || "Please try again.",
      });
      setLoggingOut(false);
    }
  }

  return (
    <section className="profile-page" aria-labelledby="profile-page-title">
      <header className="profile-hero">
        <div className="profile-hero__avatar-wrap">
          <ProfileAvatar user={user} size="xl" />
          <button
            type="button"
            className="profile-hero__camera"
            onClick={() => imageInputRef.current?.click()}
            disabled={savingPhoto}
            aria-label="Upload a new profile photo"
          >
            <AppIcon name="camera" size={18} />
          </button>
        </div>
        <div className="profile-hero__copy">
          <span className="profile-page__eyebrow">Your account</span>
          <h2 id="profile-page-title">{user?.displayName || "Your Profile"}</h2>
          <p>{user?.email}</p>
          <div className="profile-hero__badges">
            <span><AppIcon name="check" size={14} /> {providerLabel}</span>
            <span><AppIcon name="calendar" size={14} /> {formatMemberSince(user?.createdAt)}</span>
          </div>
        </div>
      </header>

      <div className="profile-layout">
        <div className="profile-layout__main">
          <article className="profile-section-card">
            <header className="profile-section-card__header">
              <span className="profile-section-card__icon"><AppIcon name="user" /></span>
              <div>
                <h3>Personal information</h3>
                <p>Control how your identity appears in the application.</p>
              </div>
            </header>
            <form className="profile-form" onSubmit={handleProfileSubmit} noValidate>
              <Input
                label="Display Name"
                name="name"
                value={profileForm.name}
                onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Your name"
                error={profileErrors.name}
                disabled={savingProfile}
              />
              <Input
                label="Username"
                name="username"
                value={profileForm.username}
                onChange={(event) => setProfileForm((current) => ({ ...current, username: event.target.value }))}
                placeholder="Example: naveen.kumar"
                error={profileErrors.username}
                disabled={savingProfile}
              />
              <div className="profile-form__hint">
                <AppIcon name="id" size={16} />
                <span>Your Firebase account ID remains protected and unchanged.</span>
              </div>
              <div className="profile-form__actions">
                <Button type="submit" loading={savingProfile}>Save Profile</Button>
              </div>
            </form>
          </article>

          <article className="profile-section-card">
            <header className="profile-section-card__header">
              <span className="profile-section-card__icon profile-section-card__icon--security"><AppIcon name="lock" /></span>
              <div>
                <h3>Account and security</h3>
                <p>Update your sign-in details securely through Firebase Authentication.</p>
              </div>
            </header>

            {isPasswordAccount ? (
              <div className="profile-security-grid">
                <form className="profile-form profile-security-form" onSubmit={handleEmailSubmit}>
                  <div className="profile-form__title"><AppIcon name="mail" size={18} /><strong>Change email</strong></div>
                  <Input
                    label="Email Address"
                    name="email"
                    type="email"
                    value={emailForm.email}
                    onChange={(event) => setEmailForm((current) => ({ ...current, email: event.target.value }))}
                    disabled={savingEmail}
                    required
                  />
                  <Input
                    label="Current Password"
                    name="emailCurrentPassword"
                    type="password"
                    value={emailForm.currentPassword}
                    onChange={(event) => setEmailForm((current) => ({ ...current, currentPassword: event.target.value }))}
                    placeholder="Required for verification"
                    disabled={savingEmail}
                    required
                  />
                  <Button type="submit" variant="secondary" loading={savingEmail}>Update Email</Button>
                </form>

                <form className="profile-form profile-security-form" onSubmit={handlePasswordSubmit}>
                  <div className="profile-form__title"><AppIcon name="lock" size={18} /><strong>Change password</strong></div>
                  <Input
                    label="Current Password"
                    name="currentPassword"
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))}
                    disabled={savingPassword}
                    required
                  />
                  <div className="profile-password-row">
                    <Input
                      label="New Password"
                      name="newPassword"
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
                      placeholder="At least 8 characters"
                      disabled={savingPassword}
                      required
                    />
                    <Input
                      label="Confirm Password"
                      name="confirmPassword"
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                      disabled={savingPassword}
                      required
                    />
                  </div>
                  <Button type="submit" variant="secondary" loading={savingPassword}>Change Password</Button>
                </form>
              </div>
            ) : (
              <div className="profile-managed-account">
                <span><AppIcon name="lock" /></span>
                <div>
                  <strong>Sign-in details are managed by Google</strong>
                  <p>Change your Google email or password from your Google Account settings.</p>
                </div>
              </div>
            )}
          </article>
        </div>

        <aside className="profile-layout__side">
          <article className="profile-section-card profile-photo-card">
            <header className="profile-section-card__header">
              <span className="profile-section-card__icon profile-section-card__icon--photo"><AppIcon name="camera" /></span>
              <div>
                <h3>Profile photo</h3>
                <p>JPG, PNG, or WebP up to 5 MB.</p>
              </div>
            </header>
            <div className="profile-photo-card__preview">
              <ProfileAvatar user={user} size="xxl" />
              {savingPhoto && <span className="profile-photo-card__loading">Preparing photo…</span>}
            </div>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="profile-photo-card__input"
              onChange={handlePhotoChange}
            />
            <div className="profile-photo-card__actions">
              <Button type="button" onClick={() => imageInputRef.current?.click()} disabled={savingPhoto}>
                <AppIcon name="upload" size={17} /> {user?.customPhotoURL ? "Replace Photo" : "Upload Photo"}
              </Button>
              {user?.customPhotoURL && (
                <Button type="button" variant="secondary" onClick={handleRemovePhoto} disabled={savingPhoto}>
                  <AppIcon name="trash" size={17} /> Remove
                </Button>
              )}
            </div>
            <small>Images are automatically cropped square and optimized before upload.</small>
          </article>

          <article className="profile-section-card profile-session-card">
            <span className="profile-page__eyebrow">Session</span>
            <h3>Finished for now?</h3>
            <p>Log out safely. Your submitted records stay connected to this account.</p>
            <Button type="button" variant="secondary" onClick={handleLogout} loading={loggingOut}>
              <AppIcon name="logout" size={18} /> Logout
            </Button>
          </article>
        </aside>
      </div>
    </section>
  );
}

export default ProfilePage;
