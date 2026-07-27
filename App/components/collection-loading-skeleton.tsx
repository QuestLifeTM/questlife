import { View } from "react-native";
import { Card } from "@/components/ui";
import { T } from "@/components/theme";

export function CollectionSkeletonBlock({ width = "100%", height, radius = 8 }: { width?: number | `${number}%`; height: number; radius?: number }) {
  return <View accessibilityRole="progressbar" style={{ width, height, borderRadius: radius, backgroundColor: "#eee7e2" }} />;
}

export function SavedQuestListSkeleton() {
  return <View accessibilityLabel="Loading saved quests" style={{ gap: 12 }}>{[0, 1, 2].map((item) => <Card key={item} style={{ minHeight: 166, padding: 16, gap: 11 }}><View style={{ flexDirection: "row", gap: 7 }}><CollectionSkeletonBlock width={74} height={24} radius={12} /><CollectionSkeletonBlock width={60} height={24} radius={12} /></View><CollectionSkeletonBlock width="72%" height={21} /><CollectionSkeletonBlock width="96%" height={13} /><CollectionSkeletonBlock width="68%" height={13} /><View style={{ marginTop: "auto", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><CollectionSkeletonBlock width={132} height={28} radius={14} /><CollectionSkeletonBlock width={76} height={36} radius={18} /></View></Card>)}</View>;
}

export function CollectionGridSkeleton({ cardWidth }: { cardWidth: number }) {
  return <View accessibilityLabel="Loading collections" style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>{[0, 1, 2, 3].map((item) => <Card key={item} style={{ width: cardWidth, padding: 0, overflow: "hidden", gap: 0 }}><CollectionSkeletonBlock height={112} radius={0} /><View style={{ padding: 12, gap: 8 }}><CollectionSkeletonBlock width="74%" height={16} /><CollectionSkeletonBlock width="92%" height={11} /><CollectionSkeletonBlock width="62%" height={11} /><View style={{ paddingTop: 9, borderTopWidth: 1, borderTopColor: T.border, flexDirection: "row", justifyContent: "space-between" }}><CollectionSkeletonBlock width={54} height={11} /><CollectionSkeletonBlock width={44} height={11} /></View></View></Card>)}</View>;
}

export function CollectionPickerSkeleton({ rows = 5 }: { rows?: number }) {
  return <View accessibilityLabel="Loading saved quests" style={{ gap: 10 }}>{Array.from({ length: rows }, (_, item) => <View key={item} style={{ minHeight: 62, padding: 12, borderRadius: 18, borderWidth: 2, borderColor: T.border, backgroundColor: T.white, flexDirection: "row", alignItems: "center", gap: 12 }}><CollectionSkeletonBlock width={38} height={38} radius={13} /><View style={{ flex: 1, gap: 6 }}><CollectionSkeletonBlock width="54%" height={14} /><CollectionSkeletonBlock width="35%" height={10} /></View><CollectionSkeletonBlock width={24} height={24} radius={12} /></View>)}</View>;
}

export function CollectionDetailSkeleton() {
  return <View accessibilityLabel="Loading collection" style={{ gap: 18 }}><Card style={{ padding: 0, overflow: "hidden" }}><CollectionSkeletonBlock height={142} radius={0} /><View style={{ padding: 18, gap: 7 }}><CollectionSkeletonBlock width="52%" height={23} /><CollectionSkeletonBlock width="42%" height={12} /></View></Card><View style={{ gap: 10 }}><CollectionSkeletonBlock width={76} height={19} /><SavedQuestListSkeleton /></View></View>;
}
