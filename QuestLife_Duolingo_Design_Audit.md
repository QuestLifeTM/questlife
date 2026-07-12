# QuestLife × Duolingo Design Audit

**Purpose:** Extract the interaction hierarchy, behavioral design, visual systems, and motion principles demonstrated by the supplied Duolingo iOS flows, then assess how those principles should guide QuestLife. This is an audit, not a request to copy Duolingo's branding, characters, screens, illustrations, wording, or proprietary visual assets.

**Reference flows reviewed:** onboarding, Home, starting a lesson, completing a first lesson, completing a lesson, rapid review, radio lesson, Quests, personal streak, leaderboard, and year in review. The QuestLife review covers the shared UI system and its current Lobby, Explore, Quest Detail, Journal, Social/Parties, profile-adjacent, packs, notifications, saved, planning, and streak surfaces.

---

## Executive read

Duolingo feels immediately usable because it behaves like a guided game, not a catalog of features. Every screen answers one question at a time: **What is my next move? What will I get? Did that work?** Its color, type, illustrations, rewards, and animation all reinforce that answer.

QuestLife already has a compatible emotional foundation: real-world quests, XP, streaks, a playful lobby, reflection, and social motivation. Its best current moments are the daily energy / active quest structure in the Lobby, the quest-reward loop, Journal's visual rhythm, animated flame, and completion-to-memory flow. The gap is not a lack of features. It is a lack of one consistent priority system across every screen. Too many QuestLife cards currently ask for equal attention; too many accent colors are available at once; primary actions, supporting details, and history sometimes use comparable weight.

The transferable opportunity is to make QuestLife feel like a **calm real-world adventure game**:

1. One obvious next action per screen.
2. One visible reward or progress signal near that action.
3. Strong feedback at meaningful milestones.
4. Secondary information visually quiet until it is needed.
5. Plenty of player agency; no guilt-driven urgency.

---

## 1. The Duolingo system: what is actually doing the work

### 1.1 Hierarchy is decisive

Duolingo uses a three-level hierarchy on nearly every task screen:

| Level | Duolingo pattern | Human effect | QuestLife translation |
| --- | --- | --- | --- |
| Primary | One full-width, saturated, raised action | Removes hesitation | One dominant action: Start Quest, Complete Quest, Create Party, Add Selected Quests |
| Secondary | Large outlined choice or utility control | Gives agency without competing | Outline actions such as Save for Later, Back, Decline, Browse |
| Tertiary | Small icon controls or quiet text links | Keeps optional work discoverable | Info, share, filters, settings, and dismiss actions |

The important distinction is proportion, not merely color. Primary actions are full-width, taller, and receive a colored face plus a darker lower edge. Secondary actions are visually lighter. Nothing else looks accidentally primary.

### 1.2 Progress is always visible and readable

In onboarding and lessons, the progress bar appears at the top before the task begins. It is thick enough to read in peripheral vision, uses a neutral track, and has a high-saturation fill. In Quest, streak, and review flows, progress is repeated in short concrete formats: `11 / 30`, `1 day`, a streak count, a rank, or a nearly-complete chest.

This reduces uncertainty: the user understands both where they are and what "done" means without reading paragraphs.

**QuestLife implication:** Every multi-step Party, quest flow, pack, and reflection flow needs a progress unit that includes both visual fill and plain-language state—e.g. `2 of 3 · Pick quests`—rather than a bar alone.

### 1.3 The interface is generous with whitespace, not with text

Onboarding is a useful example. A character, one question, several large choices, and one bottom action fill the screen. Lesson screens follow the same grammar: one prompt, one interaction area, one feedback region. The user does not have to scan five cards to infer the intended path.

Duolingo's copy is short, active, concrete, and usually attached to a thing the user can see. It avoids explaining a system before it becomes relevant.

**QuestLife implication:** Keep Party settings and game-mode explanations available, but reveal them at the moment of choice. Party home should lead with active Parties / Create Party; the explanation belongs behind the information button. Quest detail should lead with the active quest and outcome, then steps, then related information.

### 1.4 Color has a job

The reference app does not use color as a random decoration layer.

| Color role | Typical use | Principle to reuse |
| --- | --- | --- |
| Course / context color | Unit header, path nodes, progress | A color can label a single current context |
| Green | Correctness, continuation, completion | Reserve success green for earned positive state |
| Orange | Streak, urgency, hard-exercise energy | Use sparingly for energy or time-sensitive state |
| Blue | Navigation, rank, neutral progress | Use QuestLife blue for forward movement and primary interaction |
| Purple / pink | Event, special reward, social emphasis | Use as special-event and Party accents, not universal background |
| Gray | Locked, incomplete, future state | Make unavailable states calm but unmistakable |

