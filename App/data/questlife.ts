import { questCategories } from "@/types/content";

export type TabName = "explore" | "lobby" | "profile";

export const categories = questCategories;

export const sortOptions = [
  "Best Match",
  "Most XP",
  "Least XP",
  "Easiest",
  "Hardest",
  "Shortest",
  "Longest",
  "Best for today",
];

export const badges = [
  { id: "b1", emoji: "🌅", title: "Early Bird", desc: "Quest before 7am", unlocked: true, date: "Jun 28" },
  { id: "b3", emoji: "📝", title: "Storyteller", desc: "Write 5 reflections", unlocked: true, date: "Jun 26" },
  { id: "b4", emoji: "✌️", title: "Double Dip", desc: "2 quests in one day", unlocked: true, date: "Jun 25" },
  { id: "b7", emoji: "👟", title: "First Step", desc: "Complete first quest", unlocked: true, date: "May 23" },
  { id: "b2", emoji: "🗺️", title: "Explorer", desc: "10 nature quests", unlocked: false, progress: 7, total: 10 },
  { id: "b5", emoji: "🦉", title: "Night Owl", desc: "5 evening quests", unlocked: false, progress: 3, total: 5 },
];
