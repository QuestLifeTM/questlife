import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Animated, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";

import {
  AccountAlreadyExistsError,
  createAdminPassword,
  EmailNotVerifiedError,
  getAdminLoginState,
  signInWithEmail,
} from "@/services/auth/authService";
import { getAuthErrorMessage } from "@/utils/authErrors";

const C = {
  bg: "#050608",
  card: "#1b1e27",
  cardAlt: "#151922",
  border: "#272b36",
  blue: "#2563eb",
  blueSoft: "#14213f",
  text: "#f8fafc",
  muted: "#a1a1aa",
  faint: "#71717a",
  green: "#22c55e",
  red: "#ef4444",
};

type LoginStep = "email" | "password" | "create_password";

function Logo() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View style={{ width: 44, height: 44, borderRadius: 9, backgroundColor: C.blue, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="flash" size={23} color="#ffffff" />
      </View>
      <View>
        <Text style={{ color: C.text, fontSize: 25, fontWeight: "900" }}>QuestLife</Text>
        <Text style={{ color: C.faint, fontSize: 12, fontWeight: "900", letterSpacing: 1.8 }}>ADMIN TOOLS</Text>
      </View>
    </View>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <View style={{ flex: 1, minWidth: 150, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, padding: 18, gap: 14 }}>
      <View style={{ width: 38, height: 38, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: `${tone}18` }}>
        <Ionicons name="analytics-outline" size={19} color={tone} />
      </View>
      <View>
        <Text style={{ color: C.muted, fontSize: 12, fontWeight: "900", letterSpacing: 1.4, textTransform: "uppercase" }}>{label}</Text>
        <Text style={{ color: C.text, fontSize: 28, fontWeight: "900", marginTop: 6 }}>{value}</Text>
      </View>
    </View>
  );
}

function LoginField({
  error,
  icon,
  onBlur,
  onChangeText,
  placeholder,
  right,
  secureTextEntry,
  value,
}: {
  error?: string;
  icon: keyof typeof Ionicons.glyphMap;
  onBlur: () => void;
  onChangeText: (value: string) => void;
  placeholder: string;
  right?: React.ReactNode;
  secureTextEntry?: boolean;
  value: string;
}) {
  return (
    <View style={{ gap: 7 }}>
      <View style={{ minHeight: 50, borderRadius: 8, borderWidth: 1, borderColor: error ? C.red : C.border, backgroundColor: C.cardAlt, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14 }}>
        <Ionicons name={icon} size={19} color={C.faint} />
        <TextInput
          autoCapitalize="none"
          onBlur={onBlur}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={C.faint}
          secureTextEntry={secureTextEntry}
          value={value}
          style={{ flex: 1, color: C.text, fontSize: 15, fontWeight: "700", height: 48 }}
        />
        {right}
      </View>
      {error ? <Text style={{ color: C.red, fontSize: 12, fontWeight: "800" }}>{error}</Text> : null}
    </View>
  );
}

