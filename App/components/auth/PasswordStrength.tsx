import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { T } from "@/components/theme";
import { getPasswordStrength } from "@/utils/passwordStrength";

export function PasswordStrength({ password }: { password: string }) {
  if (!password) {
    return null;
  }

  const strength = getPasswordStrength(password);
  const fill = strength.score === 3 ? T.green : strength.score === 2 ? T.orange : T.red;

  return (
    <View style={styles.wrap} accessibilityLiveRegion="polite">
      <View style={styles.header}>
        <View style={styles.track}>
          <View style={[styles.progress, { backgroundColor: fill, width: `${strength.progress * 100}%` }]} />
        </View>
        <Text style={[styles.label, { color: fill }]}>{strength.label}</Text>
      </View>

      <View style={styles.requirements}>
        {strength.requirements.map((item) => (
          <View key={item.label} style={styles.requirement}>
            <Ionicons color={item.met ? T.green : T.muted} name={item.met ? "checkmark-circle" : "close-circle-outline"} size={15} />
            <Text style={[styles.requirementText, item.met && styles.met]}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
    paddingHorizontal: 4
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10
  },
  track: {
    backgroundColor: T.border,
    borderRadius: 999,
    flex: 1,
    height: 6,
    overflow: "hidden"
  },
  progress: {
    borderRadius: 999,
    height: "100%"
  },
  label: {
    fontSize: 11,
    fontWeight: "900",
    minWidth: 48
  },
  requirements: {
    gap: 6
  },
  requirement: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7
  },
  requirementText: {
    color: T.muted,
    fontSize: 12,
    fontWeight: "700"
  },
  met: {
    color: T.dark
  }
});
