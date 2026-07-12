import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { T } from "@/components/theme";
import { Card, EmptyState, Header, IconButton, Screen, useResponsiveScreenLayout } from "@/components/ui";

type NotificationCategory = "All" | "Quests" | "Progress" | "Social" | "Friends" | "System";
type NotificationPeriod = "today" | "earlier";

interface QuestLifeNotification {
  id: string;
  category: Exclude<NotificationCategory, "All">;
  period: NotificationPeriod;
  sortAt: number;
  title: string;
  body: string;
  time: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  actor?: string;
  unread?: boolean;
  reward?: string;
}

const categories: NotificationCategory[] = ["All", "Quests", "Progress", "Social", "Friends", "System"];

const notifications: QuestLifeNotification[] = [
  {
    id: "n1",
    category: "Progress",
    period: "today",
    sortAt: 170,
    title: "Streak milestone reached",
    body: "Your 9-day streak is still alive. Keep one small quest in motion today.",
    time: "Just now",
    icon: "flame",
    color: T.orange,
    reward: "9 days",
    unread: true
  },
  {
    id: "n2",
    category: "Quests",
    period: "today",
    sortAt: 160,
    title: "New daily quest",
    body: "The Hidden Coffee Run is ready for your next real-world adventure.",
    time: "18m",
    icon: "compass",
    color: T.blue,
    reward: "+120 XP",
    unread: true
  },
  {
    id: "n3",
    category: "Progress",
    period: "today",
    sortAt: 150,
    title: "XP earned",
    body: "You gained XP toward Level 9 from today's quest activity.",
    time: "42m",
    icon: "flash",
    color: T.yellow,
    reward: "+160 XP"
  },
  {
    id: "n4",
    category: "Friends",
    period: "today",
    sortAt: 140,
    title: "Friend request",
    body: "Priya W. wants to join your QuestLife circle.",
    time: "1h",
    icon: "person-add",
    color: T.pink,
    actor: "Priya W.",
    unread: true
  },
  {
    id: "n5",
    category: "Social",
    period: "today",
    sortAt: 130,
    title: "Quest invite",
    body: "Marcus invited you to Market Treasure Hunt with Weekend Warriors.",
    time: "2h",
    icon: "people",
    color: T.cyan,
    actor: "Marcus"
  },
  {
    id: "n6",
    category: "Quests",
    period: "today",
    sortAt: 120,
    title: "Quest completed",
    body: "Urban Forager was marked complete and added to your quest activity.",
    time: "3h",
    icon: "checkmark-circle",
    color: T.green,
    reward: "+160 XP"
  },
  {
    id: "n7",
    category: "Social",
    period: "today",
    sortAt: 110,
    title: "Quest completed by friend",
    body: "Alex finished Market Treasure Hunt and kept their streak going.",
    time: "4h",
    icon: "trail-sign",
    color: T.teal,
    actor: "Alex"
  },
  {
    id: "n8",
    category: "Social",
    period: "today",
    sortAt: 100,
    title: "Comment",
    body: "Sarah commented on your Sunset Sketcher reflection.",
    time: "5h",
    icon: "chatbubble",
    color: T.purple,
    actor: "Sarah"
  },
  {
    id: "n9",
    category: "Progress",
    period: "earlier",
    sortAt: 90,
    title: "Level up",
    body: "You reached Level 8 and unlocked a stronger explorer profile badge.",
    time: "Yesterday",
    icon: "trending-up",
    color: T.blue,
    reward: "Level 8"
  },
  {
    id: "n10",
    category: "Progress",
    period: "earlier",
    sortAt: 80,
    title: "Rank promotion",
    body: "You moved into the top 10 among friends for weekly quest momentum.",
    time: "Yesterday",
    icon: "podium",
    color: T.orange,
    reward: "Top 10"
  },
  {
    id: "n11",
    category: "Friends",
    period: "earlier",
    sortAt: 70,
    title: "Friend accepted",
    body: "Kai T. accepted your friend request. You can now invite them to parties.",
    time: "2d",
    icon: "person-circle",
    color: T.green,
    actor: "Kai T."
  },
  {
    id: "n12",
    category: "Social",
    period: "earlier",
    sortAt: 60,
    title: "Like",
    body: "Luna liked your Random Route Walk completion.",
    time: "2d",
    icon: "heart",
    color: T.pink,
    actor: "Luna"
  },
  {
    id: "n13",
    category: "Social",
    period: "earlier",
    sortAt: 50,
    title: "Mention",
    body: "Jake mentioned you in a party note for Dawn Jogger Challenge.",
    time: "3d",
    icon: "at",
    color: T.cyan,
    actor: "Jake"
  },
  {
    id: "n14",
    category: "Progress",
    period: "earlier",
    sortAt: 40,
    title: "Achievement unlocked",
    body: "Memory Keeper progress updated after your latest quest note.",
    time: "4d",
    icon: "ribbon",
    color: T.purple,
    reward: "Badge progress"
  },
  {
    id: "n15",
    category: "Social",
    period: "earlier",
    sortAt: 30,
    title: "Club invitation",
    body: "Creative Crew invited you to join their weekend quest club.",
    time: "5d",
    icon: "sparkles",
    color: T.teal,
    actor: "Creative Crew"
  },
  {
    id: "n16",
    category: "System",
    period: "earlier",
    sortAt: 20,
    title: "Premium update",
    body: "QuestLife Premium now includes advanced progress insights and planning tools.",
    time: "1w",
    icon: "diamond",
    color: T.yellow
  }
];

