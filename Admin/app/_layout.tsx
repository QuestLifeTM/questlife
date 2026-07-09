import { Redirect, Stack, useGlobalSearchParams, usePathname, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { T } from "@/components/theme";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ContentProvider } from "@/contexts/ContentContext";

export default function RootLayout() {
  return (
    <AuthProvider>
      <ContentProvider>
        <AdminAppLayout />
      </ContentProvider>
    </AuthProvider>
  );
}

function AdminAppLayout() {
  const { next } = useGlobalSearchParams<{ next?: string }>();
  const pathname = usePathname();
  const segments = useSegments();
  const { initializing, isEmailVerified, session, user } = useAuth();
  const firstSegment = segments[0];
  const isAuthRoute = firstSegment === "(auth)";
  const isCallbackRoute = firstSegment === "auth";

  if (initializing) {
    return null;
  }

  if (!session && !isAuthRoute && !isCallbackRoute) {
    return (
      <Redirect
        href={{
          pathname: "/(auth)/login",
          params: { next: pathname },
        }}
      />
    );
  }

  if (session && !isEmailVerified && !isAuthRoute && !isCallbackRoute) {
    return (
      <Redirect
        href={{
          pathname: "/(auth)/verify-email",
          params: { email: user?.email ?? "" },
        }}
      />
    );
  }

  if (session && isEmailVerified && isAuthRoute) {
    return <Redirect href={typeof next === "string" && next.startsWith("/admin") ? next : "/admin/quests"} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: T.bg }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: T.bg } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="auth/callback" />
        <Stack.Screen name="admin" />
      </Stack>
    </GestureHandlerRootView>
  );
}
