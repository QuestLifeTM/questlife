import { zodResolver } from "@hookform/resolvers/zod";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Alert, Image, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";

import {
  AppleButton,
  AuthInput,
  Divider,
  GoogleIcon,
  OutlineButton,
  PasswordToggle,
  PrimaryButton,
} from "@/components/auth/AuthControls";
import { AuthScaffold } from "@/components/auth/AuthScaffold";
import { T, themedStyles } from "@/components/theme";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import {
  AccountAlreadyExistsError,
  EmailNotVerifiedError,
  openOAuth,
  registerWithEmail,
  resendSignupConfirmationLink,
} from "@/services/auth/authService";
import { clearOnboardingUsernameDraft, getOnboardingUsernameDraft } from "@/services/onboarding/username-draft";
import { AuthProviderName } from "@/types/auth";
import { getAuthErrorMessage } from "@/utils/authErrors";
import { RegisterForm, registerSchema } from "@/validation/authSchemas";

function pendingUsername() {
  return `quest_${Date.now().toString(36).slice(-10)}`;
}

const questLifeWordmark = require("@/assets/branding/questlife-wordmark.png");

/** The account handoff after personalization keeps every signup choice on one screen. */
export default function AuthOptionsScreen() {
  const { firstName } = useLocalSearchParams<{ firstName?: string }>();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthProvider, setOauthProvider] = useState<AuthProviderName | null>(null);
  const reduceMotion = useReducedMotionPreference();
  const {
    control,
    formState: { errors, isValid },
    handleSubmit,
    setValue,
  } = useForm<RegisterForm>({
    defaultValues: {
      confirmPassword: "",
      email: "",
      firstName: firstName?.trim() || "Adventurer",
      lastName: "QuestLife",
      password: "",
      username: pendingUsername(),
    },
    mode: "onChange",
    resolver: zodResolver(registerSchema),
  });
  const password = useWatch({ control, name: "password" });

  useEffect(() => {
    // The layout has one password control; mirror it into the existing schema's
    // confirmation field rather than adding a redundant visual field.
    setValue("confirmPassword", password, { shouldValidate: true });
  }, [password, setValue]);

  useEffect(() => {
    getOnboardingUsernameDraft()
      .then((username) => {
        if (username) setValue("username", username, { shouldValidate: true });
      })
      .catch(() => {
        // Registration remains available if draft storage is unavailable.
      });
  }, [setValue]);

  async function resendConfirmation(email: string) {
    try {
      setLoading(true);
      await resendSignupConfirmationLink(email);
      router.replace({ pathname: "/(auth)/verify-email", params: { email } });
    } catch (error) {
      Alert.alert("Confirmation failed", getAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function submitEmailRegistration(values: RegisterForm) {
    try {
      setLoading(true);
      const result = await registerWithEmail(values.email, values.username, values.firstName, values.lastName, values.password);
      await clearOnboardingUsernameDraft().catch(() => {
        // The account was created even if the local draft cannot be removed.
      });
      router.replace({ pathname: "/(auth)/verify-email", params: { email: result.email } });
    } catch (error) {
      if (error instanceof EmailNotVerifiedError) {
        Alert.alert(
          "Account not verified",
          "An account already exists with this email. We can send a new confirmation link.",
          [
            { text: "Send link", onPress: () => void resendConfirmation(error.email) },
            { style: "cancel", text: "Not now" },
          ],
        );
        return;
      }
      if (error instanceof AccountAlreadyExistsError) {
        Alert.alert("Account already exists", "Try logging in with this email address.", [
          { text: "Go to login", onPress: () => router.replace("/(auth)/login") },
          { style: "cancel", text: "Cancel" },
        ]);
        return;
      }
      Alert.alert("Sign up failed", getAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function continueWithProvider(provider: AuthProviderName) {
    try {
      setOauthProvider(provider);
      await openOAuth(provider);
    } catch {
      Alert.alert("Sign in unavailable", `We couldn't start ${provider === "apple" ? "Apple" : "Google"} sign in. Please try again.`);
    } finally {
      setOauthProvider(null);
    }
  }

  return (
    <AuthScaffold avoidKeyboard={false}>
      <View style={styles.intro}>
        <Image accessibilityLabel="QuestLife" resizeMode="contain" source={questLifeWordmark} style={styles.wordmark} />
        <Text style={styles.subtitle}>Create an account to keep your quests, memories, and items all in one place.</Text>
      </View>

      <Animated.View entering={FadeInUp.duration(reduceMotion ? 0 : 280)} style={styles.form}>
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
            <AuthInput
              autoComplete="new-password"
              error={errors.password?.message}
              icon="lock-closed-outline"
              onBlur={onBlur}
              onChangeText={onChange}
              placeholder="Password"
              rightElement={<PasswordToggle visible={showPassword} onPress={() => setShowPassword((current) => !current)} />}
              secureTextEntry={!showPassword}
              textContentType="newPassword"
              value={value}
            />
          )}
        />
      </Animated.View>

      <Animated.View entering={FadeInUp.duration(reduceMotion ? 0 : 280).delay(reduceMotion ? 0 : 70)}>
        <PrimaryButton
          disabled={!isValid || loading || Boolean(oauthProvider)}
          loading={loading}
          onPress={handleSubmit(submitEmailRegistration)}
          title={loading ? "Creating account..." : "Sign up"}
        />
      </Animated.View>

      <Animated.View entering={FadeInUp.duration(reduceMotion ? 0 : 280).delay(reduceMotion ? 0 : 140)} style={styles.socialDivider}>
        <Divider />
      </Animated.View>

      <Animated.View entering={FadeInUp.duration(reduceMotion ? 0 : 280).delay(reduceMotion ? 0 : 210)} style={styles.providers}>
        <AppleButton
          disabled={Boolean(oauthProvider) || loading}
          onPress={() => void continueWithProvider("apple")}
          title={oauthProvider === "apple" ? "Opening Apple..." : "Continue with Apple"}
        />
        <OutlineButton
          disabled={Boolean(oauthProvider) || loading}
          onPress={() => void continueWithProvider("google")}
          title={oauthProvider === "google" ? "Opening Google..." : "Continue with Google"}
        >
          <GoogleIcon />
        </OutlineButton>
      </Animated.View>

      <Animated.View entering={FadeInUp.duration(reduceMotion ? 0 : 280).delay(reduceMotion ? 0 : 280)}>
        <Text style={styles.loginPrompt}>
          Already have an account?{" "}
          <Text onPress={() => router.push("/(auth)/login")} style={styles.loginLink}>Log in</Text>
        </Text>
        <Text style={styles.legal}>
          By continuing, you agree to our <Text style={styles.legalLink}>Terms of Service</Text>{"\n"}and <Text style={styles.legalLink}>Privacy Policy</Text>.
        </Text>
      </Animated.View>
    </AuthScaffold>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  intro: { alignItems: "center", gap: 18, marginBottom: 28 },
  wordmark: { width: "100%", maxWidth: 280, height: 66 },
  subtitle: { color: T.muted, fontFamily: "Rubik", fontSize: 15, fontWeight: "700", lineHeight: 21, maxWidth: 300, textAlign: "center" },
  providers: { gap: 12, marginTop: 24 },
  form: { gap: 13, marginBottom: 22 },
  socialDivider: { marginTop: 24 },
  loginPrompt: { color: T.muted, fontFamily: "Rubik", fontSize: 13, fontWeight: "700", marginTop: 23, textAlign: "center" },
  loginLink: { color: T.blue, fontFamily: "RubikBold", fontWeight: "900", textDecorationLine: "underline" },
  legal: { color: T.muted, fontFamily: "Rubik", fontSize: 11, fontWeight: "500", lineHeight: 16, marginTop: 18, textAlign: "center" },
  legalLink: { color: T.muted, fontFamily: "RubikBold", textDecorationLine: "underline" },
}));
