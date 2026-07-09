import { useRouter } from "expo-router";
import { NotificationsScreen } from "@/screens/notifications-screen";

export default function NotificationsRoute() {
  const router = useRouter();
  return <NotificationsScreen onBack={() => router.back()} />;
}
