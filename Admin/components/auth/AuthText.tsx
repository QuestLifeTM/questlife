import { StyleSheet, Text, View } from "react-native";
import { T } from "@/components/theme";

type AuthTitleProps = {
  children: string;
  subtitle?: string;
};

export function AuthTitle({ children, subtitle }: AuthTitleProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.brand}>QuestLife</Text>
      <Text style={styles.title}>{children}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 30,
    gap: 10
  },
  brand: {
    color: T.blue,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.7,
    textTransform: "uppercase"
  },
  title: {
    color: T.dark,
    fontSize: 40,
    lineHeight: 45,
    fontWeight: "900",
    letterSpacing: 0
  },
  subtitle: {
    color: T.muted,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "700"
  }
});
