/**
 * Authentication Context
 *
 * Provides authentication state and methods to the entire app via React Context.
 *
 * WHAT THIS FILE DOES:
 * - Listens for Supabase auth state changes (sign in, sign out, token refresh)
 * - Stores the current session and user in React state
 * - Exposes signUp, signIn, and signOut methods to any component
 * - Shows a loading state while the initial session is being restored
 *
 * WHAT IS A "CONTEXT" IN REACT?
 * Context is a way to pass data through the component tree without manually
 * passing props at every level. Think of it like a broadcast channel:
 * the AuthProvider broadcasts auth state, and any component in the tree
 * can tune in using the useAuth() hook.
 *
 * WHY WE NEED THIS:
 * Many screens need to know if the user is logged in (scan history, profile,
 * save buttons). Without context, we'd have to pass `user` and `session`
 * through every component. Context eliminates that "prop drilling."
 */

import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabase';

// ─── Types ──────────────────────────────────────────────────────────

/** The shape of the authentication state and actions available via context. */
interface AuthContextValue {
  /** The current Supabase session (contains access + refresh tokens), or null if not logged in */
  session: Session | null;
  /** The current user object (id, email, etc.), or null if not logged in */
  user: User | null;
  /** True while we're restoring the session from AsyncStorage on app launch */
  isLoading: boolean;
  /** Sign up a new user with email and password */
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  /** Sign in an existing user with email and password */
  signIn: (email: string, password: string) => Promise<SignInResult>;
  /** Sign out the current user */
  signOut: () => Promise<SignOutResult>;
}

type SignUpResult =
  | { success: true; needsConfirmation: boolean }
  | { success: false; error: string };

type SignInResult =
  | { success: true }
  | { success: false; error: string };

type SignOutResult =
  | { success: true }
  | { success: false; error: string };

// ─── Context ────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ───────────────────────────────────────────────────────

/**
 * AuthProvider wraps the app and manages authentication state.
 *
 * It does two things on mount:
 * 1. Checks AsyncStorage for an existing session (so users stay logged in
 *    across app restarts).
 * 2. Subscribes to Supabase auth state changes so the UI always reflects
 *    the current auth state (e.g., after sign out or token refresh).
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 1. Restore the session from AsyncStorage
    supabase.auth.getSession().then(({ data: { session: restoredSession } }) => {
      setSession(restoredSession);
      setIsLoading(false);
    });

    // 2. Listen for auth state changes
    // This fires when:
    //   - User signs in → event = 'SIGNED_IN'
    //   - User signs out → event = 'SIGNED_OUT', session = null
    //   - Token is refreshed → event = 'TOKEN_REFRESHED'
    //   - User is created → event = 'USER_UPDATED'
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
      }
    );

    // 3. Cleanup: unsubscribe when the provider unmounts
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // ─── Auth Methods ───────────────────────────────────────────────

  async function signUp(email: string, password: string): Promise<SignUpResult> {
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      return { success: false, error: humanizeAuthError(error.message) };
    }

    // Supabase may require email confirmation depending on project settings.
    // If email confirmation is enabled, the user won't have a session yet.
    const needsConfirmation = data.session === null;
    return { success: true, needsConfirmation };
  }

  async function signIn(email: string, password: string): Promise<SignInResult> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return { success: false, error: humanizeAuthError(error.message) };
    }

    return { success: true };
  }

  async function signOut(): Promise<SignOutResult> {
    const { error } = await supabase.auth.signOut();

    if (error) {
      return { success: false, error: humanizeAuthError(error.message) };
    }

    return { success: true };
  }

  // Memoize the context value so consumers don't re-render unnecessarily
  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isLoading,
      signUp,
      signIn,
      signOut,
    }),
    [session, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ───────────────────────────────────────────────────────────

/**
 * Custom hook to access authentication state and methods.
 *
 * Usage:
 *   const { user, signIn, signOut } = useAuth();
 *
 * Must be called inside a component wrapped by AuthProvider.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (context === null) {
    throw new Error(
      'useAuth() must be used inside an <AuthProvider>. ' +
        'Wrap your app root layout with <AuthProvider>.'
    );
  }

  return context;
}

// ─── Error Helpers ──────────────────────────────────────────────────

/**
 * Converts Supabase error messages into user-friendly language.
 *
 * Supabase returns technical error messages like "Invalid login credentials".
 * This function maps them to friendlier messages for display in the UI.
 */
function humanizeAuthError(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes('invalid login credentials')) {
    return 'Incorrect email or password. Please try again.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Please check your email and click the confirmation link before signing in.';
  }
  if (lower.includes('user already registered')) {
    return 'An account with this email already exists. Try signing in instead.';
  }
  if (lower.includes('password') && lower.includes('at least')) {
    return 'Password must be at least 6 characters long.';
  }
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  if (lower.includes('network') || lower.includes('fetch')) {
    return 'Network error. Please check your connection and try again.';
  }

  // Fallback: return the original message (but never raw error objects)
  return message;
}
