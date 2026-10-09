import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase/config';
import { UserProfile, AuthorizedUser } from '../types/crm';

export const INITIAL_ADMIN_EMAIL = 'lakshmi@yalixvalor.com';
export const LEGACY_ADMIN_EMAIL = 'lakshmi@yalixflow.com';
export const DEV_ADMIN_EMAIL = 'lnarayanan97@gmail.com';

const ALLOWED_ADMIN_EMAILS = [
  INITIAL_ADMIN_EMAIL.toLowerCase(),
  LEGACY_ADMIN_EMAIL.toLowerCase(),
  DEV_ADMIN_EMAIL.toLowerCase(),
];

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isAuthorized: boolean;
  isAdmin: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  createInitialAdminAccount: (password: string, email?: string) => Promise<void>;
  signOut: () => Promise<void>;
  authError: string | null;
  setAuthError: (err: string | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      setAuthError(null);

      if (!user) {
        setCurrentUser(null);
        setUserProfile(null);
        setIsAuthorized(false);
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      setCurrentUser(user);

      try {
        const userEmailLower = (user.email || '').toLowerCase().trim();
        const isWhitelistedAdmin = ALLOWED_ADMIN_EMAILS.includes(userEmailLower);

        // Check authorizedUsers collection first with offline-safe error handling
        const authUserRef = doc(db, 'authorizedUsers', user.uid);
        let authUserSnap: any = null;
        try {
          authUserSnap = await getDoc(authUserRef);
        } catch (fetchErr: any) {
          console.warn('authorizedUsers lookup offline or deferred:', fetchErr?.message || fetchErr);
        }

        const userDocRef = doc(db, 'users', user.uid);
        let userDocSnap: any = null;
        try {
          userDocSnap = await getDoc(userDocRef);
        } catch (fetchErr: any) {
          console.warn('users doc lookup offline or deferred:', fetchErr?.message || fetchErr);
        }

        if (isWhitelistedAdmin) {
          // Provision or sync authorized record in authorizedUsers and users
          const adminRecord: AuthorizedUser = {
            uid: user.uid,
            email: user.email || INITIAL_ADMIN_EMAIL,
            displayName: user.displayName || (userEmailLower.includes('lakshmi') ? 'Lakshmi' : 'YALIX Super Admin'),
            role: 'ADMIN',
            active: true,
            status: 'active',
            createdAt: authUserSnap?.exists?.() ? authUserSnap.data()?.createdAt || new Date().toISOString() : new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          try {
            await setDoc(authUserRef, adminRecord, { merge: true });
            await setDoc(userDocRef, adminRecord, { merge: true });
          } catch (writeErr) {
            console.warn('Admin record sync note (offline/deferred):', writeErr);
          }

          setUserProfile(adminRecord);
          setIsAuthorized(true);
          setIsAdmin(true);
        } else if (authUserSnap?.exists?.()) {
          const authData = authUserSnap.data() as AuthorizedUser;
          const isActive = authData.active === true || authData.status === 'active';
          const isRoleAdmin = authData.role === 'ADMIN';

          setUserProfile(authData);
          // Only authorized ADMIN accounts can access CRM routes per policy
          setIsAuthorized(isActive && isRoleAdmin);
          setIsAdmin(isRoleAdmin);
        } else if (userDocSnap?.exists?.()) {
          const userData = userDocSnap.data() as UserProfile;
          const isActive = userData.active === true || userData.status === 'active';
          const isRoleAdmin = userData.role === 'ADMIN' || userData.role === 'admin';

          setUserProfile(userData);
          setIsAuthorized(isActive && isRoleAdmin);
          setIsAdmin(isRoleAdmin);
        } else {
          // External or unauthorized account: deny access completely
          setIsAuthorized(false);
          setIsAdmin(false);
          setUserProfile(null);
        }
      } catch (err: any) {
        console.warn('Authorization verification check note (offline/deferred):', err?.message || err);
        const userEmailLower = (user.email || '').toLowerCase().trim();
        if (ALLOWED_ADMIN_EMAILS.includes(userEmailLower)) {
          const fallbackAdmin: AuthorizedUser = {
            uid: user.uid,
            email: user.email || INITIAL_ADMIN_EMAIL,
            displayName: user.displayName || (userEmailLower.includes('lakshmi') ? 'Lakshmi' : 'YALIX Super Admin'),
            role: 'ADMIN',
            active: true,
            status: 'active',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          setUserProfile(fallbackAdmin);
          setIsAuthorized(true);
          setIsAdmin(true);
        } else {
          setIsAuthorized(false);
          setIsAdmin(false);
          setUserProfile(null);
        }
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // First-time administrator creation / activation for lakshmi@yalixvalor.com
  // ONLY executed after user enters their chosen CRM password in UI.
  // Password is NOT hard-coded, NOT stored in code, and NOT stored in Firestore.
  const createInitialAdminAccount = async (chosenPassword: string, emailToUse: string = INITIAL_ADMIN_EMAIL) => {
    setAuthError(null);
    if (!chosenPassword || chosenPassword.length < 8) {
      const err = 'CRM password must be at least 8 characters.';
      setAuthError(err);
      throw new Error(err);
    }

    const targetEmail = (emailToUse || INITIAL_ADMIN_EMAIL).trim().toLowerCase();
    if (!ALLOWED_ADMIN_EMAILS.includes(targetEmail)) {
      const err = 'Registration closed: only authorized administrator emails can be activated.';
      setAuthError(err);
      throw new Error(err);
    }

    try {
      // 1. Create account in Firebase Authentication
      const cred = await createUserWithEmailAndPassword(auth, targetEmail, chosenPassword);

      // 2. Add to authorizedUsers and users ONLY AFTER Firebase Authentication creates the account
      const now = new Date().toISOString();
      const adminRecord: AuthorizedUser = {
        uid: cred.user.uid,
        email: targetEmail,
        displayName: 'Lakshmi',
        role: 'ADMIN',
        active: true,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(doc(db, 'authorizedUsers', cred.user.uid), adminRecord);
      await setDoc(doc(db, 'users', cred.user.uid), adminRecord);

      setUserProfile(adminRecord);
      setIsAuthorized(true);
      setIsAdmin(true);
    } catch (err: any) {
      console.error('Failed to create initial admin account:', err);
      if (err.code === 'auth/email-already-in-use') {
        setAuthError(
          `Administrator account (${targetEmail}) is already activated in Firebase Auth. Please sign in with your CRM password.`
        );
      } else {
        setAuthError(err.message || 'Failed to initialize administrator account.');
      }
      throw err;
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    setAuthError(null);
    const normalizedEmail = email.trim().toLowerCase();

    // Prevent random unauthorized emails from attempting to sign in
    if (!ALLOWED_ADMIN_EMAILS.includes(normalizedEmail)) {
      const err = 'Access Denied: Only authorized YALIX CRM administrator accounts are permitted.';
      setAuthError(err);
      throw new Error(err);
    }

    try {
      await signInWithEmailAndPassword(auth, normalizedEmail, pass);
    } catch (err: any) {
      console.error('Email Sign-in failed:', err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        if (ALLOWED_ADMIN_EMAILS.includes(normalizedEmail)) {
          setAuthError(
            `Account not yet activated in Firebase Auth. Switch to "First-Time Activation" to set your independent CRM password for ${normalizedEmail}.`
          );
        } else {
          setAuthError('Invalid credentials. YALIX CRM allows authorized ADMIN accounts only.');
        }
      } else if (err.code === 'auth/wrong-password') {
        setAuthError('Incorrect CRM password. Note: this password is independent from your actual email inbox.');
      } else {
        setAuthError(err.message || 'Authentication failed.');
      }
      throw err;
    }
  };

  const signInWithGoogle = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error('Google Sign-in failed:', err);
      setAuthError(err.message || 'Google sign-in was cancelled or failed.');
    }
  };

  const signOut = async () => {
    try {
      await fbSignOut(auth);
      setCurrentUser(null);
      setUserProfile(null);
      setIsAuthorized(false);
      setIsAdmin(false);
    } catch (err) {
      console.error('Sign-out failed:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        loading,
        isAuthorized,
        isAdmin,
        signInWithGoogle,
        signInWithEmail,
        createInitialAdminAccount,
        signOut,
        authError,
        setAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
