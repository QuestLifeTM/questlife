import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { PropsWithChildren, useEffect, useRef, useState } from "react";
import Reanimated, { cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  Text,
  TextInput,
  TextStyle,
  View,
  ViewStyle,
  useWindowDimensions
} from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, shadow, T } from "@/components/theme";
import { BackIcon } from "@/components/back-icon";
import { ScrollTopBlur, useTopScrollBlur } from "@/components/scroll-top-blur";
import { isHapticFeedbackEnabled } from "@/services/settings/settingsService";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { motionDurations, motionEasing, motionSprings, springConfig, timingConfig } from "@/motion/tokens";
import {
  resolveSheetMaxHeight,
  responsiveLayout,
  responsiveScreenGutter,
  screenBottomPadding,
  useResponsiveScreenLayout,
} from "@/lib/responsive";

const NAVIGATION_PRESS_COOLDOWN_MS = 650;

export { responsiveScreenGutter, useResponsiveScreenLayout } from "@/lib/responsive";

/** Prevents rapid taps from queuing duplicate navigation actions before a route mounts. */
export function usePressGuard() {
  const lastPressAt = useRef(0);

  return (action: () => void) => {
    const now = Date.now();
    if (now - lastPressAt.current < NAVIGATION_PRESS_COOLDOWN_MS) return;
    lastPressAt.current = now;
    action();
  };
}

export function haptic() {
  if (!isHapticFeedbackEnabled()) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function Screen({
  children,
  scroll = true,
  padded = true,
  // Most Screen consumers are tab destinations. Preserve their existing
  // clearance by default; standalone routes can opt out explicitly.
  bottomOverlay = "tab",
  contentStyle,
  ambientGlow = true
}: PropsWithChildren<{ scroll?: boolean; padded?: boolean; bottomOverlay?: "none" | "tab"; contentStyle?: StyleProp<ViewStyle>; ambientGlow?: boolean }>) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const topPadding = Math.max(insets.top + 8, 20);
  const horizontalPadding = responsiveScreenGutter(width);
  const contentWidth = Math.min(Math.max(0, width - insets.left - insets.right), responsiveLayout.defaultContentMaxWidth);
  const contentInnerWidth = Math.max(0, contentWidth - horizontalPadding * 2);
  const { onScroll, scrollY } = useTopScrollBlur();
  const constrainedContent = padded ? { width: contentInnerWidth, alignSelf: "center" as const } : null;
  if (!scroll) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg }}>
        {ambientGlow ? <AmbientGlow /> : null}
        <View style={[{ flex: 1, paddingTop: topPadding }, padded && { paddingLeft: insets.left + horizontalPadding, paddingRight: insets.right + horizontalPadding }, contentStyle]}>
          <View style={[{ flex: 1 }, constrainedContent]}>
            {children}
          </View>
        </View>
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      {ambientGlow ? <AmbientGlow /> : null}
      <Reanimated.ScrollView
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[
          { paddingTop: topPadding, paddingBottom: screenBottomPadding(insets.bottom, bottomOverlay) },
          padded && { paddingLeft: insets.left + horizontalPadding, paddingRight: insets.right + horizontalPadding },
          contentStyle,
        ]}
      >
        <View style={[padded ? { gap: 18 } : null, constrainedContent]}>{children}</View>
      </Reanimated.ScrollView>
      <ScrollTopBlur scrollY={scrollY} />
    </View>
  );
}

export function AmbientGlow({ right = true }: { right?: boolean }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        width: 280,
        height: 280,
        top: -70,
        [right ? "right" : "left"]: -65,
        borderRadius: 140,
        backgroundColor: "rgba(77,168,255,0.07)",
        opacity: 0.9
      }}
    />
  );
}

export function Entrance({ children, delay = 0, style }: PropsWithChildren<{ delay?: number; style?: StyleProp<ViewStyle> }>) {
  const reducedMotion = useReducedMotionPreference();
  const opacity = useSharedValue(reducedMotion ? 1 : 0);
  const y = useSharedValue(reducedMotion ? 0 : 14);

  useEffect(() => {
    opacity.value = reducedMotion ? 1 : 0;
    y.value = reducedMotion ? 0 : 14;
    if (reducedMotion) return;
    opacity.value = withDelay(delay, withTiming(1, timingConfig(false, motionDurations.state, motionEasing.enter)));
    y.value = withDelay(delay, withSpring(0, springConfig(false, motionSprings.control)));
  }, [delay, opacity, reducedMotion, y]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ translateY: y.value }] }));

  return <Reanimated.View style={[style, animatedStyle]}>{children}</Reanimated.View>;
}

