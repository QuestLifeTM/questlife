import { useBackNavigation } from "@/hooks/use-back-navigation";
import { useRouter } from "expo-router";
import { NotificationsScreen } from "@/screens/notifications-screen";

export default function NotificationsRoute() {
  const router = useRouter();
  const goBack = useBackNavigation();
  return <NotificationsScreen onBack={goBack} />;
}
