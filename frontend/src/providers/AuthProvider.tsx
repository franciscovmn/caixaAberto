import { useState, type ReactNode } from 'react';

import { AuthContext, type AuthSession } from '../contexts/authContext';
import { loginRequest, logoutRequest } from '../services/authService';

const storageKey = 'caixaAbertoSessao';

function readStoredSession(): AuthSession | null {
  const storedValue = localStorage.getItem(storageKey);

  if (!storedValue) {
    return null;
  }

  try {
    const session = JSON.parse(storedValue) as Partial<AuthSession>;

    if (
      typeof session.token !== 'string' ||
      typeof session.user !== 'object' ||
      session.user === null
    ) {
      localStorage.removeItem(storageKey);
      return null;
    }

    return session as AuthSession;
  } catch {
    localStorage.removeItem(storageKey);
    return null;
  }
}

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<AuthSession | null>(readStoredSession);

  async function signIn(email: string, password: string) {
    const result = await loginRequest(email, password);

    const newSession: AuthSession = {
      token: result.token,
      user: result.user,
    };

    localStorage.setItem(storageKey, JSON.stringify(newSession));
    setSession(newSession);
  }

  async function signOut() {
    const token = session?.token;

    try {
      if (token) {
        await logoutRequest(token);
      }
    } finally {
      localStorage.removeItem(storageKey);
      setSession(null);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        isAuthenticated: Boolean(session?.token),
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
