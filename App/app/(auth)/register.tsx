import { zodResolver } from "@hookform/resolvers/zod";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Alert, StyleSheet, Text, View } from "react-native";

import {
  AuthInput,
  BackButton,
  PasswordToggle,
  PrimaryButton,
} from "@/components/auth/AuthControls";
import { AuthTitle } from "@/components/auth/AuthText";
import { PasswordStrength } from "@/components/auth/PasswordStrength";
import { AuthScaffold } from "@/components/auth/AuthScaffold";
import { T } from "@/components/theme";
import {
  AccountAlreadyExistsError,
  EmailNotVerifiedError,
  isUsernameAvailable,
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
    clearErrors,
    formState: { errors, isValid },
    handleSubmit,
    setError,
  } = useForm<RegisterForm>({
    defaultValues: {
      confirmPassword: "",
      email: "",
      password: "",
      username: "",
    },
    mode: "onChange",
    resolver: zodResolver(registerSchema),
  });
  const password = useWatch({ control, name: "password" });
  const username = useWatch({ control, name: "username" });

  useEffect(() => {
    const trimmed = username.trim();
    if (!/^[A-Za-z0-9_]{3,20}$/.test(trimmed)) return;

    let cancelled = false;
    const timeout = setTimeout(async () => {
      try {
        const available = await isUsernameAvailable(trimmed);
        if (cancelled) return;

        if (available) {
          clearErrors("username");
        } else {
          setError("username", {
            message: "That username is already taken.",
            type: "validate",
          });
        }
      } catch {
        if (!cancelled) {
          setError("username", {
            message: "Unable to check username right now.",
            type: "validate",
          });
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [clearErrors, setError, username]);

  async function onSubmit(values: RegisterForm) {
    try {
      setLoading(true);
      const result = await registerWithEmail(values.email, values.username, values.password);
      router.replace({
        pathname: "/(auth)/verify-email",
        params: { email: result.email },
      });
    } catch (error) {
      if (error instanceof EmailNotVerifiedError) {
        Alert.alert(
          "Account Not Verified",
          "You already created an account with this email address, but your email has not been verified.",
          [
            {
              text: "Verify Email",
              onPress: () => handleExistingAccountConfirmation(error.email),
            },
            {
              style: "cancel",
              text: "Back",
            },
          ],
        );
        return;
      }

      if (error instanceof AccountAlreadyExistsError) {
        Alert.alert(
          "Account Already Exists",
          "An account already exists for this email address.",
          [
            {
              text: "Go to Login",
              onPress: () => router.replace("/(auth)/login"),
            },
            {
              text: "Forgot Password",
              onPress: () => router.replace("/(auth)/forgot-password"),
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

  return (
    <AuthScaffold>
      <BackButton onPress={() => router.replace("/(auth)/auth-options")} />
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
          name="username"
          render={({ field: { onBlur, onChange, value } }) => (
            <AuthInput
              autoCapitalize="none"
              autoComplete="username"
              error={errors.username?.message}
              icon="person-outline"
              onBlur={onBlur}
              onChangeText={onChange}
              placeholder="Username"
              textContentType="username"
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
  footer: {
    color: T.muted,
    fontSize: 13,
    marginTop: 22,
    textAlign: "center",
  },
  link: {
    color: T.blue,
    fontWeight: "900",
  },
});
