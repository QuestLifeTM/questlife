import { Ionicons } from "@expo/vector-icons";
import { PropsWithChildren, ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { T } from "@/components/theme";
import { haptic } from "@/components/ui";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";

type AppFeedback = {
  message: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconElement?: ReactNode;
  color?: string;
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
};

type AppFeedbackContextValue = {
  showFeedback: (feedback: AppFeedback) => void;
  dismissFeedback: () => void;
};

const AppFeedbackContext = createContext<AppFeedbackContextValue>({
  showFeedback: () => undefined,
  dismissFeedback: () => undefined,
});

export function AppFeedbackProvider({ children }: PropsWithChildren) {
  const [feedback, setFeedback] = useState<AppFeedback | null>(null);
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotionPreference();

  const dismissFeedback = useCallback(() => setFeedback(null), []);
  const showFeedback = useCallback((nextFeedback: AppFeedback) => setFeedback({
    icon: "checkmark",
    color: T.blue,
    durationMs: 2_500,
    ...nextFeedback,
  }), []);

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(dismissFeedback, feedback.durationMs);
    return () => clearTimeout(timer);
  }, [dismissFeedback, feedback]);

  useEffect(() => {
    if (feedback) haptic();
  }, [feedback]);

  const value = useMemo(() => ({ showFeedback, dismissFeedback }), [dismissFeedback, showFeedback]);
  const handleAction = () => {
    const onAction = feedback?.onAction;
    dismissFeedback();
    onAction?.();
  };

  return <AppFeedbackContext.Provider value={value}>
    <View style={{ flex: 1 }}>
      {children}
      <View pointerEvents="box-none" style={{ position: "absolute", inset: 0, justifyContent: "flex-start", paddingHorizontal: 14, paddingTop: Math.max(insets.top + 8, 20) }}>
        {feedback ? <Animated.View accessibilityRole="alert" entering={reduceMotion ? undefined : FadeInDown.duration(180)} exiting={reduceMotion ? undefined : FadeOutUp.duration(140)} style={{ minHeight: 66, flexDirection: "row", alignItems: "center", gap: 11, borderRadius: 18, backgroundColor: T.toast, paddingHorizontal: 10, paddingVertical: 9, boxShadow: `0px 4px 12px ${T.shadow}` }}>
          <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: `${feedback.color}2a`, alignItems: "center", justifyContent: "center" }}>
            {feedback.iconElement ?? <Ionicons name={feedback.icon ?? "checkmark"} size={23} color={feedback.color} />}
          </View>
          <Text style={{ flex: 1, color: T.onAccent, fontFamily: "Rubik", fontSize: 13, lineHeight: 18 }} numberOfLines={2}>{feedback.message}</Text>
          {feedback.actionLabel ? <Pressable accessibilityRole="button" accessibilityLabel={feedback.actionLabel} onPress={handleAction} hitSlop={8}>
            <Text style={{ color: T.onAccent, fontFamily: "RubikBold", fontSize: 14 }}>{feedback.actionLabel}</Text>
          </Pressable> : null}
        </Animated.View> : null}
      </View>
    </View>
  </AppFeedbackContext.Provider>;
}

export function useAppFeedback() {
  return useContext(AppFeedbackContext);
}
