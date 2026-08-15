import { useLocalSearchParams } from "expo-router";

import { UnderstandingDemo } from "@/components/onboarding-understanding-demo";

/**
 * The opening is intentionally limited to the three QuestLife app previews.
 * The next screen begins the personalization questions directly.
 */
export default function UnderstandingOnboardingScreen() {
  const { firstName } = useLocalSearchParams<{ firstName?: string }>();

  return <UnderstandingDemo firstName={firstName?.trim() || "Friend"} />;
}
