import { Session, User } from "@supabase/supabase-js";
import { SplashScreen } from "expo-router";
import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { isUserEmailVerified } from "@/services/auth/authService";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

type AuthContextValue = {
  initializing: boolean;
  isConfigured: boolean;
  isEmailVerified: boolean;
  session: Session | null;
  user: User | null;
};

const AuthContext = createContext<AuthContextValue>({
  initializing: true,
  isConfigured: isSupabaseConfigured,
  isEmailVerified: false,
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
      SplashScreen.hideAsync().catch(() => undefined);
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
          SplashScreen.hideAsync().catch(() => undefined);
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

  useEffect(() => {
    if (!session?.user) return;

    let cancelled = false;

    async function checkAdminAccount() {
      const { data, error } = await supabase
        .from("admin_memberships")
        .select("is_active, deleted_at")
        .eq("user_id", session?.user.id)
        .maybeSingle<{ is_active: boolean | null; deleted_at: string | null }>();

      if (cancelled || error) return;
      if (!data || data.is_active === false || data.deleted_at) {
        await supabase.auth.signOut().catch(() => undefined);
      }
    }

    checkAdminAccount();
    const interval = setInterval(checkAdminAccount, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [session?.user.id]);

  const value = useMemo(
    () => ({
      initializing,
      isConfigured: isSupabaseConfigured,
      isEmailVerified: session?.user
        ? isUserEmailVerified(session.user)
        : false,
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
