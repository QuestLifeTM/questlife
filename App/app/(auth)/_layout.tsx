import { Redirect, Stack } from "expo-router";

import { useAuth } from "@/contexts/AuthContext";

export default function AuthLayout() {
  const { initializing, isEmailVerified, session } = useAuth();

  if (initializing) {
    return null;
  }

  if (session && isEmailVerified) {
    return <Redirect href="/(tabs)" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
