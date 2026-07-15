/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  changeUserEmail,
  changeUserPassword,
  loginWithGoogle,
  loginUser,
  logoutUser,
  observeAuthState,
  registerUser,
  resetUserPassword,
  updateUserDisplayName,
} from "../firebase/authService";
import {
  subscribeToUserProfile,
  updateProfileDetails,
} from "../firebase/profileService";

const AuthContext = createContext(null);

function toAuthUser(firebaseUser, profile = {}) {
  if (!firebaseUser) return null;

  const providerIds = firebaseUser.providerData
    .map((provider) => provider.providerId)
    .filter(Boolean);
  const googlePhotoURL =
    firebaseUser.providerData.find(
      (provider) => provider.providerId === "google.com"
    )?.photoURL || firebaseUser.photoURL || "";

  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email || profile.email || "",
    emailVerified: firebaseUser.emailVerified,
    displayName: profile.name || firebaseUser.displayName || "",
    username: profile.username || "",
    photoURL: profile.customPhotoURL || googlePhotoURL || profile.photoURL || "",
    customPhotoURL: profile.customPhotoURL || "",
    googlePhotoURL,
    providerIds,
    createdAt:
      profile.createdAt?.toDate?.()?.toISOString?.() ||
      firebaseUser.metadata.creationTime ||
      "",
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const firebaseUserRef = useRef(null);
  const profileRef = useRef({});

  useEffect(() => {
    let unsubscribeProfile = null;

    const unsubscribeAuth = observeAuthState((firebaseUser) => {
      unsubscribeProfile?.();
      unsubscribeProfile = null;
      firebaseUserRef.current = firebaseUser;
      profileRef.current = {};
      setUser(toAuthUser(firebaseUser));

      if (firebaseUser) {
        unsubscribeProfile = subscribeToUserProfile(
          firebaseUser.uid,
          (profile) => {
            profileRef.current = profile;
            setUser(toAuthUser(firebaseUserRef.current, profile));
            setAuthLoading(false);
          },
          (error) => {
            console.error("Unable to load user profile", error);
            setAuthLoading(false);
          }
        );
      } else {
        setAuthLoading(false);
      }
    });

    return () => {
      unsubscribeProfile?.();
      unsubscribeAuth();
    };
  }, []);

  function refreshUser(firebaseUser = firebaseUserRef.current) {
    if (firebaseUser) firebaseUserRef.current = firebaseUser;
    setUser(toAuthUser(firebaseUserRef.current, profileRef.current));
  }

  async function login(credentials) {
    const credential = await loginUser(credentials);
    setUser(toAuthUser(credential.user));
    return credential.user;
  }

  async function signup(details) {
    const firebaseUser = await registerUser(details);
    setUser(toAuthUser(firebaseUser));
    return firebaseUser;
  }

  async function googleLogin() {
    const firebaseUser = await loginWithGoogle();
    setUser(toAuthUser(firebaseUser));
    return firebaseUser;
  }

  async function logout() {
    await logoutUser();
    setUser(null);
  }

  async function saveProfile(details) {
    const result = await updateProfileDetails(details);
    const firebaseUser = await updateUserDisplayName(result.name);
    refreshUser(firebaseUser);
    return result;
  }

  async function updateEmail(details) {
    const firebaseUser = await changeUserEmail(details);
    refreshUser(firebaseUser);
    return firebaseUser;
  }

  async function updatePassword(details) {
    await changeUserPassword(details);
  }

  const value = {
    user,
    authLoading,
    login,
    signup,
    googleLogin,
    logout,
    saveProfile,
    updateEmail,
    updatePassword,
    refreshUser,
    resetPassword: resetUserPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
