import { questCategoryColors, type QuestCategory } from "@/types/content";

// Dominant sRGB pixels sampled from the supplied 720×720 reference videos:
// 2067 / 2029 (light), 2260 / 2220 (dark), at 0.7s and 4.3s.
// Solid strip layers are intentional: alpha-blending category colors changes
// their appearance between modes and cannot reproduce the reference colors.
const shared = {
  xp: "#fec100",
  medallion: "#4fc603",
  stripEdge: "#c5f9ff",
  stripCenter: "#32ecff",
  stripStreak: "#95f8fa",
};

const light = {
  ...shared,
  surface: "#ffffff",
  blue: "#1ca7f4",
  buttonEdge: "#2c8ecb",
  buttonLabel: "#ffffff",
  statLabel: "#ffffff",
  photos: "#4fc603",
  copy: "#7f807f",
  shareBorder: "#e4e5e4",
  shareEdge: "#e0e0e0",
};

const dark = {
  ...shared,
  surface: "#171c21",
  blue: "#40b8f8",
  buttonEdge: "#268dc7",
  buttonLabel: "#171c21",
  statLabel: "#171c21",
  photos: "#88cd2b",
  copy: "#eeeeee",
  shareBorder: "#31393d",
  shareEdge: "#373e47",
};

export function getCompletionPalette(isDark: boolean) {
  return isDark ? dark : light;
}
const categoryStripShades: Record<QuestCategory, { stripEdge: string; stripStreak: string }> = {
  ADVENTURE: { stripEdge: "#CCE5FF", stripStreak: "#A1CFFF" },
  FITNESS: { stripEdge: "#FFD1D1", stripStreak: "#FFAAAA" },
  "FOOD AND DRINKS": { stripEdge: "#FFE3CC", stripStreak: "#FFCAA1" },
  CREATIVITY: { stripEdge: "#E6D8FF", stripStreak: "#D0B7FF" },
  SOCIAL: { stripEdge: "#CCF2D9", stripStreak: "#A1E6B9" },
};

export function getCompletionBannerPalette(isDark: boolean, category?: QuestCategory) {
  const palette = getCompletionPalette(isDark);
  if (!category) return palette;
  return { ...palette, ...categoryStripShades[category], stripCenter: questCategoryColors[category].text };
}
