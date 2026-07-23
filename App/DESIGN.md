---
name: QuestLife Mobile
description: A warm, playful mobile companion for choosing, completing, and remembering real-world quests.
colors:
  canvas: "#fffcf5"
  surface: "#ffffff"
  ink: "#3d3438"
  muted-ink: "#8a8186"
  outline: "#e8dfd5"
  quest-blue: "#4da8ff"
  signal-cyan: "#00bbf9"
  reward-yellow: "#fee440"
  success-green: "#27ae60"
  energy-orange: "#f39c12"
  alert-red: "#e17055"
  memory-pink: "#fd79a8"
  discovery-purple: "#a29bfe"
  social-teal: "#00cec9"
typography:
  display:
    fontFamily: "GeistPixel"
    fontSize: "30px"
    fontWeight: 900
    lineHeight: "36px"
  headline:
    fontFamily: "GeistPixel"
    fontSize: "21px"
    fontWeight: 900
    lineHeight: "28px"
  title:
    fontFamily: "GeistPixel"
    fontSize: "18px"
    fontWeight: 900
    lineHeight: "24px"
  body:
    fontFamily: "Rubik"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: "22px"
  label:
    fontFamily: "Rubik"
    fontSize: "12px"
    fontWeight: 800
    lineHeight: "16px"
rounded:
  lobby-control: "12px"
  lobby-card: "14px"
  sm: "14px"
  md: "20px"
  lg: "24px"
  xl: "28px"
  sheet: "32px"
  pill: "999px"
spacing:
  micro: "4px"
  tight: "8px"
  compact: "12px"
  control: "16px"
  card: "18px"
  section: "24px"
  page-gutter: "16px-24px"
components:
  button-primary:
    backgroundColor: "{colors.quest-blue}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    padding: "0 18px"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.quest-blue}"
    rounded: "{rounded.pill}"
    padding: "0 18px"
    height: "48px"
  card-default:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: "18px"
  input-search:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "48px"
  tag-default:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "5px 10px"
---

# Design System: QuestLife Mobile

## Overview

**Creative North Star: "Daily Quest Companion"**

QuestLife is a warm, game-like mobile companion for turning ordinary time into small real-world adventures. It should make the next action feel clear and achievable, then make progress feel personally rewarding without putting spectacle ahead of the task. The experience is compact, touch-first, and deliberately friendly: a user should be able to scan a screen, recognize the primary action, and return to what they were doing in the real world.

Use a pale canvas, white task surfaces, lively but disciplined status colors, and tactile depth. Color signals a useful role: starting, progressing, rewarding, warning, or categorizing. The system rejects generic productivity-dashboard density, a marketing-page hierarchy, and a hard-edged competitive-game tone. Journal is the reference for page-level header rhythm; Lobby is the reference for compact, task-first decisions.

**Key Characteristics:**
- A single clear next action anchors every important screen.
- Playfulness is functional feedback, not decorative noise.
- Tactile 4px offset shadows establish touchable surfaces and controls.
- Mobile layouts stay compact, centered, and readable from 375px through 430px widths.
- State is communicated with text, icons, and color together.

## Colors

The palette is a light, warm-neutral foundation with one familiar sky-blue action color and a purposeful set of category and reward signals.

### Primary
- **Quest Blue:** The default action voice for starts, navigation emphasis, progress, and focused tabs. Use it for the one primary action, never as a blanket background.

### Secondary
- **Signal Cyan:** A bright informational accent for badges and moments that need a lighter, more energetic signal than the primary action.
- **Energy Orange:** The time, energy, and momentum signal. Reserve it for streak heat, time-sensitive context, and medium difficulty.

### Tertiary
- **Reward Yellow:** Positive reward and XP emphasis.
- **Success Green:** Completion, success, and easy-difficulty confirmation.
- **Memory Pink, Discovery Purple, Social Teal:** Distinct content-category and social signals, not interchangeable primary actions.
- **Alert Red:** Errors, destructive states, and hard-difficulty warning only.

### Neutral
- **Soft Canvas:** The page field behind content, keeping the app warm without becoming a paper-like marketing surface.
- **Clean Surface:** The default contained surface for cards, sheets, controls, and the tab bar.
- **Charcoal Ink:** Primary headings and high-emphasis text.
- **Muted Ink:** Supporting metadata only; it must not carry essential information by itself.
- **Tactile Outline:** The shared border and shadow color that makes surfaces feel physically pressable.

**The One Action Rule.** Quest Blue belongs to the most important action or selected state in a local context. A screen with several equally blue controls has lost its hierarchy.

## Typography

**Display Font:** GeistPixel
**Body Font:** Rubik
**Label/Mono Font:** Rubik with tabular figures for timers, counts, and changing values.

**Character:** GeistPixel gives quests a crisp, game-like title voice; Rubik keeps descriptions, controls, and metadata friendly and legible. The pairing should feel encouraging, not cartoonish.

