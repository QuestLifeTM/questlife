import { useFonts } from "expo-font";
import { Redirect, Stack, useSegments } from "expo-router";
import { PropsWithChildren } from "react";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { T } from "@/components/theme";
import { GlobalAnnouncement } from "@/components/global-announcement";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ContentProvider } from "@/contexts/ContentContext";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import { QuestEngineProvider } from "@/contexts/QuestEngineContext";
import { QuestSaveProvider } from "@/contexts/QuestSaveContext";
import { SocialProvider } from "@/contexts/SocialContext";
import { StreaksProvider } from "@/contexts/StreaksContext";

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    GeistPixel: require("../assets/fonts/GeistPixel-Regular-Variable.ttf"),
    Rubik: require("../assets/fonts/Rubik-Regular.ttf"),
    RubikBold: require("../assets/fonts/Rubik-Bold.ttf"),
    RubikBlack: require("../assets/fonts/Rubik-Black.ttf"),
    "NunitoSans12pt-SemiBold": require("../assets/fonts/NunitoSans12pt-SemiBold.ttf"),
    "NunitoSans12pt-ExtraBold": require("../assets/fonts/NunitoSans12pt-ExtraBold.ttf")
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <AuthProvider>
      <SessionDataProviders>
        <AppLayout />
      </SessionDataProviders>
    </AuthProvider>
  );
}

function SessionDataProviders({ children }: PropsWithChildren) {
  const { session } = useAuth();

  // User-scoped providers hold loaded data in memory. Remount them when the
  // account changes so a signed-out user (or the next user) never sees stale
  // data while the new session is loading.
  return <ContentProvider key={session?.user.id ?? "signed-out"}>
    <QuestEngineProvider>
      <StreaksProvider>
        <SocialProvider>
          <NotificationsProvider>
            <QuestSaveProvider>{children}</QuestSaveProvider>
          </NotificationsProvider>
        </SocialProvider>
      </StreaksProvider>
    </QuestEngineProvider>
    <GlobalAnnouncement />
  </ContentProvider>;
}

function AppLayout() {
  const segments = useSegments();
  const { initializing, isEmailVerified, session, user } = useAuth();
  const firstSegment = segments[0];
  const isOnboardingRoute = !firstSegment || firstSegment === "index";
  const isAuthRoute = firstSegment === "(auth)";
  const isCallbackRoute = firstSegment === "auth";
  const isResetRoute = firstSegment === "reset-password";

  if (initializing) {
    return null;
  }

  if (!session && !isOnboardingRoute && !isAuthRoute && !isCallbackRoute && !isResetRoute) {
    return <Redirect href="/(auth)/login" />;
  }

  if (session && !isEmailVerified && !isAuthRoute && !isCallbackRoute && !isResetRoute) {
    return (
      <Redirect
        href={{
          pathname: "/(auth)/verify-email",
          params: { email: user?.email ?? "" }
        }}
      />
    );
  }

  if (session && isEmailVerified && (isOnboardingRoute || isAuthRoute)) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: T.bg }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: T.bg } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth/callback" />
        <Stack.Screen name="reset-password" />
        <Stack.Screen name="quest/[id]" options={{ presentation: "card" }} />
        <Stack.Screen name="memory/[completionId]" options={{ presentation: "card" }} />
        <Stack.Screen name="adventure-pack/[id]" options={{ presentation: "card" }} />
        <Stack.Screen name="collection/[id]" options={{ presentation: "card" }} />
        <Stack.Screen name="create-collection" options={{ presentation: "card" }} />
        <Stack.Screen name="saved" options={{ presentation: "card" }} />
        <Stack.Screen name="quest-collections" options={{ presentation: "card" }} />
        <Stack.Screen name="manage-saved" options={{ presentation: "card" }} />
        <Stack.Screen name="pack-library" options={{ presentation: "card" }} />
        <Stack.Screen name="plan/pick-quests" options={{ presentation: "card" }} />
        <Stack.Screen name="plan/save-pack" options={{ presentation: "card" }} />
        <Stack.Screen name="streak" options={{ presentation: "card" }} />
        <Stack.Screen name="party/[id]" options={{ presentation: "card" }} />
        <Stack.Screen name="notifications" options={{ presentation: "card" }} />
        <Stack.Screen name="add-friends" options={{ presentation: "card" }} />
        <Stack.Screen name="add-friend/[userId]" options={{ presentation: "card" }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
