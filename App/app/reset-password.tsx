import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Alert, StyleSheet, View } from "react-native";

import {
  AuthInput,
  BackButton,
  PasswordToggle,
  PrimaryButton,
} from "@/components/auth/AuthControls";
import { AuthTitle } from "@/components/auth/AuthText";
import { AuthScaffold } from "@/components/auth/AuthScaffold";
import {
  exchangeAuthCodeForSession,
  updatePassword,
} from "@/services/auth/authService";
import { getAuthErrorMessage } from "@/utils/authErrors";
import {
  ResetPasswordForm,
  resetPasswordSchema,
} from "@/validation/authSchemas";

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ code?: string }>();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preparing, setPreparing] = useState(Boolean(params.code));
  const {
    control,
    formState: { errors, isValid },
    handleSubmit,
  } = useForm<ResetPasswordForm>({
    defaultValues: {
      confirmPassword: "",
      password: "",
    },
    mode: "onChange",
    resolver: zodResolver(resetPasswordSchema),
  });

  useEffect(() => {
    async function exchangeRecoveryCode() {
      if (!params.code) {
        return;
      }

      try {
        await exchangeAuthCodeForSession(params.code);
      } catch (error) {
        Alert.alert("Reset link failed", getAuthErrorMessage(error));
      }
      setPreparing(false);
    }

    exchangeRecoveryCode();
  }, [params.code]);

  async function handleSave(values: ResetPasswordForm) {
    setLoading(true);
    try {
      await updatePassword(values.password);
      Alert.alert("Password updated", "You can now continue to QuestLife.", [
        { text: "OK", onPress: () => router.replace("/(tabs)") },
      ]);
    } catch (error) {
      Alert.alert("Password update failed", getAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScaffold>
      <BackButton onPress={() => router.replace("/(auth)/login")} />
      <AuthTitle
        subtitle={"Your new password must be different\nfrom previously used password"}
      >
        {"Create\nNew password"}
      </AuthTitle>

      <View style={styles.form}>
        <Controller
          control={control}
          name="password"
          render={({ field: { onBlur, onChange, value } }) => (
            <AuthInput
              autoComplete="new-password"
              editable={!preparing}
              error={errors.password?.message}
              icon="lock-closed-outline"
              onBlur={onBlur}
              onChangeText={onChange}
              placeholder="New password"
              rightElement={
                <PasswordToggle
                  visible={showPassword}
                  onPress={() => setShowPassword((current) => !current)}
                />
              }
              secureTextEntry={!showPassword}
              textContentType="newPassword"
              value={value}
            />
          )}
        />
        <Controller
          control={control}
          name="confirmPassword"
          render={({ field: { onBlur, onChange, value } }) => (
            <AuthInput
              autoComplete="new-password"
              editable={!preparing}
              error={errors.confirmPassword?.message}
              icon="lock-closed-outline"
              onBlur={onBlur}
              onChangeText={onChange}
              placeholder="Confirm password"
              rightElement={
                <PasswordToggle
                  visible={showConfirmPassword}
                  onPress={() => setShowConfirmPassword((current) => !current)}
                />
              }
              secureTextEntry={!showConfirmPassword}
              textContentType="newPassword"
              value={value}
            />
          )}
        />
      </View>

      <PrimaryButton
        disabled={!isValid || loading || preparing}
        loading={loading || preparing}
        onPress={handleSubmit(handleSave)}
        title={preparing ? "Opening reset link..." : loading ? "Saving..." : "Save"}
      />
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 13,
    marginBottom: 30,
  },
});
