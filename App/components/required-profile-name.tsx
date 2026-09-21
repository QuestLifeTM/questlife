import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useResponsiveScreenLayout } from "@/lib/responsive";

import { PrimaryButton } from "@/components/auth/AuthControls";
import { T } from "@/components/theme";
import { useAuth } from "@/contexts/AuthContext";
import { fetchRequiredProfileName, saveRequiredProfileName } from "@/services/profile/profileService";

export function RequiredProfileName() {
  const { isEmailVerified, refreshProfileName, user } = useAuth();
  const [checking, setChecking] = useState(true);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [required, setRequired] = useState(false);
  const [saving, setSaving] = useState(false);
  const { horizontalPadding, insets } = useResponsiveScreenLayout();

  useEffect(() => {
    let active = true;

    async function checkName() {
      if (!user || !isEmailVerified) {
        if (active) {
          setRequired(false);
          setChecking(false);
        }
        return;
      }

      try {
        const profile = await fetchRequiredProfileName(user.id);
        if (!active) return;
        setFirstName(profile?.first_name ?? "");
        setLastName(profile?.last_name ?? "");
        setRequired(!profile?.first_name?.trim());
      } catch {
        // Do not trap a person behind a temporary connection failure. The next
        // app open will check again and prompt if their name is still missing.
        if (active) setRequired(false);
      } finally {
        if (active) setChecking(false);
      }
    }

    setChecking(true);
    void checkName();
    return () => {
      active = false;
    };
  }, [isEmailVerified, user?.id]);

  async function save() {
    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();
    if (!normalizedFirstName) {
      Alert.alert("First name required", "Enter your first name to continue.");
      return;
    }

    try {
      setSaving(true);
      await saveRequiredProfileName(normalizedFirstName, normalizedLastName);
      refreshProfileName();
      setRequired(false);
    } catch {
      Alert.alert("Couldn’t save your name", "Please check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  if (checking || !user || !isEmailVerified) return null;

  return (
    <Modal animationType="fade" transparent visible={required} onRequestClose={() => undefined}>
      <KeyboardAvoidingView behavior={Platform.select({ ios: "padding", android: "height" })} style={styles.keyboard}>
        <ScrollView
          contentContainerStyle={[styles.backdrop, {
            paddingTop: insets.top + 20,
            paddingBottom: insets.bottom + 20,
            paddingLeft: insets.left + horizontalPadding,
            paddingRight: insets.right + horizontalPadding,
          }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        <View accessibilityViewIsModal style={styles.card}>
          <Text style={styles.eyebrow}>ONE QUICK STEP</Text>
          <Text style={styles.title}>Tell us your name</Text>
          <Text style={styles.body}>Your first name is required. Your unique username stays your QuestLife handle.</Text>
          <TextInput
            autoComplete="given-name"
            autoFocus
            onChangeText={setFirstName}
            placeholder="Enter your first name"
            placeholderTextColor={T.muted}
            style={styles.input}
            textContentType="givenName"
            value={firstName}
          />
          <TextInput
            autoComplete="family-name"
            onChangeText={setLastName}
            placeholder="Enter your last name (optional)"
            placeholderTextColor={T.muted}
            style={styles.input}
            textContentType="familyName"
            value={lastName}
          />
          <PrimaryButton disabled={saving} loading={saving} onPress={save} title={saving ? "Saving..." : "Save and continue"} />
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { alignItems: "center", backgroundColor: "rgba(23, 35, 49, 0.58)", flexGrow: 1, justifyContent: "center" },
  body: { color: T.muted, fontSize: 14, fontWeight: "600", lineHeight: 21, marginBottom: 22 },
  card: { backgroundColor: T.white, borderRadius: 28, maxWidth: 440, padding: 24, width: "100%" },
  eyebrow: { color: T.blue, fontSize: 11, fontWeight: "900", letterSpacing: 1.1, marginBottom: 8 },
  input: { backgroundColor: T.bg, borderColor: `${T.blue}28`, borderRadius: 15, borderWidth: 1, color: T.dark, fontSize: 16, fontWeight: "700", marginBottom: 12, minHeight: 54, paddingHorizontal: 16 },
  title: { color: T.dark, fontFamily: "RubikBold", fontSize: 25, marginBottom: 8 },
  keyboard: { flex: 1 },
});
