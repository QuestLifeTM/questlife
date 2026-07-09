import { useLocalSearchParams, useRouter } from "expo-router";

import { AdventurePackDetailScreen } from "@/screens/adventure-pack-detail-screen";

export default function AdventurePackRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  return <AdventurePackDetailScreen id={id} onBack={() => router.back()} />;
}
