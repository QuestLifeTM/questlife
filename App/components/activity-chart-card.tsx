import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo } from "react";
import { StyleProp, Text, View, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";

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

function ActivityBar({ height, color, delay, active }: { height: number; color: string; delay: number; active: boolean }) {
  const reduceMotion = useReducedMotionPreference();
  const progress = useSharedValue(reduceMotion || !active ? 1 : 0);

  useEffect(() => {
    progress.value = reduceMotion || !active ? 1 : 0;
    if (!active || reduceMotion) return;
    progress.value = withDelay(delay, withTiming(1, { duration: 460 }));
  }, [active, delay, progress, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: progress.value }] }));

  return <Animated.View style={[{ width: "100%", height, borderRadius: 11, backgroundColor: color, transformOrigin: "bottom center" }, animatedStyle]} />;
}

/** A native, seven-day completed-quest chart for the private Your Stats dashboard. */
export function ActivityChartCard({ title = "Weekly activity", totalValue, data, style, active = true }: ActivityChartCardProps) {
  const maxValue = useMemo(() => Math.max(1, ...data.map((item) => item.value)), [data]);

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
          return (
            <View key={`${item.day}-${index}`} style={{ flex: 1, height: "100%", minWidth: 0, alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
              <View style={{ width: "100%", height: 96, justifyContent: "flex-end", overflow: "hidden", borderRadius: 11, backgroundColor: `${T.blue}12` }}>
                <ActivityBar height={targetHeight} color={item.value ? T.blue : `${T.blue}33`} delay={index * 70} active={active} />
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
