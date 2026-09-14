import { useLocalSearchParams } from "expo-router";

import { UnderstandingDemo } from "@/components/onboarding-understanding-demo";

/**
 * The opening is intentionally limited to the three QuestLife app previews.
 * The next screen begins the personalization questions directly.
 */
export default function UnderstandingOnboardingScreen() {
  const { firstName, idealLifeId } = useLocalSearchParams<{ firstName?: string; idealLifeId?: string }>();

  return <UnderstandingDemo firstName={firstName?.trim() || "Friend"} idealLifeId={idealLifeId} />;
}
