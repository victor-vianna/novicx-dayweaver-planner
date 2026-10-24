import { createContext } from "react";

import type { MockSession } from "@/services/auth";
import type { Role } from "@/types/domain";

export type AuthStatus = "loading" | "signed_out" | "signed_in";

export interface AuthContextValue {
  status: AuthStatus;
  session: MockSession | null;
  previewClientId: string | null;
  signIn: (email: string, password: string) => Promise<MockSession>;
  signInAsDemo: (role: Role) => Promise<MockSession>;
  signOut: () => void;
  startPreview: (clientId: string) => void;
  stopPreview: () => void;
  requestPasswordReset: (email: string) => Promise<void>;
  /** True after opening a password-recovery link (Supabase mode only). */
  passwordRecovery: boolean;
  completePasswordReset: (password: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
