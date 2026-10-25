import { Fragment, type PropsWithChildren, type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleProp, View, ViewStyle } from "react-native";

import { T } from "@/components/theme";
import { useResponsiveScreenLayout } from "@/lib/responsive";
import { useThemeKey } from "@/contexts/SettingsContext";

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
  const themeKey = useThemeKey();
  const { horizontalPadding, insets, isWeb } = useResponsiveScreenLayout();
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
      <KeyboardAvoidingView behavior={Platform.select({ ios: "padding", android: "height" })} style={{ flex: 1, width: "100%", maxWidth: isWeb ? 760 : undefined, alignSelf: "center" }}>
        <ScrollView
          contentContainerStyle={[{ flexGrow: 1, backgroundColor: T.bg }, safeContentPadding, contentStyle]}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Fragment key={themeKey}>{children}</Fragment>
          <View style={[{ backgroundColor: T.bg, paddingTop: 18 }, safeFooterPadding]}>{footer}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.select({ ios: "padding", android: "height" })} style={{ flex: 1, width: "100%", maxWidth: isWeb ? 760 : undefined, alignSelf: "center" }}>
      <View style={[{ flex: 1, backgroundColor: T.bg }, safeContentPadding, contentStyle]}><Fragment key={themeKey}>{children}</Fragment></View>
      <View style={[{ backgroundColor: T.bg, paddingTop: 10 }, safeFooterPadding]}>{footer}</View>
    </KeyboardAvoidingView>
  );
}