QuestLife should retain its own blue, purple, green, orange, cream, and plum language. It should not import Duolingo green. The important lesson is **semantic allocation**: do not allow multiple saturated colors to compete inside a single decision block.

### 1.5 Icons are part of the vocabulary, not ornament

Duolingo uses three distinct icon families:

- **Illustrative game artifacts:** big 3D lesson nodes, chests, league trophies, reward cards. These explain state and offer emotional payoff.
- **Functional symbols:** close, back, audio, share, tabs, rank medal. They are simple, consistent, and given large touch targets.
- **Status glyphs:** flame, gem, heart, check, rank, chest. They are paired with a number or short label; color is never the only signal.

QuestLife's Ionicons plus its existing custom quest / flame / lobby icons should remain its functional vocabulary. The transferable rule is to use a recognizable leading icon whenever a card or action has a distinct role, and to pair unfamiliar icons with text. Do not attempt to recreate Duolingo's 3D assets or characters.

### 1.6 Buttons are physical without becoming skeuomorphic

The dominant Duolingo button has:

- a broad, forgiving touch target;
- a high-chroma top face;
- a darker lower edge that establishes depth;
- uppercase or very high-weight label text;
- a small downward press movement;
- one consistent geometry across action types.

This gives a tap a sense of consequence. It is especially effective for a next-step action and for celebration continuation, where it feels like moving the story forward.

QuestLife's Party button treatment now moves in this direction. It should become a deliberate shared vocabulary for **primary actions only**, while plain `SoftButton` / outlined actions stay less emphatic.

---

## 2. Flow-by-flow reference analysis

### Onboarding

**Observed structure:** single prompt → illustrated guide → large mutually exclusive answers → fixed bottom continuation. Progress appears at the top and each choice has a clear selected treatment.

**Psychology:** onboarding asks the user to make small, low-risk commitments. The character establishes warmth, the concise question lowers cognitive burden, and the selected card gives immediate certainty before the next step.

**QuestLife use:** first-run preference / goal selection should use one question per screen, 3–5 large answer cards, a selected state that is obvious without color, and a fixed Continue button. Avoid collecting a full profile in one scrolling form.

### Home / learning path

**Observed structure:** a compact status strip, a dominant current unit card, a visually obvious progression path, future content in quiet gray, and persistent bottom navigation.

**Psychology:** the user feels both oriented and pulled forward. The current node is clear; locked future content creates anticipation instead of clutter; completed items affirm momentum.

**QuestLife use:** Lobby should be the "next real-world adventure" equivalent. Active Quest / Empty State must outrank history, packs, and secondary stats. Future or unavailable quests should look intentionally dormant—not like broken or merely low-contrast cards.

### Starting a lesson

**Observed structure:** a visible progress bar, one exercise prompt, a contextual illustration or speech bubble, an interaction area, and a fixed action/feedback zone.

**Psychology:** the user is protected from scope creep. They work inside a tiny loop, receive progress assurance, and retain an exit option.

**QuestLife use:** quest-start and completion flows should lead with just the current quest, time/reward, the next required action, and an always-visible exit/Save option. Do not expose related quests or social context until after the core action is clear.

### Completing the first lesson and normal lessons

**Observed structure:** instant correctness feedback followed by a stronger completion scene. Feedback uses color, wording, and icon/character expression together; the action remains "Continue." Perfect streaks or notable moments receive larger animation and confetti.

**Psychology:** it uses a reward gradient: routine success is fast, meaningful achievement gets a peak moment. This supports learning without turning every tap into a party.

**QuestLife use:** standard quest completion should be fast—haptic, check, XP count, and Continue. A first completion, streak milestone, Party rank shift, or five-quest day can earn the richer celebration. Keep reflection optional and never make half XP feel punitive for skipping it.

### Rapid review and radio lessons

**Observed structure:** the same lesson shell is reused while the content modality changes. Time / challenge context is shown early; feedback state is unambiguous; the bottom action remains stable.

**Psychology:** consistency makes new modes feel learnable. The user understands that the game rules changed, not the whole app.

**QuestLife use:** Party modes, photo-proof completion, timed challenges, and solo quests need the same core shell. Mode-specific rules should show as a compact badge plus a short explanation, not a redesign of the whole quest screen.

### Quests

**Observed structure:** an event-colored hero area, a concrete objective, visible numerical progress, then a short list of daily items with progress bars and chest rewards.

