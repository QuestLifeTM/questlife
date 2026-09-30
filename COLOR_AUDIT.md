# QuestLife mobile color audit

Generated from the current `App/` source on 2026-09-29. This inventory lists every semantic `T.*` token reference and every direct hexadecimal, RGB(A), or HSL(A) literal found in UI source files. Values assembled dynamically from a token, such as `${T.blue}18`, are represented by their token in the semantic-token column.

## Theme source

Canonical theme definitions live in [`App/components/theme.ts`](App/components/theme.ts).

| Role | Light | Dark | High contrast light | High contrast dark |
| --- | --- | --- | --- | --- |
| Canvas (`bg`) | `#fffcf5` | `#171319` | `#ffffff` | `#0b090c` |
| Base surface (`white`, `surface`) | `#ffffff` | `#241e26` | `#ffffff` | `#1b161d` |
| Raised surface (`raised`) | `#ffffff` | `#2d2630` | `#ffffff` | `#28202a` |
| Input (`input`) | `#fffcf5` | `#1e1921` | `#fffcf5` | `#120f14` |
| Primary text (`dark`) | `#3d3438` | `#fff7fb` | `#171214` | `#ffffff` |
| Secondary text (`muted`) | `#71686d` | `#c6b9c2` | `#50474b` | `#e1d6df` |
| Outline (`border`) | `#e8dfd5` | `#4d414d` | `#8a7e75` | `#bcaec0` |
| Tactile shadow (`shadow`) | `#e8dfd5` | `#0f0c10` | `#8a7e75` | `#000000` |
| Selection (`selected`) | `#3d3438` | `#433642` | `#3d3438` | `#5a4055` |
| Overlay (`overlay`) | `rgba(30,25,28,0.48)` | `rgba(7,5,8,0.76)` | same as light | same as dark |
| Accent text (`onAccent`) | `#ffffff` | `#ffffff` | `#ffffff` | `#ffffff` |
| Blue | `#4da8ff` | `#70baff` | `#006dcc` | `#8bc8ff` |
| Cyan | `#00bbf9` | `#50d8ff` | `#007b9f` | `#7ce7ff` |
| Yellow | `#fee440` | `#ffdc5c` | `#9b6900` | `#ffe37a` |
| Green | `#27ae60` | `#58cc8a` | `#087d3e` | `#75e6a4` |
| Orange | `#f39c12` | `#ffb34b` | `#a84e00` | `#ffc56f` |
| Red | `#e17055` | `#ff8c7a` | `#b72e20` | `#ffad9f` |
| Pink | `#fd79a8` | `#ff9dc4` | `#b01c62` | `#ffb5d1` |
| Purple | `#a29bfe` | `#b9b0ff` | `#5d4ab8` | `#cec8ff` |
| Teal | `#00cec9` | `#4cddd1` | `#007f7a` | `#7bece2` |

## Per-file component inventory

