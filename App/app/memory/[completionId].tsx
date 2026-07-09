import { useLocalSearchParams, useRouter } from "expo-router";
import { MemoryDetailScreen } from "@/screens/memory-detail-screen";

export default function MemoryRoute() {
  const { completionId } = useLocalSearchParams<{ completionId: string }>();
  const router = useRouter();
  return <MemoryDetailScreen completionId={completionId} onBack={() => router.back()} />;
}
