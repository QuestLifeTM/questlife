import { zodResolver } from "@hookform/resolvers/zod";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Alert, StyleSheet, Text, View } from "react-native";

import { AuthInput, BackButton, PasswordToggle, PrimaryButton } from "@/components/auth/AuthControls";
import { AuthScaffold } from "@/components/auth/AuthScaffold";
import { AuthTitle } from "@/components/auth/AuthText";
import { PasswordStrength } from "@/components/auth/PasswordStrength";
import { T } from "@/components/theme";
import { registerWithEmail } from "@/services/auth/authService";
import { getAuthErrorMessage } from "@/utils/authErrors";
import { signUpPasswordSchema, type SignUpPasswordForm } from "@/validation/authSchemas";

export default function RegisterScreen() {
  const { email, firstName } = useLocalSearchParams<{ email?: string; firstName?: string }>();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { control, formState: { errors, isValid }, handleSubmit } = useForm<SignUpPasswordForm>({
    defaultValues: { confirmPassword: "", password: "" },
    mode: "onChange",
    resolver: zodResolver(signUpPasswordSchema),
  });
  const password = useWatch({ control, name: "password" });

  async function onSubmit(values: SignUpPasswordForm) {
    if (!email) {
      router.replace({ pathname: "/(auth)/auth-options", params: firstName ? { firstName } : {} });
      return;
    }

    try {
      setLoading(true);
      const result = await registerWithEmail(email, firstName ?? "", values.password);
      router.replace({ pathname: "/(auth)/verify-email", params: { email: result.email } });
    } catch (error) {
      Alert.alert("Could not create account", getAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScaffold>
      <BackButton onPress={() => router.back()} />
      <AuthTitle subtitle={email ? `Creating an account for ${email}` : "Choose a password to protect your account."}>Create a secure password</AuthTitle>
      <View style={styles.form}>
        <Controller control={control} name="password" render={({ field: { onBlur, onChange, value } }) => (
          <View style={styles.passwordGroup}>
            <AuthInput autoComplete="new-password" error={errors.password?.message} icon="lock-closed-outline" onBlur={onBlur} onChangeText={onChange} placeholder="Password" rightElement={<PasswordToggle visible={showPassword} onPress={() => setShowPassword((current) => !current)} />} secureTextEntry={!showPassword} textContentType="newPassword" value={value} />
            <PasswordStrength password={password} />
          </View>
        )} />
        <Controller control={control} name="confirmPassword" render={({ field: { onBlur, onChange, value } }) => (
          <AuthInput autoComplete="new-password" error={errors.confirmPassword?.message} icon="lock-closed-outline" onBlur={onBlur} onChangeText={onChange} placeholder="Confirm Password" rightElement={<PasswordToggle visible={showConfirmPassword} onPress={() => setShowConfirmPassword((current) => !current)} />} secureTextEntry={!showConfirmPassword} textContentType="newPassword" value={value} />
        )} />
      </View>
      <PrimaryButton disabled={!isValid || loading} loading={loading} onPress={handleSubmit(onSubmit)} title={loading ? "Creating account…" : "Sign up"} />
      <Text style={styles.footer}>By continuing, you agree to keep your account credentials private.</Text>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  form: { gap: 16, marginBottom: 22 },
  passwordGroup: { gap: 10 },
  footer: { color: T.muted, fontSize: 12, lineHeight: 18, marginTop: 18, textAlign: "center" },
});
