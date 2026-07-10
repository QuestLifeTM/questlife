import { questCategoryColors } from "@/types/content";

export const T = {
  bg: "#fffcf5",
  dark: "#3d3438",
  muted: "#8a8186",
  blue: "#4da8ff",
  cyan: "#00bbf9",
  border: "#e8dfd5",
  pill: "#fceff6",
  yellow: "#fee440",
  green: "#27ae60",
  orange: "#f39c12",
  red: "#e17055",
  pink: "#fd79a8",
  purple: "#a29bfe",
  teal: "#00cec9",
  white: "#ffffff"
} as const;

export const radius = {
  sm: 14,
  md: 20,
  lg: 24,
  xl: 28,
  sheet: 32
};

export const font = {
  heading: "GeistPixel",
  bold: "GeistPixel",
  body: "GeistPixel"
};

export const shadow = {
  boxShadow: `4px 4px 0px ${T.border}`
};

export type Difficulty = "EASY" | "MEDIUM" | "HARD" | "FORMIDABLE";

export const difficultyColor: Record<Difficulty, { text: string; bg: string }> = {
  EASY: { text: T.green, bg: "rgba(39,174,96,0.12)" },
  MEDIUM: { text: T.orange, bg: "rgba(243,156,18,0.12)" },
  HARD: { text: T.red, bg: "rgba(225,112,85,0.12)" },
  FORMIDABLE: { text: "#7f1d1d", bg: "rgba(127,29,29,0.12)" }
};

export const categoryColor: Record<string, { text: string; bg: string }> = questCategoryColors;
