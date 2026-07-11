import { T } from "@/components/theme";

/**
 * The Lobby uses a deliberately compact, task-first visual system. Keep new
 * Lobby UI inside these values so a state does not invent its own scale.
 */
export const lobbyDesign = {
  viewport: {
    narrow: 375,
    compact: 390,
    maxContent: 430,
    targets: [375, 390, 430] as const,
  },
  spacing: {
    micro: 4,
    tight: 8,
    compact: 12,
    control: 16,
    section: 24,
    headerToContent: 28,
  },
  radius: {
    card: 14,
    control: 12,
    pill: 999,
  },
  control: {
    buttonHeight: 48,
    iconButtonSize: 44,
    compactControlSize: 40,
  },
  icon: {
    inline: 16,
    button: 18,
    primary: 20,
  },
  type: {
    pageTitle: { fontSize: 30, lineHeight: 36, fontWeight: "900" as const },
    sectionTitle: { fontSize: 18, lineHeight: 24, fontWeight: "900" as const },
    cardTitle: { fontSize: 21, lineHeight: 28, fontWeight: "900" as const },
    body: { fontSize: 16, lineHeight: 22, fontWeight: "700" as const },
    supporting: { fontSize: 13, lineHeight: 18, fontWeight: "700" as const },
    metadata: { fontSize: 12, lineHeight: 16, fontWeight: "800" as const },
  },
  color: {
    page: T.bg,
    surface: T.white,
    ink: T.dark,
    mutedInk: "#62595e",
    primaryAction: "#1769aa",
    primaryOnAction: T.white,
    primarySubtle: "#eaf4fd",
    border: T.border,
    successInk: "#1f6a43",
    successSubtle: "#e8f6ee",
    errorInk: "#a63d2d",
    errorSubtle: "#fbecea",
  },
} as const;

export type LobbyRequiredState =
  | "active-quest"
  | "no-active-quest"
  | "planned-quest"
  | "no-plan"
  | "no-completions"
  | "loading"
  | "error"
  | "success";

type LobbyStateDefinition = {
  group: "activity" | "plan" | "history" | "request" | "feedback";
  primaryAction: "complete" | "start" | "plan" | "explore" | "retry" | "dismiss" | "none";
  purpose: string;
};

/**
 * Required states are composable. For example, a ready Lobby can have an
 * active quest, a plan, and no completions at the same time.
 */
export const lobbyStateDefinitions: Record<LobbyRequiredState, LobbyStateDefinition> = {
  "active-quest": {
    group: "activity",
    primaryAction: "complete",
    purpose: "Show the current quest and its single next action.",
  },
  "no-active-quest": {
    group: "activity",
    primaryAction: "explore",
    purpose: "Offer one clear route to a next quest when no session is active.",
  },
  "planned-quest": {
    group: "plan",
    primaryAction: "start",
    purpose: "Make the first planned quest the fastest path forward.",
  },
  "no-plan": {
    group: "plan",
    primaryAction: "plan",
    purpose: "Teach planning briefly and provide one direct setup action.",
  },
  "no-completions": {
    group: "history",
    primaryAction: "explore",
    purpose: "Explain the empty history and return the user to an achievable quest.",
  },
  loading: {
    group: "request",
    primaryAction: "none",
    purpose: "Preserve the page structure with a non-blocking loading treatment.",
  },
  error: {
    group: "request",
    primaryAction: "retry",
    purpose: "Explain the failed request in place and offer a retry.",
  },
  success: {
    group: "feedback",
    primaryAction: "dismiss",
    purpose: "Confirm a completed action without interrupting the next task.",
  },
};

export type LobbyFeedbackState = "idle" | "success";

export type LobbyStateInput = {
  contentLoading: boolean;
  contentError?: string | null;
  engineLoading: boolean;
  engineError?: string | null;
  hasActiveQuest: boolean;
  hasPlan: boolean;
  hasCompletions: boolean;
  feedback?: LobbyFeedbackState;
};

export function getLobbyLayout(width: number) {
  return {
    contentWidth: Math.min(width, lobbyDesign.viewport.maxContent),
    horizontalInset: 20,
    isCompact: width < lobbyDesign.viewport.compact,
  };
}

export function resolveLobbyStates({
  contentLoading,
  contentError,
  engineLoading,
  engineError,
  hasActiveQuest,
  hasPlan,
  hasCompletions,
  feedback = "idle",
}: LobbyStateInput) {
  const request = contentError || engineError ? "error" : contentLoading || engineLoading ? "loading" : "ready";

  return {
    request,
    activity: hasActiveQuest ? "active-quest" : "no-active-quest",
    plan: hasPlan ? "planned-quest" : "no-plan",
    history: hasCompletions ? "has-completions" : "no-completions",
    feedback,
  } as const;
}
