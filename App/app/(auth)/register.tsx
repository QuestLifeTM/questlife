import { zodResolver } from "@hookform/resolvers/zod";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import {
  AuthInput,
  PasswordToggle,
} from "@/components/auth/AuthControls";
import { PasswordStrength } from "@/components/auth/PasswordStrength";
import { AuthScaffold } from "@/components/auth/AuthScaffold";
import { T } from "@/components/theme";
import {
  AccountAlreadyExistsError,
  EmailNotVerifiedError,
  registerWithEmail,
  resendSignupConfirmationLink,
} from "@/services/auth/authService";
import { getAuthErrorMessage } from "@/utils/authErrors";
import { RegisterForm, registerSchema } from "@/validation/authSchemas";
import { clearOnboardingUsernameDraft, getOnboardingUsernameDraft } from "@/services/onboarding/username-draft";
import { haptic, IconButton } from "@/components/ui";

function pendingUsername() {
  return `quest_${Date.now().toString(36).slice(-10)}`;
}

export default function RegisterScreen() {
  const { firstName: onboardingFirstName, fromOnboarding } = useLocalSearchParams<{
    firstName?: string;
    fromOnboarding?: string;
  }>();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const {
    control,
    formState: { errors, isValid },
    handleSubmit,
    setValue,
  } = useForm<RegisterForm>({
    defaultValues: {
      confirmPassword: "",
      email: "",
      firstName: onboardingFirstName?.trim() || "Adventurer",
      lastName: "QuestLife",
      password: "",
      username: pendingUsername(),
    },
    mode: "onChange",
    resolver: zodResolver(registerSchema),
  });
  const password = useWatch({ control, name: "password" });
  useEffect(() => {
    getOnboardingUsernameDraft().then((username) => {
      if (username) setValue("username", username, { shouldValidate: true });
    }).catch(() => {
      // The registration form remains usable if local draft storage is unavailable.
    });
  }, [setValue]);

  async function onSubmit(values: RegisterForm) {
    try {
      setLoading(true);
      const result = await registerWithEmail(values.email, values.username, values.firstName, values.lastName, values.password);
      await clearOnboardingUsernameDraft().catch(() => {
        // Cleanup is optional; the username has already been submitted to registration.
      });
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

  function handleBack() {
    if (fromOnboarding === "true") {
      router.replace({
        pathname: "/onboarding/personalizing",
        params: onboardingFirstName ? { firstName: onboardingFirstName } : {},
      });
      return;
    }

    router.replace("/(auth)/auth-options");
  }

  return (
    <AuthScaffold>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.brand}>QuestLife</Text>
          <Text style={styles.title}>Let's get started!</Text>
        </View>
        <IconButton icon="arrow-back" label="Back" onPress={handleBack} size={40} />
      </View>

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
              placeholder="Email"
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
              placeholder="Confirm your password"
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

      <AppButton
        disabled={!isValid || loading}
        loading={loading}
        onPress={handleSubmit(onSubmit)}
        title={loading ? "Creating account..." : "Create my account"}
      />

      <Text style={styles.footer}>
        Already have an account?{" "}
        <Text style={styles.link} onPress={() => router.push("/(auth)/login")}>
          Log in
        </Text>
      </Text>
      <Text style={styles.legal}>By continuing, you agree to our <Text style={styles.legalLink}>Terms of Service</Text> and <Text style={styles.legalLink}>Privacy Policy</Text>.</Text>
    </AuthScaffold>
  );
}

function AppButton({ disabled, loading, onPress, title }: { disabled: boolean; loading: boolean; onPress: () => void; title: string }) {
  return <Pressable
    accessibilityRole="button"
    accessibilityState={{ disabled }}
    disabled={disabled}
    onPress={() => { haptic(); onPress(); }}
    style={({ pressed }) => [styles.submitButton, disabled && styles.submitButtonDisabled, pressed && !disabled && styles.submitButtonPressed]}
  ><Text style={[styles.submitButtonLabel, disabled && styles.submitButtonLabelDisabled]}>{title}</Text></Pressable>;
}

const styles = StyleSheet.create({
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 16,
    marginBottom: 30,
  },
  headerCopy: {
    flex: 1,
    gap: 10,
  },
  brand: {
    color: T.blue,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  title: {
    color: T.dark,
    fontSize: 36,
    lineHeight: 41,
    fontWeight: "900",
    letterSpacing: 0,
  },
  form: {
    gap: 13,
    marginBottom: 22,
  },
  passwordGroup: {
    gap: 10,
  },
  submitButton: { minHeight: 54, borderRadius: 20, borderBottomWidth: 5, borderBottomColor: "#258fd8", backgroundColor: T.blue, alignItems: "center", justifyContent: "center" },
  submitButtonDisabled: { borderBottomColor: "#d7cec2", backgroundColor: T.border },
  submitButtonPressed: { borderBottomWidth: 2, transform: [{ translateY: 3 }] },
  submitButtonLabel: { color: T.white, fontFamily: "RubikBold", fontSize: 16, lineHeight: 20 },
  submitButtonLabelDisabled: { color: T.muted },
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
  legal: { marginTop: 12, color: T.muted, fontFamily: "Rubik", fontSize: 11, lineHeight: 15, fontWeight: "500", textAlign: "center" },
  legalLink: { color: T.muted, fontFamily: "RubikBold", textDecorationLine: "underline" },
});