export function Header({
  eyebrow,
  title,
  subtitle,
  titleContent,
  subtitleContent,
  right,
  animated = true
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  titleContent?: React.ReactNode;
  subtitleContent?: React.ReactNode;
  right?: React.ReactNode;
  animated?: boolean;
}) {
  const caption = subtitle ?? eyebrow;

  const body = (
    <View
      style={[
        {
          minHeight: 70,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12
        }
      ]}
    >
      <View style={{ flex: 1 }}>
        {titleContent ?? <Text style={styles.title}>{title}</Text>}
        {subtitleContent ?? (caption ? <Text style={styles.subtitle}>{caption}</Text> : null)}
      </View>
      {right}
    </View>
  );

  if (!animated) return body;
  return (
    <Entrance>
      {body}
    </Entrance>
  );
}

export function Card({
  children,
  style,
  pressable,
  onPress
}: PropsWithChildren<{ style?: StyleProp<ViewStyle>; pressable?: boolean; onPress?: () => void }>) {
  const body = (
    <View
      style={[
        {
          backgroundColor: T.white,
          borderWidth: 2,
          borderColor: T.border,
          borderRadius: radius.xl,
          padding: 18,
          ...shadow
        },
        style
      ]}
    >
      {children}
    </View>
  );
  if (!pressable) return body;
  return (
    <Pressable
      onPress={() => {
        haptic();
        onPress?.();
      }}
      style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.985 : 1 }] }]}
    >
      {body}
    </Pressable>
  );
}

export function SoftButton({
  label,
  icon,
  onPress,
  color = T.blue,
  inverse = false,
  disabled = false,
  style
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  color?: string;
  inverse?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const guardPress = usePressGuard();
  const baseColor = color === T.blue ? "#258fd8" : `${color}88`;
  return (
    <Pressable
      disabled={disabled}
      accessibilityState={{ disabled }}
      onPress={() => {
        if (disabled) return;
        guardPress(() => {
          haptic();
          onPress?.();
        });
      }}
      style={({ pressed }) => [
        {
          minHeight: 58,
          paddingHorizontal: 18,
          borderRadius: 20,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          backgroundColor: inverse ? T.white : color,
          borderWidth: 2,
          borderColor: inverse ? color : color,
          borderBottomWidth: pressed && !disabled ? (inverse ? 2 : 3) : (inverse ? 4 : 6),
          borderBottomColor: inverse ? `${color}88` : baseColor,
          opacity: disabled ? 0.5 : 1,
          transform: [{ scale: pressed && !disabled ? 0.96 : 1 }, { translateY: pressed && !disabled ? 3 : 0 }]
        },
        style
      ]}
    >
      {icon ? <Ionicons name={icon} size={19} color={inverse ? color : T.white} /> : null}
      <Text style={{ fontFamily: "RubikBold", fontSize: 15, lineHeight: 20, letterSpacing: 0.55, textTransform: "uppercase", color: inverse ? color : T.white }}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  color = T.muted,
  backAccent,
  bg = T.white,
  badge,
  label,
  size = 44
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  color?: string;
  /** Overrides the standard blue accent for a back button without changing its established shape. */
  backAccent?: string;
  bg?: string;
  badge?: string | number;
  label?: string;
  /** Use a larger category-pill control where a header needs it. */
  size?: number;
}) {
  const isBackButton = icon === "chevron-back" || icon === "arrow-back";
  const isFilled = bg !== T.white;
  const accent = isFilled ? bg : (isBackButton ? backAccent ?? T.blue : color);
  const innerSize = Math.round(size * 0.625);
  const iconColor = isFilled ? T.white : accent;
  const guardPress = usePressGuard();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        guardPress(() => {
          haptic();
          onPress?.();
        });
      }}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        borderWidth: 2,
        borderColor: accent,
        // Mirrors the compact Profile controls: a colored outer ring, a soft
        // icon well, and a short lower edge that compresses on press.
        borderBottomWidth: pressed ? 2 : 4,
        borderBottomColor: `${accent}88`,
        alignItems: "center",
        justifyContent: "center",
        transform: [{ scale: pressed ? 0.96 : 1 }, { translateY: pressed ? 2 : 0 }]
      })}
    >
      {({ pressed }) => <>
        <View style={{ transform: [{ translateX: isBackButton && pressed ? -3 : 0 }] }}>
          <View style={{ width: innerSize, height: innerSize, borderRadius: innerSize / 2, alignItems: "center", justifyContent: "center", backgroundColor: isFilled ? "rgba(255,255,255,0.18)" : `${accent}16` }}>
            {isBackButton ? <BackIcon size={Math.min(22, Math.round(size * 0.5))} color={iconColor} /> : <Ionicons name={icon} size={Math.min(20, Math.round(size * 0.43))} color={iconColor} />}
          </View>
        </View>
        {badge !== undefined ? (
          <View style={{ position: "absolute", top: -5, right: -5, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: T.cyan, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 }}>
            <Text style={{ color: T.white, fontWeight: "900", fontSize: 10 }}>{badge}</Text>
          </View>
        ) : null}
      </>}
    </Pressable>
  );
}

