import { useFonts } from "expo-font";
import { Redirect, Stack, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { T } from "@/components/theme";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ContentProvider } from "@/contexts/ContentContext";
import { QuestEngineProvider } from "@/contexts/QuestEngineContext";
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
      <ContentProvider>
        <QuestEngineProvider>
          <StreaksProvider>
            <SocialProvider>
              <AppLayout />
            </SocialProvider>
          </StreaksProvider>
        </QuestEngineProvider>
      </ContentProvider>
    </AuthProvider>
  );
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
        <Stack.Screen name="pack-library" options={{ presentation: "card" }} />
        <Stack.Screen name="plan/pick-quests" options={{ presentation: "card" }} />
        <Stack.Screen name="plan/save-pack" options={{ presentation: "card" }} />
        <Stack.Screen name="streak" options={{ presentation: "card" }} />
        <Stack.Screen name="party/[id]" options={{ presentation: "card" }} />
        <Stack.Screen name="notifications" options={{ presentation: "card" }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