export default function LoginScreen() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  const { width } = useWindowDimensions();
  const wide = width >= 980;
  const compact = width < 560;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [step, setStep] = useState<LoginStep>("email");
  const [stepMessage, setStepMessage] = useState("Enter your admin email first. If you were invited, you will create your password next.");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;
  const normalizedEmail = email.trim().toLowerCase();
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
  const passwordValid = password.length > 0;
  const createPasswordValid =
    password.length >= 8 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    password === confirmPassword;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, damping: 18, stiffness: 180, useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY]);

  async function handleEmailContinue() {
    if (!emailValid) return;

    try {
      setLoading(true);
      const state = await getAdminLoginState(normalizedEmail);

      if (!state.allowed) {
        setStepMessage(state.message ?? "This email does not have admin access yet.");
        return;
      }

      setPassword("");
      setConfirmPassword("");
      setStep(state.firstTime ? "create_password" : "password");
      setStepMessage(state.message ?? (state.firstTime ? "Create your admin password." : "Enter your admin password."));
    } catch (error) {
      Alert.alert("Unable to check admin access", getAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordLogin() {
    try {
      setLoading(true);
      await signInWithEmail(normalizedEmail, password);
      router.replace(typeof next === "string" && next.startsWith("/admin") ? next : "/admin/published");
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

  async function handleCreatePassword() {
    try {
      setLoading(true);
      const result = await createAdminPassword(normalizedEmail, password);

      if (result.needsVerification) {
        router.replace({
          pathname: "/(auth)/verify-email",
          params: { email: result.email },
        });
        return;
      }

      router.replace(typeof next === "string" && next.startsWith("/admin") ? next : "/admin/published");
    } catch (error) {
      if (error instanceof AccountAlreadyExistsError) {
        setStep("password");
        setStepMessage("That admin account already exists. Sign in with the password for this email.");
        setPassword("");
        setConfirmPassword("");
        return;
      }

      Alert.alert("Unable to create password", getAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  function resetEmailStep() {
    setStep("email");
    setPassword("");
    setConfirmPassword("");
    setStepMessage("Enter your admin email first. If you were invited, you will create your password next.");
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: wide ? 28 : compact ? 14 : 18 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Animated.View style={{ flex: 1, opacity, transform: [{ translateY }] }}>
          <View style={{ flex: 1, flexDirection: wide ? "row" : "column-reverse", gap: compact ? 14 : 24 }}>
          <View style={{ flex: wide ? 1.15 : undefined, borderRadius: 16, borderWidth: 1, borderColor: C.border, backgroundColor: "#0f121a", padding: wide ? 34 : compact ? 18 : 22, gap: compact ? 20 : 28, overflow: "hidden" }}>
            <Logo />
            <View style={{ gap: 10, maxWidth: 680 }}>
              <Text style={{ color: C.text, fontSize: wide ? 48 : compact ? 30 : 36, lineHeight: wide ? 54 : compact ? 36 : 42, fontWeight: "900" }}>Content operations, without touching the app build.</Text>
              <Text style={{ color: C.muted, fontSize: compact ? 15 : 17, lineHeight: compact ? 22 : 25, fontWeight: "600" }}>
                Sign in to create drafts, review quests, and publish live QuestLife content from the private admin dashboard.
              </Text>
            </View>
            {!compact ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
              <Metric label="Published" value="Live" tone={C.blue} />
              <Metric label="Review Queue" value="Gated" tone="#a5b4fc" />
              <Metric label="Drafts" value="Private" tone={C.green} />
            </View> : null}
            {!compact ? <View style={{ flex: 1, minHeight: 220, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, padding: 22, justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 16 }}>
                <View>
                  <Text style={{ color: C.text, fontSize: 20, fontWeight: "900" }}>Publication Flow</Text>
                  <Text style={{ color: C.muted, marginTop: 5, fontWeight: "700" }}>Drafts move through review before going live.</Text>
                </View>
                <View style={{ borderRadius: 999, backgroundColor: C.blueSoft, paddingHorizontal: 12, paddingVertical: 7 }}>
                  <Text style={{ color: "#bfdbfe", fontSize: 12, fontWeight: "900" }}>SECURE</Text>
                </View>
              </View>
              <View style={{ gap: 14 }}>
                {["Create Draft", "Submit Review", "Approve Publish"].map((item, index) => (
                  <View key={item} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: index === 2 ? C.blue : C.cardAlt, borderWidth: 1, borderColor: C.border }}>
                      <Text style={{ color: index === 2 ? "#ffffff" : C.muted, fontSize: 12, fontWeight: "900" }}>{index + 1}</Text>
                    </View>
                    <View style={{ flex: 1, height: 8, borderRadius: 999, backgroundColor: C.cardAlt, overflow: "hidden" }}>
                      <View style={{ width: `${42 + index * 24}%`, height: "100%", backgroundColor: index === 0 ? C.green : C.blue }} />
                    </View>
                    <Text style={{ color: C.text, width: 120, fontWeight: "900" }}>{item}</Text>
                  </View>
                ))}
              </View>
            </View> : null}
          </View>

          <View style={{ flex: wide ? 0.85 : undefined, justifyContent: "center" }}>
            <View style={{ borderRadius: 16, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, padding: wide ? 34 : compact ? 20 : 24, gap: compact ? 18 : 22, boxShadow: "0 5px 8px rgba(0,0,0,0.22)" }}>
              <View style={{ gap: 8 }}>
                <Text style={{ color: C.text, fontSize: 30, fontWeight: "900" }}>Admin Login</Text>
                <Text style={{ color: C.muted, fontSize: 15, fontWeight: "700", lineHeight: 22 }}>{stepMessage}</Text>
              </View>

              <View style={{ gap: 14 }}>
                <LoginField
                  error={email.length && !emailValid ? "Enter a valid admin email." : undefined}
                  icon="mail-outline"
                  onBlur={() => undefined}
                  onChangeText={(value) => {
                    setEmail(value);
                    if (step !== "email") resetEmailStep();
                  }}
                  placeholder="Admin email"
                  value={email}
                />
                {step !== "email" ? (
                  <LoginField
                    error={step === "create_password" && password.length > 0 && !createPasswordValid ? "Use 8+ chars with uppercase, lowercase, number, and matching confirmation." : undefined}
                    icon="lock-closed-outline"
                    onBlur={() => undefined}
                    onChangeText={setPassword}
                    placeholder={step === "create_password" ? "Create password" : "Password"}
                    secureTextEntry={!showPassword}
                    value={password}
                    right={
                      <Pressable onPress={() => setShowPassword((current) => !current)} style={{ width: 34, height: 34, alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color={C.muted} />
                      </Pressable>
                    }
                  />
                ) : null}
                {step === "create_password" ? (
                  <LoginField
                    error={confirmPassword.length > 0 && password !== confirmPassword ? "Passwords do not match." : undefined}
                    icon="shield-checkmark-outline"
                    onBlur={() => undefined}
                    onChangeText={setConfirmPassword}
                    placeholder="Confirm password"
                    secureTextEntry={!showPassword}
                    value={confirmPassword}
                  />
                ) : null}
              </View>

              {step === "password" ? (
                <Pressable onPress={() => router.push("/(auth)/forgot-password")} style={{ alignSelf: "flex-end" }}>
                  <Text style={{ color: "#bfdbfe", fontWeight: "900" }}>Forgot password?</Text>
                </Pressable>
              ) : null}

              <Pressable
                disabled={
                  loading ||
                  (step === "email" && !emailValid) ||
                  (step === "password" && !passwordValid) ||
                  (step === "create_password" && !createPasswordValid)
                }
                onPress={step === "email" ? handleEmailContinue : step === "password" ? handlePasswordLogin : handleCreatePassword}
                style={{
                  minHeight: 50,
                  borderRadius: 8,
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: 9,
                  backgroundColor:
                    loading ||
                    (step === "email" && !emailValid) ||
                    (step === "password" && !passwordValid) ||
                    (step === "create_password" && !createPasswordValid)
                      ? "#334155"
                      : C.blue,
                }}
              >
                <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "900" }}>
                  {loading ? "Working..." : step === "email" ? "Continue" : step === "password" ? "Sign In" : "Create Password"}
                </Text>
                <Ionicons name="arrow-forward" size={18} color="#ffffff" />
              </Pressable>

              {step !== "email" ? (
                <Pressable onPress={resetEmailStep} style={{ alignSelf: "center" }}>
                  <Text style={{ color: C.muted, fontWeight: "900" }}>Use a different email</Text>
                </Pressable>
              ) : null}

              <View style={{ height: 1, backgroundColor: C.border }} />
              <Text style={{ color: C.faint, fontSize: 13, fontWeight: "700", lineHeight: 19 }}>
                Admin access is controlled by Supabase admin memberships and invites before login.
              </Text>
            </View>
          </View>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
