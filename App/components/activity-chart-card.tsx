import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef } from "react";
import { Animated, StyleProp, Text, View, ViewStyle } from "react-native";

import { T } from "@/components/theme";
import { Card } from "@/components/ui";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";

export type ActivityDataPoint = {
  day: string;
  value: number;
};

type ActivityChartCardProps = {
  title?: string;
  totalValue: string;
  data: ActivityDataPoint[];
  style?: StyleProp<ViewStyle>;
  active?: boolean;
};

/** A native, seven-day completed-quest chart for the Profile stats screen. */
export function ActivityChartCard({ title = "Weekly activity", totalValue, data, style, active = true }: ActivityChartCardProps) {
  const reduceMotion = useReducedMotionPreference();
  const progress = useRef<Animated.Value[]>([]);
  const maxValue = useMemo(() => Math.max(1, ...data.map((item) => item.value)), [data]);

  while (progress.current.length < data.length) progress.current.push(new Animated.Value(0));

  useEffect(() => {
    const animations = data.map((_, index) => {
      const value = progress.current[index];
      value.setValue(reduceMotion ? 1 : 0);
      return Animated.timing(value, { toValue: 1, duration: 460, useNativeDriver: false });
    });
    if (!active || reduceMotion) return;
    const sequence = Animated.stagger(70, animations);
    sequence.start();
    return () => sequence.stop();
  }, [active, data, reduceMotion]);

  return (
    <Card style={[{ borderRadius: 24, padding: 18, gap: 18 }, style]}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 19, lineHeight: 24 }}>{title}</Text>
          <Text style={{ color: T.muted, fontFamily: "Rubik", fontSize: 12, lineHeight: 16, fontWeight: "700" }}>Completed quests · last 7 days</Text>
        </View>
        <View style={{ minWidth: 72, alignItems: "flex-end", gap: 1 }}>
          <Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 25, lineHeight: 29, fontVariant: ["tabular-nums"] }}>{totalValue}</Text>
          <Text style={{ color: T.muted, fontFamily: "RubikBold", fontSize: 10, lineHeight: 13, letterSpacing: 0.3, textTransform: "uppercase" }}>this week</Text>
        </View>
      </View>
      <View accessibilityRole="image" accessibilityLabel={`${totalValue} completed quests in the last seven days`} style={{ height: 128, flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
        {data.map((item, index) => {
          const targetHeight = Math.max(item.value ? 12 : 5, Math.round((item.value / maxValue) * 96));
          const height = progress.current[index].interpolate({ inputRange: [0, 1], outputRange: [0, targetHeight] });
          return (
            <View key={`${item.day}-${index}`} style={{ flex: 1, height: "100%", minWidth: 0, alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
              <View style={{ width: "100%", height: 96, justifyContent: "flex-end", overflow: "hidden", borderRadius: 11, backgroundColor: `${T.blue}12` }}>
                <Animated.View style={{ width: "100%", height, borderRadius: 11, backgroundColor: item.value ? T.blue : `${T.blue}33` }} />
              </View>
              <Text style={{ color: T.muted, fontFamily: "RubikBold", fontSize: 11, lineHeight: 15 }}>{item.day}</Text>
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Ionicons name="checkmark-circle" size={15} color={T.green} />
        <Text style={{ color: T.muted, fontFamily: "Rubik", fontSize: 12, lineHeight: 16, fontWeight: "700" }}>Each bar is a day of completed quests.</Text>
      </View>
    </Card>
  );
}
