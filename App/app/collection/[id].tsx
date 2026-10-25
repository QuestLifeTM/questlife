import { useBackNavigation } from "@/hooks/use-back-navigation";
import { useLocalSearchParams, useRouter } from "expo-router";
import { UserCollectionDetailScreen } from "@/screens/user-collection-detail-screen";

export default function CollectionRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const goBack = useBackNavigation();
  return <UserCollectionDetailScreen id={id ?? ""} onBack={goBack} />;
}
