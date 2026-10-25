import { useBackNavigation } from "@/hooks/use-back-navigation";
import { useRouter } from "expo-router";
import { SavedScreen } from "@/screens/saved-screen";

export default function SavedRoute() {
  const router = useRouter();
  const goBack = useBackNavigation();
  return <SavedScreen onBack={goBack} />;
}
