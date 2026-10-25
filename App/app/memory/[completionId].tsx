import { useBackNavigation } from "@/hooks/use-back-navigation";
import { useLocalSearchParams, useRouter } from "expo-router";
import { MemoryDetailScreen } from "@/screens/memory-detail-screen";

export default function MemoryRoute() {
  const { completionId } = useLocalSearchParams<{ completionId: string }>();
  const router = useRouter();
  const goBack = useBackNavigation();
  return <MemoryDetailScreen completionId={completionId} onBack={goBack} />;
}
