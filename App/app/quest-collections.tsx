import { useRouter } from "expo-router";
import { QuestCollectionsScreen } from "@/screens/quest-collections-screen";

export default function QuestCollectionsRoute() {
  const router = useRouter();
  return <QuestCollectionsScreen onBack={() => router.back()} />;
}
