import { useRouter } from "expo-router";
import { StreakScreen } from "@/screens/streak-screen";

export default function StreakRoute() {
  const router = useRouter();
  return <StreakScreen onBack={() => router.back()} />;
}
