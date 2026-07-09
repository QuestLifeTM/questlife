import { useLocalSearchParams, useRouter } from "expo-router";
import { PlanSavePackScreen } from "@/screens/plan-save-pack-screen";

export default function PlanSavePackRoute() {
  const router = useRouter();
  const { questIds } = useLocalSearchParams<{ questIds?: string }>();
  const ids = questIds ? questIds.split(",") : [];
  return <PlanSavePackScreen questIds={ids} onBack={() => router.back()} onDone={() => router.replace("/(tabs)")} />;
}
