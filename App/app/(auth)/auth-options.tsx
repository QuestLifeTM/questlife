import { zodResolver } from "@hookform/resolvers/zod";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Alert, StyleSheet, Text, View } from "react-native";
import { z } from "zod";

import { AppleIcon, AuthInput, BackButton, Divider, GoogleIcon, OutlineButton, PrimaryButton } from "@/components/auth/AuthControls";
import { AuthScaffold } from "@/components/auth/AuthScaffold";
import { AuthTitle } from "@/components/auth/AuthText";
import { T } from "@/components/theme";
import { openOAuth } from "@/services/auth/authService";
import { getAuthErrorMessage } from "@/utils/authErrors";
import { emailSchema } from "@/validation/authSchemas";

const signUpEmailSchema = z.object({ email: emailSchema });
type SignUpEmailForm = z.infer<typeof signUpEmailSchema>;

export default function AuthOptionsScreen() {
  const { email, firstName } = useLocalSearchParams<{ email?: string; firstName?: string }>();
  const [provider, setProvider] = useState<"apple" | "google" | null>(null);
  const { control, formState: { errors, isValid }, handleSubmit } = useForm<SignUpEmailForm>({
    defaultValues: { email: typeof email === "string" ? email : "" },
    mode: "onChange",
    resolver: zodResolver(signUpEmailSchema),
  });

  async function continueWithEmail({ email: submittedEmail }: SignUpEmailForm) {
    router.push({ pathname: "/(auth)/register", params: { email: submittedEmail, ...(firstName ? { firstName } : {}) } });
  }

  async function continueWithProvider(nextProvider: "apple" | "google") {
    try {
      setProvider(nextProvider);
      await openOAuth(nextProvider);
    } catch (error) {
      Alert.alert("Sign in unavailable", getAuthErrorMessage(error));
    } finally {
      setProvider(null);
    }
  }

  return (
    <AuthScaffold>
      <BackButton onPress={() => router.replace({ pathname: "/onboarding/understanding", params: firstName ? { firstName } : {} })} />
      <AuthTitle subtitle="Enter your email address to get started.">{"Let's save your\nadventure."}</AuthTitle>

      <View style={styles.actions}>
        <Controller control={control} name="email" render={({ field: { onBlur, onChange, value } }) => (
          <AuthInput autoCapitalize="none" autoComplete="email" error={errors.email?.message} keyboardType="email-address" onBlur={onBlur} onChangeText={onChange} placeholder="you@example.com" textContentType="emailAddress" value={value} />
        )} />
        <PrimaryButton disabled={!isValid} onPress={handleSubmit(continueWithEmail)} title="Continue with Email" />
        <Divider />
        <OutlineButton disabled={provider !== null} onPress={() => void continueWithProvider("google")} title={provider === "google" ? "Opening Google…" : "Continue with Google"}><GoogleIcon /></OutlineButton>
        <OutlineButton disabled={provider !== null} onPress={() => void continueWithProvider("apple")} title={provider === "apple" ? "Opening Apple…" : "Continue with Apple"}><AppleIcon /></OutlineButton>
      </View>

      <Text style={styles.footer}>Already have an account? <Text style={styles.link} onPress={() => router.replace("/(auth)/login")}>Sign in</Text></Text>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  actions: { gap: 14 },
  footer: { color: T.muted, fontSize: 13, marginTop: 26, textAlign: "center" },
  link: { color: T.blue, fontWeight: "900" },
});
