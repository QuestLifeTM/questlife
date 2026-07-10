import { Redirect, Stack, useGlobalSearchParams, usePathname, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ActivityIndicator, Platform, Text, View } from "react-native";

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
  const speedInsightsRoute = pathname.startsWith("/admin/quest/") ? "/admin/quest/[id]" : pathname;

  if (initializing) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24, backgroundColor: T.bg }}>
        <ActivityIndicator color={T.blue} />
        <Text style={{ color: T.muted, fontWeight: "800", textAlign: "center" }}>Loading QuestLife Admin...</Text>
      </View>
    );
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
      {Platform.OS === "web" ? <SpeedInsights route={speedInsightsRoute} /> : null}
    </GestureHandlerRootView>
  );
}
