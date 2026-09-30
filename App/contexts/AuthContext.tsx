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
import { rememberEmail } from "@/services/auth/rememberedEmail";
import { stopQuestLocationTracking } from "@/services/active-quest/tracking";
import { createEncryptedLogoutOutbox, discardEncryptedLogoutOutbox, restoreEncryptedLogoutOutbox } from "@/services/local-data/outbox";
import { clearLocalUserData, clearLifecycleRecord, clearSharedDeviceAccountHints, getLifecycleRecord, removeLegacyUnscopedData, writeLifecycleRecord } from "@/services/local-data/lifecycle";
import { blockLocalDataWrites, setLocalDataOwner } from "@/services/local-data/owner";

type AuthContextValue = {
  initializing: boolean;
  isConfigured: boolean;
  isEmailVerified: boolean;
  profileNameVersion: number;
  refreshProfileName: () => void;
  signOut: (options?: { accountDeleted?: boolean }) => Promise<void>;
  session: Session | null;
  user: User | null;
};

const AuthContext = createContext<AuthContextValue>({
  initializing: true,
  isConfigured: isSupabaseConfigured,
  isEmailVerified: false,
  profileNameVersion: 0,
  refreshProfileName: () => undefined,
  signOut: async () => undefined,
  session: null,
  user: null,
});

export function AuthProvider({ children }: PropsWithChildren) {
  const [initializing, setInitializing] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profileNameVersion, setProfileNameVersion] = useState(0);

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
      .then(async ({ data }) => {
        await removeLegacyUnscopedData().catch(() => undefined);
        const lifecycle = await getLifecycleRecord().catch(() => null);
        if (lifecycle && lifecycle.phase !== "signedOut") {
          // A prior logout was interrupted. Do not hydrate any authenticated
          // state (even for the same user) until its privacy boundary has
          // been completed. An encrypted outbox is the sole exception.
          blockLocalDataWrites(lifecycle.userId);
          await stopQuestLocationTracking().catch(() => undefined);
          await clearLocalUserData(lifecycle.userId, {
            preserveOutbox: lifecycle.phase === "outboxed",
          }).catch(() => undefined);
          await clearSharedDeviceAccountHints().catch(() => undefined);
          await signOutFromService().catch(() => undefined);
          await clearLifecycleRecord().catch(() => undefined);
          setLocalDataOwner(null);
          if (mounted) setSession(null);
          return;
        }
        if (lifecycle?.phase === "signedOut") await clearLifecycleRecord().catch(() => undefined);
        setLocalDataOwner(data.session?.user.id ?? null);
        if (mounted) {
          setSession(data.session);
        }

        if (data.session?.user.email) {
          await rememberEmail(data.session.user.email).catch(() => {
            // A secure-storage failure must not block restoration of a valid session.
          });
        }
        if (data.session?.user.id) {
          const restored = await restoreEncryptedLogoutOutbox(data.session.user.id).catch(() => false);
          if (restored) {
            try {
              const { getAllActiveQuestSnapshots } = await import("@/services/active-quest/local-store");
              const { syncActiveQuestRecord } = await import("@/services/active-quest/sync");
              const snapshots = await getAllActiveQuestSnapshots();
              await Promise.all(snapshots.filter((snapshot): snapshot is NonNullable<typeof snapshot> => Boolean(snapshot)).map((snapshot) => syncActiveQuestRecord(snapshot.session.sessionId)));
              await discardEncryptedLogoutOutbox(data.session.user.id);
            } catch {
              // Keep the encrypted outbox for a later authenticated retry.
            }
          }
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
      setLocalDataOwner(nextSession?.user.id ?? null);

      if (nextSession?.user.email) {
        rememberEmail(nextSession.user.email).catch(() => {
          // Remembering an email is optional and must never interrupt auth.
        });
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
      profileNameVersion,
      refreshProfileName: () => setProfileNameVersion((version) => version + 1),
      signOut: async (options: { accountDeleted?: boolean } = {}) => {
        const userId = session?.user.id;
        if (!userId) {
          await signOutFromService();
          setSession(null);
          return;
        }
        // Once logout begins, no route point can be retained. The lifecycle
        // journal lets startup finish safely if the process is interrupted.
        blockLocalDataWrites(userId);
        await writeLifecycleRecord({ userId, phase: "gated", startedAt: new Date().toISOString() }).catch(() => undefined);
        await stopQuestLocationTracking().catch(() => undefined);
        let synchronized = false;
        try {
          const { pauseAndFlushCurrentUsersActiveQuest } = await import("@/services/active-quest/sync");
          await pauseAndFlushCurrentUsersActiveQuest();
          await writeLifecycleRecord({ userId, phase: "checkpointed", startedAt: new Date().toISOString() }).catch(() => undefined);
          synchronized = true;
        } catch {
          // Preserve only encrypted, owner-bound recovery data for offline use.
          if (!options.accountDeleted) {
            await createEncryptedLogoutOutbox(userId).catch(() => undefined);
            await writeLifecycleRecord({ userId, phase: "outboxed", startedAt: new Date().toISOString() }).catch(() => undefined);
          }
        }
        await clearLocalUserData(userId, { preserveOutbox: !synchronized && !options.accountDeleted }).catch(() => undefined);
        await clearSharedDeviceAccountHints().catch(() => undefined);
        await writeLifecycleRecord({ userId, phase: "cleared", startedAt: new Date().toISOString() }).catch(() => undefined);
        // A local-scope signout does not need the network. If the underlying
        // auth client reports a transient error, preserve the local privacy
        // boundary and let its persisted session be reconciled at launch.
        await signOutFromService().catch(() => undefined);
        await writeLifecycleRecord({ userId, phase: "signedOut", startedAt: new Date().toISOString() }).catch(() => undefined);
        await clearLifecycleRecord().catch(() => undefined);
        // Supabase emits SIGNED_OUT, but update synchronously as well so the
        // protected-route boundary and user-scoped providers clear immediately.
        setSession(null);
        setLocalDataOwner(null);
      },
      session,
      user: session?.user ?? null,
    }),
    [initializing, profileNameVersion, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
