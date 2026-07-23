import { useLocalSearchParams, useRouter } from "expo-router";
import { UserCollectionDetailScreen } from "@/screens/user-collection-detail-screen";

export default function CollectionRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  return <UserCollectionDetailScreen id={id ?? ""} onBack={() => router.back()} />;
}
