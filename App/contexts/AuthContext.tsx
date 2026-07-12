import { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { isUserEmailVerified, signOut as signOutFromService } from "@/services/auth/authService";

type AuthContextValue = {
  initializing: boolean;
  isConfigured: boolean;
  isEmailVerified: boolean;
  signOut: () => Promise<void>;
  session: Session | null;
  user: User | null;
};

const AuthContext = createContext<AuthContextValue>({
  initializing: true,
  isConfigured: isSupabaseConfigured,
  isEmailVerified: false,
  signOut: async () => undefined,
  session: null,
  user: null,
});

export function AuthProvider({ children }: PropsWithChildren) {
  const [initializing, setInitializing] = useState(true);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let mounted = true;

    if (!isSupabaseConfigured) {
      setInitializing(false);
      return () => {
        mounted = false;
      };
    }

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (mounted) {
          setSession(data.session);
        }
      })
      .finally(() => {
        if (mounted) {
          setInitializing(false);
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      // Ignore late auth events after the provider unmounts during reloads.
      if (mounted) {
        setSession(nextSession);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      initializing,
      isConfigured: isSupabaseConfigured,
      isEmailVerified: session?.user
        ? isUserEmailVerified(session.user)
        : false,
      signOut: async () => {
        await signOutFromService();
        // Supabase emits SIGNED_OUT, but update synchronously as well so the
        // protected-route boundary and user-scoped providers clear immediately.
        setSession(null);
      },
      session,
      user: session?.user ?? null,
    }),
    [initializing, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
