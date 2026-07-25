import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Easing,
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { OnboardingIntro } from "@/components/onboarding-intro";
import { T } from "@/components/theme";
import { haptic } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { getIntroEnabled } from "@/services/announcements/announcementService";
import { sendEmailSignInLink } from "@/services/auth/authService";
import { getAuthErrorMessage } from "@/utils/authErrors";

const welcomeArtwork = require("../assets/onboarding/screen-one.png");

export default function OnboardingWelcomeScreen() {
  const { isEmailVerified, session, user } = useAuth();
  const insets = useSafeAreaInsets();
  const [introComplete, setIntroComplete] = useState(false);
  const [introEnabled, setIntroEnabled] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [emailSheetVisible, setEmailSheetVisible] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const welcomeOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!introComplete) return;

    welcomeOpacity.setValue(0);
    Animated.timing(welcomeOpacity, {
      toValue: 1,
      duration: 1100,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [introComplete, welcomeOpacity]);

  useEffect(() => {
    let active = true;

    getIntroEnabled()
      .then((enabled) => {
        if (!active) return;
        setIntroEnabled(enabled);
        if (!enabled) setIntroComplete(true);
      })
      .catch(() => {
        // Preserve the existing intro if settings cannot be reached.
        if (active) setIntroEnabled(true);
      });

    return () => {
      active = false;
    };
  }, []);

  function restoreProgress() {
    haptic();

    if (!session) {
      router.replace("/(auth)/login");
      return;
    }

    if (!isEmailVerified) {
      router.replace({
        pathname: "/(auth)/verify-email",
        params: { email: user?.email ?? "" },
      });
      return;
    }

    router.replace("/(tabs)");
  }

  function showOAuthSetup(provider: "Apple" | "Google") {
    haptic();
    Alert.alert("Provider setup required", `${provider} sign in requires provider credentials in Supabase before it can be enabled safely.`);
  }

  async function continueWithEmail() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      Alert.alert("Enter a valid email", "Use an email address you can access.");
      return;
    }

    try {
      setSendingEmail(true);
      await sendEmailSignInLink(normalizedEmail);
      setEmailSheetVisible(false);
      Alert.alert("Check your email", "We sent you a verification link to continue with QuestLife.");
    } catch (error) {
      Alert.alert("Couldn’t send link", getAuthErrorMessage(error));
    } finally {
      setSendingEmail(false);
    }
  }

  if (!introComplete && introEnabled === null) {
    return <View style={styles.root} />;
  }

  if (!introComplete && introEnabled) {
    return <OnboardingIntro onDone={() => setIntroComplete(true)} />;
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Animated.View style={[styles.artworkFade, { opacity: welcomeOpacity }]}>
        <ImageBackground
          source={welcomeArtwork}
          resizeMode="cover"
          style={styles.artwork}
        />
      </Animated.View>
      <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom + 6, 18) }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Continue with Apple" onPress={() => showOAuthSetup("Apple")} style={({ pressed }) => [styles.appleAction, pressed && styles.actionPressed]}><Ionicons name="logo-apple" size={21} color={T.white} /><Text style={styles.appleActionText}>Continue with Apple</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Continue with Google" onPress={() => showOAuthSetup("Google")} style={({ pressed }) => [styles.lightAction, pressed && styles.actionPressed]}><View style={styles.googleBadge}><Text style={styles.googleLetter}>G</Text></View><Text style={styles.lightActionText}>Continue with Google</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Continue with Email" onPress={() => { haptic(); setEmailSheetVisible(true); }} style={({ pressed }) => [styles.lightAction, pressed && styles.actionPressed]}><Ionicons name="mail-outline" size={22} color={T.dark} /><Text style={styles.lightActionText}>Continue with Email</Text></Pressable>
        <View style={styles.divider} />
        <Pressable accessibilityRole="button" accessibilityLabel="Restore progress" onPress={restoreProgress} style={({ pressed }) => ({ alignSelf: "center", minHeight: 34, justifyContent: "center", opacity: pressed ? 0.65 : 1 })}><Text style={styles.restoreText}>Restore progress</Text></Pressable>
      </View>
      <Modal
        animationType="slide"
        onRequestClose={() => !sendingEmail && setEmailSheetVisible(false)}
        transparent
        visible={emailSheetVisible}
      >
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.sheetBackdrop}>
          <Pressable
            accessibilityLabel="Close email sign-in"
            disabled={sendingEmail}
            onPress={() => setEmailSheetVisible(false)}
            style={StyleSheet.absoluteFill}
          />
          <View accessibilityViewIsModal style={[styles.emailSheet, { paddingBottom: Math.max(insets.bottom + 20, 32) }]}>
            <View style={styles.sheetHandle} />
            <Pressable accessibilityRole="button" accessibilityLabel="Close" disabled={sendingEmail} onPress={() => setEmailSheetVisible(false)} style={styles.backButton}>
              <Ionicons color={T.white} name="chevron-back" size={28} />
            </Pressable>
            <Text style={styles.sheetTitle}>Enter your email address.</Text>
            <Text style={styles.sheetSubtitle}>We’ll send you a verification link.</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              autoFocus
              editable={!sendingEmail}
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="Email ID"
              placeholderTextColor="#aaa5aa"
              returnKeyType="send"
              onSubmitEditing={() => void continueWithEmail()}
              style={styles.emailInput}
              textContentType="emailAddress"
              value={email}
            />
            <Pressable
              accessibilityRole="button"
              disabled={sendingEmail || !email.trim()}
              onPress={() => void continueWithEmail()}
              style={({ pressed }) => [styles.sendButton, (!email.trim() || sendingEmail) && styles.sendButtonDisabled, pressed && styles.actionPressed]}
            >
              <Text style={styles.sendButtonText}>{sendingEmail ? "Sending…" : "Send verification link"}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000000",
  },
  artworkFade: {
    ...StyleSheet.absoluteFillObject,
  },
  artwork: {
    flex: 1,
  },
  actions: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 0,
    gap: 12,
  },
  appleAction: {
    minHeight: 57,
    borderRadius: 19,
    backgroundColor: T.blue,
    borderWidth: 1.25,
    borderColor: "rgba(255,255,255,0.4)",
    borderBottomWidth: 4,
    borderBottomColor: "#277dcc",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 12,
  },
  appleActionText: {
    color: T.white,
    fontFamily: "Rubik",
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "700",
  },
  lightAction: {
    minHeight: 57,
    borderRadius: 19,
    backgroundColor: T.white,
    borderWidth: 1.25,
    borderColor: "#e6e0e1",
    borderBottomWidth: 4,
    borderBottomColor: "#cbc3c6",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 12,
  },
  lightActionText: {
    color: T.dark,
    fontFamily: "Rubik",
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "700",
  },
  googleBadge: {
    width: 23,
    height: 23,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: T.white,
  },
  googleLetter: {
    color: "#4285F4",
    fontSize: 18,
    fontWeight: "900",
  },
  divider: {
    height: 1,
    marginTop: 7,
    backgroundColor: "rgba(255,255,255,0.42)",
  },
  restoreText: {
    color: T.white,
    fontFamily: "Rubik",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  actionPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.98 }],
  },
  sheetBackdrop: {
    backgroundColor: "rgba(0,0,0,0.54)",
    flex: 1,
    justifyContent: "flex-end",
  },
  emailSheet: {
    backgroundColor: "#121013",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    minHeight: 390,
    paddingHorizontal: 28,
    paddingTop: 12,
  },
  sheetHandle: {
    alignSelf: "center",
    backgroundColor: "#767178",
    borderRadius: 4,
    height: 6,
    marginBottom: 12,
    width: 48,
  },
  backButton: {
    alignItems: "center",
    height: 42,
    justifyContent: "center",
    marginLeft: -10,
    width: 42,
  },
  sheetTitle: {
    color: T.white,
    fontFamily: "RubikBold",
    fontSize: 25,
    lineHeight: 32,
    marginTop: 14,
  },
  sheetSubtitle: {
    color: "#aaa5aa",
    fontFamily: "Rubik",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 7,
  },
  emailInput: {
    backgroundColor: "#3f3b40",
    borderRadius: 13,
    color: T.white,
    fontFamily: "Rubik",
    fontSize: 16,
    height: 62,
    marginTop: 22,
    paddingHorizontal: 17,
  },
  sendButton: {
    alignItems: "center",
    backgroundColor: T.blue,
    borderBottomColor: "#277dcc",
    borderBottomWidth: 4,
    borderRadius: 13,
    height: 62,
    justifyContent: "center",
    marginTop: 14,
  },
  sendButtonDisabled: {
    backgroundColor: "#4b474c",
    borderBottomColor: "#39353a",
  },
  sendButtonText: {
    color: T.white,
    fontFamily: "Rubik",
    fontSize: 16,
    fontWeight: "700",
  },
});
