# QuestLife Motion Plan

## Motion contract

QuestLife motion should confirm an action, preserve orientation, or show a meaningful state change. It must never delay readable content or become a decorative page-load sequence.

- **Runtime:** React Native Reanimated worklets (the project currently ships Expo SDK 54's `react-native-reanimated` 4.x, which is API-compatible with the Reanimated 3 patterns used here).
- **Properties:** animate `opacity`, `translateX/Y`, and `scale` only. No layout-property animation in new work.
- **Timing:** 160–200 ms ease-out for fades; a restrained spring for position and scale.
- **Accessibility:** when the OS or QuestLife preference requests reduced motion, states settle immediately. Content is never initially hidden while waiting for an animation.
- **Performance:** shared values live inside the animated component; no animation state is held in React state and no animation work runs on the JS thread.

## Audit findings

| Priority | Surface | Finding | Decision |
| --- | --- | --- | --- |
| P0 | Shared UI | `Entrance`, buttons, and sheets use legacy `Animated`; their behavior is duplicated across screens. | Introduce a small shared Reanimated motion layer and migrate reusable primitives first. |
| P0 | Dashboard charts | `activity-chart-card` and `profile-insights-dashboard` animate height/width using the JS driver. | Replace with transform-based fill/bar motion. |
| P1 | Navigation | The tab selection changes dimensions abruptly; stack transitions are platform defaults. | Add a transform/opacity tab affordance, retaining native stack transitions. |
| P1 | Streak and social | Both screens mix legacy and Reanimated animations and duplicate accessibility subscriptions. | Migrate the compact controls and feedback sequences to the shared contract. |
| P2 | Onboarding | Long opacity choreography can delay first useful content. | Simplify to a short, optional opacity transition after content is ready. |
| P2 | One-off content effects | Feed, party, and quest-completion effects are already partly Reanimated. | Standardize reduced-motion behavior and remove any layout animation when touched. |

## Delivery phases

1. **Foundation:** shared durations, springs, reduced-motion helpers, and reusable press/entrance primitives.
2. **High-frequency UI:** tab selection, buttons/cards, headers, and charts.
3. **High-value feedback:** streak controls, social success feedback, and quest completion.
4. **Onboarding and remaining legacy paths:** migrate only where motion clarifies state; simplify anything that does not.

## Verification after each phase

- Run TypeScript type-checking.
- Confirm shared values are not mirrored in React state and animated styles use worklets.
- Confirm new motion changes only opacity and transforms.
- Confirm reduced motion settles to the final visual state without delayed/invisible content.
- Manually inspect the affected screen on device/simulator before treating the phase as complete; startup and initial screen rendering remain unanimated.
