import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { PropsWithChildren, useEffect, useRef, useState } from "react";
import Reanimated from "react-native-reanimated";
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, shadow, T } from "@/components/theme";
import { BackIcon } from "@/components/back-icon";
import { ScrollTopBlur, useTopScrollBlur } from "@/components/scroll-top-blur";
import { isHapticFeedbackEnabled } from "@/services/settings/settingsService";

const MIN_SCREEN_GUTTER = 16;
const MAX_SCREEN_GUTTER = 24;
const DEFAULT_CONTENT_MAX_WIDTH = 520;
const NAVIGATION_PRESS_COOLDOWN_MS = 650;

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

export function responsiveScreenGutter(width: number) {
  return Math.round(Math.min(MAX_SCREEN_GUTTER, Math.max(MIN_SCREEN_GUTTER, width * 0.05)));
}

/**
 * Shared layout values for screens that need to manage their own horizontal
 * content container. This keeps custom screens aligned with `Screen`.
 */
export function useResponsiveScreenLayout(maxContentWidth = DEFAULT_CONTENT_MAX_WIDTH) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const safeWidth = Math.max(0, width - insets.left - insets.right);
  const contentWidth = Math.min(safeWidth, maxContentWidth);

  return {
    contentWidth,
    horizontalPadding: responsiveScreenGutter(contentWidth),
    safeAreaOffset: (insets.left - insets.right) / 2,
    insets
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
  contentStyle,
  ambientGlow = true
}: PropsWithChildren<{ scroll?: boolean; padded?: boolean; contentStyle?: StyleProp<ViewStyle>; ambientGlow?: boolean }>) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const topPadding = Math.max(insets.top + 8, 20);
  const horizontalPadding = responsiveScreenGutter(width);
  const { onScroll, scrollY } = useTopScrollBlur();
  if (!scroll) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg }}>
        {ambientGlow ? <AmbientGlow /> : null}
        <View style={[{ flex: 1, paddingTop: topPadding }, padded && { paddingLeft: insets.left + horizontalPadding, paddingRight: insets.right + horizontalPadding }, contentStyle]}>
          {children}
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
          { paddingTop: topPadding, paddingBottom: insets.bottom + 112, gap: 18 },
          padded && { paddingLeft: insets.left + horizontalPadding, paddingRight: insets.right + horizontalPadding },
          contentStyle
        ]}
      >
        {children}
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
  const opacity = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 260, delay, useNativeDriver: true }),
      Animated.spring(y, { toValue: 0, delay, damping: 18, stiffness: 180, mass: 0.8, useNativeDriver: true })
    ]).start();
  }, [delay, opacity, y]);

  return <Animated.View style={[style, { opacity, transform: [{ translateY: y }] }]}>{children}</Animated.View>;
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
          borderBottomWidth: pressed && !disabled ? 2 : 5,
          borderBottomColor: `${color}88`,
          opacity: disabled ? 0.5 : 1,
          transform: [{ scale: pressed && !disabled ? 0.96 : 1 }, { translateY: pressed && !disabled ? 3 : 0 }]
        },
        style
      ]}
    >
      {icon ? <Ionicons name={icon} size={17} color={inverse ? color : T.white} /> : null}
      <Text style={{ fontSize: 15, fontWeight: "800", color: inverse ? color : T.white }}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  color = T.muted,
  bg = T.white,
  badge,
  label,
  size = 44
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  color?: string;
  bg?: string;
  badge?: string | number;
  label?: string;
  /** Use a larger category-pill control where a header needs it. */
  size?: number;
}) {
  const isBackButton = icon === "chevron-back" || icon === "arrow-back";
  const isFilled = bg !== T.white;
  const accent = isFilled ? bg : (isBackButton ? T.blue : color);
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
  keyboardAvoiding = true,
  expandOnKeyboard = false,
  glass = false
}: PropsWithChildren<{ visible: boolean; onClose: () => void; maxHeight?: ViewStyle["maxHeight"]; fillHeight?: boolean; keyboardAvoiding?: boolean; expandOnKeyboard?: boolean; glass?: boolean }>) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const dragY = useRef(new Animated.Value(0)).current;
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const dragResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 4 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderMove: (_, gesture) => dragY.setValue(Math.max(0, gesture.dy)),
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dy > 88 || gesture.vy > 0.85) {
        Animated.timing(dragY, { toValue: 360, duration: 160, useNativeDriver: true }).start(({ finished }) => {
          if (finished) onCloseRef.current();
        });
        return;
      }
      Animated.spring(dragY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 240 }).start();
    },
    onPanResponderTerminate: () => Animated.spring(dragY, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 240 }).start(),
  })).current;

  useEffect(() => {
    if (visible) dragY.setValue(0);
  }, [dragY, visible]);

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

  const maxHeightPixels = typeof maxHeight === "number"
    ? maxHeight
    : typeof maxHeight === "string" && maxHeight.endsWith("%")
      ? (windowHeight * Number.parseFloat(maxHeight)) / 100
      : 0;
  const keyboardAvailableHeight = Math.max(0, windowHeight - keyboardHeight - insets.top - 12);
  const expandedHeight = expandOnKeyboard && keyboardHeight > 0
    ? Math.min(keyboardAvailableHeight, Math.max(maxHeightPixels, 360))
    : undefined;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView enabled={keyboardAvoiding} behavior={Platform.select({ ios: "padding", android: "height" })} style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: glass ? "rgba(61,52,56,0.28)" : "rgba(61,52,56,0.42)", justifyContent: "flex-end" }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss sheet" onPress={onClose} style={{ flex: 1 }} />
        <Animated.View
          accessibilityViewIsModal
          style={{
            maxHeight: expandedHeight ?? maxHeight,
            ...(fillHeight || expandedHeight !== undefined ? { height: expandedHeight ?? maxHeight } : null),
            backgroundColor: glass ? "rgba(255,255,255,0.72)" : T.white,
            borderTopLeftRadius: radius.sheet,
            borderTopRightRadius: radius.sheet,
            borderWidth: 2,
            borderColor: glass ? "rgba(255,255,255,0.88)" : T.border,
            borderBottomWidth: 0,
            paddingBottom: insets.bottom + 8,
            overflow: "hidden",
            transform: [{ translateY: dragY }],
          }}
        >
          {glass ? <BlurView pointerEvents="none" intensity={18} tint="light" style={{ position: "absolute", inset: 0 }} /> : null}
          <View {...dragResponder.panHandlers} accessibilityLabel="Drag down to dismiss" style={{ alignItems: "center", paddingTop: 12, paddingBottom: 12 }}>
            <View style={{ width: 36, height: 4, borderRadius: 99, backgroundColor: T.border }} />
          </View>
          {children}
        </Animated.View>
      </View>
      </KeyboardAvoidingView>
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

export function EmptyState({ emoji, artwork, title, body, action }: { emoji?: string; artwork?: React.ReactNode; title: string; body: string; action?: React.ReactNode }) {
  return (
    <View style={{ alignItems: "center", paddingVertical: 32, paddingHorizontal: 18 }}>
      {artwork ? <View style={{ marginBottom: 12 }}>{artwork}</View> : emoji ? <Text style={{ fontSize: 44, marginBottom: 12 }}>{emoji}</Text> : null}
      <Text style={{ color: T.dark, fontWeight: "900", fontSize: 18, marginBottom: 8 }}>{title}</Text>
      <Text style={{ color: T.muted, fontWeight: "600", lineHeight: 20, textAlign: "center", marginBottom: action ? 18 : 0 }}>{body}</Text>
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