export function Tag({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <View style={{ borderRadius: 99, paddingHorizontal: 11, paddingVertical: 5, backgroundColor: bg, borderWidth: 2, borderColor: color, borderBottomWidth: 4, borderBottomColor: `${color}88`, alignSelf: "flex-start" }}>
      <Text style={{ color, fontSize: 10, fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase" }}>{label}</Text>
    </View>
  );
}

export function ProgressBar({ value, color = T.blue, height = 10 }: { value: number; color?: string; height?: number }) {
  return (
    <View style={{ height, borderRadius: 99, backgroundColor: T.border, overflow: "hidden" }}>
      <View style={{ height: "100%", width: `${Math.max(4, Math.min(100, value))}%`, borderRadius: 99, backgroundColor: color }} />
    </View>
  );
}

export function PillStat({ icon, iconElement, text, color = T.blue }: { icon?: keyof typeof Ionicons.glyphMap; iconElement?: ReactNode; text: string; color?: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: `${color}1f` }}>
      {iconElement ?? (icon ? <Ionicons name={icon} size={12} color={color} /> : null)}
      <Text style={{ color, fontWeight: "900", fontSize: 12 }}>{text}</Text>
    </View>
  );
}

export function Sheet({
  visible,
  onClose,
  children,
  maxHeight = "82%",
  fillHeight = false,
  fullScreen = false,
  dismissible = true,
  keyboardAvoiding = true,
  expandOnKeyboard = false,
  glass = false,
  celebrationEntrance = false,
  onCelebrationSettled,
}: PropsWithChildren<{ visible: boolean; onClose: () => void; maxHeight?: ViewStyle["maxHeight"]; fillHeight?: boolean; /** Render as a locked, edge-to-edge completion screen instead of a bottom sheet. */ fullScreen?: boolean; /** Prevent backdrop, drag, and system-back dismissal while a flow must be completed. */ dismissible?: boolean; keyboardAvoiding?: boolean; expandOnKeyboard?: boolean; glass?: boolean; /** A one-off, fast reward-sheet entrance that lands before its celebration begins. */ celebrationEntrance?: boolean; onCelebrationSettled?: () => void }>) {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotionPreference();
  const { height: windowHeight } = useWindowDimensions();
  const dragY = useSharedValue(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const dragGesture = Gesture.Pan()
    .activeOffsetY(4)
    .failOffsetX([-24, 24])
    .onUpdate((event) => {
      dragY.value = Math.max(0, event.translationY);
    })
    .onEnd((event) => {
      if (event.translationY > 88 || event.velocityY > 850) {
        if (reducedMotion) {
          dragY.value = 360;
          scheduleOnRN(onClose);
          return;
        }
        dragY.value = withTiming(360, { duration: 160 }, (finished) => {
          if (finished) scheduleOnRN(onClose);
        });
        return;
      }
      dragY.value = reducedMotion ? 0 : withSpring(0, springConfig(false, motionSprings.control));
    })
    .onFinalize((_event, success) => {
      if (!success) dragY.value = reducedMotion ? 0 : withSpring(0, springConfig(false, motionSprings.control));
    });

  useEffect(() => {
    if (!visible) {
      cancelAnimation(dragY);
      return;
    }
    if (!celebrationEntrance || reducedMotion) {
      dragY.value = 0;
      if (celebrationEntrance) onCelebrationSettled?.();
      return;
    }

    // This rare reward state earns a distinct entrance: it clears the bottom
    // edge quickly, then makes one compact, smooth landing bounce.
    dragY.value = windowHeight;
    dragY.value = withSequence(
      withTiming(-14, { duration: 190, easing: motionEasing.enter }),
      withSpring(0, { stiffness: 360, damping: 23, mass: 0.68 }, (finished) => {
        if (finished && onCelebrationSettled) scheduleOnRN(onCelebrationSettled);
      }),
    );
    return () => cancelAnimation(dragY);
  }, [celebrationEntrance, dragY, onCelebrationSettled, reducedMotion, visible, windowHeight]);

  const sheetMotionStyle = useAnimatedStyle(() => ({ transform: [{ translateY: dragY.value }] }));

  useEffect(() => {
    if (!visible || !keyboardAvoiding || !expandOnKeyboard) {
      setKeyboardHeight(0);
      return;
    }

    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSubscription = Keyboard.addListener(showEvent, ({ endCoordinates }) => setKeyboardHeight(endCoordinates.height));
    const hideSubscription = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [expandOnKeyboard, keyboardAvoiding, visible]);

  const resolvedMaxHeight = resolveSheetMaxHeight(maxHeight as number | `${number}%`, windowHeight, insets.top);
  const keyboardAvailableHeight = Math.max(0, windowHeight - insets.top - responsiveLayout.sheetTopClearance);
  const expandedHeight = expandOnKeyboard && keyboardHeight > 0 && contentHeight > 0
    ? Math.min(keyboardAvailableHeight, contentHeight + keyboardHeight)
    : undefined;

  return (
    <Modal visible={visible} transparent={!fullScreen} animationType="fade" onRequestClose={() => { if (dismissible) onClose(); }}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardAvoidingView enabled={keyboardAvoiding && !expandOnKeyboard} behavior={Platform.select({ ios: "padding", android: "height" })} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: fullScreen ? T.white : glass ? "rgba(61,52,56,0.28)" : "rgba(61,52,56,0.42)", justifyContent: "flex-end" }}>
            {dismissible ? <Pressable accessibilityRole="button" accessibilityLabel="Dismiss sheet" onPress={onClose} style={{ flex: 1 }} /> : <View pointerEvents="none" style={{ flex: 1 }} />}
            <Reanimated.View
              accessibilityViewIsModal
              onLayout={({ nativeEvent }) => {
                if (keyboardHeight === 0) setContentHeight(nativeEvent.layout.height);
              }}
              style={[{
                maxHeight: fullScreen ? "100%" : expandedHeight ?? resolvedMaxHeight,
                ...(fullScreen ? { height: "100%", borderRadius: 0, borderWidth: 0, paddingBottom: insets.bottom } : fillHeight || expandedHeight !== undefined ? { height: expandedHeight ?? resolvedMaxHeight } : null),
                backgroundColor: glass ? "rgba(255,255,255,0.72)" : T.white,
                borderTopLeftRadius: fullScreen ? 0 : radius.sheet,
                borderTopRightRadius: fullScreen ? 0 : radius.sheet,
                borderWidth: fullScreen ? 0 : 2,
                borderColor: glass ? "rgba(255,255,255,0.88)" : T.border,
                borderBottomWidth: 0,
                paddingBottom: fullScreen ? insets.bottom : insets.bottom + 8,
                overflow: "hidden",
              }, sheetMotionStyle]}
            >
              {glass ? <BlurView pointerEvents="none" intensity={18} tint="light" style={{ position: "absolute", inset: 0 }} /> : null}
              {dismissible && !fullScreen ? <GestureDetector gesture={dragGesture}>
                <View accessibilityLabel="Drag down to dismiss" style={{ alignItems: "center", paddingTop: 12, paddingBottom: 12 }}>
                  <View style={{ width: 36, height: 4, borderRadius: 99, backgroundColor: T.border }} />
                </View>
              </GestureDetector> : <View style={{ height: fullScreen ? insets.top + 12 : 0 }} />}
              {children}
            </Reanimated.View>
          </View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

export function SearchInput({
  value,
  onChangeText,
  placeholder
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
}) {
  return (
    <View style={{ flex: 1, height: 48, borderRadius: 28, backgroundColor: T.white, borderWidth: 2, borderColor: T.border, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 8, ...shadow }}>
      <Ionicons name="search" size={16} color={T.muted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={T.muted}
        style={{ flex: 1, color: T.dark, fontFamily: "Rubik", fontSize: 15, lineHeight: 20, paddingVertical: 0, includeFontPadding: false, textAlignVertical: "center" }}
      />
      {value ? (
        <Pressable onPress={() => onChangeText("")}>
          <Ionicons name="close" size={15} color={T.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function GradientBand({ color, children, bleedTop = false, bleedTopSpacing = 16 }: PropsWithChildren<{ color: string; bleedTop?: boolean; bleedTopSpacing?: number }>) {
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top + 8, 20);

  return (
    <LinearGradient
      colors={[`${color}22`, "rgba(255,255,255,0)"]}
      style={{
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: `${color}28`,
        ...(bleedTop ? { marginTop: -topPadding, paddingTop: topPadding + bleedTopSpacing } : {})
      }}
    >
      {children}
    </LinearGradient>
  );
}

type EmptyStateVisual = {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
};

/**
 * Empty states use the same icon family as navigation and actions. This keeps
 * their personality without relying on an emoji's platform-specific rendering.
 */
function emptyStateVisual(emoji?: string): EmptyStateVisual {
  switch (emoji) {
    case "!":
    case "⚠️":
      return { icon: "alert-circle-outline", color: T.red };
    case "🌍":
      return { icon: "globe-outline", color: T.teal };
    case "🤝":
    case "👋":
    case "🫂":
      return { icon: "people-outline", color: T.teal };
    case "📷":
      return { icon: "camera-outline", color: T.pink };
    case "📭":
    case "🗂️":
      return { icon: "bookmarks-outline", color: T.purple };
    case "🔍":
    case "🔎":
      return { icon: "search-outline", color: T.purple };
    case "✅":
      return { icon: "checkmark-circle-outline", color: T.green };
    case "🧭":
      return { icon: "compass-outline", color: T.blue };
    case "⏳":
      return { icon: "hourglass-outline", color: T.orange };
    case "✨":
      return { icon: "sparkles-outline", color: T.purple };
    default:
      return { icon: "sparkles-outline", color: T.blue };
  }
}

function EmptyStateIcon({ emoji }: { emoji?: string }) {
  const { icon, color } = emptyStateVisual(emoji);
  return (
    <View
      style={{
        width: 66,
        height: 66,
        borderRadius: 23,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: `${color}14`,
        borderWidth: 2,
        borderColor: `${color}36`,
        borderBottomWidth: 4,
        borderBottomColor: `${color}52`
      }}
    >
      <Ionicons name={icon} size={31} color={color} />
    </View>
  );
}

export function EmptyState({ emoji, artwork, title, body, action, fill = false, framed = fill }: { emoji?: string; artwork?: React.ReactNode; title: string; body: string; action?: React.ReactNode; fill?: boolean; /** Wrap the state in a QuestLife tactile surface. */ framed?: boolean }) {
  return (
    <View accessibilityRole="summary" style={{ flex: fill ? 1 : undefined, minHeight: fill ? 292 : undefined, width: framed ? "100%" : undefined, alignSelf: framed ? "stretch" : undefined, justifyContent: "center", alignItems: "center", paddingVertical: fill ? 48 : 30, paddingHorizontal: 24, ...(framed ? { borderRadius: radius.xl, borderWidth: 2, borderColor: T.border, borderBottomWidth: 6, borderBottomColor: "#dfd6cc", backgroundColor: T.white, boxShadow: `4px 4px 0px ${T.border}` } : {}) }}>
      {artwork ? <View style={{ marginBottom: 18 }}>{artwork}</View> : <View style={{ marginBottom: 18 }}><EmptyStateIcon emoji={emoji} /></View>}
      <Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 21, lineHeight: 27, letterSpacing: -0.35, textAlign: "center", marginBottom: 8 }}>{title}</Text>
      <Text style={{ color: T.muted, fontFamily: "Rubik", fontSize: 15, lineHeight: 22, textAlign: "center", maxWidth: 325, marginBottom: action ? 22 : 0 }}>{body}</Text>
      {action}
    </View>
  );
}

const styles: Record<string, TextStyle> = {
  eyebrow: {
    color: T.muted,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 4
  },
  title: {
    color: T.dark,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "900"
  },
  subtitle: {
    color: T.muted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "900",
    letterSpacing: 0.7,
    textTransform: "uppercase",
    marginTop: 2
  }
};

export function sectionTitle(text: string) {
  return <Text style={{ color: T.dark, fontSize: 18, fontWeight: "900" }}>{text}</Text>;
}

export function isAndroid() {
  return Platform.OS === "android";
}
