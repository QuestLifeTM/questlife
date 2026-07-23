import { Ionicons } from "@expo/vector-icons";
import { PropsWithChildren, ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";

import { T } from "@/components/theme";

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

  const dismissFeedback = useCallback(() => setFeedback(null), []);
  const showFeedback = useCallback((nextFeedback: AppFeedback) => setFeedback({
    icon: "checkmark",
    color: T.blue,
    durationMs: 4_500,
    ...nextFeedback,
  }), []);

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(dismissFeedback, feedback.durationMs);
    return () => clearTimeout(timer);
  }, [dismissFeedback, feedback]);

  const value = useMemo(() => ({ showFeedback, dismissFeedback }), [dismissFeedback, showFeedback]);
  const handleAction = () => {
    const onAction = feedback?.onAction;
    dismissFeedback();
    onAction?.();
  };

  return <AppFeedbackContext.Provider value={value}>
    {children}
    <Modal transparent visible={Boolean(feedback)} animationType="fade" onRequestClose={dismissFeedback}>
      <View pointerEvents="box-none" style={{ flex: 1, justifyContent: "flex-end", paddingHorizontal: 14, paddingBottom: 24 }}>
        {feedback ? <View accessibilityRole="alert" style={{ minHeight: 66, flexDirection: "row", alignItems: "center", gap: 11, borderRadius: 18, backgroundColor: "rgba(61,52,56,0.9)", paddingHorizontal: 10, paddingVertical: 9, boxShadow: "0px 4px 12px rgba(61,52,56,0.22)" }}>
          <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: `${feedback.color}2a`, alignItems: "center", justifyContent: "center" }}>
            {feedback.iconElement ?? <Ionicons name={feedback.icon ?? "checkmark"} size={23} color={feedback.color} />}
          </View>
          <Text style={{ flex: 1, color: T.white, fontFamily: "Rubik", fontSize: 13, lineHeight: 18 }} numberOfLines={2}>{feedback.message}</Text>
          {feedback.actionLabel ? <Pressable accessibilityRole="button" accessibilityLabel={feedback.actionLabel} onPress={handleAction} hitSlop={8}>
            <Text style={{ color: T.white, fontFamily: "RubikBold", fontSize: 14 }}>{feedback.actionLabel}</Text>
          </Pressable> : null}
        </View> : null}
      </View>
    </Modal>
  </AppFeedbackContext.Provider>;
}

export function useAppFeedback() {
  return useContext(AppFeedbackContext);
}
