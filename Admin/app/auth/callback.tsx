import * as Linking from "expo-linking";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { T } from "@/components/theme";
import { exchangeAuthCodeForSession } from "@/services/auth/authService";

export default function AuthCallback() {
  const params = useLocalSearchParams<{ code?: string }>();
  const [done, setDone] = useState(false);
  const [redirectTo, setRedirectTo] = useState<"/(tabs)" | "/(auth)/login">(
    "/(auth)/login",
  );

  useEffect(() => {
    let mounted = true;

    async function finishAuth() {
      const url = await Linking.getInitialURL();
      const parsed = url ? Linking.parse(url) : null;
      const code = params.code ?? parsed?.queryParams?.code;

      if (typeof code === "string") {
        try {
          await exchangeAuthCodeForSession(code);
          if (mounted) {
            setRedirectTo("/(tabs)");
          }
        } catch {
          // Keep failed or expired callback links out of protected routes.
          if (mounted) {
            setRedirectTo("/(auth)/login");
          }
        }
      }

      if (mounted) {
        setDone(true);
      }
    }

    finishAuth();

    return () => {
      mounted = false;
    };
  }, [params.code]);

  if (done) {
    return <Redirect href={redirectTo} />;
  }

  return (
    <View style={styles.root}>
      <ActivityIndicator color={T.blue} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: T.bg,
  },
});