| Source file | Semantic tokens used | Direct color literals |
| --- | --- | --- |
| [App/app/(auth)/auth-options.tsx](App/app/(auth)/auth-options.tsx) | `T.bg`, `T.blue`, `T.border`, `T.dark`, `T.green`, `T.muted`, `T.onAccent`, `T.orange`, `T.pink`, `T.purple`, `T.white` | `#dff1ff`, `#e1f8ef`, `#e9f5ff`, `#eeeaff`, `#f0ecff`, `#fff0f5`, `#fff4cd`, `rgba(77,168,255,0.13)`, `rgba(77,168,255,0.18)` |
| [App/app/(auth)/login.tsx](App/app/(auth)/login.tsx) | `T.blue`, `T.muted` | — |
| [App/app/(auth)/register.tsx](App/app/(auth)/register.tsx) | `T.blue`, `T.border`, `T.buttonEdge`, `T.dark`, `T.muted`, `T.onAccent` | — |
| [App/app/(auth)/verify-email.tsx](App/app/(auth)/verify-email.tsx) | `T.muted` | `rgba(255,255,255,0.78)` |
| [App/app/(tabs)/_layout.tsx](App/app/(tabs)/_layout.tsx) | `T.blue`, `T.border`, `T.muted`, `T.pill`, `T.red`, `T.white` | `rgba(0,0,0,0.05)` |
| [App/app/_layout.tsx](App/app/_layout.tsx) | `T.bg` | `#101510` |
| [App/app/auth/callback.tsx](App/app/auth/callback.tsx) | `T.bg`, `T.blue` | — |
| [App/app/index.tsx](App/app/index.tsx) | `T.blue`, `T.border`, `T.buttonEdge`, `T.dark`, `T.isDark`, `T.muted`, `T.onAccent` | `#000000`, `#277dcc`, `#4D9CFF`, `#EAF4FF`, `rgba(255,255,255,0.4)`, `rgba(255,255,255,0.42)`, `rgba(36,30,38,0.56)` |
| [App/app/onboarding/about-you.tsx](App/app/onboarding/about-you.tsx) | `T.bg`, `T.blue`, `T.border`, `T.buttonEdge`, `T.dark`, `T.muted`, `T.onAccent`, `T.white` | `#101510`, `#258fd8`, `#34A853`, `#7C5CFC`, `#E4405F`, `#FF0000`, `#FF4500` |
| [App/app/onboarding/claim-username.tsx](App/app/onboarding/claim-username.tsx) | `T.bg`, `T.blue`, `T.border`, `T.buttonEdge`, `T.dark`, `T.green`, `T.muted`, `T.onAccent`, `T.red`, `T.white` | — |
| [App/app/onboarding/follow-up-questions.tsx](App/app/onboarding/follow-up-questions.tsx) | `T.bg`, `T.blue`, `T.border`, `T.buttonEdge`, `T.dark`, `T.muted`, `T.onAccent`, `T.white` | `#258fd8` |
| [App/app/onboarding/frequency.tsx](App/app/onboarding/frequency.tsx) | `T.bg`, `T.blue`, `T.buttonEdge`, `T.dark`, `T.onAccent` | — |
| [App/app/onboarding/personalizing.tsx](App/app/onboarding/personalizing.tsx) | `T.bg`, `T.blue`, `T.border`, `T.dark`, `T.green`, `T.onAccent`, `T.white` | `#f9c74f`, `#ff6b6b` |
| [App/app/onboarding/questions-intro.tsx](App/app/onboarding/questions-intro.tsx) | `T.bg`, `T.blue`, `T.border`, `T.buttonEdge`, `T.dark`, `T.muted`, `T.onAccent`, `T.white` | `#258fd8` |
| [App/app/onboarding/questions-path.tsx](App/app/onboarding/questions-path.tsx) | `T.blue`, `T.buttonEdge`, `T.onAccent` | `#101510`, `rgba(255,255,255,0.92)`, `rgba(5,10,7,0.5)`, `rgba(5,10,7,0.76)` |
| [App/app/onboarding/reassurance.tsx](App/app/onboarding/reassurance.tsx) | `T.blue`, `T.dark`, `T.muted`, `T.onAccent`, `T.white` | — |
| [App/components/activity-chart-card.tsx](App/components/activity-chart-card.tsx) | `T.blue`, `T.dark`, `T.green`, `T.muted` | — |
| [App/components/add-friend-icon.tsx](App/components/add-friend-icon.tsx) | — | `#4DA8FF` |
| [App/components/auth/AuthControls.tsx](App/components/auth/AuthControls.tsx) | `T.blue`, `T.border`, `T.buttonEdge`, `T.dark`, `T.muted`, `T.onAccent`, `T.red`, `T.white` | `#4285F4`, `rgba(225,112,85,0.08)` |
| [App/components/auth/AuthScaffold.tsx](App/components/auth/AuthScaffold.tsx) | `T.bg`, `T.border`, `T.raised` | `rgba(253,121,168,0.10)` |
| [App/components/auth/AuthText.tsx](App/components/auth/AuthText.tsx) | `T.blue`, `T.dark`, `T.muted` | — |
| [App/components/auth/OtpInput.tsx](App/components/auth/OtpInput.tsx) | `T.blue`, `T.border`, `T.dark`, `T.white` | — |
| [App/components/auth/PasswordStrength.tsx](App/components/auth/PasswordStrength.tsx) | `T.border`, `T.dark`, `T.green`, `T.muted`, `T.orange`, `T.red` | — |
| [App/components/avatar-pile.tsx](App/components/avatar-pile.tsx) | `T.border`, `T.muted`, `T.white` | — |
| [App/components/back-icon.tsx](App/components/back-icon.tsx) | — | `#4DA8FF` |
| [App/components/collection-loading-skeleton.tsx](App/components/collection-loading-skeleton.tsx) | `T.border`, `T.white` | — |
| [App/components/global-announcement.tsx](App/components/global-announcement.tsx) | `T.blue`, `T.dark`, `T.muted`, `T.onAccent`, `T.white` | `#000000`, `#dc2626`, `rgba(5, 10, 18, 0.62)`, `rgba(77,168,255,0.38)` |
| [App/components/heart-icon.tsx](App/components/heart-icon.tsx) | — | `#FF6B81` |
| [App/components/lobby-design.ts](App/components/lobby-design.ts) | `T.bg`, `T.border`, `T.dark`, `T.white` | `#1769aa`, `#1f6a43`, `#62595e`, `#a63d2d`, `#e8f6ee`, `#eaf4fd`, `#fbecea` |
| [App/components/log-lore-flow.tsx](App/components/log-lore-flow.tsx) | `T.blue`, `T.border`, `T.dark`, `T.green`, `T.isDark`, `T.muted`, `T.onAccent`, `T.orange`, `T.pink`, `T.purple`, `T.red`, `T.teal`, `T.white`, `T.yellow` | `#f6b90b`, `#ffa70f`, `#ffb317`, `#ffb517`, `#ffbd35`, `#ffbf24`, `#ffbf26`, `#ffc13a`, `#ffc64d`, `#ffdc83`, `#ffe58a`, `#fff0bc`, `#fff9e7`, `rgba(255, 181, 23, 0.13)`, `rgba(255, 191, 24, 0.9)`, `rgba(255, 215, 103, 0.2)`, `rgba(255,252,248,0.36)`, `rgba(255,255,255,0)`, `rgba(255,255,255,0.06)`, `rgba(255,255,255,0.55)`, `rgba(36,30,38,0.36)` |
| [App/components/onboarding-compass-route.tsx](App/components/onboarding-compass-route.tsx) | — | `#9CB8C2` |
| [App/components/onboarding-intro.tsx](App/components/onboarding-intro.tsx) | — | `#000000`, `#ffffff` |
| [App/components/onboarding-progress.tsx](App/components/onboarding-progress.tsx) | `T.blue`, `T.white` | `#4D9CFF` |
| [App/components/onboarding-question-header.tsx](App/components/onboarding-question-header.tsx) | `T.dark` | — |
| [App/components/onboarding-scaffold.tsx](App/components/onboarding-scaffold.tsx) | `T.bg` | — |
| [App/components/onboarding-understanding-demo.tsx](App/components/onboarding-understanding-demo.tsx) | `T.bg`, `T.blue`, `T.buttonEdge`, `T.onAccent`, `T.orange`, `T.pink`, `T.purple`, `T.teal` | `#101510`, `rgba(255,255,255,0.92)`, `rgba(5,10,7,0.5)`, `rgba(5,10,7,0.76)` |
| [App/components/party-category-icon.tsx](App/components/party-category-icon.tsx) | — | `#00E6B3`, `#4DA8FF`, `#9C4DFF`, `#D14DFF`, `#E98F49`, `#FF4560`, `#FF4D9C` |
| [App/components/profile-avatar.tsx](App/components/profile-avatar.tsx) | `T.blue`, `T.white` | — |
| [App/components/profile-insights-dashboard.tsx](App/components/profile-insights-dashboard.tsx) | `T.blue`, `T.border`, `T.cyan`, `T.dark`, `T.green`, `T.muted`, `T.orange`, `T.purple`, `T.white`, `T.yellow` | — |
| [App/components/quest-comments-sheet.tsx](App/components/quest-comments-sheet.tsx) | `T.blue`, `T.border`, `T.dark`, `T.muted`, `T.onAccent`, `T.red` | — |
| [App/components/quest-feed-card.tsx](App/components/quest-feed-card.tsx) | `T.bg`, `T.border`, `T.dark`, `T.muted`, `T.onAccent`, `T.orange`, `T.raised`, `T.red`, `T.white` | `#d94d65`, `#FF6B81`, `#ffe4ea`, `#fff7f9`, `rgba(0,0,0,0.34)`, `rgba(20,17,20,0.06)`, `rgba(20,17,20,0.78)`, `rgba(28,24,27,0.64)`, `rgba(28,24,27,0.68)`, `rgba(28,24,27,0.82)` |
| [App/components/quest-post-management-sheet.tsx](App/components/quest-post-management-sheet.tsx) | `T.bg`, `T.blue`, `T.border`, `T.dark`, `T.green`, `T.muted`, `T.purple`, `T.raised`, `T.red`, `T.white` | — |
| [App/components/quest-save-sheet.tsx](App/components/quest-save-sheet.tsx) | `T.bg`, `T.blue`, `T.border`, `T.dark`, `T.muted`, `T.onAccent`, `T.orange`, `T.pink`, `T.purple`, `T.red`, `T.white`, `T.yellow` | `#2588D8` |
| [App/components/quest-start-block.tsx](App/components/quest-start-block.tsx) | `T.blue`, `T.dark`, `T.muted`, `T.orange`, `T.pink`, `T.purple`, `T.red` | `#087d73`, `#9b42b6` |
| [App/components/required-profile-name.tsx](App/components/required-profile-name.tsx) | `T.bg`, `T.blue`, `T.dark`, `T.muted`, `T.white` | `rgba(23, 35, 49, 0.58)` |
| [App/components/scroll-top-blur.tsx](App/components/scroll-top-blur.tsx) | `T.isDark` | `rgba(0,0,0,0)`, `rgba(0,0,0,0.72)`, `rgba(0,0,0,1)` |
| [App/components/streak-pill.tsx](App/components/streak-pill.tsx) | — | `#5a3027`, `#e79766`, `#ffb785` |
| [App/components/ui.tsx](App/components/ui.tsx) | `T.bg`, `T.blue`, `T.border`, `T.buttonEdge`, `T.cyan`, `T.dark`, `T.green`, `T.isDark`, `T.muted`, `T.onAccent`, `T.orange`, `T.overlay`, `T.pink`, `T.purple`, `T.raised`, `T.red`, `T.teal`, `T.white` | `rgba(255,255,255,0)`, `rgba(255,255,255,0.18)`, `rgba(77,168,255,0.07)` |
| [App/components/weekly-frequency-slider.tsx](App/components/weekly-frequency-slider.tsx) | `T.blue`, `T.border`, `T.dark`, `T.muted`, `T.white` | — |
| [App/contexts/AppFeedbackContext.tsx](App/contexts/AppFeedbackContext.tsx) | `T.blue`, `T.onAccent` | `rgba(61,52,56,0.22)`, `rgba(61,52,56,0.9)` |
| [App/motion/primitives.tsx](App/motion/primitives.tsx) | `T.raised` | `rgba(61,52,56,0.22)` |
| [App/screens/active-quest-screen.tsx](App/screens/active-quest-screen.tsx) | `T.bg`, `T.blue`, `T.border`, `T.buttonEdge`, `T.dark`, `T.green`, `T.isDark`, `T.muted`, `T.onAccent`, `T.orange`, `T.raised`, `T.red`, `T.white` | `#000000`, `#867a79`, `#9D93A0`, `#e5e8e2`, `#e7a52c`, `#edf0eb`, `#f8f7f3`, `rgba(0,0,0,0.52)`, `rgba(232,223,213,0.84)`, `rgba(232,223,213,0.92)`, `rgba(232,223,213,0.94)`, `rgba(255,252,248,0.36)`, `rgba(35,40,37,0.16)`, `rgba(35,40,37,0.20)`, `rgba(35,40,37,0.24)`, `rgba(36,30,38,0.52)`, `rgba(61,52,56,0.08)`, `rgba(61,52,56,0.12)`, `rgba(61,52,56,0.14)` |
| [App/screens/add-friends-screen.tsx](App/screens/add-friends-screen.tsx) | `T.blue`, `T.border`, `T.buttonEdge`, `T.dark`, `T.green`, `T.muted`, `T.onAccent`, `T.purple`, `T.white` | `#20894d`, `#258fd8`, `#7973c7`, `#a8d8ff`, `#d8eafa` |
| [App/screens/explore-screen.tsx](App/screens/explore-screen.tsx) | `T.bg`, `T.blue`, `T.border`, `T.buttonEdge`, `T.dark`, `T.muted`, `T.onAccent`, `T.selected`, `T.white` | — |
| [App/screens/friend-profile-screen.tsx](App/screens/friend-profile-screen.tsx) | `T.bg`, `T.blue`, `T.border`, `T.dark`, `T.green`, `T.muted`, `T.onAccent`, `T.red` | — |
| [App/screens/friends-screen.tsx](App/screens/friends-screen.tsx) | `T.blue`, `T.border`, `T.dark`, `T.muted`, `T.white` | — |
| [App/screens/in-progress-quest-screen.tsx](App/screens/in-progress-quest-screen.tsx) | `T.bg`, `T.blue`, `T.border`, `T.dark`, `T.muted`, `T.onAccent`, `T.raised`, `T.red`, `T.white` | `#d9d0c6`, `#f6b90b`, `rgba(255, 191, 24, 0.9)` |
| [App/screens/journal-screen.tsx](App/screens/journal-screen.tsx) | `T.bg`, `T.blue`, `T.border`, `T.cyan`, `T.dark`, `T.green`, `T.muted`, `T.onAccent`, `T.orange`, `T.purple`, `T.raised`, `T.selected`, `T.white`, `T.yellow` | `#258fd8`, `#cfc6bc`, `#d3c9be`, `#d7cec2`, `#f1efec`, `#fffaff`, `rgba(254,228,64,0.22)`, `rgba(254,228,64,0.55)`, `rgba(39,34,35,0.66)` |
| [App/screens/lobby-screen.tsx](App/screens/lobby-screen.tsx) | `T.bg`, `T.blue`, `T.border`, `T.buttonEdge`, `T.cyan`, `T.dark`, `T.green`, `T.input`, `T.isDark`, `T.muted`, `T.onAccent`, `T.red`, `T.white` | `#171b23`, `#202938`, `#2d3444`, `#3a4152`, `#4DA8FF`, `#E85D3F`, `#FF4560`, `rgba(0,187,249,0.32)`, `rgba(252,239,246,0.5)`, `rgba(77,168,255,0.16)` |
| [App/screens/manage-saved-quests-screen.tsx](App/screens/manage-saved-quests-screen.tsx) | `T.bg`, `T.blue`, `T.border`, `T.buttonEdge`, `T.dark`, `T.muted`, `T.onAccent`, `T.red`, `T.white` | — |
| [App/screens/memory-detail-screen.tsx](App/screens/memory-detail-screen.tsx) | `T.bg`, `T.blue`, `T.border`, `T.dark`, `T.muted`, `T.onAccent`, `T.purple`, `T.raised`, `T.red`, `T.white` | `#d7cec2`, `rgba(61,52,56,0.22)`, `rgba(61,52,56,0.24)` |
| [App/screens/notifications-screen.tsx](App/screens/notifications-screen.tsx) | `T.blue`, `T.border`, `T.cyan`, `T.dark`, `T.muted`, `T.onAccent`, `T.orange`, `T.pink`, `T.red`, `T.white` | `rgba(254,228,64,0.18)`, `rgba(254,228,64,0.5)` |
| [App/screens/profile-screen.tsx](App/screens/profile-screen.tsx) | `T.bg`, `T.blue`, `T.border`, `T.dark`, `T.green`, `T.isDark`, `T.muted`, `T.onAccent`, `T.orange`, `T.pink`, `T.purple`, `T.raised`, `T.red`, `T.white`, `T.yellow` | `#8996A3`, `#b57d00`, `#B9754E`, `#d39a00`, `#D89A19`, `#e5f3ff`, `#e6f8ed`, `#f2eaff`, `#ffe8f3`, `#fff0df`, `#fff7d8`, `rgba(255,252,245,0.48)`, `rgba(36,30,38,0.48)` |
| [App/screens/quest-collections-screen.tsx](App/screens/quest-collections-screen.tsx) | `T.blue`, `T.border`, `T.dark`, `T.muted`, `T.onAccent`, `T.orange`, `T.red`, `T.white` | — |
| [App/screens/quest-detail-screen.tsx](App/screens/quest-detail-screen.tsx) | `T.bg`, `T.blue`, `T.border`, `T.dark`, `T.muted`, `T.onAccent`, `T.orange`, `T.red`, `T.white` | `#00B894`, `#4D9CFF`, `#8549D6`, `#B83CD1`, `#D83B7D`, `#E67E22`, `#E84C63`, `rgba(61,52,56,0.22)` |
| [App/screens/saved-screen.tsx](App/screens/saved-screen.tsx) | `T.bg`, `T.blue`, `T.border`, `T.buttonEdge`, `T.dark`, `T.muted`, `T.onAccent`, `T.purple`, `T.white` | — |
| [App/screens/settings-screen.tsx](App/screens/settings-screen.tsx) | `T.blue`, `T.border`, `T.cyan`, `T.dark`, `T.green`, `T.input`, `T.muted`, `T.orange`, `T.pink`, `T.purple`, `T.raised`, `T.red`, `T.toggleOff`, `T.white` | `#bde3ff`, `#e17055`, `rgba(0,0,0,0.22)`, `rgba(30,25,28,0.48)`, `rgba(61,52,56,0.18)` |
| [App/screens/share-adventure-screen.tsx](App/screens/share-adventure-screen.tsx) | `T.bg`, `T.blue`, `T.border`, `T.dark`, `T.muted`, `T.onAccent`, `T.raised`, `T.red`, `T.toggleOff`, `T.white` | `#d9d0c6`, `rgba(61,52,56,0.22)` |
| [App/screens/social-screen.tsx](App/screens/social-screen.tsx) | `T.blue`, `T.border`, `T.dark`, `T.green`, `T.muted`, `T.onAccent`, `T.red`, `T.selected`, `T.white` | `rgba(232,223,213,0.82)` |
| [App/screens/streak-invite-friends-screen.tsx](App/screens/streak-invite-friends-screen.tsx) | `T.border`, `T.dark`, `T.muted`, `T.onAccent`, `T.white` | `#d44c31`, `#ddd4ce`, `#eee7e2`, `#f1eae5`, `#ff6d45` |
| [App/screens/streak-screen.tsx](App/screens/streak-screen.tsx) | `T.bg`, `T.border`, `T.cyan`, `T.dark`, `T.green`, `T.isDark`, `T.muted`, `T.onAccent`, `T.orange`, `T.pink`, `T.purple`, `T.red`, `T.teal`, `T.white` | `#282124`, `#422b31`, `#957d7c`, `#a39a98`, `#b7aeac`, `#c8aaa0`, `#cfc5c1`, `#d44c31`, `#d7cec2`, `#d95b3d`, `#ded6d1`, `#e9f8ee`, `#eadfd9`, `#edb99d`, `#eebf9f`, `#eee7e2`, `#f2c9b5`, `#f2d8c9`, `#f2f0ef`, `#f4c7ae`, `#f5c7b0`, `#f6f1ee`, `#ff6d45`, `#fff0e7`, `#fff6f0`, `#fff7f2`, `rgba(246,239,225,0)`, `rgba(246,239,225,0.03)`, `rgba(246,239,225,0.32)` |
| [App/screens/user-collection-detail-screen.tsx](App/screens/user-collection-detail-screen.tsx) | `T.bg`, `T.blue`, `T.border`, `T.buttonEdge`, `T.dark`, `T.input`, `T.muted`, `T.onAccent`, `T.orange`, `T.red`, `T.white` | — |
| [App/services/journal/journalService.ts](App/services/journal/journalService.ts) | — | `#49a6f4` |
| [App/types/content.ts](App/types/content.ts) | — | `#00E6B3`, `#4D9CFF`, `#9C4DFF`, `#D14DFF`, `#E5FFF9`, `#EAF4FF`, `#F3EAFF`, `#FAE9FF`, `#FF4560`, `#FF4D9C`, `#FF9C4D`, `#FFEAF4`, `#FFECEF`, `#FFF2E3` |
| [App/work/QuestLife-main/src/app/App.tsx](App/work/QuestLife-main/src/app/App.tsx) | `T.activeTabBg`, `T.bgWarm`, `T.blue`, `T.border`, `T.cyan`, `T.textDark`, `T.textMuted` | `#00bbf9`, `#3d3438`, `#4da8ff`, `#4da8ff20`, `#8a8186`, `#a29bfe`, `#e8dfd5`, `#ede5db`, `#fceff6`, `#fd79a8`, `#fee440`, `#fff`, `#fffcf5`, `#ffffff`, `rgba(0,0,0,0.05)`, `rgba(0,0,0,0.08)`, `rgba(0,0,0,0.12)`, `rgba(0,187,249,0.1)`, `rgba(138,129,134,0.08)`, `rgba(254,228,64,0.2)`, `rgba(254,228,64,0.5)`, `rgba(255,255,255,0.7)`, `rgba(61,52,56,0.3)`, `rgba(61,52,56,0.5)`, `rgba(77,168,255,0.05)`, `rgba(77,168,255,0.06)`, `rgba(77,168,255,0.1)`, `rgba(77,168,255,0.12)`, `rgba(77,168,255,0.3)` |
| [App/work/QuestLife-main/src/app/Explore.tsx](App/work/QuestLife-main/src/app/Explore.tsx) | `T.bg`, `T.blue`, `T.border`, `T.cardShadow`, `T.cyan`, `T.dark`, `T.muted` | `#00bbf9`, `#00cec9`, `#27ae60`, `#3d3438`, `#4da8ff`, `#8a8186`, `#a29bfe`, `#e17055`, `#e8dfd5`, `#f39c12`, `#fceff6`, `#fd79a8`, `#fee440`, `#fff`, `#fffcf5`, `rgba(0,187,249,0.12)`, `rgba(0,206,201,0.12)`, `rgba(162,155,254,0.1)`, `rgba(162,155,254,0.12)`, `rgba(225,112,85,0.12)`, `rgba(243,156,18,0.1)`, `rgba(243,156,18,0.12)`, `rgba(253,121,168,0.1)`, `rgba(253,121,168,0.12)`, `rgba(39,174,96,0.1)`, `rgba(39,174,96,0.12)`, `rgba(61,52,56,0.4)`, `rgba(77,168,255,0.06)`, `rgba(77,168,255,0.1)`, `rgba(77,168,255,0.12)`, `rgba(77,168,255,0.3)` |
| [App/work/QuestLife-main/src/app/Journal.tsx](App/work/QuestLife-main/src/app/Journal.tsx) | `T.bg`, `T.blue`, `T.border`, `T.cardShadow`, `T.cyan`, `T.dark`, `T.muted`, `T.yellow` | `#00bbf9`, `#27ae60`, `#3d3438`, `#4da8ff`, `#8a8186`, `#a29bfe`, `#e17055`, `#e8dfd5`, `#f39c12`, `#fceff6`, `#fd79a8`, `#fee440`, `#fff`, `#fffcf5`, `rgba(0,0,0,0.08)`, `rgba(0,187,249,0.12)`, `rgba(162,155,254,0.12)`, `rgba(225,112,85,0.12)`, `rgba(243,156,18,0.12)`, `rgba(253,121,168,0.12)`, `rgba(254,228,64,0.1)`, `rgba(254,228,64,0.12)`, `rgba(254,228,64,0.2)`, `rgba(254,228,64,0.35)`, `rgba(254,228,64,0.4)`, `rgba(254,228,64,0.5)`, `rgba(254,228,64,0.6)`, `rgba(39,174,96,0.12)`, `rgba(61,52,56,0.4)`, `rgba(77,168,255,0.05)`, `rgba(77,168,255,0.12)`, `rgba(77,168,255,0.25)`, `rgba(77,168,255,0.3)` |
| [App/work/QuestLife-main/src/app/Lobby.tsx](App/work/QuestLife-main/src/app/Lobby.tsx) | `T.bg`, `T.blue`, `T.border`, `T.cardShadow`, `T.cyan`, `T.dark`, `T.muted`, `T.yellow` | `#00bbf9`, `#00cec9`, `#27ae60`, `#3d3438`, `#4da8ff`, `#8a8186`, `#a29bfe`, `#e17055`, `#e8dfd5`, `#f39c12`, `#fceff6`, `#fd79a8`, `#fee440`, `#fff`, `#fffcf5`, `rgba(0,0,0,0.12)`, `rgba(0,187,249,0.1)`, `rgba(0,187,249,0.12)`, `rgba(0,187,249,0.7)`, `rgba(0,206,201,0.12)`, `rgba(162,155,254,0.12)`, `rgba(225,112,85,0.12)`, `rgba(232,223,213,0.5)`, `rgba(243,156,18,0.1)`, `rgba(243,156,18,0.12)`, `rgba(252,239,246,0.5)`, `rgba(253,121,168,0.1)`, `rgba(253,121,168,0.12)`, `rgba(254,228,64,0.2)`, `rgba(254,228,64,0.5)`, `rgba(255,255,255,0.4)`, `rgba(39,174,96,0.1)`, `rgba(39,174,96,0.12)`, `rgba(61,52,56,0.3)`, `rgba(61,52,56,0.4)`, `rgba(61,52,56,0.5)`, `rgba(77,168,255,0.06)`, `rgba(77,168,255,0.1)`, `rgba(77,168,255,0.12)`, `rgba(77,168,255,0.15)`, `rgba(77,168,255,0.2)`, `rgba(77,168,255,0.25)`, `rgba(77,168,255,0.3)` |
| [App/work/QuestLife-main/src/app/Profile.tsx](App/work/QuestLife-main/src/app/Profile.tsx) | `T.bg`, `T.blue`, `T.border`, `T.cardShadow`, `T.cyan`, `T.dark`, `T.muted` | `#00bbf9`, `#27ae60`, `#3d3438`, `#4da8ff`, `#8a8186`, `#a29bfe`, `#e17055`, `#e8dfd5`, `#f39c12`, `#fceff6`, `#fd79a8`, `#fee440`, `#fff`, `#fffcf5`, `rgba(0,0,0,0.18)`, `rgba(162,155,254,0.15)`, `rgba(225,112,85,0.08)`, `rgba(225,112,85,0.12)`, `rgba(225,112,85,0.3)`, `rgba(243,156,18,0.12)`, `rgba(243,156,18,0.15)`, `rgba(253,121,168,0.12)`, `rgba(253,121,168,0.15)`, `rgba(254,228,64,0.25)`, `rgba(255,255,255,0.4)`, `rgba(39,174,96,0.12)`, `rgba(39,174,96,0.15)`, `rgba(61,52,56,0.4)`, `rgba(61,52,56,0.55)`, `rgba(77,168,255,0.07)`, `rgba(77,168,255,0.15)` |
| [App/work/QuestLife-main/src/app/SavedQuests.tsx](App/work/QuestLife-main/src/app/SavedQuests.tsx) | `T.bg`, `T.blue`, `T.border`, `T.cardShadow`, `T.cyan`, `T.dark`, `T.muted` | `#00bbf9`, `#00cec9`, `#27ae60`, `#3d3438`, `#4da8ff`, `#8a8186`, `#a29bfe`, `#e17055`, `#e8dfd5`, `#f39c12`, `#fceff6`, `#fd79a8`, `#fdcb6e`, `#fee440`, `#fff`, `#fffcf5`, `rgba(0,187,249,0.12)`, `rgba(0,206,201,0.12)`, `rgba(162,155,254,0.12)`, `rgba(225,112,85,0.1)`, `rgba(225,112,85,0.12)`, `rgba(225,112,85,0.3)`, `rgba(243,156,18,0.12)`, `rgba(253,121,168,0.12)`, `rgba(39,174,96,0.12)`, `rgba(61,52,56,0.4)`, `rgba(77,168,255,0.05)`, `rgba(77,168,255,0.12)`, `rgba(77,168,255,0.3)` |
| [App/work/QuestLife-main/src/app/Social.tsx](App/work/QuestLife-main/src/app/Social.tsx) | `T.bg`, `T.blue`, `T.border`, `T.cardShadow`, `T.cyan`, `T.dark`, `T.muted`, `T.yellow` | `#00bbf9`, `#00bbf915`, `#00cec9`, `#1a1a2e`, `#27ae60`, `#27ae6015`, `#27ae6020`, `#3d3438`, `#4da8ff`, `#4da8ff15`, `#8a8186`, `#a29bfe`, `#b7791f`, `#e17055`, `#e74c3c`, `#e8dfd5`, `#f39c12`, `#f39c1215`, `#fca5a5`, `#fceff6`, `#fd79a8`, `#fdcb6e`, `#fecaca`, `#fee440`, `#fff`, `#fff2f2`, `#fffcf5`, `rgba(0,0,0,0.08)`, `rgba(0,0,0,0.45)`, `rgba(0,187,249,0.08)`, `rgba(0,187,249,0.12)`, `rgba(0,206,201,0.12)`, `rgba(225,112,85,0.12)`, `rgba(243,156,18,0.12)`, `rgba(253,121,168,0.12)`, `rgba(254,228,64,0.1)`, `rgba(254,228,64,0.4)`, `rgba(255,255,255,0.4)`, `rgba(39,174,96,0.12)`, `rgba(39,174,96,0.3)`, `rgba(61,52,56,0.4)`, `rgba(77,168,255,0.07)`, `rgba(77,168,255,0.08)`, `rgba(77,168,255,0.12)`, `rgba(77,168,255,0.3)` |
| [App/work/QuestLife-main/src/app/components/ui/chart.tsx](App/work/QuestLife-main/src/app/components/ui/chart.tsx) | — | `#ccc`, `#fff` |
| [App/work/QuestLife-main/src/app/components/ui/sidebar.tsx](App/work/QuestLife-main/src/app/components/ui/sidebar.tsx) | — | `hsl(var(--sidebar-accent)`, `hsl(var(--sidebar-border)` |
| [App/work/QuestLife-main/src/imports/Frame1/index.tsx](App/work/QuestLife-main/src/imports/Frame1/index.tsx) | — | `#00BBF9`, `#00bbf9`, `#3d3438`, `#3D3438`, `#4DA8FF`, `#4da8ff`, `#8A8186`, `#8a8186`, `#e8dfd5`, `#fceff6`, `#fee440`, `#FF5C5C`, `#fffcf5`, `rgba(0,0,0,0.05)`, `rgba(0,0,0,0.1)`, `rgba(0,187,249,0.1)`, `rgba(0,187,249,0.7)`, `rgba(232,223,213,0.5)`, `rgba(252,239,246,0.5)`, `rgba(254,228,64,0.2)`, `rgba(255,255,255,0.4)`, `rgba(77,168,255,0.05)`, `rgba(77,168,255,0.1)`, `rgba(77,168,255,0.2)`, `rgba(77,168,255,0.7)` |
| [App/work/QuestLife-main/src/imports/NavBar/index.tsx](App/work/QuestLife-main/src/imports/NavBar/index.tsx) | — | `#4DA8FF`, `#8A8186`, `#e8dfd5`, `#fceff6`, `rgba(0,0,0,0.05)` |

