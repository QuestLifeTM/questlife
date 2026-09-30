import { questCategoryColors } from "@/types/content";
import { StyleSheet } from "react-native";

export type AppearancePreference = "system" | "light" | "dark";
type ResolvedAppearance = "light" | "dark";

type Theme = {
  isDark: boolean;
  bg: string; white: string; surface: string; raised: string; input: string;
  dark: string; muted: string; subtle: string; disabled: string; placeholder: string;
  border: string; borderSubtle: string; borderStrong: string; shadow: string; pill: string;
  overlay: string; toast: string; selected: string; pressed: string; focus: string;
  onAccent: string; onBlueButton: string; buttonEdge: string; compactButton: string; compactButtonEdge: string; primaryButton: string; primaryButtonEdge: string; toggleOff: string;
  blue: string; cyan: string; yellow: string; green: string; orange: string;
  red: string; pink: string; purple: string; teal: string;
};

const lightTheme: Theme = {
  isDark: false,
  bg: "#fffcf5", white: "#ffffff", surface: "#ffffff", raised: "#ffffff", input: "#fffcf5",
  dark: "#3d3438", muted: "#71686d", subtle: "#93888d", disabled: "#b8afb1", placeholder: "#897f84",
  border: "#e8dfd5", borderSubtle: "#f1eae2", borderStrong: "#cfc4bb", shadow: "#e8dfd5", pill: "#fceff6",
  overlay: "rgba(30,25,28,0.48)", toast: "#3d3438", selected: "#3d3438", pressed: "#f0e8e2", focus: "#258fd8",
  onAccent: "#ffffff", onBlueButton: "#ffffff", buttonEdge: "#258fd8", compactButton: "#4da8ff", compactButtonEdge: "#258fd8", primaryButton: "#4da8ff", primaryButtonEdge: "#258fd8", toggleOff: "#e5ddd3",
  blue: "#4da8ff", cyan: "#00bbf9", yellow: "#fee440", green: "#27ae60", orange: "#f39c12",
  red: "#e17055", pink: "#fd79a8", purple: "#a29bfe", teal: "#00cec9",
};

const darkTheme: Theme = {
  isDark: true,
  bg: "#11151e", white: "#181e29", surface: "#181e29", raised: "#222a38", input: "#141a24",
  dark: "#f3f6fc", muted: "#b7c0d0", subtle: "#8490a3", disabled: "#657084", placeholder: "#8893a6",
  border: "#3a4558", borderSubtle: "#293244", borderStrong: "#59677d", shadow: "#070a0f", pill: "#263650",
  overlay: "rgba(5,8,14,0.78)", toast: "#222a38", selected: "#243958", pressed: "#1d293a", focus: "#5eb6ff",
  onAccent: "#ffffff", onBlueButton: "#ffffff", buttonEdge: "#438dc8", compactButton: "#63B6FF", compactButtonEdge: "#438dc8", primaryButton: "#63B6FF", primaryButtonEdge: "#438dc8", toggleOff: "#4a5669",
  blue: "#63b6ff", cyan: "#58d5ff", yellow: "#ffd56a", green: "#62cf93", orange: "#ffb85c",
  red: "#ff9586", pink: "#ffa1c8", purple: "#beb5ff", teal: "#57ded2",
};

const highContrastLightTheme: Theme = {
  ...lightTheme, isDark: false, bg: "#ffffff", dark: "#171214", muted: "#50474b", subtle: "#655a5f", disabled: "#82767a", placeholder: "#50474b", border: "#8a7e75", borderSubtle: "#b0a39a", borderStrong: "#655a5f", shadow: "#8a7e75", compactButton: "#006dcc", compactButtonEdge: "#004e92", primaryButton: "#006dcc", primaryButtonEdge: "#004e92",
  blue: "#006dcc", cyan: "#007b9f", yellow: "#9b6900", green: "#087d3e", orange: "#a84e00",
  red: "#b72e20", pink: "#b01c62", purple: "#5d4ab8", teal: "#007f7a",
};

const highContrastDarkTheme: Theme = {
  ...darkTheme, isDark: true, bg: "#070a10", white: "#111722", surface: "#111722", raised: "#1b2433", input: "#0c121c",
  dark: "#ffffff", muted: "#d9e1ed", subtle: "#b4c0d0", disabled: "#8996a8", placeholder: "#c3cfdf", border: "#aebed1", borderSubtle: "#617087", borderStrong: "#d9e1ed", shadow: "#000000", pill: "#314668", selected: "#365b91", pressed: "#263f63", focus: "#8dcbff", onBlueButton: "#ffffff", compactButton: "#63B6FF", compactButtonEdge: "#438dc8", primaryButton: "#63B6FF", primaryButtonEdge: "#438dc8",
  blue: "#8dcbff", cyan: "#87e8ff", yellow: "#ffe37a", green: "#82eab0", orange: "#ffc56f",
  red: "#ffb0a5", pink: "#ffb8d4", purple: "#d3cdff", teal: "#82efe5",
};

export const T: Theme = { ...lightTheme };
let themeRevision = 0;

export function setTheme(appearance: AppearancePreference, highContrast: boolean, systemAppearance: ResolvedAppearance = "light") {
  const resolved = appearance === "system" ? systemAppearance : appearance;
  const theme = highContrast
    ? (resolved === "dark" ? highContrastDarkTheme : highContrastLightTheme)
    : (resolved === "dark" ? darkTheme : lightTheme);
  Object.assign(T, theme);
  themeRevision += 1;
  return resolved;
}

/**
 * StyleSheet.create runs at module load in many routes. This lazy wrapper
 * recreates only theme-backed styles after the selected palette changes,
 * without changing a component's geometry or its public API.
 */
export function themedStyles<TStyles extends Record<string, object>>(factory: () => TStyles): TStyles {
  let revision = -1;
  let current: TStyles;
  return new Proxy({} as TStyles, {
    get(_target, property: string | symbol) {
      if (revision !== themeRevision) {
        current = StyleSheet.create(factory()) as TStyles;
        revision = themeRevision;
      }
      return current[property as keyof TStyles];
    },
  });
}

export const radius = {
  sm: 14,
  md: 20,
  lg: 24,
  xl: 28,
  sheet: 32
};

export const font = {
  heading: "RubikBlack",
  bold: "RubikBold",
  body: "Rubik"
};

export const shadow = {
  get boxShadow() {
    return `4px 4px 0px ${T.shadow}`;
  }
};

export type Difficulty = "EASY" | "MEDIUM" | "HARD" | "FORMIDABLE";

export const difficultyColor = {} as Record<Difficulty, { readonly text: string; readonly bg: string }>;
Object.defineProperties(difficultyColor, {
  EASY: { enumerable: true, get: () => ({ text: T.green, bg: `${T.green}1f` }) },
  MEDIUM: { enumerable: true, get: () => ({ text: T.orange, bg: `${T.orange}1f` }) },
  HARD: { enumerable: true, get: () => ({ text: T.red, bg: `${T.red}1f` }) },
  FORMIDABLE: { enumerable: true, get: () => ({ text: T.red, bg: `${T.red}2b` }) },
});

// Category hues are content metadata. Their light tints become translucent color wells on dark surfaces.
export const categoryColor = {} as Record<string, { readonly text: string; readonly bg: string }>;
Object.entries(questCategoryColors).forEach(([category, color]) => {
  Object.defineProperty(categoryColor, category, {
    enumerable: true,
    get: () => ({ text: color.text, bg: T.isDark ? `${color.text}22` : color.bg }),
  });
});
