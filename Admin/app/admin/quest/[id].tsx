import { useLocalSearchParams } from "expo-router";

import { AdminDashboardScreen } from "@/components/admin/admin-dashboard";

export default function AdminQuestDetailRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <AdminDashboardScreen questId={id} view="detail" />;
}
