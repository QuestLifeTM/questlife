import { zodResolver } from "@hookform/resolvers/zod";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import {
  AuthInput,
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
import { getRememberedEmail } from "@/services/auth/rememberedEmail";
import { LoginForm, loginSchema } from "@/validation/authSchemas";

export default function LoginScreen() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const {
    control,
    formState: { errors, isValid },
    getValues,
    handleSubmit,
    setValue,
  } = useForm<LoginForm>({
    defaultValues: {
      email: "",
      password: "",
    },
    mode: "onChange",
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    let active = true;

    getRememberedEmail()
      .then((email) => {
        if (active && email && !getValues("email")) {
          setValue("email", email, { shouldValidate: true });
        }
      })
      .catch(() => {
        // The login form remains usable when device storage is unavailable.
      });

    return () => {
      active = false;
    };
  }, [getValues, setValue]);

  async function onSubmit(values: LoginForm) {
    try {
      setLoading(true);
      await signInWithEmail(values.email, values.password);
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

      Alert.alert("Sign in failed", "Invalid email or password.");
    } finally {
      setLoading(false);
    }
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

      <Text style={styles.footer}>
        {"Don't have an account? "}
        <Text style={styles.link} onPress={() => router.push("/(auth)/auth-options")}>
          Sign up
        </Text>
      </Text>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 14,
    marginBottom: 12,
  },
  forgotButton: {
    alignSelf: "center",
    marginBottom: 24,
  },
  forgotText: {
    color: T.blue,
    fontSize: 12,
    fontWeight: "800",
  },
  footer: {
    color: T.muted,
    fontSize: 13,
    marginTop: 24,
    textAlign: "center",
  },
  link: {
    color: T.blue,
    fontWeight: "900",
  },
});
