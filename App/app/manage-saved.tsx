import { useBackNavigation } from "@/hooks/use-back-navigation";
import { useRouter } from "expo-router";
import { ManageSavedQuestsScreen } from "@/screens/manage-saved-quests-screen";

export default function ManageSavedRoute() {
  const router = useRouter();
  const goBack = useBackNavigation();
  return <ManageSavedQuestsScreen onBack={goBack} />;
}
