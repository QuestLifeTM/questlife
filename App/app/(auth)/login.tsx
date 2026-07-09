import { zodResolver } from "@hookform/resolvers/zod";
import { router } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import {
  AppleIcon,
  AuthInput,
  BackButton,
  Divider,
  GoogleIcon,
  OutlineButton,
  PasswordToggle,
  PrimaryButton,
} from "@/components/auth/AuthControls";
import { AuthTitle } from "@/components/auth/AuthText";
import { AuthScaffold } from "@/components/auth/AuthScaffold";
import { T } from "@/components/theme";
import {
  EmailNotVerifiedError,
  signInWithEmail,
} from "@/services/auth/authService";
import { getAuthErrorMessage } from "@/utils/authErrors";
import { LoginForm, loginSchema } from "@/validation/authSchemas";

export default function LoginScreen() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const {
    control,
    formState: { errors, isValid },
    handleSubmit,
  } = useForm<LoginForm>({
    defaultValues: {
      email: "",
      password: "",
    },
    mode: "onChange",
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(values: LoginForm) {
    try {
      setLoading(true);
      await signInWithEmail(values.email, values.password);
      router.replace("/(tabs)");
    } catch (error) {
      if (error instanceof EmailNotVerifiedError) {
        Alert.alert(
          "Email not confirmed",
          "Your account exists, but your email is not confirmed yet. We sent you a new confirmation link.",
          [
            {
              text: "OK",
              onPress: () =>
                router.replace({
                  pathname: "/(auth)/verify-email",
                  params: { email: error.email },
                }),
            },
          ],
        );
        return;
      }

      Alert.alert("Sign in failed", getAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  function showOAuthSetup() {
    Alert.alert(
      "Provider setup required",
      "Google and Apple sign in require provider credentials in Supabase before they can be enabled safely.",
    );
  }

  return (
    <AuthScaffold>
      <AuthTitle>{"Hey,\nWelcome\nBack"}</AuthTitle>

      <View style={styles.form}>
        <Controller
          control={control}
          name="email"
          render={({ field: { onBlur, onChange, value } }) => (
            <AuthInput
              autoComplete="email"
              error={errors.email?.message}
              icon="mail-outline"
              keyboardType="email-address"
              onBlur={onBlur}
              onChangeText={onChange}
              placeholder="Email id"
              textContentType="emailAddress"
              value={value}
            />
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field: { onBlur, onChange, value } }) => (
            <AuthInput
              autoComplete="password"
              error={errors.password?.message}
              icon="lock-closed-outline"
              onBlur={onBlur}
              onChangeText={onChange}
              placeholder="Password"
              rightElement={
                <PasswordToggle
                  visible={showPassword}
                  onPress={() => setShowPassword((current) => !current)}
                />
              }
              secureTextEntry={!showPassword}
              textContentType="password"
              value={value}
            />
          )}
        />
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/(auth)/forgot-password")}
        style={styles.forgotButton}
      >
        <Text style={styles.forgotText}>Forget password?</Text>
      </Pressable>

      <PrimaryButton
        disabled={!isValid || loading}
        loading={loading}
        onPress={handleSubmit(onSubmit)}
        title={loading ? "Signing in..." : "Sign In"}
      />

      <View style={styles.social}>
        <Divider />
        <OutlineButton title="Continue with Apple" onPress={showOAuthSetup}>
          <AppleIcon />
        </OutlineButton>
        <OutlineButton title="Continue with Google" onPress={showOAuthSetup}>
          <GoogleIcon />
        </OutlineButton>
      </View>

      <Text style={styles.footer}>
        {"Don't have an account? "}
        <Text style={styles.link} onPress={() => router.push("/(auth)/register")}>
          Sign up
        </Text>
      </Text>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 13,
    marginBottom: 12,
  },
  forgotButton: {
    alignSelf: "center",
    marginBottom: 24,
  },
  forgotText: {
    color: "rgba(255,255,255,0.44)",
    fontSize: 12,
    fontWeight: "600",
  },
  social: {
    gap: 14,
    marginBottom: 24,
    marginTop: 24,
  },
  footer: {
    color: T.muted,
    fontSize: 13,
    textAlign: "center",
  },
  link: {
    color: "rgba(255,255,255,0.78)",
    fontWeight: "800",
  },
});
