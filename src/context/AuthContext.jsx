import { createContext, useContext, useEffect, useState } from "react";
import {
  loginWithGoogle,
  loginUser,
  logoutUser,
  observeAuthState,
  registerUser,
  resetUserPassword,
} from "../firebase/authService";

const AuthContext = createContext(null);

function toAuthUser(firebaseUser) {
  if (!firebaseUser) return null;

  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    return observeAuthState((firebaseUser) => {
      setUser(toAuthUser(firebaseUser));
      setAuthLoading(false);
    });
  }, []);

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

  const value = {
    user,
    authLoading,
    login,
    signup,
    googleLogin,
    logout,
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
