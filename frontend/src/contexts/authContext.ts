import { createContext } from 'react';

import type { AuthUser } from '../services/authService';

export type AuthSession = {
  token: string;
  user: AuthUser;
};

export type AuthContextValue = {
  session: AuthSession | null;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
