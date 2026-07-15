import { useRouter } from "expo-router";
import { ManageSavedQuestsScreen } from "@/screens/manage-saved-quests-screen";

export default function ManageSavedRoute() {
  const router = useRouter();
  return <ManageSavedQuestsScreen onBack={() => router.back()} />;
}
