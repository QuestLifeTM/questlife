import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { View } from "react-native";
import { T } from "@/components/theme";
import { useNotifications } from "@/contexts/NotificationsContext";

const tabIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  index: "home",
  explore: "compass",
  social: "people",
  journal: "book",
  profile: "person",
};

function TabIcon({ routeName, focused, color }: { routeName: string; focused: boolean; color: string }) {
  const icon = tabIcons[routeName] ?? "ellipse";
  const { hasUnreadJournal } = useNotifications();
  return (
    <View
      style={{
        width: focused ? 46 : 36,
        height: focused ? 46 : 36,
        borderRadius: 20,
        backgroundColor: focused ? T.pill : "transparent",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View>
        <Ionicons name={icon} size={30} color={focused ? color : T.muted} />
        {routeName === "journal" && hasUnreadJournal ? <View style={{ position: "absolute", top: -2, right: -4, width: 9, height: 9, borderRadius: 5, backgroundColor: T.red, borderWidth: 1.5, borderColor: T.white }} /> : null}
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: T.blue,
        tabBarInactiveTintColor: T.muted,
        tabBarStyle: {
          position: "absolute",
          height: 76,
          borderTopLeftRadius: 26,
          borderTopRightRadius: 26,
          borderTopWidth: 2,
          borderTopColor: T.border,
          backgroundColor: T.white,
          paddingTop: 17,
          paddingBottom: 15,
          paddingHorizontal: 24,
          boxShadow: "0px -8px 8px rgba(0,0,0,0.05)",
        },
        tabBarItemStyle: { height: 46, borderRadius: 20, alignItems: "center", justifyContent: "center" },
        tabBarIcon: ({ color, focused }) => <TabIcon routeName={route.name} focused={focused} color={color} />,
      })}
    >
      <Tabs.Screen name="social" options={{ title: "Social" }} />
      <Tabs.Screen name="explore" options={{ title: "Explore" }} />
      <Tabs.Screen name="index" options={{ title: "Lobby" }} />
      <Tabs.Screen name="journal" options={{ title: "Journal" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
