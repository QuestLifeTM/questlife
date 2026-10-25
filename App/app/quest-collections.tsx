import { useBackNavigation } from "@/hooks/use-back-navigation";
import { useRouter } from "expo-router";
import { QuestCollectionsScreen } from "@/screens/quest-collections-screen";

export default function QuestCollectionsRoute() {
  const router = useRouter();
  const goBack = useBackNavigation();
  return <QuestCollectionsScreen onBack={goBack} />;
}
