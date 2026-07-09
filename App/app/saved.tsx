import { useRouter } from "expo-router";
import { SavedScreen } from "@/screens/saved-screen";

export default function SavedRoute() {
  const router = useRouter();
  return <SavedScreen onBack={() => router.back()} />;
}
