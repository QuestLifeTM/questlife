import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { BackButton, PrimaryButton } from "@/components/auth/AuthControls";
import { AuthTitle } from "@/components/auth/AuthText";
import { AuthScaffold } from "@/components/auth/AuthScaffold";
import { T } from "@/components/theme";
import { resendSignupConfirmationLink } from "@/services/auth/authService";
import { getAuthErrorMessage } from "@/utils/authErrors";

const RESEND_SECONDS = 60;

export default function VerifyEmailScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const email = useMemo(() => String(params.email ?? ""), [params.email]);
  const [resending, setResending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (secondsLeft <= 0) {
      return;
    }

    const timeout = setTimeout(() => {
      setSecondsLeft((current) => current - 1);
    }, 1000);

    return () => clearTimeout(timeout);
  }, [secondsLeft]);

  async function handleResend() {
    try {
      setResending(true);
      await resendSignupConfirmationLink(email);
      setSecondsLeft(RESEND_SECONDS);
      Alert.alert(
        "Confirmation email sent",
        "Open the confirmation link on this device to finish signing up.",
      );
    } catch (error) {
      Alert.alert("Resend failed", getAuthErrorMessage(error));
    } finally {
      setResending(false);
    }
  }

  if (!email) {
    return (
      <AuthScaffold>
        <BackButton onPress={() => router.replace("/(auth)/register")} />
        <AuthTitle subtitle="Please register again to request a new confirmation email.">
          {"Missing\nEmail"}
        </AuthTitle>
        <PrimaryButton
          onPress={() => router.replace("/(auth)/register")}
          title="Back to sign up"
        />
      </AuthScaffold>
    );
  }

  return (
    <AuthScaffold>
      <BackButton onPress={() => router.replace("/(auth)/register")} />
      <AuthTitle subtitle={`Open the confirmation link sent to\n${email}`}>
        {"Verify\nEmail"}
      </AuthTitle>

      <View style={styles.form}>
        <Text style={styles.instructions}>
          Tap the confirmation link in your email. QuestLife will open
          automatically and finish verification.
        </Text>
      </View>

      <PrimaryButton
        onPress={() => router.replace("/(auth)/login")}
        title="Back to login"
      />

      <Pressable
        accessibilityRole="button"
        disabled={secondsLeft > 0 || resending}
        onPress={handleResend}
        style={styles.resend}
      >
        <Text
          style={[
            styles.resendText,
            secondsLeft > 0 || resending ? styles.resendDisabled : null,
          ]}
        >
          {resending
            ? "Sending..."
            : secondsLeft > 0
              ? `Resend email in ${secondsLeft}s`
              : "Resend confirmation email"}
        </Text>
      </Pressable>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 10,
    marginBottom: 26,
  },
  instructions: {
    color: T.muted,
    fontSize: 13,
    lineHeight: 21,
    paddingHorizontal: 4,
    textAlign: "center",
  },
  resend: {
    alignSelf: "center",
    marginTop: 20,
  },
  resendText: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 13,
    fontWeight: "800",
  },
  resendDisabled: {
    color: T.muted,
  },
});
