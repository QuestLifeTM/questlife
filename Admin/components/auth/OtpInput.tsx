import { useRef } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { T } from "@/components/theme";

type OtpInputProps = {
  code: string;
  disabled?: boolean;
  onChangeCode: (code: string) => void;
};

export function OtpInput({ code, disabled, onChangeCode }: OtpInputProps) {
  const inputRef = useRef<TextInput>(null);
  const digits = Array.from({ length: 6 }, (_, index) => code[index] ?? "");

  return (
    <Pressable
      accessibilityLabel="Verification code"
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => inputRef.current?.focus()}
      style={styles.wrap}
    >
      <TextInput
        ref={inputRef}
        autoComplete="one-time-code"
        editable={!disabled}
        keyboardType="number-pad"
        maxLength={6}
        onChangeText={(value) => onChangeCode(value.replace(/\D/g, ""))}
        style={styles.hiddenInput}
        textContentType="oneTimeCode"
        value={code}
      />
      {digits.map((digit, index) => (
        <View
          key={index}
          style={[styles.cell, digit ? styles.cellFilled : null]}
        >
          <TextInput
            editable={false}
            pointerEvents="none"
            style={styles.cellText}
            value={digit}
          />
        </View>
      ))}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
  },
  hiddenInput: {
    height: 1,
    opacity: 0,
    position: "absolute",
    width: 1,
  },
  cell: {
    alignItems: "center",
    backgroundColor: T.white,
    borderColor: T.border,
    borderRadius: 12,
    borderWidth: 1,
    height: 50,
    justifyContent: "center",
    width: 43,
  },
  cellFilled: {
    borderColor: T.blue,
  },
  cellText: {
    color: T.dark,
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
  },
});
