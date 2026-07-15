import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { T } from "@/components/theme";
import { Card, EmptyState, Header, IconButton, Screen, useResponsiveScreenLayout } from "@/components/ui";
import { useNotifications } from "@/contexts/NotificationsContext";
import { AppNotification, AppNotificationCategory } from "@/types/notifications";

type NotificationFilter = "All" | "Quests" | "Progress" | "Social" | "Parties" | "System";
type NotificationPeriod = "today" | "earlier";

const categories: NotificationFilter[] = ["All", "Quests", "Progress", "Social", "Parties", "System"];

const filterCategory: Record<Exclude<NotificationFilter, "All">, AppNotificationCategory> = {
  Quests: "quest",
  Progress: "progress",
  Social: "social",
  Parties: "party",
  System: "system",
};

function categoryTint(category: NotificationFilter) {
  if (category === "All") return T.dark;
  if (category === "Quests") return T.blue;
  if (category === "Progress") return T.orange;
  if (category === "Social") return T.cyan;
  if (category === "Parties") return T.purple;
  return T.pink;
}

function formatTime(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 172800) return "Yesterday";
  return `${Math.floor(seconds / 86400)}d`;
}

function periodFor(value: string): NotificationPeriod {
  return Date.now() - new Date(value).getTime() < 86400000 ? "today" : "earlier";
}

function CategoryChip({ category, active, onPress }: { category: NotificationFilter; active: boolean; onPress: () => void }) {
  const color = categoryTint(category);
  return <Pressable onPress={onPress} style={({ pressed }) => ({ minHeight: 42, borderRadius: 24, paddingHorizontal: 17, alignItems: "center", justifyContent: "center", backgroundColor: active ? color : T.white, borderWidth: 2, borderColor: active ? color : T.border, boxShadow: active ? "none" : `3px 3px 0px ${T.border}`, transform: [{ scale: pressed ? 0.96 : 1 }] })}><Text style={{ color: active ? T.white : color, fontFamily: "RubikBold", fontSize: 12 }}>{category}</Text></Pressable>;
}

function NotificationRow({ item, onPress }: { item: AppNotification; onPress: () => void }) {
  const icon = item.icon in Ionicons.glyphMap ? item.icon as keyof typeof Ionicons.glyphMap : "notifications";
  const reward = typeof item.metadata.xpAwarded === "number" ? `+${item.metadata.xpAwarded} XP` : typeof item.metadata.streak === "number" ? `${item.metadata.streak} days` : typeof item.metadata.level === "number" ? `Level ${item.metadata.level}` : null;
  return <Pressable accessibilityRole="button" accessibilityLabel={item.title} onPress={onPress}><Card style={{ borderRadius: 20, padding: 0, overflow: "hidden", backgroundColor: item.readAt ? T.white : `${item.color}0f`, borderColor: item.readAt ? T.border : `${item.color}55`, boxShadow: `4px 4px 0px ${T.border}` }}><View style={{ flexDirection: "row" }}><View style={{ width: 6, backgroundColor: item.color }} /><View style={{ flex: 1, padding: 14 }}><View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}><View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: `${item.color}18`, borderWidth: 2, borderColor: `${item.color}55`, alignItems: "center", justifyContent: "center" }}><Ionicons name={icon} size={19} color={item.color} /></View><View style={{ flex: 1, minWidth: 0, gap: 6 }}><View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}><Text style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 15, lineHeight: 20 }}>{item.title}</Text><Text style={{ color: T.muted, fontFamily: "RubikBold", fontSize: 12, lineHeight: 17 }}>{formatTime(item.createdAt)}</Text></View><Text style={{ color: T.muted, fontFamily: "Rubik", fontSize: 13, lineHeight: 19 }}>{item.body}</Text>{reward ? <View style={{ alignSelf: "flex-end", borderRadius: 99, backgroundColor: "rgba(254,228,64,0.18)", borderWidth: 1.5, borderColor: "rgba(254,228,64,0.5)", paddingHorizontal: 10, paddingVertical: 5 }}><Text style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 11 }}>{reward}</Text></View> : null}</View>{item.readAt ? null : <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.color, marginTop: 7 }} />}</View></View></View></Card></Pressable>;
}

function FeedSection({ title, items, onOpen }: { title: "Today" | "Earlier"; items: AppNotification[]; onOpen: (item: AppNotification) => void }) {
  return <View style={{ gap: 12 }}><View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 22, lineHeight: 28 }}>{title}</Text><Text style={{ color: T.muted, fontFamily: "RubikBold", fontSize: 12 }}>{items.length} update{items.length === 1 ? "" : "s"}</Text></View>{items.length ? <View style={{ gap: 12 }}>{items.map((item) => <NotificationRow key={item.id} item={item} onPress={() => onOpen(item)} />)}</View> : <Card style={{ borderRadius: 20, paddingVertical: 10 }}><EmptyState emoji={title === "Today" ? "🧭" : "📜"} title={`No ${title.toLowerCase()} updates`} body="Nothing matches this category yet." /></Card>}</View>;
}

export function NotificationsScreen({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const { contentWidth, horizontalPadding, safeAreaOffset } = useResponsiveScreenLayout();
  const { error, loading, markRead, notifications } = useNotifications();
  const [selectedCategory, setSelectedCategory] = useState<NotificationFilter>("All");
  const filtered = useMemo(() => selectedCategory === "All" ? notifications : notifications.filter((item) => item.category === filterCategory[selectedCategory]), [notifications, selectedCategory]);
  const today = filtered.filter((item) => periodFor(item.createdAt) === "today");
  const earlier = filtered.filter((item) => periodFor(item.createdAt) === "earlier");

  const openNotification = async (item: AppNotification) => {
    if (!item.readAt) await markRead([item.id]);
    const questId = typeof item.metadata.questId === "string" ? item.metadata.questId : null;
    const partyId = typeof item.metadata.partyId === "string" ? item.metadata.partyId : null;
    if (questId) router.push(`/quest/${questId}`);
    else if (partyId) router.push(`/party/${partyId}`);
  };

  return <Screen padded={false} contentStyle={{ alignItems: "center", gap: 22 }}><View style={{ width: contentWidth, gap: 22, transform: [{ translateX: safeAreaOffset }] }}><View style={{ gap: 12 }}><View style={{ paddingHorizontal: horizontalPadding }}><Header title="Notifications" subtitle="QuestLife activity" right={<IconButton icon="chevron-back" onPress={onBack} />} animated={false} /></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: horizontalPadding, paddingTop: 2, paddingBottom: 7, paddingRight: horizontalPadding + 8 }}>{categories.map((category) => <CategoryChip key={category} category={category} active={selectedCategory === category} onPress={() => setSelectedCategory(category)} />)}</ScrollView></View><View style={{ paddingHorizontal: horizontalPadding, gap: 24 }}>{error ? <Card style={{ borderColor: T.red }}><EmptyState emoji="⚠️" title="Notifications unavailable" body={error} /></Card> : null}{loading && !notifications.length ? <EmptyState emoji="⏳" title="Opening notifications" body="Checking your latest QuestLife updates." /> : <><FeedSection title="Today" items={today} onOpen={openNotification} /><FeedSection title="Earlier" items={earlier} onOpen={openNotification} /></>}</View></View></Screen>;
}
