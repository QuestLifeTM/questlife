import { useBackNavigation } from "@/hooks/use-back-navigation";
import { useLocalSearchParams, useRouter } from "expo-router";
import { QuestDetailScreen } from "../../screens/quest-detail-screen";

export default function QuestRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const goBack = useBackNavigation();
  return <QuestDetailScreen id={id} onBack={goBack} />;
}
