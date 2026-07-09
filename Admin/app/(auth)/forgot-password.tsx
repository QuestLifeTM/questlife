import { zodResolver } from "@hookform/resolvers/zod";
import { router } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Alert, StyleSheet, View } from "react-native";

import {
  AuthInput,
  BackButton,
  PrimaryButton,
} from "@/components/auth/AuthControls";
import { AuthTitle } from "@/components/auth/AuthText";
import { AuthScaffold } from "@/components/auth/AuthScaffold";
import { sendPasswordReset } from "@/services/auth/authService";
import { getAuthErrorMessage } from "@/utils/authErrors";
import {
  ForgotPasswordForm,
  forgotPasswordSchema,
} from "@/validation/authSchemas";

export default function ForgotPasswordScreen() {
  const [loading, setLoading] = useState(false);
  const {
    control,
    formState: { errors, isValid },
    handleSubmit,
  } = useForm<ForgotPasswordForm>({
    defaultValues: {
      email: "",
    },
    mode: "onChange",
    resolver: zodResolver(forgotPasswordSchema),
  });

  async function handleResetEmail(values: ForgotPasswordForm) {
    try {
      setLoading(true);
      await sendPasswordReset(values.email);
      Alert.alert(
        "Check your email",
        "We sent a password reset link to your email address.",
        [{ text: "OK", onPress: () => router.replace("/(auth)/login") }],
      );
    } catch (resetError) {
      Alert.alert("Reset failed", getAuthErrorMessage(resetError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScaffold>
      <BackButton onPress={() => router.replace("/(auth)/login")} />
      <AuthTitle subtitle="Enter your email address">
        {"Forget\nPassword?"}
      </AuthTitle>

      <View style={styles.form}>
        <Controller
          control={control}
          name="email"
          render={({ field: { onBlur, onChange, value } }) => (
            <AuthInput
              autoComplete="email"
              error={errors.email?.message}
              icon="mail-outline"
              keyboardType="email-address"
              onBlur={onBlur}
              onChangeText={onChange}
              placeholder="Email"
              textContentType="emailAddress"
              value={value}
            />
          )}
        />
      </View>

      <PrimaryButton
        disabled={!isValid || loading}
        loading={loading}
        onPress={handleSubmit(handleResetEmail)}
        title={loading ? "Sending..." : "Send"}
      />
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  form: {
    marginBottom: 28,
  },
});
