import { router } from "expo-router";
import { Alert, StyleSheet, Text, View } from "react-native";

import {
  AppleIcon,
  GoogleIcon,
  OutlineButton,
  PrimaryButton,
} from "@/components/auth/AuthControls";
import { AuthScaffold } from "@/components/auth/AuthScaffold";
import { AuthTitle } from "@/components/auth/AuthText";
import { T } from "@/components/theme";

export default function AuthOptionsScreen() {
  function showOAuthSetup() {
    Alert.alert(
      "Provider setup required",
      "Google and Apple sign in require provider credentials in Supabase before they can be enabled safely.",
    );
  }

  return (
    <AuthScaffold>
      <AuthTitle
        subtitle="Choose the sign-up method you want to use for your quests, memories, and streaks."
      >
        {"Start your\nQuestLife"}
      </AuthTitle>

      <View style={styles.actions}>
        <PrimaryButton
          onPress={() => router.push("/(auth)/register")}
          title="Continue with Email"
        />
        <OutlineButton title="Continue with Apple" onPress={showOAuthSetup}>
          <AppleIcon />
        </OutlineButton>
        <OutlineButton title="Continue with Google" onPress={showOAuthSetup}>
          <GoogleIcon />
        </OutlineButton>
      </View>

      <Text style={styles.footer}>
        Already have an account?{" "}
        <Text style={styles.link} onPress={() => router.push("/(auth)/login")}>
          Sign in
        </Text>
      </Text>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 14,
  },
  footer: {
    color: T.muted,
    fontSize: 13,
    marginTop: 26,
    textAlign: "center",
  },
  link: {
    color: T.blue,
    fontWeight: "900",
  },
});
