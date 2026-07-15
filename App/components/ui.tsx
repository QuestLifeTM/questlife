import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { PropsWithChildren, useEffect, useRef } from "react";
import {
  Animated,
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

const MIN_SCREEN_GUTTER = 16;
const MAX_SCREEN_GUTTER = 24;
const DEFAULT_CONTENT_MAX_WIDTH = 520;

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
  if (process.env.EXPO_OS === "ios") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }
}

export function Screen({
  children,
  scroll = true,
  padded = true,
  contentStyle
}: PropsWithChildren<{ scroll?: boolean; padded?: boolean; contentStyle?: StyleProp<ViewStyle> }>) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const topPadding = Math.max(insets.top + 8, 20);
  const horizontalPadding = responsiveScreenGutter(width);
  if (!scroll) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg }}>
        <AmbientGlow />
        <View style={[{ flex: 1, paddingTop: topPadding }, padded && { paddingLeft: insets.left + horizontalPadding, paddingRight: insets.right + horizontalPadding }, contentStyle]}>
          {children}
        </View>
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <AmbientGlow />
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          { paddingTop: topPadding, paddingBottom: insets.bottom + 112, gap: 18 },
          padded && { paddingLeft: insets.left + horizontalPadding, paddingRight: insets.right + horizontalPadding },
          contentStyle
        ]}
      >
        {children}
      </ScrollView>
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
  style
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  color?: string;
  inverse?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={() => {
        haptic();
        onPress?.();
      }}
      style={({ pressed }) => [
        {
          minHeight: 48,
          paddingHorizontal: 18,
          borderRadius: 28,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          backgroundColor: inverse ? T.white : color,
          borderWidth: inverse ? 2 : 0,
          borderColor: inverse ? T.border : "transparent",
          transform: [{ scale: pressed ? 0.96 : 1 }]
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
  label
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  color?: string;
  bg?: string;
  badge?: string | number;
  label?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        haptic();
        onPress?.();
      }}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 24,
        backgroundColor: bg,
        borderWidth: 2,
        borderColor: T.border,
        alignItems: "center",
        justifyContent: "center",
        ...shadow,
        transform: [{ scale: pressed ? 0.9 : 1 }]
      })}
    >
      <Ionicons name={icon} size={19} color={color} />
      {badge !== undefined ? (
        <View style={{ position: "absolute", top: -5, right: -5, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: T.cyan, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 }}>
          <Text style={{ color: T.white, fontWeight: "900", fontSize: 10 }}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function Tag({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <View style={{ borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: bg, alignSelf: "flex-start" }}>
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

export function PillStat({ icon, text, color = T.blue }: { icon?: keyof typeof Ionicons.glyphMap; text: string; color?: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: `${color}1f` }}>
      {icon ? <Ionicons name={icon} size={12} color={color} /> : null}
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
  keyboardAvoiding = true
}: PropsWithChildren<{ visible: boolean; onClose: () => void; maxHeight?: ViewStyle["maxHeight"]; fillHeight?: boolean; keyboardAvoiding?: boolean }>) {
  const insets = useSafeAreaInsets();
  const dragY = useRef(new Animated.Value(0)).current;
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

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView enabled={keyboardAvoiding} behavior={Platform.select({ ios: "padding", android: "height" })} style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: "rgba(61,52,56,0.42)", justifyContent: "flex-end" }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss sheet" onPress={onClose} style={{ flex: 1 }} />
        <Animated.View
          accessibilityViewIsModal
          style={{
            maxHeight,
            ...(fillHeight ? { height: maxHeight } : null),
            backgroundColor: T.white,
            borderTopLeftRadius: radius.sheet,
            borderTopRightRadius: radius.sheet,
            borderWidth: 2,
            borderColor: T.border,
            borderBottomWidth: 0,
            paddingBottom: insets.bottom + 8,
            overflow: "hidden",
            transform: [{ translateY: dragY }],
          }}
        >
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

export function GradientBand({ color, children, bleedTop = false }: PropsWithChildren<{ color: string; bleedTop?: boolean }>) {
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top + 8, 20);

  return (
    <LinearGradient
      colors={[`${color}22`, "rgba(255,255,255,0)"]}
      style={{
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: `${color}28`,
        ...(bleedTop ? { marginTop: -topPadding, paddingTop: topPadding + 16 } : {})
      }}
    >
      {children}
    </LinearGradient>
  );
}

export function EmptyState({ emoji, title, body, action }: { emoji: string; title: string; body: string; action?: React.ReactNode }) {
  return (
    <View style={{ alignItems: "center", paddingVertical: 32, paddingHorizontal: 18 }}>
      <Text style={{ fontSize: 44, marginBottom: 12 }}>{emoji}</Text>
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
