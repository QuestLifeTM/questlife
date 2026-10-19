import { Asset } from "expo-asset";
import { useEffect } from "react";

import { UnderstandingDemo } from "@/components/onboarding-understanding-demo";

/**
 * The opening is intentionally limited to the three QuestLife app previews.
 * The next screen begins the personalization questions directly.
 */
export default function UnderstandingOnboardingScreen() {
  useEffect(() => {
    // These are local bundle assets, but warming them here means the first
    // visible mockup has its files ready without ever delaying onboarding.
    void Asset.loadAsync([
      require("../../assets/onboarding/iphone-mockup.png"),
      require("../../assets/onboarding/stone-arch-background.png"),
    ]).catch(() => {
      // Asset warming is optional; the demo must still render if it fails.
    });
  }, []);

  return <UnderstandingDemo />;
}
