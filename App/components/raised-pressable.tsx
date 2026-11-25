import React, { forwardRef } from "react";
import { Platform, Pressable as NativePressable, StyleSheet, type PressableProps } from "react-native";
import { T } from "@/components/theme";
import { questCategoryColors } from "@/types/content";

/** Opaque, hue-matched lower edge; alpha shadows wash out on light surfaces. */
export function buttonEdgeColor(color: string): string {
  if (!/^#[\da-f]{6}$/i.test(color)) return color;
  const channels = [1, 3, 5].map((offset) => Math.round(parseInt(color.slice(offset, offset + 2), 16) * 0.74));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function buttonFillColor(color: string): string {
  const palette = questCategoryColors;
  const aliases: [string[], string][] = [
    [[T.blue, T.cyan, T.primaryButton, T.compactButton, "#4da8ff", "#63b6ff"], palette.ADVENTURE.text],
    [[T.red, "#e17055"], palette.FITNESS.text],
    [[T.orange, "#f39c12"], palette["FOOD AND DRINKS"].text],
    [[T.purple, T.pink, "#a29bfe"], palette.CREATIVITY.text],
    [[T.green, T.teal, "#27ae60"], palette.SOCIAL.text],
  ];
  // Preserve the dedicated high-contrast theme's accessible fills.
  if (T.primaryButton === "#006dcc" || T.blue === "#8dcbff") return color;
  return aliases.find(([values]) => values.some((value) => value.toLowerCase() === color.toLowerCase()))?.[1] ?? color;
}

/** Shared iOS treatment for solid action surfaces, including custom screen buttons.
 * Resolve styles per press so disabled/loading states and existing handlers survive.
 * Tinted choices, outlined controls, cards and other platforms retain their styles.
 */
export const Pressable = forwardRef<React.ComponentRef<typeof NativePressable>, PressableProps>(function RaisedPressable({ style, disabled, ...props }, ref) {
  if (Platform.OS !== "ios") return <NativePressable ref={ref} {...props} disabled={disabled} style={style} />;
  return <NativePressable ref={ref} {...props} disabled={disabled} style={(state) => {
    const original = typeof style === "function" ? style(state) : style;
    const flat = StyleSheet.flatten(original);
    const fill = flat?.backgroundColor;
    if (!flat || typeof fill !== "string" || !/^#[\da-f]{6}$/i.test(fill)) return original;
    if ([T.white, T.bg, T.surface, T.raised, T.input, T.border, T.pressed, "#ffffff", "#fff"].some((surface) => surface.toLowerCase() === fill.toLowerCase())) return original;
    if (props.accessibilityRole && props.accessibilityRole !== "button") return original;
    // Buttons center their contents; large image/card surfaces do not qualify.
    if (flat.justifyContent !== "center" || flat.alignItems !== "center" || !flat.borderRadius) return original;
    if ((typeof flat.height === "number" && flat.height > 80) || (typeof flat.minHeight === "number" && flat.minHeight > 80)) return original;
    const channels = [1, 3, 5].map((offset) => parseInt(fill.slice(offset, offset + 2), 16));
    // Light category wells and neutral disabled fills are not solid actions.
    if (Math.min(...channels) > 180 || (Math.max(...channels) - Math.min(...channels) < 25 && fill !== T.dark)) return original;
    const color = buttonFillColor(fill);
    const pressed = state.pressed && !disabled;
    const existingEdge = flat.borderBottomWidth ?? flat.borderWidth ?? 0;
    const depth = Math.max(5, existingEdge);
    return [original, {
      backgroundColor: color,
      borderWidth: 2,
      borderColor: color,
      borderBottomColor: buttonEdgeColor(color),
      borderBottomWidth: pressed ? 2 : depth,
      // Keep custom animation transforms. Add travel to controls without one.
      ...(flat.transform ? {} : { transform: [{ translateY: pressed ? depth - 2 : 0 }] }),
    }];
  }} />;
});