function categoryTint(category: NotificationCategory) {
  if (category === "All") return T.dark;
  if (category === "Quests") return T.blue;
  if (category === "Progress") return T.orange;
  if (category === "Social") return T.cyan;
  if (category === "Friends") return T.pink;
  return T.purple;
}

function CategoryChip({
  category,
  active,
  onPress
}: {
  category: NotificationCategory;
  active: boolean;
  onPress: () => void;
}) {
  const color = categoryTint(category);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 42,
        borderRadius: 24,
        paddingHorizontal: 17,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: active ? color : T.white,
        borderWidth: 2,
        borderColor: active ? color : T.border,
        boxShadow: active ? "none" : `3px 3px 0px ${T.border}`,
        transform: [{ scale: pressed ? 0.96 : 1 }]
      })}
    >
      <Text style={{ color: active ? T.white : color, fontSize: 13, fontWeight: "900" }}>{category}</Text>
    </Pressable>
  );
}

function NotificationRow({ item }: { item: QuestLifeNotification }) {
  return (
    <Card
      style={{
        borderRadius: 22,
        padding: 0,
        overflow: "hidden",
        backgroundColor: item.unread ? `${item.color}0f` : T.white,
        borderColor: item.unread ? `${item.color}55` : T.border,
        boxShadow: `4px 4px 0px ${T.border}`
      }}
    >
      <View style={{ flexDirection: "row" }}>
        <View style={{ width: 5, backgroundColor: item.color }} />
        <View style={{ flex: 1, paddingHorizontal: 14, paddingVertical: 12, gap: item.reward ? 8 : 0 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 11 }}>
            <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: `${item.color}18`, borderWidth: 2, borderColor: `${item.color}55`, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name={item.icon} size={19} color={item.color} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <Text style={{ color: T.dark, fontSize: 15, lineHeight: 20, fontWeight: "900" }}>{item.title}</Text>
                <Text style={{ color: T.muted, fontSize: 12, lineHeight: 17, fontWeight: "800" }}>{item.time}</Text>
              </View>
              {item.actor ? <Text style={{ color: item.color, fontSize: 12, lineHeight: 16, fontWeight: "900" }}>{item.actor}</Text> : null}
              <Text style={{ color: T.muted, fontSize: 13, lineHeight: 18, fontWeight: "600", marginTop: 2 }}>{item.body}</Text>
            </View>
            {item.unread ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.color, marginTop: 7 }} /> : null}
          </View>
          {item.reward ? (
            <View style={{ alignSelf: "flex-end", borderRadius: 99, backgroundColor: "rgba(254,228,64,0.18)", borderWidth: 1.5, borderColor: "rgba(254,228,64,0.5)", paddingHorizontal: 10, paddingVertical: 5 }}>
              <Text style={{ color: T.dark, fontSize: 11, fontWeight: "900" }}>{item.reward}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

function SectionEmpty({ section }: { section: "Today" | "Earlier" }) {
  return (
    <Card style={{ borderRadius: 24, paddingVertical: 10 }}>
      <EmptyState
        emoji={section === "Today" ? "🧭" : "📜"}
        title={`No ${section.toLowerCase()} updates`}
        body="Nothing matches this category here yet. Try another filter to keep exploring your activity."
      />
    </Card>
  );
}

function FeedSection({ title, items }: { title: "Today" | "Earlier"; items: QuestLifeNotification[] }) {
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ color: T.dark, fontSize: 22, lineHeight: 28, fontWeight: "900" }}>{title}</Text>
        <Text style={{ color: T.muted, fontSize: 12, fontWeight: "800" }}>{items.length} update{items.length === 1 ? "" : "s"}</Text>
      </View>
      {items.length ? (
        <View style={{ gap: 12 }}>
          {items.map((item) => <NotificationRow key={item.id} item={item} />)}
        </View>
      ) : (
        <SectionEmpty section={title} />
      )}
    </View>
  );
}

export function NotificationsScreen({ onBack }: { onBack: () => void }) {
  const { contentWidth, horizontalPadding, safeAreaOffset } = useResponsiveScreenLayout();
  const [selectedCategory, setSelectedCategory] = useState<NotificationCategory>("All");

  const filtered = useMemo(() => {
    const visible = selectedCategory === "All"
      ? notifications
      : notifications.filter((item) => item.category === selectedCategory);
    return [...visible].sort((a, b) => b.sortAt - a.sortAt);
  }, [selectedCategory]);

  const today = filtered.filter((item) => item.period === "today");
  const earlier = filtered.filter((item) => item.period === "earlier");

  return (
    <Screen padded={false} contentStyle={{ alignItems: "center", gap: 22 }}>
      <View style={{ width: contentWidth, gap: 22, transform: [{ translateX: safeAreaOffset }] }}>
        <View style={{ paddingHorizontal: horizontalPadding, gap: 18 }}>
          <Header title="Notifications" subtitle="QuestLife activity" right={<IconButton icon="chevron-back" onPress={onBack} />} animated={false} />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 4 }}>
            {categories.map((category) => (
              <CategoryChip
                key={category}
                category={category}
                active={selectedCategory === category}
                onPress={() => setSelectedCategory(category)}
              />
            ))}
          </ScrollView>
        </View>

        <View style={{ paddingHorizontal: horizontalPadding, gap: 24 }}>
          <FeedSection title="Today" items={today} />
          <FeedSection title="Earlier" items={earlier} />
        </View>
      </View>
    </Screen>
  );
}
