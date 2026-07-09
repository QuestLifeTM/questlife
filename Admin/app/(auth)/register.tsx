import { zodResolver } from "@hookform/resolvers/zod";
import { router } from "expo-router";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Alert, StyleSheet, Text, View } from "react-native";

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
import { PasswordStrength } from "@/components/auth/PasswordStrength";
import { AuthScaffold } from "@/components/auth/AuthScaffold";
import { T } from "@/components/theme";
import {
  AccountAlreadyExistsError,
  registerWithEmail,
  resendSignupConfirmationLink,
} from "@/services/auth/authService";
import { getAuthErrorMessage } from "@/utils/authErrors";
import { RegisterForm, registerSchema } from "@/validation/authSchemas";

export default function RegisterScreen() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const {
    control,
    formState: { errors, isValid },
    handleSubmit,
  } = useForm<RegisterForm>({
    defaultValues: {
      confirmPassword: "",
      email: "",
      password: "",
    },
    mode: "onChange",
    resolver: zodResolver(registerSchema),
  });
  const password = useWatch({ control, name: "password" });

  async function onSubmit(values: RegisterForm) {
    try {
      setLoading(true);
      const result = await registerWithEmail(values.email, values.password);
      router.replace({
        pathname: "/(auth)/verify-email",
        params: { email: result.email },
      });
    } catch (error) {
      if (error instanceof AccountAlreadyExistsError) {
        Alert.alert(
          "Account already exists",
          "This email is already signed up. Log in if you confirmed it, or send a new confirmation email if you have not verified it yet.",
          [
            {
              text: "Log in",
              onPress: () => router.replace("/(auth)/login"),
            },
            {
              text: "Send confirmation",
              onPress: () => handleExistingAccountConfirmation(error.email),
            },
            {
              style: "cancel",
              text: "Cancel",
            },
          ],
        );
        return;
      }

      Alert.alert("Sign up failed", getAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handleExistingAccountConfirmation(email: string) {
    try {
      setLoading(true);
      await resendSignupConfirmationLink(email);
      router.replace({
        pathname: "/(auth)/verify-email",
        params: { email },
      });
    } catch (error) {
      Alert.alert("Confirmation failed", getAuthErrorMessage(error));
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
      <BackButton onPress={() => router.replace("/(auth)/login")} />
      <AuthTitle>{"Let's get\nStarted"}</AuthTitle>

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
            <View style={styles.passwordGroup}>
              <AuthInput
                autoComplete="new-password"
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
                textContentType="newPassword"
                value={value}
              />
              <PasswordStrength password={password} />
            </View>
          )}
        />
        <Controller
          control={control}
          name="confirmPassword"
          render={({ field: { onBlur, onChange, value } }) => (
            <AuthInput
              autoComplete="new-password"
              error={errors.confirmPassword?.message}
              icon="lock-closed-outline"
              onBlur={onBlur}
              onChangeText={onChange}
              placeholder="Confirm Password"
              rightElement={
                <PasswordToggle
                  visible={showConfirmPassword}
                  onPress={() => setShowConfirmPassword((current) => !current)}
                />
              }
              secureTextEntry={!showConfirmPassword}
              textContentType="newPassword"
              value={value}
            />
          )}
        />
      </View>

      <PrimaryButton
        disabled={!isValid || loading}
        loading={loading}
        onPress={handleSubmit(onSubmit)}
        title={loading ? "Creating account..." : "Sign up"}
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
        Already have an account?{" "}
        <Text style={styles.link} onPress={() => router.push("/(auth)/login")}>
          Login
        </Text>
      </Text>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 13,
    marginBottom: 22,
  },
  passwordGroup: {
    gap: 10,
  },
  social: {
    gap: 14,
    marginBottom: 24,
    marginTop: 22,
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
