import { useRouter } from "expo-router";
/** A directly opened detail URL still needs an in-app way home. */
export function useBackNavigation() {
  const router = useRouter();
  return () => { if (router.canGoBack()) router.back(); else router.replace("/home"); };
}
