import { useLocalSearchParams, useRouter } from "expo-router";
import { StreakScreen } from "@/screens/streak-screen";

export default function StreakRoute() {
  const router = useRouter();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  return <StreakScreen initialTab={tab === "friends" ? "friends" : "personal"} onBack={() => router.back()} />;
}
