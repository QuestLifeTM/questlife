import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { OnboardingScaffold } from "@/components/onboarding-scaffold";
import { T } from "@/components/theme";
import { OnboardingQuestionHeader } from "@/components/onboarding-question-header";
import { ONBOARDING_PERSONALIZATION_TOTAL } from "@/components/onboarding-progress";
import { haptic } from "@/components/ui";
import { checkUsernameAvailability } from "@/services/auth/authService";
import { getOnboardingUsernameDraft, saveOnboardingUsernameDraft } from "@/services/onboarding/username-draft";
import { validateUsername } from "@/validation/username";

type Availability = "idle" | "checking" | "available" | "unavailable" | "invalid" | "error";

export default function ClaimUsernameScreen() {
  const { firstName } = useLocalSearchParams<{ firstName?: string }>();
  const [username, setUsername] = useState("");
  const [availability, setAvailability] = useState<Availability>("idle");
  const [availabilityMessage, setAvailabilityMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getOnboardingUsernameDraft().then((draft) => {
      if (active && draft) setUsername(draft);
    }).catch(() => {
      // A draft is optional; a storage failure should not block onboarding.
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!username) {
      setAvailability("idle");
      setAvailabilityMessage(null);
      return;
    }
    const validation = validateUsername(username);
    if (!validation.valid) {
      setAvailability("invalid");
      setAvailabilityMessage(validation.message);
      return;
    }

    let active = true;
    setAvailability("checking");
    const timer = setTimeout(() => {
      checkUsernameAvailability(username)
        .then(({ available, reason }) => {
          if (!active) return;
          setAvailability(available ? "available" : "unavailable");
          setAvailabilityMessage(reason ?? null);
        })
        .catch(() => { if (active) setAvailability("error"); });
    }, 400);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [username]);

  const isAvailable = availability === "available";
  const inputColor = isAvailable ? T.green : availability === "unavailable" || availability === "invalid" || availability === "error" ? T.red : T.border;
  const validation = validateUsername(username);
  const feedback = availability === "available"
    ? "This username is available."
    : availability === "unavailable"
      ? availabilityMessage ?? "That username is already taken. Try another one."
      : availability === "invalid"
        ? availabilityMessage ?? (validation.valid ? "That username isn't available." : validation.message)
        : availability === "checking"
          ? "Checking availability…"
          : availability === "error"
            ? "We couldn't check availability. Please try again."
            : "Use 3–20 letters, numbers, . or _.";

  async function continueOnboarding() {
    if (!isAvailable) return;
    haptic();
    await saveOnboardingUsernameDraft(username);
    router.replace({ pathname: "/onboarding/questions-intro", params: firstName ? { firstName } : {} });
  }

  function goBack() {
    haptic();
    router.replace({ pathname: "/onboarding/questions-path", params: firstName ? { firstName } : {} });
  }

  return (
    <View style={styles.root}>
      <OnboardingScaffold
        scroll
        contentStyle={styles.content}
        footer={<Pressable accessibilityRole="button" accessibilityLabel="Continue" accessibilityState={{ disabled: !isAvailable }} disabled={!isAvailable} onPress={() => void continueOnboarding()} style={({ pressed }) => [styles.continueButton, !isAvailable && styles.continueButtonDisabled, pressed && isAvailable && styles.continueButtonPressed]}>
          <Ionicons name="arrow-forward" size={19} color={T.white} />
          <Text style={styles.continueText}>Continue</Text>
        </Pressable>}
      >
        <View style={styles.progressSection}><OnboardingQuestionHeader currentStep={1} totalSteps={ONBOARDING_PERSONALIZATION_TOTAL} phaseLabel="Personalizing your experience" onBack={goBack} /></View>
        <View style={styles.copy}>
          <Text style={styles.title}>Claim your <Text style={styles.titleAccent}>username</Text></Text>
          <Text style={styles.body}>You can edit it later.</Text>
        </View>
        <View style={styles.fieldGroup}>
          <View style={[styles.inputWrap, { borderColor: inputColor }]}> 
            <Text style={styles.atSign}>@</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="username"
              autoCorrect={false}
              onChangeText={setUsername}
              placeholder="username"
              placeholderTextColor={T.muted}
              returnKeyType="done"
              style={styles.input}
              textContentType="username"
              value={username}
            />
            {availability === "checking" ? <Ionicons name="hourglass-outline" size={21} color={T.muted} /> : availability === "available" ? <Ionicons name="checkmark-circle" size={23} color={T.green} /> : availability === "unavailable" || availability === "invalid" || availability === "error" ? <Ionicons name="close-circle" size={23} color={T.red} /> : null}
          </View>
          <Text accessibilityLiveRegion="polite" style={[styles.feedback, { color: isAvailable ? T.green : availability === "unavailable" || availability === "invalid" || availability === "error" ? T.red : T.muted }]}>{feedback}</Text>
        </View>
      </OnboardingScaffold>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  content: { flex: 1, gap: 28 },
  progressSection: { paddingTop: 2 },
  copy: { gap: 7 },
  title: { color: T.dark, fontFamily: "RubikBlack", fontSize: 29, lineHeight: 35, letterSpacing: -0.55 },
  titleAccent: { color: T.blue },
  body: { color: T.muted, fontFamily: "Rubik", fontSize: 16, lineHeight: 22, fontWeight: "700" },
  fieldGroup: { gap: 9 },
  inputWrap: { minHeight: 60, borderRadius: 20, borderWidth: 2, backgroundColor: T.white, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 5 },
  atSign: { color: T.muted, fontFamily: "RubikBold", fontSize: 18, lineHeight: 22 },
  input: { flex: 1, minWidth: 0, color: T.dark, fontFamily: "Rubik", fontSize: 17, fontWeight: "700", paddingVertical: 0 },
  feedback: { fontFamily: "RubikBold", fontSize: 13, lineHeight: 18 },
  footer: { backgroundColor: T.bg, paddingTop: 10 },
  continueButton: { minHeight: 58, paddingHorizontal: 18, borderRadius: 20, backgroundColor: T.blue, borderBottomWidth: 6, borderBottomColor: "#258fd8", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  continueButtonDisabled: { backgroundColor: T.border, borderBottomColor: "#d7cec2" },
  continueButtonPressed: { transform: [{ translateY: 3 }], borderBottomWidth: 3 },
  continueText: { color: T.white, fontFamily: "RubikBold", fontSize: 15, lineHeight: 20, letterSpacing: 0.55, textTransform: "uppercase" },
});
