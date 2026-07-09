import { useRouter } from "expo-router";
import { PlanPickQuestsScreen } from "@/screens/plan-pick-quests-screen";

export default function PlanPickQuestsRoute() {
  const router = useRouter();
  return <PlanPickQuestsScreen onBack={() => router.back()} />;
}
