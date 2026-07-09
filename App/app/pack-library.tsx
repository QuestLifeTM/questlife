import { useRouter } from "expo-router";
import { PackLibraryScreen } from "@/screens/pack-library-screen";

export default function PackLibraryRoute() {
  const router = useRouter();
  return <PackLibraryScreen onBack={() => router.back()} />;
}