**Psychology:** the user sees a ladder of achievable wins. Each daily quest is a commitment with immediate feedback; the next reward is visible.

**QuestLife use:** Daily Energy should be a real progress system, not merely a counter. Pair its progress bar with one visible next reward or outcome. Keep each daily action short and measurable, and avoid presenting many unrelated goals at equal priority.

### Personal streak

**Observed structure:** a full emotional color field, one large streak number, a flame mark, a calendar, and simple personal/friends tabs.

**Psychology:** the streak becomes identity and continuity, not only a metric. The calendar provides evidence that a missed day is recoverable context rather than an opaque failure.

**QuestLife use:** retain the animated flame and streak review, but introduce compassionate recovery states. Avoid shame-based copy, artificial midnight pressure, or making users feel that logging a reflection is required to "protect" their identity.

### Leaderboard

**Observed structure:** league title and time remaining, a large visual league ladder, then a rank-ordered list where each row has one person, one rank, one score, and an avatar.

**Psychology:** social comparison is structured and legible. The interface makes rank meaningful, but does not put every social interaction on the same screen.

**QuestLife use:** Party leaderboard should preserve a strong rank → avatar → name → XP row pattern. Use a separate information button for mode-specific ranking rules. Keep rank changes celebratory but avoid threatening members who cannot do real-world activities at the same pace.

### Year in review

**Observed structure:** a focused, shareable story card with a single headline statistic, supporting metrics, a strong themed background, and one share action.

**Psychology:** this is an identity artifact: users see themselves as a person who did something meaningful. It turns accumulated data into a memory worth sharing.

**QuestLife use:** Journal is the natural home for a future Adventure Recap: quests completed, places explored, favorite category, streak high point, Party contribution, and memories. Make it a dedicated, opt-in, shareable recap—not a crowded analytics dashboard.

---

## 3. Interaction psychology: what QuestLife should deliberately preserve

### Build momentum through small wins

Use an action sequence that a user can understand at a glance:

```text
Choose a quest → Start it → Do it in the world → Confirm it → See the reward → Keep or record the memory
```

The current app already supports this loop. The next design pass should make it visually identical in its sequence wherever it appears: solo quest, Party quest, daily energy, and streak flows.

### Use social motivation without social pressure

Parties, friend challenges, and leaderboards can create belonging, accountability, and celebration. They can also create exclusion and avoidance when a user is busy, unable to travel, or less physically able.

Recommended posture:

- Celebrate contribution, not only rank.
- Explain rank mechanics before competition begins.
- Use "Take your time" / "Pick another quest" recovery paths.
- Make photo proof a host rule shown plainly before a user starts.
- Give users an easy leave / mute / decline path with neutral language.

### Protect autonomy in reflection and streaks

Reflection improves memory and Journal quality, but the reward differential for skipping it should not feel coercive. Make the primary completion reward unconditional. Frame reflection as a way to "save the moment" rather than a duty.

### Design peak and end moments

Use a larger emotional payoff only at real milestones:

- first completed quest;
- first Party completion;
- Party rank change or shared-round lock;
- streak milestone;
- five completed daily quests;
- month/year recap.

Routine actions should give brief, reliable confirmation. Over-celebration turns delight into delay.

---

## 4. QuestLife implementation audit

### Strengths to keep

1. **The product premise and visual register match.** QuestLife already feels playful, motivating, and warm rather than like a productivity dashboard. Its cream field, plum ink, blue action color, quest cards, and Journal-based rhythm are a viable identity.
2. **The Lobby has a strong behavioral foundation.** Daily Energy, Active Quest, and Completed Today already tell a useful story: current commitment, capacity, then evidence of progress.
3. **The reward-to-memory loop is distinctive.** Completion → Lore / reflection → Journal can turn activity into a personal narrative rather than just points.
4. **The system has reusable primitives.** `Screen`, `Header`, `Card`, `Sheet`, `SoftButton`, `EmptyState`, tags, haptics, and the animated flame are practical foundations.
5. **Some motion work is already thoughtful.** Lobby includes a reduced-motion preference and uses short native-driver transitions; Journal has purposeful state transitions rather than only decorative animation.

### Current friction points