## Direct-literal register

These values bypass the semantic theme object. Scene artwork, illustrations, map tiles, brand-specific provider colors, and intentional reward effects may be valid exceptions; all other entries are candidates for migration to semantic tokens.

| Literal | Files |
| --- | --- |
| `#000000` | [App/app/index.tsx](App/app/index.tsx)<br>[App/components/global-announcement.tsx](App/components/global-announcement.tsx)<br>[App/components/onboarding-intro.tsx](App/components/onboarding-intro.tsx)<br>[App/screens/active-quest-screen.tsx](App/screens/active-quest-screen.tsx) |
| `#00B894` | [App/screens/quest-detail-screen.tsx](App/screens/quest-detail-screen.tsx) |
| `#00BBF9` | [App/work/QuestLife-main/src/imports/Frame1/index.tsx](App/work/QuestLife-main/src/imports/Frame1/index.tsx) |
| `#00bbf9` | [App/work/QuestLife-main/src/app/App.tsx](App/work/QuestLife-main/src/app/App.tsx)<br>[App/work/QuestLife-main/src/app/Explore.tsx](App/work/QuestLife-main/src/app/Explore.tsx)<br>[App/work/QuestLife-main/src/app/Journal.tsx](App/work/QuestLife-main/src/app/Journal.tsx)<br>[App/work/QuestLife-main/src/app/Lobby.tsx](App/work/QuestLife-main/src/app/Lobby.tsx)<br>[App/work/QuestLife-main/src/app/Profile.tsx](App/work/QuestLife-main/src/app/Profile.tsx)<br>[App/work/QuestLife-main/src/app/SavedQuests.tsx](App/work/QuestLife-main/src/app/SavedQuests.tsx)<br>[App/work/QuestLife-main/src/app/Social.tsx](App/work/QuestLife-main/src/app/Social.tsx)<br>[App/work/QuestLife-main/src/imports/Frame1/index.tsx](App/work/QuestLife-main/src/imports/Frame1/index.tsx) |
| `#00bbf915` | [App/work/QuestLife-main/src/app/Social.tsx](App/work/QuestLife-main/src/app/Social.tsx) |
| `#00cec9` | [App/work/QuestLife-main/src/app/Explore.tsx](App/work/QuestLife-main/src/app/Explore.tsx)<br>[App/work/QuestLife-main/src/app/Lobby.tsx](App/work/QuestLife-main/src/app/Lobby.tsx)<br>[App/work/QuestLife-main/src/app/SavedQuests.tsx](App/work/QuestLife-main/src/app/SavedQuests.tsx)<br>[App/work/QuestLife-main/src/app/Social.tsx](App/work/QuestLife-main/src/app/Social.tsx) |
| `#00E6B3` | [App/components/party-category-icon.tsx](App/components/party-category-icon.tsx)<br>[App/types/content.ts](App/types/content.ts) |
| `#087d73` | [App/components/quest-start-block.tsx](App/components/quest-start-block.tsx) |
| `#101510` | [App/app/_layout.tsx](App/app/_layout.tsx)<br>[App/app/onboarding/about-you.tsx](App/app/onboarding/about-you.tsx)<br>[App/app/onboarding/questions-path.tsx](App/app/onboarding/questions-path.tsx)<br>[App/components/onboarding-understanding-demo.tsx](App/components/onboarding-understanding-demo.tsx) |
| `#171b23` | [App/screens/lobby-screen.tsx](App/screens/lobby-screen.tsx) |
| `#1769aa` | [App/components/lobby-design.ts](App/components/lobby-design.ts) |
| `#1a1a2e` | [App/work/QuestLife-main/src/app/Social.tsx](App/work/QuestLife-main/src/app/Social.tsx) |
| `#1f6a43` | [App/components/lobby-design.ts](App/components/lobby-design.ts) |
| `#202938` | [App/screens/lobby-screen.tsx](App/screens/lobby-screen.tsx) |
| `#20894d` | [App/screens/add-friends-screen.tsx](App/screens/add-friends-screen.tsx) |
| `#2588D8` | [App/components/quest-save-sheet.tsx](App/components/quest-save-sheet.tsx) |
| `#258fd8` | [App/app/onboarding/about-you.tsx](App/app/onboarding/about-you.tsx)<br>[App/app/onboarding/follow-up-questions.tsx](App/app/onboarding/follow-up-questions.tsx)<br>[App/app/onboarding/questions-intro.tsx](App/app/onboarding/questions-intro.tsx)<br>[App/screens/add-friends-screen.tsx](App/screens/add-friends-screen.tsx)<br>[App/screens/journal-screen.tsx](App/screens/journal-screen.tsx) |
| `#277dcc` | [App/app/index.tsx](App/app/index.tsx) |
| `#27ae60` | [App/work/QuestLife-main/src/app/Explore.tsx](App/work/QuestLife-main/src/app/Explore.tsx)<br>[App/work/QuestLife-main/src/app/Journal.tsx](App/work/QuestLife-main/src/app/Journal.tsx)<br>[App/work/QuestLife-main/src/app/Lobby.tsx](App/work/QuestLife-main/src/app/Lobby.tsx)<br>[App/work/QuestLife-main/src/app/Profile.tsx](App/work/QuestLife-main/src/app/Profile.tsx)<br>[App/work/QuestLife-main/src/app/SavedQuests.tsx](App/work/QuestLife-main/src/app/SavedQuests.tsx)<br>[App/work/QuestLife-main/src/app/Social.tsx](App/work/QuestLife-main/src/app/Social.tsx) |
| `#27ae6015` | [App/work/QuestLife-main/src/app/Social.tsx](App/work/QuestLife-main/src/app/Social.tsx) |
| `#27ae6020` | [App/work/QuestLife-main/src/app/Social.tsx](App/work/QuestLife-main/src/app/Social.tsx) |
| `#282124` | [App/screens/streak-screen.tsx](App/screens/streak-screen.tsx) |
| `#2d3444` | [App/screens/lobby-screen.tsx](App/screens/lobby-screen.tsx) |
| `#34A853` | [App/app/onboarding/about-you.tsx](App/app/onboarding/about-you.tsx) |
| `#3a4152` | [App/screens/lobby-screen.tsx](App/screens/lobby-screen.tsx) |
| `#3D3438` | [App/work/QuestLife-main/src/imports/Frame1/index.tsx](App/work/QuestLife-main/src/imports/Frame1/index.tsx) |
| `#3d3438` | [App/work/QuestLife-main/src/app/App.tsx](App/work/QuestLife-main/src/app/App.tsx)<br>[App/work/QuestLife-main/src/app/Explore.tsx](App/work/QuestLife-main/src/app/Explore.tsx)<br>[App/work/QuestLife-main/src/app/Journal.tsx](App/work/QuestLife-main/src/app/Journal.tsx)<br>[App/work/QuestLife-main/src/app/Lobby.tsx](App/work/QuestLife-main/src/app/Lobby.tsx)<br>[App/work/QuestLife-main/src/app/Profile.tsx](App/work/QuestLife-main/src/app/Profile.tsx)<br>[App/work/QuestLife-main/src/app/SavedQuests.tsx](App/work/QuestLife-main/src/app/SavedQuests.tsx)<br>[App/work/QuestLife-main/src/app/Social.tsx](App/work/QuestLife-main/src/app/Social.tsx)<br>[App/work/QuestLife-main/src/imports/Frame1/index.tsx](App/work/QuestLife-main/src/imports/Frame1/index.tsx) |
| `#422b31` | [App/screens/streak-screen.tsx](App/screens/streak-screen.tsx) |
| `#4285F4` | [App/components/auth/AuthControls.tsx](App/components/auth/AuthControls.tsx) |
| `#49a6f4` | [App/services/journal/journalService.ts](App/services/journal/journalService.ts) |
| `#4D9CFF` | [App/app/index.tsx](App/app/index.tsx)<br>[App/components/onboarding-progress.tsx](App/components/onboarding-progress.tsx)<br>[App/screens/quest-detail-screen.tsx](App/screens/quest-detail-screen.tsx)<br>[App/types/content.ts](App/types/content.ts) |
| `#4DA8FF` | [App/components/add-friend-icon.tsx](App/components/add-friend-icon.tsx)<br>[App/components/back-icon.tsx](App/components/back-icon.tsx)<br>[App/components/party-category-icon.tsx](App/components/party-category-icon.tsx)<br>[App/screens/lobby-screen.tsx](App/screens/lobby-screen.tsx)<br>[App/work/QuestLife-main/src/imports/Frame1/index.tsx](App/work/QuestLife-main/src/imports/Frame1/index.tsx)<br>[App/work/QuestLife-main/src/imports/NavBar/index.tsx](App/work/QuestLife-main/src/imports/NavBar/index.tsx) |
| `#4da8ff` | [App/work/QuestLife-main/src/app/App.tsx](App/work/QuestLife-main/src/app/App.tsx)<br>[App/work/QuestLife-main/src/app/Explore.tsx](App/work/QuestLife-main/src/app/Explore.tsx)<br>[App/work/QuestLife-main/src/app/Journal.tsx](App/work/QuestLife-main/src/app/Journal.tsx)<br>[App/work/QuestLife-main/src/app/Lobby.tsx](App/work/QuestLife-main/src/app/Lobby.tsx)<br>[App/work/QuestLife-main/src/app/Profile.tsx](App/work/QuestLife-main/src/app/Profile.tsx)<br>[App/work/QuestLife-main/src/app/SavedQuests.tsx](App/work/QuestLife-main/src/app/SavedQuests.tsx)<br>[App/work/QuestLife-main/src/app/Social.tsx](App/work/QuestLife-main/src/app/Social.tsx)<br>[App/work/QuestLife-main/src/imports/Frame1/index.tsx](App/work/QuestLife-main/src/imports/Frame1/index.tsx) |
| `#4da8ff15` | [App/work/QuestLife-main/src/app/Social.tsx](App/work/QuestLife-main/src/app/Social.tsx) |
| `#4da8ff20` | [App/work/QuestLife-main/src/app/App.tsx](App/work/QuestLife-main/src/app/App.tsx) |
| `#5a3027` | [App/components/streak-pill.tsx](App/components/streak-pill.tsx) |
| `#62595e` | [App/components/lobby-design.ts](App/components/lobby-design.ts) |
| `#7973c7` | [App/screens/add-friends-screen.tsx](App/screens/add-friends-screen.tsx) |
| `#7C5CFC` | [App/app/onboarding/about-you.tsx](App/app/onboarding/about-you.tsx) |
| `#8549D6` | [App/screens/quest-detail-screen.tsx](App/screens/quest-detail-screen.tsx) |
| `#867a79` | [App/screens/active-quest-screen.tsx](App/screens/active-quest-screen.tsx) |
| `#8996A3` | [App/screens/profile-screen.tsx](App/screens/profile-screen.tsx) |
| `#8A8186` | [App/work/QuestLife-main/src/imports/Frame1/index.tsx](App/work/QuestLife-main/src/imports/Frame1/index.tsx)<br>[App/work/QuestLife-main/src/imports/NavBar/index.tsx](App/work/QuestLife-main/src/imports/NavBar/index.tsx) |
| `#8a8186` | [App/work/QuestLife-main/src/app/App.tsx](App/work/QuestLife-main/src/app/App.tsx)<br>[App/work/QuestLife-main/src/app/Explore.tsx](App/work/QuestLife-main/src/app/Explore.tsx)<br>[App/work/QuestLife-main/src/app/Journal.tsx](App/work/QuestLife-main/src/app/Journal.tsx)<br>[App/work/QuestLife-main/src/app/Lobby.tsx](App/work/QuestLife-main/src/app/Lobby.tsx)<br>[App/work/QuestLife-main/src/app/Profile.tsx](App/work/QuestLife-main/src/app/Profile.tsx)<br>[App/work/QuestLife-main/src/app/SavedQuests.tsx](App/work/QuestLife-main/src/app/SavedQuests.tsx)<br>[App/work/QuestLife-main/src/app/Social.tsx](App/work/QuestLife-main/src/app/Social.tsx)<br>[App/work/QuestLife-main/src/imports/Frame1/index.tsx](App/work/QuestLife-main/src/imports/Frame1/index.tsx) |
| `#957d7c` | [App/screens/streak-screen.tsx](App/screens/streak-screen.tsx) |
| `#9b42b6` | [App/components/quest-start-block.tsx](App/components/quest-start-block.tsx) |
| `#9C4DFF` | [App/components/party-category-icon.tsx](App/components/party-category-icon.tsx)<br>[App/types/content.ts](App/types/content.ts) |
| `#9CB8C2` | [App/components/onboarding-compass-route.tsx](App/components/onboarding-compass-route.tsx) |
| `#9D93A0` | [App/screens/active-quest-screen.tsx](App/screens/active-quest-screen.tsx) |
| `#a29bfe` | [App/work/QuestLife-main/src/app/App.tsx](App/work/QuestLife-main/src/app/App.tsx)<br>[App/work/QuestLife-main/src/app/Explore.tsx](App/work/QuestLife-main/src/app/Explore.tsx)<br>[App/work/QuestLife-main/src/app/Journal.tsx](App/work/QuestLife-main/src/app/Journal.tsx)<br>[App/work/QuestLife-main/src/app/Lobby.tsx](App/work/QuestLife-main/src/app/Lobby.tsx)<br>[App/work/QuestLife-main/src/app/Profile.tsx](App/work/QuestLife-main/src/app/Profile.tsx)<br>[App/work/QuestLife-main/src/app/SavedQuests.tsx](App/work/QuestLife-main/src/app/SavedQuests.tsx)<br>[App/work/QuestLife-main/src/app/Social.tsx](App/work/QuestLife-main/src/app/Social.tsx) |
| `#a39a98` | [App/screens/streak-screen.tsx](App/screens/streak-screen.tsx) |
| `#a63d2d` | [App/components/lobby-design.ts](App/components/lobby-design.ts) |
| `#a8d8ff` | [App/screens/add-friends-screen.tsx](App/screens/add-friends-screen.tsx) |
| `#b57d00` | [App/screens/profile-screen.tsx](App/screens/profile-screen.tsx) |
| `#b7791f` | [App/work/QuestLife-main/src/app/Social.tsx](App/work/QuestLife-main/src/app/Social.tsx) |
| `#b7aeac` | [App/screens/streak-screen.tsx](App/screens/streak-screen.tsx) |
| `#B83CD1` | [App/screens/quest-detail-screen.tsx](App/screens/quest-detail-screen.tsx) |
| `#B9754E` | [App/screens/profile-screen.tsx](App/screens/profile-screen.tsx) |
| `#bde3ff` | [App/screens/settings-screen.tsx](App/screens/settings-screen.tsx) |
| `#c8aaa0` | [App/screens/streak-screen.tsx](App/screens/streak-screen.tsx) |
| `#ccc` | [App/work/QuestLife-main/src/app/components/ui/chart.tsx](App/work/QuestLife-main/src/app/components/ui/chart.tsx) |
| `#cfc5c1` | [App/screens/streak-screen.tsx](App/screens/streak-screen.tsx) |
| `#cfc6bc` | [App/screens/journal-screen.tsx](App/screens/journal-screen.tsx) |
| `#D14DFF` | [App/components/party-category-icon.tsx](App/components/party-category-icon.tsx)<br>[App/types/content.ts](App/types/content.ts) |
| `#d39a00` | [App/screens/profile-screen.tsx](App/screens/profile-screen.tsx) |
| `#d3c9be` | [App/screens/journal-screen.tsx](App/screens/journal-screen.tsx) |
| `#d44c31` | [App/screens/streak-invite-friends-screen.tsx](App/screens/streak-invite-friends-screen.tsx)<br>[App/screens/streak-screen.tsx](App/screens/streak-screen.tsx) |
| `#d7cec2` | [App/screens/journal-screen.tsx](App/screens/journal-screen.tsx)<br>[App/screens/memory-detail-screen.tsx](App/screens/memory-detail-screen.tsx)<br>[App/screens/streak-screen.tsx](App/screens/streak-screen.tsx) |
| `#D83B7D` | [App/screens/quest-detail-screen.tsx](App/screens/quest-detail-screen.tsx) |
| `#D89A19` | [App/screens/profile-screen.tsx](App/screens/profile-screen.tsx) |
| `#d8eafa` | [App/screens/add-friends-screen.tsx](App/screens/add-friends-screen.tsx) |
| `#d94d65` | [App/components/quest-feed-card.tsx](App/components/quest-feed-card.tsx) |
| `#d95b3d` | [App/screens/streak-screen.tsx](App/screens/streak-screen.tsx) |
| `#d9d0c6` | [App/screens/in-progress-quest-screen.tsx](App/screens/in-progress-quest-screen.tsx)<br>[App/screens/share-adventure-screen.tsx](App/screens/share-adventure-screen.tsx) |
| `#dc2626` | [App/components/global-announcement.tsx](App/components/global-announcement.tsx) |
| `#ddd4ce` | [App/screens/streak-invite-friends-screen.tsx](App/screens/streak-invite-friends-screen.tsx) |
| `#ded6d1` | [App/screens/streak-screen.tsx](App/screens/streak-screen.tsx) |
| `#dff1ff` | [App/app/(auth)/auth-options.tsx](App/app/(auth)/auth-options.tsx) |
| `#e17055` | [App/screens/settings-screen.tsx](App/screens/settings-screen.tsx)<br>[App/work/QuestLife-main/src/app/Explore.tsx](App/work/QuestLife-main/src/app/Explore.tsx)<br>[App/work/QuestLife-main/src/app/Journal.tsx](App/work/QuestLife-main/src/app/Journal.tsx)<br>[App/work/QuestLife-main/src/app/Lobby.tsx](App/work/QuestLife-main/src/app/Lobby.tsx)<br>[App/work/QuestLife-main/src/app/Profile.tsx](App/work/QuestLife-main/src/app/Profile.tsx)<br>[App/work/QuestLife-main/src/app/SavedQuests.tsx](App/work/QuestLife-main/src/app/SavedQuests.tsx)<br>[App/work/QuestLife-main/src/app/Social.tsx](App/work/QuestLife-main/src/app/Social.tsx) |
| `#e1f8ef` | [App/app/(auth)/auth-options.tsx](App/app/(auth)/auth-options.tsx) |
| `#E4405F` | [App/app/onboarding/about-you.tsx](App/app/onboarding/about-you.tsx) |
| `#e5e8e2` | [App/screens/active-quest-screen.tsx](App/screens/active-quest-screen.tsx) |
| `#e5f3ff` | [App/screens/profile-screen.tsx](App/screens/profile-screen.tsx) |
| `#E5FFF9` | [App/types/content.ts](App/types/content.ts) |
| `#E67E22` | [App/screens/quest-detail-screen.tsx](App/screens/quest-detail-screen.tsx) |
| `#e6f8ed` | [App/screens/profile-screen.tsx](App/screens/profile-screen.tsx) |
| `#e74c3c` | [App/work/QuestLife-main/src/app/Social.tsx](App/work/QuestLife-main/src/app/Social.tsx) |
| `#e79766` | [App/components/streak-pill.tsx](App/components/streak-pill.tsx) |
| `#e7a52c` | [App/screens/active-quest-screen.tsx](App/screens/active-quest-screen.tsx) |
| `#E84C63` | [App/screens/quest-detail-screen.tsx](App/screens/quest-detail-screen.tsx) |
| `#E85D3F` | [App/screens/lobby-screen.tsx](App/screens/lobby-screen.tsx) |
| `#e8dfd5` | [App/work/QuestLife-main/src/app/App.tsx](App/work/QuestLife-main/src/app/App.tsx)<br>[App/work/QuestLife-main/src/app/Explore.tsx](App/work/QuestLife-main/src/app/Explore.tsx)<br>[App/work/QuestLife-main/src/app/Journal.tsx](App/work/QuestLife-main/src/app/Journal.tsx)<br>[App/work/QuestLife-main/src/app/Lobby.tsx](App/work/QuestLife-main/src/app/Lobby.tsx)<br>[App/work/QuestLife-main/src/app/Profile.tsx](App/work/QuestLife-main/src/app/Profile.tsx)<br>[App/work/QuestLife-main/src/app/SavedQuests.tsx](App/work/QuestLife-main/src/app/SavedQuests.tsx)<br>[App/work/QuestLife-main/src/app/Social.tsx](App/work/QuestLife-main/src/app/Social.tsx)<br>[App/work/QuestLife-main/src/imports/Frame1/index.tsx](App/work/QuestLife-main/src/imports/Frame1/index.tsx)<br>[App/work/QuestLife-main/src/imports/NavBar/index.tsx](App/work/QuestLife-main/src/imports/NavBar/index.tsx) |
| `#e8f6ee` | [App/components/lobby-design.ts](App/components/lobby-design.ts) |
| `#E98F49` | [App/components/party-category-icon.tsx](App/components/party-category-icon.tsx) |
| `#e9f5ff` | [App/app/(auth)/auth-options.tsx](App/app/(auth)/auth-options.tsx) |
| `#e9f8ee` | [App/screens/streak-screen.tsx](App/screens/streak-screen.tsx) |
| `#eadfd9` | [App/screens/streak-screen.tsx](App/screens/streak-screen.tsx) |
| `#eaf4fd` | [App/components/lobby-design.ts](App/components/lobby-design.ts) |
| `#EAF4FF` | [App/app/index.tsx](App/app/index.tsx)<br>[App/types/content.ts](App/types/content.ts) |
| `#edb99d` | [App/screens/streak-screen.tsx](App/screens/streak-screen.tsx) |
| `#ede5db` | [App/work/QuestLife-main/src/app/App.tsx](App/work/QuestLife-main/src/app/App.tsx) |
| `#edf0eb` | [App/screens/active-quest-screen.tsx](App/screens/active-quest-screen.tsx) |
| `#eebf9f` | [App/screens/streak-screen.tsx](App/screens/streak-screen.tsx) |
| `#eee7e2` | [App/screens/streak-invite-friends-screen.tsx](App/screens/streak-invite-friends-screen.tsx)<br>[App/screens/streak-screen.tsx](App/screens/streak-screen.tsx) |
| `#eeeaff` | [App/app/(auth)/auth-options.tsx](App/app/(auth)/auth-options.tsx) |
| `#f0ecff` | [App/app/(auth)/auth-options.tsx](App/app/(auth)/auth-options.tsx) |
| `#f1eae5` | [App/screens/streak-invite-friends-screen.tsx](App/screens/streak-invite-friends-screen.tsx) |
| `#f1efec` | [App/screens/journal-screen.tsx](App/screens/journal-screen.tsx) |
| `#f2c9b5` | [App/screens/streak-screen.tsx](App/screens/streak-screen.tsx) |
| `#f2d8c9` | [App/screens/streak-screen.tsx](App/screens/streak-screen.tsx) |
| `#f2eaff` | [App/screens/profile-screen.tsx](App/screens/profile-screen.tsx) |
| `#f2f0ef` | [App/screens/streak-screen.tsx](App/screens/streak-screen.tsx) |
| `#f39c12` | [App/work/QuestLife-main/src/app/Explore.tsx](App/work/QuestLife-main/src/app/Explore.tsx)<br>[App/work/QuestLife-main/src/app/Journal.tsx](App/work/QuestLife-main/src/app/Journal.tsx)<br>[App/work/QuestLife-main/src/app/Lobby.tsx](App/work/QuestLife-main/src/app/Lobby.tsx)<br>[App/work/QuestLife-main/src/app/Profile.tsx](App/work/QuestLife-main/src/app/Profile.tsx)<br>[App/work/QuestLife-main/src/app/SavedQuests.tsx](App/work/QuestLife-main/src/app/SavedQuests.tsx)<br>[App/work/QuestLife-main/src/app/Social.tsx](App/work/QuestLife-main/src/app/Social.tsx) |
| `#f39c1215` | [App/work/QuestLife-main/src/app/Social.tsx](App/work/QuestLife-main/src/app/Social.tsx) |
| `#F3EAFF` | [App/types/content.ts](App/types/content.ts) |
| `#f4c7ae` | [App/screens/streak-screen.tsx](App/screens/streak-screen.tsx) |
| `#f5c7b0` | [App/screens/streak-screen.tsx](App/screens/streak-screen.tsx) |
| `#f6b90b` | [App/components/log-lore-flow.tsx](App/components/log-lore-flow.tsx)<br>[App/screens/in-progress-quest-screen.tsx](App/screens/in-progress-quest-screen.tsx) |
| `#f6f1ee` | [App/screens/streak-screen.tsx](App/screens/streak-screen.tsx) |
| `#f8f7f3` | [App/screens/active-quest-screen.tsx](App/screens/active-quest-screen.tsx) |
| `#f9c74f` | [App/app/onboarding/personalizing.tsx](App/app/onboarding/personalizing.tsx) |
| `#FAE9FF` | [App/types/content.ts](App/types/content.ts) |
| `#fbecea` | [App/components/lobby-design.ts](App/components/lobby-design.ts) |
| `#fca5a5` | [App/work/QuestLife-main/src/app/Social.tsx](App/work/QuestLife-main/src/app/Social.tsx) |
| `#fceff6` | [App/work/QuestLife-main/src/app/App.tsx](App/work/QuestLife-main/src/app/App.tsx)<br>[App/work/QuestLife-main/src/app/Explore.tsx](App/work/QuestLife-main/src/app/Explore.tsx)<br>[App/work/QuestLife-main/src/app/Journal.tsx](App/work/QuestLife-main/src/app/Journal.tsx)<br>[App/work/QuestLife-main/src/app/Lobby.tsx](App/work/QuestLife-main/src/app/Lobby.tsx)<br>[App/work/QuestLife-main/src/app/Profile.tsx](App/work/QuestLife-main/src/app/Profile.tsx)<br>[App/work/QuestLife-main/src/app/SavedQuests.tsx](App/work/QuestLife-main/src/app/SavedQuests.tsx)<br>[App/work/QuestLife-main/src/app/Social.tsx](App/work/QuestLife-main/src/app/Social.tsx)<br>[App/work/QuestLife-main/src/imports/Frame1/index.tsx](App/work/QuestLife-main/src/imports/Frame1/index.tsx)<br>[App/work/QuestLife-main/src/imports/NavBar/index.tsx](App/work/QuestLife-main/src/imports/NavBar/index.tsx) |
| `#fd79a8` | [App/work/QuestLife-main/src/app/App.tsx](App/work/QuestLife-main/src/app/App.tsx)<br>[App/work/QuestLife-main/src/app/Explore.tsx](App/work/QuestLife-main/src/app/Explore.tsx)<br>[App/work/QuestLife-main/src/app/Journal.tsx](App/work/QuestLife-main/src/app/Journal.tsx)<br>[App/work/QuestLife-main/src/app/Lobby.tsx](App/work/QuestLife-main/src/app/Lobby.tsx)<br>[App/work/QuestLife-main/src/app/Profile.tsx](App/work/QuestLife-main/src/app/Profile.tsx)<br>[App/work/QuestLife-main/src/app/SavedQuests.tsx](App/work/QuestLife-main/src/app/SavedQuests.tsx)<br>[App/work/QuestLife-main/src/app/Social.tsx](App/work/QuestLife-main/src/app/Social.tsx) |
| `#fdcb6e` | [App/work/QuestLife-main/src/app/SavedQuests.tsx](App/work/QuestLife-main/src/app/SavedQuests.tsx)<br>[App/work/QuestLife-main/src/app/Social.tsx](App/work/QuestLife-main/src/app/Social.tsx) |
| `#fecaca` | [App/work/QuestLife-main/src/app/Social.tsx](App/work/QuestLife-main/src/app/Social.tsx) |
| `#fee440` | [App/work/QuestLife-main/src/app/App.tsx](App/work/QuestLife-main/src/app/App.tsx)<br>[App/work/QuestLife-main/src/app/Explore.tsx](App/work/QuestLife-main/src/app/Explore.tsx)<br>[App/work/QuestLife-main/src/app/Journal.tsx](App/work/QuestLife-main/src/app/Journal.tsx)<br>[App/work/QuestLife-main/src/app/Lobby.tsx](App/work/QuestLife-main/src/app/Lobby.tsx)<br>[App/work/QuestLife-main/src/app/Profile.tsx](App/work/QuestLife-main/src/app/Profile.tsx)<br>[App/work/QuestLife-main/src/app/SavedQuests.tsx](App/work/QuestLife-main/src/app/SavedQuests.tsx)<br>[App/work/QuestLife-main/src/app/Social.tsx](App/work/QuestLife-main/src/app/Social.tsx)<br>[App/work/QuestLife-main/src/imports/Frame1/index.tsx](App/work/QuestLife-main/src/imports/Frame1/index.tsx) |
| `#FF0000` | [App/app/onboarding/about-you.tsx](App/app/onboarding/about-you.tsx) |
| `#FF4500` | [App/app/onboarding/about-you.tsx](App/app/onboarding/about-you.tsx) |
| `#FF4560` | [App/components/party-category-icon.tsx](App/components/party-category-icon.tsx)<br>[App/screens/lobby-screen.tsx](App/screens/lobby-screen.tsx)<br>[App/types/content.ts](App/types/content.ts) |
| `#FF4D9C` | [App/components/party-category-icon.tsx](App/components/party-category-icon.tsx)<br>[App/types/content.ts](App/types/content.ts) |
| `#FF5C5C` | [App/work/QuestLife-main/src/imports/Frame1/index.tsx](App/work/QuestLife-main/src/imports/Frame1/index.tsx) |
| `#ff6b6b` | [App/app/onboarding/personalizing.tsx](App/app/onboarding/personalizing.tsx) |
| `#FF6B81` | [App/components/heart-icon.tsx](App/components/heart-icon.tsx)<br>[App/components/quest-feed-card.tsx](App/components/quest-feed-card.tsx) |
| `#ff6d45` | [App/screens/streak-invite-friends-screen.tsx](App/screens/streak-invite-friends-screen.tsx)<br>[App/screens/streak-screen.tsx](App/screens/streak-screen.tsx) |
| `#FF9C4D` | [App/types/content.ts](App/types/content.ts) |
| `#ffa70f` | [App/components/log-lore-flow.tsx](App/components/log-lore-flow.tsx) |
| `#ffb317` | [App/components/log-lore-flow.tsx](App/components/log-lore-flow.tsx) |
| `#ffb517` | [App/components/log-lore-flow.tsx](App/components/log-lore-flow.tsx) |
| `#ffb785` | [App/components/streak-pill.tsx](App/components/streak-pill.tsx) |
| `#ffbd35` | [App/components/log-lore-flow.tsx](App/components/log-lore-flow.tsx) |
| `#ffbf24` | [App/components/log-lore-flow.tsx](App/components/log-lore-flow.tsx) |
| `#ffbf26` | [App/components/log-lore-flow.tsx](App/components/log-lore-flow.tsx) |
| `#ffc13a` | [App/components/log-lore-flow.tsx](App/components/log-lore-flow.tsx) |
| `#ffc64d` | [App/components/log-lore-flow.tsx](App/components/log-lore-flow.tsx) |
| `#ffdc83` | [App/components/log-lore-flow.tsx](App/components/log-lore-flow.tsx) |
| `#ffe4ea` | [App/components/quest-feed-card.tsx](App/components/quest-feed-card.tsx) |
| `#ffe58a` | [App/components/log-lore-flow.tsx](App/components/log-lore-flow.tsx) |
| `#ffe8f3` | [App/screens/profile-screen.tsx](App/screens/profile-screen.tsx) |
| `#FFEAF4` | [App/types/content.ts](App/types/content.ts) |
| `#FFECEF` | [App/types/content.ts](App/types/content.ts) |
| `#fff` | [App/work/QuestLife-main/src/app/App.tsx](App/work/QuestLife-main/src/app/App.tsx)<br>[App/work/QuestLife-main/src/app/Explore.tsx](App/work/QuestLife-main/src/app/Explore.tsx)<br>[App/work/QuestLife-main/src/app/Journal.tsx](App/work/QuestLife-main/src/app/Journal.tsx)<br>[App/work/QuestLife-main/src/app/Lobby.tsx](App/work/QuestLife-main/src/app/Lobby.tsx)<br>[App/work/QuestLife-main/src/app/Profile.tsx](App/work/QuestLife-main/src/app/Profile.tsx)<br>[App/work/QuestLife-main/src/app/SavedQuests.tsx](App/work/QuestLife-main/src/app/SavedQuests.tsx)<br>[App/work/QuestLife-main/src/app/Social.tsx](App/work/QuestLife-main/src/app/Social.tsx)<br>[App/work/QuestLife-main/src/app/components/ui/chart.tsx](App/work/QuestLife-main/src/app/components/ui/chart.tsx) |
| `#fff0bc` | [App/components/log-lore-flow.tsx](App/components/log-lore-flow.tsx) |
| `#fff0df` | [App/screens/profile-screen.tsx](App/screens/profile-screen.tsx) |
| `#fff0e7` | [App/screens/streak-screen.tsx](App/screens/streak-screen.tsx) |
| `#fff0f5` | [App/app/(auth)/auth-options.tsx](App/app/(auth)/auth-options.tsx) |
| `#FFF2E3` | [App/types/content.ts](App/types/content.ts) |
| `#fff2f2` | [App/work/QuestLife-main/src/app/Social.tsx](App/work/QuestLife-main/src/app/Social.tsx) |
| `#fff4cd` | [App/app/(auth)/auth-options.tsx](App/app/(auth)/auth-options.tsx) |
| `#fff6f0` | [App/screens/streak-screen.tsx](App/screens/streak-screen.tsx) |
| `#fff7d8` | [App/screens/profile-screen.tsx](App/screens/profile-screen.tsx) |
| `#fff7f2` | [App/screens/streak-screen.tsx](App/screens/streak-screen.tsx) |
| `#fff7f9` | [App/components/quest-feed-card.tsx](App/components/quest-feed-card.tsx) |
| `#fff9e7` | [App/components/log-lore-flow.tsx](App/components/log-lore-flow.tsx) |
| `#fffaff` | [App/screens/journal-screen.tsx](App/screens/journal-screen.tsx) |
| `#fffcf5` | [App/work/QuestLife-main/src/app/App.tsx](App/work/QuestLife-main/src/app/App.tsx)<br>[App/work/QuestLife-main/src/app/Explore.tsx](App/work/QuestLife-main/src/app/Explore.tsx)<br>[App/work/QuestLife-main/src/app/Journal.tsx](App/work/QuestLife-main/src/app/Journal.tsx)<br>[App/work/QuestLife-main/src/app/Lobby.tsx](App/work/QuestLife-main/src/app/Lobby.tsx)<br>[App/work/QuestLife-main/src/app/Profile.tsx](App/work/QuestLife-main/src/app/Profile.tsx)<br>[App/work/QuestLife-main/src/app/SavedQuests.tsx](App/work/QuestLife-main/src/app/SavedQuests.tsx)<br>[App/work/QuestLife-main/src/app/Social.tsx](App/work/QuestLife-main/src/app/Social.tsx)<br>[App/work/QuestLife-main/src/imports/Frame1/index.tsx](App/work/QuestLife-main/src/imports/Frame1/index.tsx) |
| `#ffffff` | [App/components/onboarding-intro.tsx](App/components/onboarding-intro.tsx)<br>[App/work/QuestLife-main/src/app/App.tsx](App/work/QuestLife-main/src/app/App.tsx) |
| `hsl(var(--sidebar-accent)` | [App/work/QuestLife-main/src/app/components/ui/sidebar.tsx](App/work/QuestLife-main/src/app/components/ui/sidebar.tsx) |
| `hsl(var(--sidebar-border)` | [App/work/QuestLife-main/src/app/components/ui/sidebar.tsx](App/work/QuestLife-main/src/app/components/ui/sidebar.tsx) |
| `rgba(0,0,0,0)` | [App/components/scroll-top-blur.tsx](App/components/scroll-top-blur.tsx) |
| `rgba(0,0,0,0.05)` | [App/app/(tabs)/_layout.tsx](App/app/(tabs)/_layout.tsx)<br>[App/work/QuestLife-main/src/app/App.tsx](App/work/QuestLife-main/src/app/App.tsx)<br>[App/work/QuestLife-main/src/imports/Frame1/index.tsx](App/work/QuestLife-main/src/imports/Frame1/index.tsx)<br>[App/work/QuestLife-main/src/imports/NavBar/index.tsx](App/work/QuestLife-main/src/imports/NavBar/index.tsx) |
| `rgba(0,0,0,0.08)` | [App/work/QuestLife-main/src/app/App.tsx](App/work/QuestLife-main/src/app/App.tsx)<br>[App/work/QuestLife-main/src/app/Journal.tsx](App/work/QuestLife-main/src/app/Journal.tsx)<br>[App/work/QuestLife-main/src/app/Social.tsx](App/work/QuestLife-main/src/app/Social.tsx) |
| `rgba(0,0,0,0.1)` | [App/work/QuestLife-main/src/imports/Frame1/index.tsx](App/work/QuestLife-main/src/imports/Frame1/index.tsx) |
| `rgba(0,0,0,0.12)` | [App/work/QuestLife-main/src/app/App.tsx](App/work/QuestLife-main/src/app/App.tsx)<br>[App/work/QuestLife-main/src/app/Lobby.tsx](App/work/QuestLife-main/src/app/Lobby.tsx) |
| `rgba(0,0,0,0.18)` | [App/work/QuestLife-main/src/app/Profile.tsx](App/work/QuestLife-main/src/app/Profile.tsx) |
| `rgba(0,0,0,0.22)` | [App/screens/settings-screen.tsx](App/screens/settings-screen.tsx) |
| `rgba(0,0,0,0.34)` | [App/components/quest-feed-card.tsx](App/components/quest-feed-card.tsx) |
| `rgba(0,0,0,0.45)` | [App/work/QuestLife-main/src/app/Social.tsx](App/work/QuestLife-main/src/app/Social.tsx) |
| `rgba(0,0,0,0.52)` | [App/screens/active-quest-screen.tsx](App/screens/active-quest-screen.tsx) |
| `rgba(0,0,0,0.72)` | [App/components/scroll-top-blur.tsx](App/components/scroll-top-blur.tsx) |
| `rgba(0,0,0,1)` | [App/components/scroll-top-blur.tsx](App/components/scroll-top-blur.tsx) |
| `rgba(0,187,249,0.08)` | [App/work/QuestLife-main/src/app/Social.tsx](App/work/QuestLife-main/src/app/Social.tsx) |
| `rgba(0,187,249,0.1)` | [App/work/QuestLife-main/src/app/App.tsx](App/work/QuestLife-main/src/app/App.tsx)<br>[App/work/QuestLife-main/src/app/Lobby.tsx](App/work/QuestLife-main/src/app/Lobby.tsx)<br>[App/work/QuestLife-main/src/imports/Frame1/index.tsx](App/work/QuestLife-main/src/imports/Frame1/index.tsx) |
| `rgba(0,187,249,0.12)` | [App/work/QuestLife-main/src/app/Explore.tsx](App/work/QuestLife-main/src/app/Explore.tsx)<br>[App/work/QuestLife-main/src/app/Journal.tsx](App/work/QuestLife-main/src/app/Journal.tsx)<br>[App/work/QuestLife-main/src/app/Lobby.tsx](App/work/QuestLife-main/src/app/Lobby.tsx)<br>[App/work/QuestLife-main/src/app/SavedQuests.tsx](App/work/QuestLife-main/src/app/SavedQuests.tsx)<br>[App/work/QuestLife-main/src/app/Social.tsx](App/work/QuestLife-main/src/app/Social.tsx) |
| `rgba(0,187,249,0.32)` | [App/screens/lobby-screen.tsx](App/screens/lobby-screen.tsx) |
| `rgba(0,187,249,0.7)` | [App/work/QuestLife-main/src/app/Lobby.tsx](App/work/QuestLife-main/src/app/Lobby.tsx)<br>[App/work/QuestLife-main/src/imports/Frame1/index.tsx](App/work/QuestLife-main/src/imports/Frame1/index.tsx) |
| `rgba(0,206,201,0.12)` | [App/work/QuestLife-main/src/app/Explore.tsx](App/work/QuestLife-main/src/app/Explore.tsx)<br>[App/work/QuestLife-main/src/app/Lobby.tsx](App/work/QuestLife-main/src/app/Lobby.tsx)<br>[App/work/QuestLife-main/src/app/SavedQuests.tsx](App/work/QuestLife-main/src/app/SavedQuests.tsx)<br>[App/work/QuestLife-main/src/app/Social.tsx](App/work/QuestLife-main/src/app/Social.tsx) |
| `rgba(138,129,134,0.08)` | [App/work/QuestLife-main/src/app/App.tsx](App/work/QuestLife-main/src/app/App.tsx) |
| `rgba(162,155,254,0.1)` | [App/work/QuestLife-main/src/app/Explore.tsx](App/work/QuestLife-main/src/app/Explore.tsx) |
| `rgba(162,155,254,0.12)` | [App/work/QuestLife-main/src/app/Explore.tsx](App/work/QuestLife-main/src/app/Explore.tsx)<br>[App/work/QuestLife-main/src/app/Journal.tsx](App/work/QuestLife-main/src/app/Journal.tsx)<br>[App/work/QuestLife-main/src/app/Lobby.tsx](App/work/QuestLife-main/src/app/Lobby.tsx)<br>[App/work/QuestLife-main/src/app/SavedQuests.tsx](App/work/QuestLife-main/src/app/SavedQuests.tsx) |
| `rgba(162,155,254,0.15)` | [App/work/QuestLife-main/src/app/Profile.tsx](App/work/QuestLife-main/src/app/Profile.tsx) |
| `rgba(20,17,20,0.06)` | [App/components/quest-feed-card.tsx](App/components/quest-feed-card.tsx) |
| `rgba(20,17,20,0.78)` | [App/components/quest-feed-card.tsx](App/components/quest-feed-card.tsx) |
| `rgba(225,112,85,0.08)` | [App/components/auth/AuthControls.tsx](App/components/auth/AuthControls.tsx)<br>[App/work/QuestLife-main/src/app/Profile.tsx](App/work/QuestLife-main/src/app/Profile.tsx) |
| `rgba(225,112,85,0.1)` | [App/work/QuestLife-main/src/app/SavedQuests.tsx](App/work/QuestLife-main/src/app/SavedQuests.tsx) |
| `rgba(225,112,85,0.12)` | [App/work/QuestLife-main/src/app/Explore.tsx](App/work/QuestLife-main/src/app/Explore.tsx)<br>[App/work/QuestLife-main/src/app/Journal.tsx](App/work/QuestLife-main/src/app/Journal.tsx)<br>[App/work/QuestLife-main/src/app/Lobby.tsx](App/work/QuestLife-main/src/app/Lobby.tsx)<br>[App/work/QuestLife-main/src/app/Profile.tsx](App/work/QuestLife-main/src/app/Profile.tsx)<br>[App/work/QuestLife-main/src/app/SavedQuests.tsx](App/work/QuestLife-main/src/app/SavedQuests.tsx)<br>[App/work/QuestLife-main/src/app/Social.tsx](App/work/QuestLife-main/src/app/Social.tsx) |
| `rgba(225,112,85,0.3)` | [App/work/QuestLife-main/src/app/Profile.tsx](App/work/QuestLife-main/src/app/Profile.tsx)<br>[App/work/QuestLife-main/src/app/SavedQuests.tsx](App/work/QuestLife-main/src/app/SavedQuests.tsx) |
| `rgba(23, 35, 49, 0.58)` | [App/components/required-profile-name.tsx](App/components/required-profile-name.tsx) |
| `rgba(232,223,213,0.5)` | [App/work/QuestLife-main/src/app/Lobby.tsx](App/work/QuestLife-main/src/app/Lobby.tsx)<br>[App/work/QuestLife-main/src/imports/Frame1/index.tsx](App/work/QuestLife-main/src/imports/Frame1/index.tsx) |
| `rgba(232,223,213,0.82)` | [App/screens/social-screen.tsx](App/screens/social-screen.tsx) |
| `rgba(232,223,213,0.84)` | [App/screens/active-quest-screen.tsx](App/screens/active-quest-screen.tsx) |
| `rgba(232,223,213,0.92)` | [App/screens/active-quest-screen.tsx](App/screens/active-quest-screen.tsx) |
| `rgba(232,223,213,0.94)` | [App/screens/active-quest-screen.tsx](App/screens/active-quest-screen.tsx) |
| `rgba(243,156,18,0.1)` | [App/work/QuestLife-main/src/app/Explore.tsx](App/work/QuestLife-main/src/app/Explore.tsx)<br>[App/work/QuestLife-main/src/app/Lobby.tsx](App/work/QuestLife-main/src/app/Lobby.tsx) |
| `rgba(243,156,18,0.12)` | [App/work/QuestLife-main/src/app/Explore.tsx](App/work/QuestLife-main/src/app/Explore.tsx)<br>[App/work/QuestLife-main/src/app/Journal.tsx](App/work/QuestLife-main/src/app/Journal.tsx)<br>[App/work/QuestLife-main/src/app/Lobby.tsx](App/work/QuestLife-main/src/app/Lobby.tsx)<br>[App/work/QuestLife-main/src/app/Profile.tsx](App/work/QuestLife-main/src/app/Profile.tsx)<br>[App/work/QuestLife-main/src/app/SavedQuests.tsx](App/work/QuestLife-main/src/app/SavedQuests.tsx)<br>[App/work/QuestLife-main/src/app/Social.tsx](App/work/QuestLife-main/src/app/Social.tsx) |
| `rgba(243,156,18,0.15)` | [App/work/QuestLife-main/src/app/Profile.tsx](App/work/QuestLife-main/src/app/Profile.tsx) |
| `rgba(246,239,225,0)` | [App/screens/streak-screen.tsx](App/screens/streak-screen.tsx) |
| `rgba(246,239,225,0.03)` | [App/screens/streak-screen.tsx](App/screens/streak-screen.tsx) |
| `rgba(246,239,225,0.32)` | [App/screens/streak-screen.tsx](App/screens/streak-screen.tsx) |
| `rgba(252,239,246,0.5)` | [App/screens/lobby-screen.tsx](App/screens/lobby-screen.tsx)<br>[App/work/QuestLife-main/src/app/Lobby.tsx](App/work/QuestLife-main/src/app/Lobby.tsx)<br>[App/work/QuestLife-main/src/imports/Frame1/index.tsx](App/work/QuestLife-main/src/imports/Frame1/index.tsx) |
| `rgba(253,121,168,0.1)` | [App/work/QuestLife-main/src/app/Explore.tsx](App/work/QuestLife-main/src/app/Explore.tsx)<br>[App/work/QuestLife-main/src/app/Lobby.tsx](App/work/QuestLife-main/src/app/Lobby.tsx) |
| `rgba(253,121,168,0.10)` | [App/components/auth/AuthScaffold.tsx](App/components/auth/AuthScaffold.tsx) |
| `rgba(253,121,168,0.12)` | [App/work/QuestLife-main/src/app/Explore.tsx](App/work/QuestLife-main/src/app/Explore.tsx)<br>[App/work/QuestLife-main/src/app/Journal.tsx](App/work/QuestLife-main/src/app/Journal.tsx)<br>[App/work/QuestLife-main/src/app/Lobby.tsx](App/work/QuestLife-main/src/app/Lobby.tsx)<br>[App/work/QuestLife-main/src/app/Profile.tsx](App/work/QuestLife-main/src/app/Profile.tsx)<br>[App/work/QuestLife-main/src/app/SavedQuests.tsx](App/work/QuestLife-main/src/app/SavedQuests.tsx)<br>[App/work/QuestLife-main/src/app/Social.tsx](App/work/QuestLife-main/src/app/Social.tsx) |
| `rgba(253,121,168,0.15)` | [App/work/QuestLife-main/src/app/Profile.tsx](App/work/QuestLife-main/src/app/Profile.tsx) |
| `rgba(254,228,64,0.1)` | [App/work/QuestLife-main/src/app/Journal.tsx](App/work/QuestLife-main/src/app/Journal.tsx)<br>[App/work/QuestLife-main/src/app/Social.tsx](App/work/QuestLife-main/src/app/Social.tsx) |
| `rgba(254,228,64,0.12)` | [App/work/QuestLife-main/src/app/Journal.tsx](App/work/QuestLife-main/src/app/Journal.tsx) |
| `rgba(254,228,64,0.18)` | [App/screens/notifications-screen.tsx](App/screens/notifications-screen.tsx) |
| `rgba(254,228,64,0.2)` | [App/work/QuestLife-main/src/app/App.tsx](App/work/QuestLife-main/src/app/App.tsx)<br>[App/work/QuestLife-main/src/app/Journal.tsx](App/work/QuestLife-main/src/app/Journal.tsx)<br>[App/work/QuestLife-main/src/app/Lobby.tsx](App/work/QuestLife-main/src/app/Lobby.tsx)<br>[App/work/QuestLife-main/src/imports/Frame1/index.tsx](App/work/QuestLife-main/src/imports/Frame1/index.tsx) |
| `rgba(254,228,64,0.22)` | [App/screens/journal-screen.tsx](App/screens/journal-screen.tsx) |
| `rgba(254,228,64,0.25)` | [App/work/QuestLife-main/src/app/Profile.tsx](App/work/QuestLife-main/src/app/Profile.tsx) |
| `rgba(254,228,64,0.35)` | [App/work/QuestLife-main/src/app/Journal.tsx](App/work/QuestLife-main/src/app/Journal.tsx) |
| `rgba(254,228,64,0.4)` | [App/work/QuestLife-main/src/app/Journal.tsx](App/work/QuestLife-main/src/app/Journal.tsx)<br>[App/work/QuestLife-main/src/app/Social.tsx](App/work/QuestLife-main/src/app/Social.tsx) |
| `rgba(254,228,64,0.5)` | [App/screens/notifications-screen.tsx](App/screens/notifications-screen.tsx)<br>[App/work/QuestLife-main/src/app/App.tsx](App/work/QuestLife-main/src/app/App.tsx)<br>[App/work/QuestLife-main/src/app/Journal.tsx](App/work/QuestLife-main/src/app/Journal.tsx)<br>[App/work/QuestLife-main/src/app/Lobby.tsx](App/work/QuestLife-main/src/app/Lobby.tsx) |
| `rgba(254,228,64,0.55)` | [App/screens/journal-screen.tsx](App/screens/journal-screen.tsx) |
| `rgba(254,228,64,0.6)` | [App/work/QuestLife-main/src/app/Journal.tsx](App/work/QuestLife-main/src/app/Journal.tsx) |
| `rgba(255, 181, 23, 0.13)` | [App/components/log-lore-flow.tsx](App/components/log-lore-flow.tsx) |
| `rgba(255, 191, 24, 0.9)` | [App/components/log-lore-flow.tsx](App/components/log-lore-flow.tsx)<br>[App/screens/in-progress-quest-screen.tsx](App/screens/in-progress-quest-screen.tsx) |
| `rgba(255, 215, 103, 0.2)` | [App/components/log-lore-flow.tsx](App/components/log-lore-flow.tsx) |
| `rgba(255,252,245,0.48)` | [App/screens/profile-screen.tsx](App/screens/profile-screen.tsx) |
| `rgba(255,252,248,0.36)` | [App/components/log-lore-flow.tsx](App/components/log-lore-flow.tsx)<br>[App/screens/active-quest-screen.tsx](App/screens/active-quest-screen.tsx) |
| `rgba(255,255,255,0)` | [App/components/log-lore-flow.tsx](App/components/log-lore-flow.tsx)<br>[App/components/ui.tsx](App/components/ui.tsx) |
| `rgba(255,255,255,0.06)` | [App/components/log-lore-flow.tsx](App/components/log-lore-flow.tsx) |
| `rgba(255,255,255,0.18)` | [App/components/ui.tsx](App/components/ui.tsx) |
| `rgba(255,255,255,0.4)` | [App/app/index.tsx](App/app/index.tsx)<br>[App/work/QuestLife-main/src/app/Lobby.tsx](App/work/QuestLife-main/src/app/Lobby.tsx)<br>[App/work/QuestLife-main/src/app/Profile.tsx](App/work/QuestLife-main/src/app/Profile.tsx)<br>[App/work/QuestLife-main/src/app/Social.tsx](App/work/QuestLife-main/src/app/Social.tsx)<br>[App/work/QuestLife-main/src/imports/Frame1/index.tsx](App/work/QuestLife-main/src/imports/Frame1/index.tsx) |
| `rgba(255,255,255,0.42)` | [App/app/index.tsx](App/app/index.tsx) |
| `rgba(255,255,255,0.55)` | [App/components/log-lore-flow.tsx](App/components/log-lore-flow.tsx) |
| `rgba(255,255,255,0.7)` | [App/work/QuestLife-main/src/app/App.tsx](App/work/QuestLife-main/src/app/App.tsx) |
| `rgba(255,255,255,0.78)` | [App/app/(auth)/verify-email.tsx](App/app/(auth)/verify-email.tsx) |
| `rgba(255,255,255,0.92)` | [App/app/onboarding/questions-path.tsx](App/app/onboarding/questions-path.tsx)<br>[App/components/onboarding-understanding-demo.tsx](App/components/onboarding-understanding-demo.tsx) |
| `rgba(28,24,27,0.64)` | [App/components/quest-feed-card.tsx](App/components/quest-feed-card.tsx) |
| `rgba(28,24,27,0.68)` | [App/components/quest-feed-card.tsx](App/components/quest-feed-card.tsx) |
| `rgba(28,24,27,0.82)` | [App/components/quest-feed-card.tsx](App/components/quest-feed-card.tsx) |
| `rgba(30,25,28,0.48)` | [App/screens/settings-screen.tsx](App/screens/settings-screen.tsx) |
| `rgba(35,40,37,0.16)` | [App/screens/active-quest-screen.tsx](App/screens/active-quest-screen.tsx) |
| `rgba(35,40,37,0.20)` | [App/screens/active-quest-screen.tsx](App/screens/active-quest-screen.tsx) |
| `rgba(35,40,37,0.24)` | [App/screens/active-quest-screen.tsx](App/screens/active-quest-screen.tsx) |
| `rgba(36,30,38,0.36)` | [App/components/log-lore-flow.tsx](App/components/log-lore-flow.tsx) |
| `rgba(36,30,38,0.48)` | [App/screens/profile-screen.tsx](App/screens/profile-screen.tsx) |
| `rgba(36,30,38,0.52)` | [App/screens/active-quest-screen.tsx](App/screens/active-quest-screen.tsx) |
| `rgba(36,30,38,0.56)` | [App/app/index.tsx](App/app/index.tsx) |
| `rgba(39,174,96,0.1)` | [App/work/QuestLife-main/src/app/Explore.tsx](App/work/QuestLife-main/src/app/Explore.tsx)<br>[App/work/QuestLife-main/src/app/Lobby.tsx](App/work/QuestLife-main/src/app/Lobby.tsx) |
| `rgba(39,174,96,0.12)` | [App/work/QuestLife-main/src/app/Explore.tsx](App/work/QuestLife-main/src/app/Explore.tsx)<br>[App/work/QuestLife-main/src/app/Journal.tsx](App/work/QuestLife-main/src/app/Journal.tsx)<br>[App/work/QuestLife-main/src/app/Lobby.tsx](App/work/QuestLife-main/src/app/Lobby.tsx)<br>[App/work/QuestLife-main/src/app/Profile.tsx](App/work/QuestLife-main/src/app/Profile.tsx)<br>[App/work/QuestLife-main/src/app/SavedQuests.tsx](App/work/QuestLife-main/src/app/SavedQuests.tsx)<br>[App/work/QuestLife-main/src/app/Social.tsx](App/work/QuestLife-main/src/app/Social.tsx) |
| `rgba(39,174,96,0.15)` | [App/work/QuestLife-main/src/app/Profile.tsx](App/work/QuestLife-main/src/app/Profile.tsx) |
| `rgba(39,174,96,0.3)` | [App/work/QuestLife-main/src/app/Social.tsx](App/work/QuestLife-main/src/app/Social.tsx) |
| `rgba(39,34,35,0.66)` | [App/screens/journal-screen.tsx](App/screens/journal-screen.tsx) |
| `rgba(5, 10, 18, 0.62)` | [App/components/global-announcement.tsx](App/components/global-announcement.tsx) |
| `rgba(5,10,7,0.5)` | [App/app/onboarding/questions-path.tsx](App/app/onboarding/questions-path.tsx)<br>[App/components/onboarding-understanding-demo.tsx](App/components/onboarding-understanding-demo.tsx) |
| `rgba(5,10,7,0.76)` | [App/app/onboarding/questions-path.tsx](App/app/onboarding/questions-path.tsx)<br>[App/components/onboarding-understanding-demo.tsx](App/components/onboarding-understanding-demo.tsx) |
| `rgba(61,52,56,0.08)` | [App/screens/active-quest-screen.tsx](App/screens/active-quest-screen.tsx) |
| `rgba(61,52,56,0.12)` | [App/screens/active-quest-screen.tsx](App/screens/active-quest-screen.tsx) |
| `rgba(61,52,56,0.14)` | [App/screens/active-quest-screen.tsx](App/screens/active-quest-screen.tsx) |
| `rgba(61,52,56,0.18)` | [App/screens/settings-screen.tsx](App/screens/settings-screen.tsx) |
| `rgba(61,52,56,0.22)` | [App/contexts/AppFeedbackContext.tsx](App/contexts/AppFeedbackContext.tsx)<br>[App/motion/primitives.tsx](App/motion/primitives.tsx)<br>[App/screens/memory-detail-screen.tsx](App/screens/memory-detail-screen.tsx)<br>[App/screens/quest-detail-screen.tsx](App/screens/quest-detail-screen.tsx)<br>[App/screens/share-adventure-screen.tsx](App/screens/share-adventure-screen.tsx) |
| `rgba(61,52,56,0.24)` | [App/screens/memory-detail-screen.tsx](App/screens/memory-detail-screen.tsx) |
| `rgba(61,52,56,0.3)` | [App/work/QuestLife-main/src/app/App.tsx](App/work/QuestLife-main/src/app/App.tsx)<br>[App/work/QuestLife-main/src/app/Lobby.tsx](App/work/QuestLife-main/src/app/Lobby.tsx) |
| `rgba(61,52,56,0.4)` | [App/work/QuestLife-main/src/app/Explore.tsx](App/work/QuestLife-main/src/app/Explore.tsx)<br>[App/work/QuestLife-main/src/app/Journal.tsx](App/work/QuestLife-main/src/app/Journal.tsx)<br>[App/work/QuestLife-main/src/app/Lobby.tsx](App/work/QuestLife-main/src/app/Lobby.tsx)<br>[App/work/QuestLife-main/src/app/Profile.tsx](App/work/QuestLife-main/src/app/Profile.tsx)<br>[App/work/QuestLife-main/src/app/SavedQuests.tsx](App/work/QuestLife-main/src/app/SavedQuests.tsx)<br>[App/work/QuestLife-main/src/app/Social.tsx](App/work/QuestLife-main/src/app/Social.tsx) |
| `rgba(61,52,56,0.5)` | [App/work/QuestLife-main/src/app/App.tsx](App/work/QuestLife-main/src/app/App.tsx)<br>[App/work/QuestLife-main/src/app/Lobby.tsx](App/work/QuestLife-main/src/app/Lobby.tsx) |
| `rgba(61,52,56,0.55)` | [App/work/QuestLife-main/src/app/Profile.tsx](App/work/QuestLife-main/src/app/Profile.tsx) |
| `rgba(61,52,56,0.9)` | [App/contexts/AppFeedbackContext.tsx](App/contexts/AppFeedbackContext.tsx) |
| `rgba(77,168,255,0.05)` | [App/work/QuestLife-main/src/app/App.tsx](App/work/QuestLife-main/src/app/App.tsx)<br>[App/work/QuestLife-main/src/app/Journal.tsx](App/work/QuestLife-main/src/app/Journal.tsx)<br>[App/work/QuestLife-main/src/app/SavedQuests.tsx](App/work/QuestLife-main/src/app/SavedQuests.tsx)<br>[App/work/QuestLife-main/src/imports/Frame1/index.tsx](App/work/QuestLife-main/src/imports/Frame1/index.tsx) |
| `rgba(77,168,255,0.06)` | [App/work/QuestLife-main/src/app/App.tsx](App/work/QuestLife-main/src/app/App.tsx)<br>[App/work/QuestLife-main/src/app/Explore.tsx](App/work/QuestLife-main/src/app/Explore.tsx)<br>[App/work/QuestLife-main/src/app/Lobby.tsx](App/work/QuestLife-main/src/app/Lobby.tsx) |
| `rgba(77,168,255,0.07)` | [App/components/ui.tsx](App/components/ui.tsx)<br>[App/work/QuestLife-main/src/app/Profile.tsx](App/work/QuestLife-main/src/app/Profile.tsx)<br>[App/work/QuestLife-main/src/app/Social.tsx](App/work/QuestLife-main/src/app/Social.tsx) |
| `rgba(77,168,255,0.08)` | [App/work/QuestLife-main/src/app/Social.tsx](App/work/QuestLife-main/src/app/Social.tsx) |
| `rgba(77,168,255,0.1)` | [App/work/QuestLife-main/src/app/App.tsx](App/work/QuestLife-main/src/app/App.tsx)<br>[App/work/QuestLife-main/src/app/Explore.tsx](App/work/QuestLife-main/src/app/Explore.tsx)<br>[App/work/QuestLife-main/src/app/Lobby.tsx](App/work/QuestLife-main/src/app/Lobby.tsx)<br>[App/work/QuestLife-main/src/imports/Frame1/index.tsx](App/work/QuestLife-main/src/imports/Frame1/index.tsx) |
| `rgba(77,168,255,0.12)` | [App/work/QuestLife-main/src/app/App.tsx](App/work/QuestLife-main/src/app/App.tsx)<br>[App/work/QuestLife-main/src/app/Explore.tsx](App/work/QuestLife-main/src/app/Explore.tsx)<br>[App/work/QuestLife-main/src/app/Journal.tsx](App/work/QuestLife-main/src/app/Journal.tsx)<br>[App/work/QuestLife-main/src/app/Lobby.tsx](App/work/QuestLife-main/src/app/Lobby.tsx)<br>[App/work/QuestLife-main/src/app/SavedQuests.tsx](App/work/QuestLife-main/src/app/SavedQuests.tsx)<br>[App/work/QuestLife-main/src/app/Social.tsx](App/work/QuestLife-main/src/app/Social.tsx) |
| `rgba(77,168,255,0.13)` | [App/app/(auth)/auth-options.tsx](App/app/(auth)/auth-options.tsx) |
| `rgba(77,168,255,0.15)` | [App/work/QuestLife-main/src/app/Lobby.tsx](App/work/QuestLife-main/src/app/Lobby.tsx)<br>[App/work/QuestLife-main/src/app/Profile.tsx](App/work/QuestLife-main/src/app/Profile.tsx) |
| `rgba(77,168,255,0.16)` | [App/screens/lobby-screen.tsx](App/screens/lobby-screen.tsx) |
| `rgba(77,168,255,0.18)` | [App/app/(auth)/auth-options.tsx](App/app/(auth)/auth-options.tsx) |
| `rgba(77,168,255,0.2)` | [App/work/QuestLife-main/src/app/Lobby.tsx](App/work/QuestLife-main/src/app/Lobby.tsx)<br>[App/work/QuestLife-main/src/imports/Frame1/index.tsx](App/work/QuestLife-main/src/imports/Frame1/index.tsx) |
| `rgba(77,168,255,0.25)` | [App/work/QuestLife-main/src/app/Journal.tsx](App/work/QuestLife-main/src/app/Journal.tsx)<br>[App/work/QuestLife-main/src/app/Lobby.tsx](App/work/QuestLife-main/src/app/Lobby.tsx) |
| `rgba(77,168,255,0.3)` | [App/work/QuestLife-main/src/app/App.tsx](App/work/QuestLife-main/src/app/App.tsx)<br>[App/work/QuestLife-main/src/app/Explore.tsx](App/work/QuestLife-main/src/app/Explore.tsx)<br>[App/work/QuestLife-main/src/app/Journal.tsx](App/work/QuestLife-main/src/app/Journal.tsx)<br>[App/work/QuestLife-main/src/app/Lobby.tsx](App/work/QuestLife-main/src/app/Lobby.tsx)<br>[App/work/QuestLife-main/src/app/SavedQuests.tsx](App/work/QuestLife-main/src/app/SavedQuests.tsx)<br>[App/work/QuestLife-main/src/app/Social.tsx](App/work/QuestLife-main/src/app/Social.tsx) |
| `rgba(77,168,255,0.38)` | [App/components/global-announcement.tsx](App/components/global-announcement.tsx) |
| `rgba(77,168,255,0.7)` | [App/work/QuestLife-main/src/imports/Frame1/index.tsx](App/work/QuestLife-main/src/imports/Frame1/index.tsx) |

## Audit totals

- Files with a color reference: **85**
- Semantic token references: **3390**
- Direct literal references: **1246**
- Unique direct literals: **286**
