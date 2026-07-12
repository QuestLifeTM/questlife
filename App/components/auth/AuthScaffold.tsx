import { PropsWithChildren } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, shadow, T } from "@/components/theme";
import { AmbientGlow, useResponsiveScreenLayout } from "@/components/ui";

export function AuthScaffold({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets();
  const { horizontalPadding } = useResponsiveScreenLayout();

  return (
    <View style={styles.root}>
      <AmbientGlow />
      <View style={styles.warmGlow} pointerEvents="none" />
      <KeyboardAvoidingView behavior={Platform.select({ ios: "padding", android: undefined })} style={styles.keyboard}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: Math.max(insets.top + 16, 28),
              paddingBottom: Math.max(insets.bottom + 24, 36),
              paddingLeft: insets.left + horizontalPadding,
              paddingRight: insets.right + horizontalPadding
            }
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: T.bg
  },
  keyboard: {
    flex: 1
  },
  content: {
    flexGrow: 1,
    justifyContent: "center"
  },
  card: {
    width: "100%",
    maxWidth: 390,
    alignSelf: "center",
    borderWidth: 2,
    borderColor: T.border,
    borderRadius: radius.xl,
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 24,
    paddingVertical: 28,
    ...shadow
  },
  warmGlow: {
    position: "absolute",
    left: -80,
    bottom: -80,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(253,121,168,0.10)"
  }
});