| Priority | Finding | Why it matters | Direction |
| --- | --- | --- | --- |
| P1 | Shared secondary and on-accent text lacks sufficient contrast in several token combinations. | Low-vision users can lose labels and body content; this is a product-quality and accessibility issue. | Introduce semantic text ramps and a tested `onAccent` color per action color. |
| P1 | Many pressable controls are icon-only or lack explicit accessible names; shared sheets do not provide complete modal focus semantics. | Screen-reader and keyboard/switch users cannot reliably identify or leave controls. | Standardize accessibility labels, 44px hit areas, sheet dialog role / focus handling, and a labeled backdrop dismissal. |
| P2 | Cards are overused and use similar outline/shadow weight. | The user has to visually process every section as equally important. | Reserve card depth for active decisions/rewards; use simpler grouped sections and dividers for details/history. |
| P2 | Typography is mechanically consistent rather than intentionally tiered. | Repeated all-caps tracked subtitles and similar bold weights make scanning tiring. | Define a small mobile type scale: page title, section title, action label, body, metadata. Use all-caps only for compact status labels. |
| P2 | Motion quality is inconsistent across features. | Some flows respect reduced motion while shared entrances/onboarding/Journal do not consistently do so. | Establish one motion policy: 150–260 ms state motion, reduced-motion fallback, and milestone-only celebration. |
| P2 | Creation and settings flows can become decision-heavy. | New users may abandon a long Party form before experiencing its value. | Keep progressive disclosure: quest source → quest choice → core details; hide advanced rules behind a clear optional section. |
| P2 | Initial font/auth loading currently returns a blank screen. | The product feels unresponsive at the most fragile first impression. | Show a branded, accessible loading state instead of null. |

### Current screen map and hierarchy review

| QuestLife surface | Existing hierarchy | What is working | What the next pass should protect or change |
| --- | --- | --- | --- |
| Lobby | Greeting → Daily Energy → Active Quest → Completed Today | It correctly centers the daily loop and has the clearest game-like rhythm. | Keep Active Quest as the decisive focal point; visually quieten supporting progress/history when a quest is active. |
| Explore | Header → search / sort / category controls → featured content → quest list | Good discovery controls and flexible browsing. | Avoid filter and featured-card competition. Let search/category selection lead, then present one featured idea, then results. |
| Quest detail | Quest identity → effort/reward → instructions → action → secondary context | The action is understandable and rewards are visible. | Reduce stacked cards. Keep Start / Complete sticky and dominant; collapse supporting information into lightweight sections. |
| Journal | Period navigation → timeline / entries → memories and summaries | The strongest visual-rhythm reference; it makes history feel personal. | Preserve the narrative quality; keep editing and filters subordinate to the story. |
| Social / Parties | Tab switch → invites / code utilities → Create Party → active/past Parties | Recent Party hierarchy is much clearer and supports real social entry points. | Keep Create Party as the sole saturated CTA; do not add explanatory paragraphs back to the home surface. |
| Party detail | Party identity → members/status → Quests / Feed / Leaderboard | Tabs make a multi-mode social feature comprehensible. | Mode rules should remain on-demand. In Quests, show the one actionable quest ahead of cards/history. |
| Streak | Streak state → continuity evidence → goals / recovery | The animated flame supplies emotion without a separate mascot. | Add graceful recovery / pause paths; avoid copy that frames a missed day as failure. |
| Plans and Adventure Packs | Pack / plan identity → selection or details → save/start action | Packs create useful themed choice. | Use one hero/context color per pack; keep selection and saving steps as focused task screens with progress. |
| Saved | Saved list → resume/remove actions | Useful low-pressure holding area. | Ensure save/remove targets are 44px and that resuming is visually stronger than removal. |
| Profile / Notifications | Personal identity / event history → settings or response | They provide useful support context. | They should stay calm, dense, and functional—not compete with the action-oriented Lobby. |
| Authentication / onboarding | Identity / setup → one step forward | Existing onboarding animation is a strong base. | Use question-by-question commitment, a visible progress unit, and a clear recovery path; never show a blank initial load. |

### Measured implementation risks

The visual system needs an accessibility foundation before expanding the gamified surface:

- `#8a8186` muted text is approximately **3.68:1** against `#fffcf5` and **3.77:1** against white—below the AA requirement for normal text.
- White text on existing blue, green, orange, and purple action colors ranges from approximately **2.19:1 to 2.87:1** in the current palette. This affects shared primary button labels.
- Static source review found roughly **82 `Pressable` usages**, while accessibility semantics are much less consistently supplied. Icon controls and selection rows need explicit roles and labels.
- Several reusable controls are below the recommended **44 × 44 pt** touch area, including calendar, view-toggle, save, and remove controls.
- The shared `Sheet` is visually familiar but needs `accessibilityViewIsModal`, an explicit dialog label, focus transfer/restore, and an accessible backdrop-dismiss action.
- The detector reported **0 automated pattern hits**, but manual review still found repeated large radii, card/shadow repetition, and two colored side-stripe treatments that should be removed from the visual vocabulary.

