import { Ionicons } from "@expo/vector-icons";
import { ComponentProps, ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View
} from "react-native";
import { radius, shadow, T } from "@/components/theme";
import { haptic } from "@/components/ui";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

type AuthInputProps = TextInputProps & {
  icon: IoniconName;
  error?: string;
  label?: string;
  rightElement?: ReactNode;
};

export function AuthInput({ icon, error, label, rightElement, style, ...props }: AuthInputProps) {
  return (
    <View style={styles.inputWrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputShell, error ? styles.inputError : null]}>
        <Ionicons name={icon} size={17} color={error ? T.red : T.muted} />
        <TextInput
          placeholderTextColor={T.muted}
          selectionColor={T.blue}
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.input, style]}
          {...props}
        />
        {rightElement ? <View style={styles.right}>{rightElement}</View> : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

type PrimaryButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
};

export function PrimaryButton({ title, onPress, disabled, loading }: PrimaryButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={() => {
        haptic();
        onPress();
      }}
      style={({ pressed }) => [
        styles.primaryButton,
        pressed && !disabled ? styles.pressed : null,
        disabled || loading ? styles.disabled : null
      ]}
    >
      {loading ? <ActivityIndicator color={T.white} /> : null}
      <Text style={styles.primaryLabel}>{title}</Text>
    </Pressable>
  );
}

type OutlineButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  children?: ReactNode;
};

export function OutlineButton({ title, onPress, disabled, children }: OutlineButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => {
        haptic();
        onPress();
      }}
      style={({ pressed }) => [
        styles.outlineButton,
        pressed && !disabled ? styles.pressed : null,
        disabled ? styles.disabled : null
      ]}
    >
      {children}
      <Text style={styles.outlineLabel}>{title}</Text>
    </Pressable>
  );
}

export function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        haptic();
        onPress();
      }}
      hitSlop={10}
      style={styles.backButton}
    >
      <Ionicons name="arrow-back" color={T.dark} size={17} />
      <Text style={styles.backLabel}>Back</Text>
    </Pressable>
  );
}

export function Divider() {
  return (
    <View style={styles.divider}>
      <View style={styles.line} />
      <Text style={styles.dividerText}>or</Text>
      <View style={styles.line} />
    </View>
  );
}

export function PasswordToggle({ visible, onPress }: { visible: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel={visible ? "Hide password" : "Show password"}
      accessibilityRole="button"
      hitSlop={8}
      onPress={() => {
        haptic();
        onPress();
      }}
    >
      <Ionicons color={T.muted} name={visible ? "eye-off-outline" : "eye-outline"} size={18} />
    </Pressable>
  );
}

export function GoogleIcon() {
  return (
    <View style={styles.googleIcon}>
      <Text style={styles.googleG}>G</Text>
    </View>
  );
}

export function AppleIcon() {
  return <Ionicons color={T.dark} name="logo-apple" size={20} />;
}

const styles = StyleSheet.create({
  inputWrap: {
    gap: 6
  },
  inputShell: {
    minHeight: 54,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: T.border,
    backgroundColor: T.white,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    ...shadow
  },
  inputError: {
    borderColor: T.red,
    backgroundColor: "rgba(225,112,85,0.08)"
  },
  input: {
    flex: 1,
    color: T.dark,
    fontSize: 15,
    fontWeight: "700",
    minHeight: 50
  },
  right: {
    width: 26,
    alignItems: "center"
  },
  error: {
    color: T.red,
    fontSize: 12,
    fontWeight: "800",
    paddingHorizontal: 4
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 999,
    backgroundColor: T.blue,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10
  },
  label: {
    color: T.dark,
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 4
  },
  primaryLabel: {
    color: T.white,
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0
  },
  outlineButton: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: T.border,
    backgroundColor: T.white,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 12
  },
  outlineLabel: {
    color: T.dark,
    fontSize: 14,
    fontWeight: "900"
  },
  disabled: {
    opacity: 0.58
  },
  pressed: {
    transform: [{ scale: 0.97 }]
  },
  backButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 26
  },
  backLabel: {
    color: T.dark,
    fontSize: 14,
    fontWeight: "800"
  },
  divider: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: T.border
  },
  dividerText: {
    color: T.muted,
    fontSize: 12,
    fontWeight: "800"
  },
  googleIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: T.white,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: "center",
    justifyContent: "center"
  },
  googleG: {
    color: "#4285F4",
    fontSize: 13,
    fontWeight: "900"
  }
});