### Hierarchy
- **Display:** Heavy page titles establish the screen’s purpose and are kept to one or two lines.
- **Headline:** Heavy quest and card titles carry the main item a user is choosing or completing.
- **Title:** Heavy section titles organize compact vertical stacks.
- **Body:** Strong, readable supporting copy explains a quest or status in short blocks.
- **Label:** Compact, high-weight metadata may use uppercase and modest tracking only for genuine categories or system labels.

**The Scan-First Rule.** A user should identify the page title, current state, and primary action before reading a description. Do not turn every supporting label into uppercase display text.

## Elevation

QuestLife uses structural rather than ambient elevation. White surfaces are bounded by a firm outline and a 4px offset tactile shadow in the same outline family, making cards and controls feel like pieces a user can press. This is intentionally more physical than a conventional soft-shadow app and should remain consistent across primary controls, cards, and compact icon buttons.

### Shadow Vocabulary
- **Tactile Offset:** The shared 4px x 4px offset shadow for cards and outlined icon controls. It communicates a stable, pressable surface.
- **Pressed Response:** Pressable elements may scale slightly down on touch. Keep the response quick and subtle; it is feedback, not a page transition.
- **Sheet Separation:** Bottom sheets use their own raised edge and backdrop to establish modal hierarchy. Blur is reserved for sheets or transient overlays where it clarifies the layer.

**The Physical Surface Rule.** Do not combine broad, hazy drop shadows with the tactile outline treatment. A surface is either a crisp QuestLife object or a purposeful modal layer.

## Components

### Buttons

Buttons are compact, direct, and comfortably thumb-sized.
- **Shape:** Full pill for primary and secondary actions; 48px minimum height.
- **Primary:** Quest Blue surface with white, high-weight text and an optional Ionicons symbol.
- **Secondary:** White surface with a tactile outline; use the action color for its label and icon.
- **Pressed / Disabled:** Pressed controls scale down slightly; disabled controls reduce opacity without losing legibility or their accessible state.

### Chips

Chips are classification and compact status, never substitute buttons for major actions.
- **Style:** Full pill with a light tint derived from its semantic or category color.
- **State:** Active filters use the strongest local contrast; category and difficulty tags keep text and tint paired.

### Cards / Containers

Cards hold genuinely distinct quests, summaries, media, or grouped actions.
- **Corner Style:** Shared cards use the global gentle curve; the dense Lobby uses its smaller dedicated card curve.
- **Background:** Clean Surface over the Soft Canvas.
- **Shadow Strategy:** Use Tactile Offset only when the card is intended to read as a physical, interactive object.
- **Border:** Use the shared Tactile Outline; do not add colored side stripes.
- **Internal Padding:** Standard cards use the card spacing token; tighter Lobby modules use the documented compact scale.

### Inputs / Fields

Inputs are quiet white controls with a tactile outline and clearly readable placeholder text.
- **Style:** Search fields use a full pill, a leading Ionicons symbol, and compact horizontal padding.
- **Focus:** Preserve the outline language and expose a visible focus indicator on web-capable surfaces; do not rely on a placeholder color change alone.
- **Error / Disabled:** Error text and iconography accompany Alert Red. Disabled fields remain readable and do not masquerade as loading states.

### Navigation

The tab bar is a persistent white bottom surface with five icon-first destinations.
- **Style:** The selected destination sits inside a pale pink circular field; inactive icons use Muted Ink.
- **Active State:** Quest Blue marks the focused icon, while notification badges use Alert Red with a white keyline.
- **Touch:** Tab controls preserve a stable icon target and do not resize surrounding navigation when selected.

### Signature Component: Quest Progress

Progress bars are pill tracks with a color-coded fill and a minimum visible fill for nonzero values. Countdown and elapsed values use tabular figures and stable one-line space so progress remains calm while it changes.

## Do's and Don'ts

### Do:
- **Do** use the Soft Canvas for page backgrounds and Clean Surface for task containers; preserve the visual distinction between the page and a touchable object.
- **Do** make the primary action obvious on every important screen: start, complete, log, save, or invite.
- **Do** use the tactile outline and 4px offset shadow consistently for pressable QuestLife surfaces.
- **Do** keep mobile controls at least 44px, and use the shared 48px height for text actions and search fields.
- **Do** pair status color with copy and an icon or shape so completion, warning, and selection do not depend on color alone.
- **Do** respect reduced-motion preferences and use short feedback motion for interaction state, never choreography that delays a task.

### Don't:
- **Don't** turn the app into a generic productivity dashboard; quests should read as invitations to act, not rows of obligations.
- **Don't** turn the product into a marketing landing page; authenticated screens prioritize a clear task over oversized promotional hierarchy.
- **Don't** drift into a hard-edged competitive game UI; reward progress warmly and avoid aggressive score-first presentation.
- **Don't** use Quest Blue for every control, inactive state, or decorative background.
- **Don't** add colored side stripes, gradient text, decorative glass cards, or oversized soft shadows.
- **Don't** use broad page-load choreography or let animated content be invisible before its reveal runs.
