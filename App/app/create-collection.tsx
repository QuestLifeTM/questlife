import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Text, View } from "react-native";
import { Card, IconButton, Screen, SoftButton, useResponsiveScreenLayout } from "@/components/ui";
import { T } from "@/components/theme";

export default function CreateCollectionRoute() {
  const router = useRouter();
  const { contentWidth, horizontalPadding, safeAreaOffset } = useResponsiveScreenLayout();

  return (
    <Screen padded={false} contentStyle={{ alignItems: "center", gap: 22, paddingTop: 38 }}>
      <View style={{ width: contentWidth, paddingHorizontal: horizontalPadding, gap: 24, transform: [{ translateX: safeAreaOffset }] }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <IconButton icon="chevron-back" onPress={() => router.back()} />
          <Text style={{ color: T.muted, fontSize: 12, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" }}>Adventure Packs</Text>
          <View style={{ width: 44 }} />
        </View>

        <Card style={{ minHeight: 360, borderRadius: 30, alignItems: "center", justifyContent: "center", gap: 16, padding: 28, boxShadow: `8px 8px 0px ${T.border}` }}>
          <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: `${T.blue}14`, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="construct-outline" size={36} color={T.blue} />
          </View>
          <Text style={{ color: T.dark, fontSize: 28, lineHeight: 34, fontWeight: "900", textAlign: "center" }}>Managed by Admins</Text>
          <Text style={{ color: T.muted, fontSize: 15, lineHeight: 22, fontWeight: "600", textAlign: "center" }}>
            Adventure Packs are curated groups of quests created from the admin dashboard.
          </Text>
          <SoftButton label="Back to Explore" icon="compass-outline" onPress={() => router.back()} style={{ alignSelf: "stretch", marginTop: 6 }} />
        </Card>
      </View>
    </Screen>
  );
}
