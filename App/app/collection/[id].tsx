import { useLocalSearchParams, useRouter } from "expo-router";
import { AdventurePackDetailScreen } from "@/screens/adventure-pack-detail-screen";

export default function CollectionRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  return <AdventurePackDetailScreen id={id} onBack={() => router.back()} />;
}
