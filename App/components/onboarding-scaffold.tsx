import type { PropsWithChildren, ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleProp, View, ViewStyle } from "react-native";

import { T } from "@/components/theme";
import { useResponsiveScreenLayout } from "@/lib/responsive";

type OnboardingScaffoldProps = PropsWithChildren<{
  footer: ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}>;

/**
 * Shared safe-area frame for the onboarding steps. Question steps keep their
 * own option list scrollable; form and illustration steps can opt into a
 * whole-page scroll when a shorter phone or the keyboard needs more room.
 */
export function OnboardingScaffold({ children, footer, scroll = false, contentStyle }: OnboardingScaffoldProps) {
  const { horizontalPadding, insets } = useResponsiveScreenLayout();
  const safeContentPadding = {
    paddingTop: Math.max(insets.top + 6, 18),
    paddingLeft: insets.left + horizontalPadding,
    paddingRight: insets.right + horizontalPadding,
  };
  const safeFooterPadding = {
    paddingBottom: Math.max(insets.bottom + 12, 20),
    paddingLeft: insets.left + horizontalPadding,
    paddingRight: insets.right + horizontalPadding,
  };

  if (scroll) {
    return (
      <KeyboardAvoidingView behavior={Platform.select({ ios: "padding", android: "height" })} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[{ flexGrow: 1, backgroundColor: T.bg }, safeContentPadding, contentStyle]}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
          <View style={[{ backgroundColor: T.bg, paddingTop: 18 }, safeFooterPadding]}>{footer}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.select({ ios: "padding", android: "height" })} style={{ flex: 1 }}>
      <View style={[{ flex: 1, backgroundColor: T.bg }, safeContentPadding, contentStyle]}>{children}</View>
      <View style={[{ backgroundColor: T.bg, paddingTop: 10 }, safeFooterPadding]}>{footer}</View>
    </KeyboardAvoidingView>
  );
}