### Consistency observations

- The theme token foundation is a strength, but values are still repeated as literal colors across interface files. Promote semantic roles such as `textPrimary`, `textSecondary`, `onPrimary`, `surfaceSelected`, `borderStrong`, and `successSurface`.
- `GeistPixel` is currently used for heading, bold, and body roles while the Lobby separately hard-codes Rubik. Choose and document one body system and one display system—or use one typeface consistently—and apply it across all screens.
- Preserve the QuestLife hard-edged, friendly depth, but use 16–20px radii for cards and reserve full pills for tags/buttons. Avoid adding more large rounded containers.
- Two colored side stripes currently appear in content/list treatments. Prefer full borders, leading icons, or colored tags; stripes are easy to overuse and weaken the system.

---

## 5. Motion, pop-ups, and feedback rules

### Recommended motion map

| Moment | Motion | Duration | Reduced motion |
| --- | --- | --- | --- |
| Page/section arrives | opacity + 8–12px rise, only when it clarifies a new state | 180–240ms | instant / crossfade |
| Button press | 2–3px down, then return | press-bound | no movement required |
| Selection | color/border change + check icon | 120–180ms | instant state change |
| Progress increase | bar fill interpolates | 180–260ms | instant fill |
| Routine completion | check + light haptic + XP count | 250–450ms | static confirmation |
| Meaningful milestone | one focused celebration, then Continue | 600–1200ms | still achievement screen |
| Leaderboard update | only the affected row shifts | 180–260ms | crossfade / final order |

### Pop-up hierarchy

- Use **bottom sheets** for a short choice, supporting information, invite, picker, or completion details.
- Use a **full focused screen** for a multi-step task where the user must concentrate, such as a long Party settings form if it grows beyond the current three stages.
- Use an **inline status or toast** for routine saves, a reaction, a quick "quest added" confirmation, and recoverable low-stakes events.
- Use a **native confirmation alert** only for destructive actions such as End Party or Leave Party, with neutral copy and a clear cancel.
- Do not place critical information only in animations or pop-ups; active quest status and rewards should remain visible in the resulting screen state.

---

## 6. A practical visual hierarchy for QuestLife

### Page anatomy

1. **Orientation:** short title plus one meaningful current status.
2. **Commitment:** the single next action or active quest.
3. **Evidence:** progress, reward, time, or Party status.
4. **Support:** instructions, options, people, history, or related quests.
5. **Navigation:** stable and visually quiet until selected.

### Button anatomy

- **Primary:** saturated QuestLife blue / contextual Party accent, dark lower edge, 52–58px height, icon + clear verb, strong contrast.
- **Secondary:** white or tinted surface, clear 2px outline, dark/accent label, no heavy shadow.
- **Destructive:** outline red or a deliberate confirmation sheet; never position it as the screen's most visually attractive action.
- **Icon-only:** 44px minimum target, always accessibility label, use only for universal actions (back, close, info, share, save).

### Text anatomy

- Page heading: strong dark plum, 24–30px, heavy.
- Section heading: 18–22px, heavy.
- Task / quest title: 16–20px, heavy.
- Body: 14–16px, readable dark secondary tone.
- Metadata: 11–12px, compact; use uppercase sparingly for status, not paragraphs.

---

## 7. Recommended design work order

1. **Harden the shared system first.** Correct contrast, touch targets, accessible names, and bottom-sheet accessibility. This makes every current and future screen better.
2. **Create a real component vocabulary.** Standardize primary / secondary / destructive button variants, reward chip, status pill, selectable row, progress module, and accessible icon control.
3. **Refine the Lobby and quest-completion loop.** These are the product's highest-frequency motivation surfaces and should establish the model for Parties.
4. **Apply that model to Party creation and Party detail.** One next action, one progress/reward signal, a calm secondary layer, mode explanation on demand.
5. **Polish Journal and recap moments.** They are the differentiator that can make QuestLife feel memorable rather than merely gamified.

---

## Non-negotiable boundaries

- Do not copy Duolingo's green brand, owl, 3D characters, lesson path, illustrations, wording, or specific screens.
- Do not turn QuestLife into a language-learning product or force its real-world quests into a linear course path.
- Do not use gamification to shame users for resting, missing a day, or opting out of social activity.
- Do not make every element colorful, elevated, animated, or bold. Contrast creates hierarchy.
- Keep rewards grounded in real-world exploration, memories, and connection—the reason QuestLife exists.
