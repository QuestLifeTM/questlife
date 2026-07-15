import { useLocalSearchParams, useRouter } from "expo-router";
import { AdventurePackDetailScreen } from "@/screens/adventure-pack-detail-screen";
import { UserCollectionDetailScreen } from "@/screens/user-collection-detail-screen";
import { useQuestEngine } from "@/contexts/QuestEngineContext";

export default function CollectionRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { userPacks } = useQuestEngine();
  if (id && userPacks.some((pack) => pack.id === id)) {
    return <UserCollectionDetailScreen id={id} onBack={() => router.back()} />;
  }
  return <AdventurePackDetailScreen id={id} onBack={() => router.back()} />;
}
