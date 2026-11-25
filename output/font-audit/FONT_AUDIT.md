# QuestLife font audit

Audit of the current working tree, including uncommitted source changes. Generated November 22, 2026 (user timezone).

Scanned 313 first-party source files under App, Admin, Shared, and Website. Excludes dependencies, generated build outputs, caches, and font text baked into raster artwork. Primary scope is the iOS app; alternate platform implementations and sibling products are included separately. This is a static source audit, not a device rendering measurement.

## Findings

- App/app/_layout.tsx:31–35 loads three aliases: Rubik → Rubik-Regular.ttf (400), RubikBold → Rubik-Bold.ttf (700), RubikBlack → Rubik-Black.ttf (900).
- App/components/theme.ts:93–97 defines heading/bold/body aliases but does not apply them globally. The themedStyles helper only refreshes theme-backed styles; it does not assign a font.
- Text/TextInput with no fontFamily uses the platform default unless it inherits from an enclosing Text or receives a style override. On iOS this is the system font (San Francisco family; exact face is selected by the OS). No global React Native Text or TextInput font override was found.
- Requested weights in the app are 500 Medium, 600 SemiBold, 700 Bold, 800 ExtraBold, and 900 Black, plus default Regular 400. Only Rubik 400/700/900 files are loaded. A Rubik alias plus a different fontWeight is a request, not proof that a matching Rubik variant is rendered; device font resolution may synthesize or fall back. Both values are retained below.
- No fontStyle italic declarations were found in App or Admin source. Tabular numerals (fontVariant: ["tabular-nums"]) are included in the inventory.
- Ionicons is an icon font, used for symbols rather than body text. Each JSX icon instance is in icon-font-usage.csv. SVG-based icons are not fonts.
- App/assets/fonts also contains NunitoSans-Variable.ttf, NunitoSans-Italic-Variable.ttf, NunitoSans12pt-SemiBold.ttf, NunitoSans12pt-ExtraBold.ttf, and GeistPixel-Regular-Variable.ttf. No App UI loads/references these files. Asset presence alone does not make them active UI fonts.
- Admin uses the platform default and declares System theme aliases. Website uses Rubik, Georgia/serif, and GeistPixel (legal kicker), with Arial/sans-serif fallbacks; its exact CSS selectors are below.

## Complete inventories

- [Font style declarations](/Users/jabiullah/Documents/QuestLifeProject/output/font-audit/font-style-declarations.csv): 1128 objects with family/weight/style/variant, exact lines, containing style/component, and size/line height where declared. Includes reusable tokens; a declaration is not a count of rendered instances.
- [Text and text input elements](/Users/jabiullah/Documents/QuestLifeProject/output/font-audit/text-elements.csv): 1212 JSX sites, including elements without fontFamily. Resolves local StyleSheet/themedStyles objects, style arrays, and imported tokens where statically possible. Dynamic/caller-supplied styles are retained in unresolved/styleExpression; nested Text may inherit.
- [Icon font uses](/Users/jabiullah/Documents/QuestLifeProject/output/font-audit/icon-font-usage.csv): 386 Ionicons sites, with glyph expression and component.
- [CSS and native rules](/Users/jabiullah/Documents/QuestLifeProject/output/font-audit/css-and-native-font-rules.csv): exact rules and selectors, retaining original source line numbers.

Do not interpret a missing family in a reusable style object as final proof of system text: the consuming Text can merge another family. Consult the Text inventory and source. Platform-specific .ios.tsx files take precedence on iOS; .native/.web and shared fallback files are listed as separate source locations, not combined as simultaneous iOS usage. Runtime navigation, conditional rendering, inherited nested Text styles, accessibility scaling, external/native controls, and OS-selected faces cannot be proven from a static inventory alone.

## App family and weight combinations

These counts describe style objects, including shared and alternate platform files, not visible text instances.

| Family alias | Bundled variant | Requested fontWeight | Style objects |
|---|---|---|---|
| Rubik | Regular 400 | 500 | 2 |
| Rubik | Regular 400 | 600 | 5 |
| Rubik | Regular 400 | 700 | 20 |
| Rubik | Regular 400 | 800 | 1 |
| Rubik | Regular 400 | 900 | 1 |
| Rubik | Regular 400 | default | 104 |
| Rubik, sans-serif | Regular 400; web fallback | default | 1 |
| RubikBlack | Black 900 | 600 | 1 |
| RubikBlack | Black 900 | 900 | 4 |
| RubikBlack | Black 900 | default | 129 |
| RubikBold | Bold 700 | 700 | 2 |
| RubikBold | Bold 700 | 800 | 1 |
| RubikBold | Bold 700 | 900 | 10 |
| RubikBold | Bold 700 | default | 263 |
| Unspecified | Default / inherited / merged | 600 | 16 |
| Unspecified | Default / inherited / merged | 700 | 86 |
| Unspecified | Default / inherited / merged | 800 | 39 |
| Unspecified | Default / inherited / merged | 900 | 241 |
| Unspecified | Default / inherited / merged | default | 2 |
| Unspecified | Default / inherited / merged | isActive || isToday ? "900" : "700" | 1 |

## Bundled Rubik with a different requested weight

The font files have weights 400/700/900, verified from their OpenType OS/2 metadata. The following locations ask for another weight. These are not additional loaded Rubik variants.

| Exact location | Style / component | Font alias | File weight | Requested weight |
|---|---|---|---|---|
| [App/app/(auth)/auth-options.tsx:226](/Users/jabiullah/Documents/QuestLifeProject/App/app/(auth)/auth-options.tsx:226) |  / styles.subtitle | Rubik | 400 | 700 |
| [App/app/(auth)/auth-options.tsx:230](/Users/jabiullah/Documents/QuestLifeProject/App/app/(auth)/auth-options.tsx:230) |  / styles.loginPrompt | Rubik | 400 | 700 |
| [App/app/(auth)/auth-options.tsx:231](/Users/jabiullah/Documents/QuestLifeProject/App/app/(auth)/auth-options.tsx:231) |  / styles.loginLink | RubikBold | 700 | 900 |
| [App/app/(auth)/auth-options.tsx:232](/Users/jabiullah/Documents/QuestLifeProject/App/app/(auth)/auth-options.tsx:232) |  / styles.legal | Rubik | 400 | 500 |
| [App/app/(auth)/register.tsx:299](/Users/jabiullah/Documents/QuestLifeProject/App/app/(auth)/register.tsx:299) |  / styles.legal | Rubik | 400 | 500 |
| [App/app/index.tsx:189](/Users/jabiullah/Documents/QuestLifeProject/App/app/index.tsx:189) |  / styles.getStartedActionText | Rubik | 400 | 700 |
| [App/app/index.tsx:201](/Users/jabiullah/Documents/QuestLifeProject/App/app/index.tsx:201) |  / styles.authPrompt | Rubik | 400 | 700 |
| [App/app/index.tsx:207](/Users/jabiullah/Documents/QuestLifeProject/App/app/index.tsx:207) |  / styles.signInText | RubikBold | 700 | 900 |
| [App/app/index.tsx:229](/Users/jabiullah/Documents/QuestLifeProject/App/app/index.tsx:229) |  / styles.nameInput | Rubik | 400 | 700 |
| [App/app/index.tsx:253](/Users/jabiullah/Documents/QuestLifeProject/App/app/index.tsx:253) |  / styles.nameContinueButtonText | RubikBold | 700 | 900 |
| [App/app/onboarding/about-you.tsx:245](/Users/jabiullah/Documents/QuestLifeProject/App/app/onboarding/about-you.tsx:245) |  / styles.optionLabel | Rubik | 400 | 600 |
| [App/app/onboarding/claim-username.tsx:137](/Users/jabiullah/Documents/QuestLifeProject/App/app/onboarding/claim-username.tsx:137) |  / styles.body | Rubik | 400 | 700 |
| [App/app/onboarding/claim-username.tsx:141](/Users/jabiullah/Documents/QuestLifeProject/App/app/onboarding/claim-username.tsx:141) |  / styles.input | Rubik | 400 | 700 |
| [App/app/onboarding/follow-up-questions.tsx:214](/Users/jabiullah/Documents/QuestLifeProject/App/app/onboarding/follow-up-questions.tsx:214) |  / styles.optionLabel | Rubik | 400 | 600 |
| [App/app/onboarding/personalizing.tsx:243](/Users/jabiullah/Documents/QuestLifeProject/App/app/onboarding/personalizing.tsx:243) |  / styles.compassLabel | RubikBold | 700 | 900 |
| [App/app/onboarding/questions-intro.tsx:240](/Users/jabiullah/Documents/QuestLifeProject/App/app/onboarding/questions-intro.tsx:240) |  / styles.optionLabel | Rubik | 400 | 600 |
| [App/components/activity-chart-card.tsx:47](/Users/jabiullah/Documents/QuestLifeProject/App/components/activity-chart-card.tsx:47) | ActivityChartCard / ActivityChartCard | Rubik | 400 | 700 |
| [App/components/activity-chart-card.tsx:69](/Users/jabiullah/Documents/QuestLifeProject/App/components/activity-chart-card.tsx:69) | ActivityChartCard / ActivityChartCard | Rubik | 400 | 700 |
| [App/components/album-sort-header.tsx:40](/Users/jabiullah/Documents/QuestLifeProject/App/components/album-sort-header.tsx:40) | AlbumSortHeader / AlbumSortHeader | Rubik | 400 | 900 |
| [App/components/album-sort-header.tsx:45](/Users/jabiullah/Documents/QuestLifeProject/App/components/album-sort-header.tsx:45) | AlbumSortHeader / AlbumSortHeader | Rubik | 400 | 800 |
| [App/components/auth/AuthControls.tsx:285](/Users/jabiullah/Documents/QuestLifeProject/App/components/auth/AuthControls.tsx:285) |  / styles.dividerText | RubikBold | 700 | 800 |
| [App/components/profile-insights-dashboard.tsx:38](/Users/jabiullah/Documents/QuestLifeProject/App/components/profile-insights-dashboard.tsx:38) | InsightTile / InsightTile | Rubik | 400 | 700 |
| [App/components/profile-insights-dashboard.tsx:49](/Users/jabiullah/Documents/QuestLifeProject/App/components/profile-insights-dashboard.tsx:49) | ProfileInsightsDashboard / ProfileInsightsDashboard | Rubik | 400 | 700 |
| [App/components/profile-insights-dashboard.tsx:63](/Users/jabiullah/Documents/QuestLifeProject/App/components/profile-insights-dashboard.tsx:63) | ProfileInsightsDashboard / ProfileInsightsDashboard | Rubik | 400 | 700 |
| [App/components/profile-insights-dashboard.tsx:67](/Users/jabiullah/Documents/QuestLifeProject/App/components/profile-insights-dashboard.tsx:67) | ProfileInsightsDashboard / ProfileInsightsDashboard | Rubik | 400 | 700 |
| [App/components/profile-insights-dashboard.tsx:71](/Users/jabiullah/Documents/QuestLifeProject/App/components/profile-insights-dashboard.tsx:71) | ProfileInsightsDashboard / ProfileInsightsDashboard | Rubik | 400 | 700 |
| [App/components/quest-start-block.tsx:52](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-start-block.tsx:52) | QuestStartBlockSheet / QuestStartBlockSheet | Rubik | 400 | 700 |
| [App/components/quest-start-block.tsx:72](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-start-block.tsx:72) | QuestStartBlockSheet / QuestStartBlockSheet | Rubik | 400 | 700 |
| [App/screens/active-quest-screen.ios.tsx:496](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:496) | StaleQuestActionButton / StaleQuestActionButton | RubikBold | 700 | 900 |
| [App/screens/active-quest-screen.ios.tsx:523](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:523) | StaleQuestReminder / StaleQuestReminder | RubikBold | 700 | 900 |
| [App/screens/active-quest-screen.native.tsx:418](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:418) | StaleQuestActionButton / StaleQuestActionButton | RubikBold | 700 | 900 |
| [App/screens/active-quest-screen.native.tsx:445](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:445) | StaleQuestReminder / StaleQuestReminder | RubikBold | 700 | 900 |
| [App/screens/active-quest-screen.tsx:416](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:416) | StaleQuestActionButton / StaleQuestActionButton | RubikBold | 700 | 900 |
| [App/screens/active-quest-screen.tsx:443](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:443) | StaleQuestReminder / StaleQuestReminder | RubikBold | 700 | 900 |
| [App/screens/in-progress-quest-screen.tsx:104](/Users/jabiullah/Documents/QuestLifeProject/App/screens/in-progress-quest-screen.tsx:104) | InProgressQuestScreen / InProgressQuestScreen | Rubik | 400 | 600 |
| [App/screens/lobby-screen.tsx:982](/Users/jabiullah/Documents/QuestLifeProject/App/screens/lobby-screen.tsx:982) |  / styles.activeDescription | Rubik | 400 | 600 |
| [App/screens/lobby-screen.tsx:1024](/Users/jabiullah/Documents/QuestLifeProject/App/screens/lobby-screen.tsx:1024) |  / styles.statLabel | RubikBlack | 900 | 600 |
| [App/screens/lobby-screen.tsx:1088](/Users/jabiullah/Documents/QuestLifeProject/App/screens/lobby-screen.tsx:1088) |  / styles.emptyQuestBody | Rubik | 400 | 700 |
| [App/screens/profile-screen.tsx:348](/Users/jabiullah/Documents/QuestLifeProject/App/screens/profile-screen.tsx:348) | QuestTrail / QuestTrail | Rubik | 400 | 700 |
| [App/screens/profile-screen.tsx:364](/Users/jabiullah/Documents/QuestLifeProject/App/screens/profile-screen.tsx:364) | QuestTrail / QuestTrail | Rubik | 400 | 700 |
| [App/screens/profile-screen.tsx:387](/Users/jabiullah/Documents/QuestLifeProject/App/screens/profile-screen.tsx:387) | YourStatsDashboard / YourStatsDashboard | Rubik | 400 | 700 |

## Unused app font asset variants

| Asset | Verified weight / axes | App UI usage |
|---|---|---|
| NunitoSans-Variable.ttf | Upright variable weight 200–1000; width 75–125; optical size 6–12; YTLC 440–540 | Not loaded/referenced |
| NunitoSans-Italic-Variable.ttf | Italic variable weight 200–1000; same additional axes | Not loaded/referenced |
| NunitoSans12pt-SemiBold.ttf | Static weight 600 | Not loaded/referenced |
| NunitoSans12pt-ExtraBold.ttf | Static weight 800 | Not loaded/referenced |
| GeistPixel-Regular-Variable.ttf | Regular 400; ELSH axis 0–100 | Not loaded/referenced in App; Website legal CSS uses its copy |

The two static Nunito files retain internal ExtraLight name strings despite OS/2 weight values 600/800. They remain unused. Ionicons resolves to the package’s Ionicons.ttf via node_modules/@expo/vector-icons/build/Ionicons.js:3–5; outline/filled/sharp names are glyph choices, not font-weight variants.

## Font style declarations by file

Requested weight is separate from the bundled file's real weight. Sizes and line heights use React Native logical units.

### Admin/app/(auth)/login.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [Admin/app/(auth)/login.tsx:38](/Users/jabiullah/Documents/QuestLifeProject/Admin/app/(auth)/login.tsx:38) | Logo / Logo | No family specified; default/inherited/merged | 900 | 25 / — | — | QuestLife |
| [Admin/app/(auth)/login.tsx:39](/Users/jabiullah/Documents/QuestLifeProject/Admin/app/(auth)/login.tsx:39) | Logo / Logo | No family specified; default/inherited/merged | 900 | 12 / — | — | ADMIN TOOLS |
| [Admin/app/(auth)/login.tsx:52](/Users/jabiullah/Documents/QuestLifeProject/Admin/app/(auth)/login.tsx:52) | Metric / Metric | No family specified; default/inherited/merged | 900 | 12 / — | — | {label} |
| [Admin/app/(auth)/login.tsx:53](/Users/jabiullah/Documents/QuestLifeProject/Admin/app/(auth)/login.tsx:53) | Metric / Metric | No family specified; default/inherited/merged | 900 | 28 / — | — | {value} |
| [Admin/app/(auth)/login.tsx:90](/Users/jabiullah/Documents/QuestLifeProject/Admin/app/(auth)/login.tsx:90) | LoginField / LoginField | No family specified; default/inherited/merged | 700 | 15 / — | — | <TextInput autoCapitalize="none" onBlur={onBlur} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={C.faint} secureTextEntry= |
| [Admin/app/(auth)/login.tsx:94](/Users/jabiullah/Documents/QuestLifeProject/Admin/app/(auth)/login.tsx:94) | LoginField / LoginField | No family specified; default/inherited/merged | 800 | 12 / — | — | {error} |
| [Admin/app/(auth)/login.tsx:227](/Users/jabiullah/Documents/QuestLifeProject/Admin/app/(auth)/login.tsx:227) | LoginScreen / LoginScreen | No family specified; default/inherited/merged | 900 | wide ? 48 : compact ? 30 : 36 / wide ? 54 : compact ? 36 : 42 | — | Content operations, without touching the app build. |
| [Admin/app/(auth)/login.tsx:228](/Users/jabiullah/Documents/QuestLifeProject/Admin/app/(auth)/login.tsx:228) | LoginScreen / LoginScreen | No family specified; default/inherited/merged | 600 | compact ? 15 : 17 / compact ? 22 : 25 | — | Sign in to create drafts, review quests, and publish live QuestLife content from the private admin dashboard. |
| [Admin/app/(auth)/login.tsx:240](/Users/jabiullah/Documents/QuestLifeProject/Admin/app/(auth)/login.tsx:240) | LoginScreen / LoginScreen | No family specified; default/inherited/merged | 900 | 20 / — | — | Publication Flow |
| [Admin/app/(auth)/login.tsx:241](/Users/jabiullah/Documents/QuestLifeProject/Admin/app/(auth)/login.tsx:241) | LoginScreen / LoginScreen | No family specified; default/inherited/merged | 700 | — / — | — | Drafts move through review before going live. |
| [Admin/app/(auth)/login.tsx:244](/Users/jabiullah/Documents/QuestLifeProject/Admin/app/(auth)/login.tsx:244) | LoginScreen / LoginScreen | No family specified; default/inherited/merged | 900 | 12 / — | — | SECURE |
| [Admin/app/(auth)/login.tsx:251](/Users/jabiullah/Documents/QuestLifeProject/Admin/app/(auth)/login.tsx:251) | LoginScreen / LoginScreen | No family specified; default/inherited/merged | 900 | 12 / — | — | {index + 1} |
| [Admin/app/(auth)/login.tsx:256](/Users/jabiullah/Documents/QuestLifeProject/Admin/app/(auth)/login.tsx:256) | LoginScreen / LoginScreen | No family specified; default/inherited/merged | 900 | — / — | — | {item} |
| [Admin/app/(auth)/login.tsx:266](/Users/jabiullah/Documents/QuestLifeProject/Admin/app/(auth)/login.tsx:266) | LoginScreen / LoginScreen | No family specified; default/inherited/merged | 900 | 30 / — | — | Admin Login |
| [Admin/app/(auth)/login.tsx:267](/Users/jabiullah/Documents/QuestLifeProject/Admin/app/(auth)/login.tsx:267) | LoginScreen / LoginScreen | No family specified; default/inherited/merged | 700 | 15 / 22 | — | {stepMessage} |
| [Admin/app/(auth)/login.tsx:313](/Users/jabiullah/Documents/QuestLifeProject/Admin/app/(auth)/login.tsx:313) | LoginScreen / LoginScreen | No family specified; default/inherited/merged | 900 | — / — | — | Forgot password? |
| [Admin/app/(auth)/login.tsx:341](/Users/jabiullah/Documents/QuestLifeProject/Admin/app/(auth)/login.tsx:341) | LoginScreen / LoginScreen | No family specified; default/inherited/merged | 900 | 16 / — | — | {loading ? "Working..." : step === "email" ? "Continue" : step === "password" ? "Sign In" : "Create Password"} |
| [Admin/app/(auth)/login.tsx:349](/Users/jabiullah/Documents/QuestLifeProject/Admin/app/(auth)/login.tsx:349) | LoginScreen / LoginScreen | No family specified; default/inherited/merged | 900 | — / — | — | Use a different email |
| [Admin/app/(auth)/login.tsx:354](/Users/jabiullah/Documents/QuestLifeProject/Admin/app/(auth)/login.tsx:354) | LoginScreen / LoginScreen | No family specified; default/inherited/merged | 700 | 13 / 19 | — | Admin access is controlled by Supabase admin memberships and invites before login. |

### Admin/app/(auth)/register.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [Admin/app/(auth)/register.tsx:228](/Users/jabiullah/Documents/QuestLifeProject/Admin/app/(auth)/register.tsx:228) | styles.link | No family specified; default/inherited/merged | 800 | — / — | — | Reusable style/token |

### Admin/app/(auth)/verify-email.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [Admin/app/(auth)/verify-email.tsx:124](/Users/jabiullah/Documents/QuestLifeProject/Admin/app/(auth)/verify-email.tsx:124) | styles.resendText | No family specified; default/inherited/merged | 800 | 13 / — | — | Reusable style/token |

### Admin/app/_layout.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [Admin/app/_layout.tsx:41](/Users/jabiullah/Documents/QuestLifeProject/Admin/app/_layout.tsx:41) | AdminAppLayout / AdminAppLayout | No family specified; default/inherited/merged | 800 | — / — | — | Loading QuestLife Admin... |

### Admin/components/admin/admin-dashboard.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [Admin/components/admin/admin-dashboard.tsx:325](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:325) | AdminLogo / AdminLogo | No family specified; default/inherited/merged | 900 | 22 / — | — | QuestLife |
| [Admin/components/admin/admin-dashboard.tsx:326](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:326) | AdminLogo / AdminLogo | No family specified; default/inherited/merged | 800 | 12 / — | — | ADMIN V1.0 |
| [Admin/components/admin/admin-dashboard.tsx:345](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:345) | Pill / Pill | No family specified; default/inherited/merged | 900 | 12 / — | — | {children} |
| [Admin/components/admin/admin-dashboard.tsx:462](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:462) | LoadingPanel / LoadingPanel | No family specified; default/inherited/merged | 800 | 14 / — | — | {label} |
| [Admin/components/admin/admin-dashboard.tsx:488](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:488) | Field / Field | No family specified; default/inherited/merged | 900 | 12 / — | — | {label} |
| [Admin/components/admin/admin-dashboard.tsx:505](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:505) | Field / Field | No family specified; default/inherited/merged | 600 | 15 / — | — | <TextInput editable={editable} maxLength={maxLength} multiline={multiline} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor= |
| [Admin/components/admin/admin-dashboard.tsx:571](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:571) | Segmented / Segmented | No family specified; default/inherited/merged | 900 | 13 / — | — | {renderLabel ? renderLabel(option) : option} |
| [Admin/components/admin/admin-dashboard.tsx:623](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:623) | FilterCarousel / FilterCarousel | No family specified; default/inherited/merged | 900 | 13 / — | — | {renderLabel ? renderLabel(option) : option} |
| [Admin/components/admin/admin-dashboard.tsx:637](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:637) | FormSectionLabel / FormSectionLabel | No family specified; default/inherited/merged | 900 | 12 / — | — | {children} |
| [Admin/components/admin/admin-dashboard.tsx:687](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:687) | ChoiceGrid / ChoiceGrid | No family specified; default/inherited/merged | 900 | 13 / — | — | {renderLabel ? renderLabel(option) : option} |
| [Admin/components/admin/admin-dashboard.tsx:736](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:736) | ActionButton / ActionButton | No family specified; default/inherited/merged | 900 | 15 / — | — | {label} |
| [Admin/components/admin/admin-dashboard.tsx:763](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:763) | QuestStatCard / QuestStatCard | No family specified; default/inherited/merged | 900 | 16 / — | — | {label} |
| [Admin/components/admin/admin-dashboard.tsx:764](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:764) | QuestStatCard / QuestStatCard | No family specified; default/inherited/merged | 900 | 30 / — | — | {value} |
| [Admin/components/admin/admin-dashboard.tsx:801](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:801) | QuestRow / QuestRow | No family specified; default/inherited/merged | 900 | 16 / — | — | {quest.title} |
| [Admin/components/admin/admin-dashboard.tsx:804](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:804) | QuestRow / QuestRow | No family specified; default/inherited/merged | 900 | 10 / — | — | Featured {featuredDate} |
| [Admin/components/admin/admin-dashboard.tsx:808](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:808) | QuestRow / QuestRow | No family specified; default/inherited/merged | 600 | 13 / — | — | {quest.description} |
| [Admin/components/admin/admin-dashboard.tsx:811](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:811) | QuestRow / QuestRow | No family specified; default/inherited/merged | 800 | 12 / — | — | {quest.category} |
| [Admin/components/admin/admin-dashboard.tsx:812](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:812) | QuestRow / QuestRow | No family specified; default/inherited/merged | 900 | 12 / — | — | +{quest.xp} XP |
| [Admin/components/admin/admin-dashboard.tsx:813](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:813) | QuestRow / QuestRow | No family specified; default/inherited/merged | 700 | 12 / — | — | {quest.timeLabel} · {quest.difficulty} |
| [Admin/components/admin/admin-dashboard.tsx:819](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:819) | QuestRow / QuestRow | No family specified; default/inherited/merged | 800 | 13 / — | — | {quest.category} |
| [Admin/components/admin/admin-dashboard.tsx:820](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:820) | QuestRow / QuestRow | No family specified; default/inherited/merged | 900 | 14 / — | — | +{quest.xp} XP |
| [Admin/components/admin/admin-dashboard.tsx:820](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:820) | QuestRow / QuestRow | No family specified; default/inherited/merged | 700 | 12 / — | — | {quest.timeLabel} |
| [Admin/components/admin/admin-dashboard.tsx:821](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:821) | QuestRow / QuestRow | No family specified; default/inherited/merged | 900 | 13 / — | — | {quest.difficulty} |
| [Admin/components/admin/admin-dashboard.tsx:821](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:821) | QuestRow / QuestRow | No family specified; default/inherited/merged | 700 | 12 / — | — | {quest.createdByLabel} |
| [Admin/components/admin/admin-dashboard.tsx:847](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:847) | PreviewTag / PreviewTag | No family specified; default/inherited/merged | 900 | 12 / 16 | — | {label} |
| [Admin/components/admin/admin-dashboard.tsx:856](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:856) | PreviewMetaPill / PreviewMetaPill | No family specified; default/inherited/merged | 900 | 12 / 16 | — | {text} |
| [Admin/components/admin/admin-dashboard.tsx:863](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:863) | QuestPreviewCard / QuestPreviewCard | No family specified; default/inherited/merged | 900 | 18 / — | — | Mobile Preview |
| [Admin/components/admin/admin-dashboard.tsx:878](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:878) | QuestPreviewCard / QuestPreviewCard | No family specified; default/inherited/merged | 900 | 18 / 23 | — | {form.title \|\| "Untitled quest"} |
| [Admin/components/admin/admin-dashboard.tsx:879](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:879) | QuestPreviewCard / QuestPreviewCard | No family specified; default/inherited/merged | 700 | 13 / 19 | — | {form.description \|\| "Quest description preview will appear here."} |
| [Admin/components/admin/admin-dashboard.tsx:886](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:886) | QuestPreviewCard / QuestPreviewCard | No family specified; default/inherited/merged | 900 | 13 / — | — | Start |
| [Admin/components/admin/admin-dashboard.tsx:929](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:929) | QuestForm / QuestForm | No family specified; default/inherited/merged | 800 | — / — | — | Side task {index + 1} |
| [Admin/components/admin/admin-dashboard.tsx:941](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:941) | QuestForm / QuestForm | No family specified; default/inherited/merged | 700 | — / — | — | {action.label} |
| [Admin/components/admin/admin-dashboard.tsx:945](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:945) | QuestForm / QuestForm | No family specified; default/inherited/merged | 800 | — / — | — | + Add side task |
| [Admin/components/admin/admin-dashboard.tsx:963](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:963) | QuestForm / QuestForm | No family specified; default/inherited/merged | 900 | 11 / — | — | Difficulty |
| [Admin/components/admin/admin-dashboard.tsx:989](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:989) | QuestForm / QuestForm | No family specified; default/inherited/merged | 600 | 13 / 19 | — | {form.mode === "focused" ? "Focused starts a live, timed quest." : "Flexible adds the quest to In progress without a timer."} |
| [Admin/components/admin/admin-dashboard.tsx:999](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:999) | QuestForm / QuestForm | No family specified; default/inherited/merged | 900 | 12 / — | — | {index + 1} |
| [Admin/components/admin/admin-dashboard.tsx:1025](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:1025) | EmptyPanel / EmptyPanel | No family specified; default/inherited/merged | 900 | 20 / — | — | {title} |
| [Admin/components/admin/admin-dashboard.tsx:1026](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:1026) | EmptyPanel / EmptyPanel | No family specified; default/inherited/merged | 600 | — / 21 | — | {body} |
| [Admin/components/admin/admin-dashboard.tsx:1046](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:1046) | DenyReviewPanel / DenyReviewPanel | No family specified; default/inherited/merged | 900 | 18 / — | — | Deny Publication |
| [Admin/components/admin/admin-dashboard.tsx:1047](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:1047) | DenyReviewPanel / DenyReviewPanel | No family specified; default/inherited/merged | 600 | — / 20 | — | Write exactly what needs to change. The quest will return to draft with this note attached. |
| [Admin/components/admin/admin-dashboard.tsx:1092](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:1092) | SearchField / SearchField | No family specified; default/inherited/merged | 700 | 14 / — | — | <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={t.faint} style={{ flex: 1, color: t.text, fontSiz |
| [Admin/components/admin/admin-dashboard.tsx:1130](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:1130) | QuestPickRow / QuestPickRow | No family specified; default/inherited/merged | 900 | 15 / — | — | {quest.title} |
| [Admin/components/admin/admin-dashboard.tsx:1131](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:1131) | QuestPickRow / QuestPickRow | No family specified; default/inherited/merged | 700 | 12 / — | — | {quest.category} · +{quest.xp} XP · {quest.timeLabel} |
| [Admin/components/admin/admin-dashboard.tsx:1148](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:1148) | AdventurePackPreviewCard / AdventurePackPreviewCard | No family specified; default/inherited/merged | 900 | 18 / — | — | Mobile Preview |
| [Admin/components/admin/admin-dashboard.tsx:1153](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:1153) | AdventurePackPreviewCard / AdventurePackPreviewCard | No family specified; default/inherited/merged | 700 | 12 / — | — | Cover image set |
| [Admin/components/admin/admin-dashboard.tsx:1157](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:1157) | AdventurePackPreviewCard / AdventurePackPreviewCard | No family specified; default/inherited/merged | 900 | 11 / — | — | {previewQuests.length} QUESTS |
| [Admin/components/admin/admin-dashboard.tsx:1158](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:1158) | AdventurePackPreviewCard / AdventurePackPreviewCard | No family specified; default/inherited/merged | 900 | 22 / 27 | — | {form.icon \|\| "🧭"} {form.title \|\| "Pack title"} |
| [Admin/components/admin/admin-dashboard.tsx:1161](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:1161) | AdventurePackPreviewCard / AdventurePackPreviewCard | No family specified; default/inherited/merged | 700 | — / 20 | — | {form.subtitle \|\| "Subtitle preview"} |
| [Admin/components/admin/admin-dashboard.tsx:1164](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:1164) | AdventurePackPreviewCard / AdventurePackPreviewCard | No family specified; default/inherited/merged | 800 | 13 / — | — | • {quest.title} |
| [Admin/components/admin/admin-dashboard.tsx:1169](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:1169) | AdventurePackPreviewCard / AdventurePackPreviewCard | No family specified; default/inherited/merged | 700 | 13 / — | — | Selected quests will preview here. |
| [Admin/components/admin/admin-dashboard.tsx:2164](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2164) | renderNavItem / renderNavItem | No family specified; default/inherited/merged | 800 | 16 / — | — | {item.label} |
| [Admin/components/admin/admin-dashboard.tsx:2192](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2192) | renderSidebarAction / renderSidebarAction | No family specified; default/inherited/merged | 900 | 15 / — | — | {label} |
| [Admin/components/admin/admin-dashboard.tsx:2290](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2290) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 900 | 13 / — | — | Daily quest limit |
| [Admin/components/admin/admin-dashboard.tsx:2290](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2290) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 700 | 11 / — | — | {dailyQuestLimitEnabled ? "On · 5 per day" : "Off · unlimited"} |
| [Admin/components/admin/admin-dashboard.tsx:2315](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2315) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 900 | 13 / — | — | App intro |
| [Admin/components/admin/admin-dashboard.tsx:2315](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2315) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 700 | 11 / — | — | {introEnabled ? "On · shown at launch" : "Off · skipped at launch"} |
| [Admin/components/admin/admin-dashboard.tsx:2319](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2319) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 800 | 15 / — | — | {membership ? `${membership.role} access` : checkingRole ? "Checking access" : "No access"} |
| [Admin/components/admin/admin-dashboard.tsx:2340](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2340) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 900 | 19 / — | — | Welcome back, |
| [Admin/components/admin/admin-dashboard.tsx:2346](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2346) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 900 | 19 / — | — | {adminName} |
| [Admin/components/admin/admin-dashboard.tsx:2350](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2350) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 700 | 13 / — | — | Build the quests people will actually remember. |
| [Admin/components/admin/admin-dashboard.tsx:2357](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2357) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 900 | 10 / — | — | {unreadCount} |
| [Admin/components/admin/admin-dashboard.tsx:2368](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2368) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 900 | compact ? 32 : 42 / — | — | {currentTitle} |
| [Admin/components/admin/admin-dashboard.tsx:2369](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2369) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 600 | 17 / — | — | {currentSubtitle} |
| [Admin/components/admin/admin-dashboard.tsx:2396](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2396) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 900 | — / — | — | {message} |
| [Admin/components/admin/admin-dashboard.tsx:2397](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2397) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 900 | — / — | — | {error} |
| [Admin/components/admin/admin-dashboard.tsx:2412](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2412) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 900 | 22 / — | — | {view === "published" ? "Published Library" : "Quest Library"} |
| [Admin/components/admin/admin-dashboard.tsx:2413](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2413) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 600 | — / — | — | {visibleQuests.length} quests shown |
| [Admin/components/admin/admin-dashboard.tsx:2435](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2435) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 900 | 21 / — | — | New announcement |
| [Admin/components/admin/admin-dashboard.tsx:2436](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2436) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 700 | — / 20 | — | Publishing replaces the current announcement and opens a dismissible popup for people using the mobile app. |
| [Admin/components/admin/admin-dashboard.tsx:2444](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2444) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 900 | 21 / — | — | Announcement history |
| [Admin/components/admin/admin-dashboard.tsx:2445](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2445) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 700 | — / — | — | {announcements.length ? `${announcements.length} published` : "No announcements yet"} |
| [Admin/components/admin/admin-dashboard.tsx:2450](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2450) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 900 | 16 / — | — | {announcement.title} |
| [Admin/components/admin/admin-dashboard.tsx:2451](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2451) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 900 | 11 / — | — | {announcement.isActive ? "Live" : "Ended"} |
| [Admin/components/admin/admin-dashboard.tsx:2453](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2453) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 700 | — / 20 | — | {announcement.body} |
| [Admin/components/admin/admin-dashboard.tsx:2455](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2455) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 700 | 12 / — | — | {formatDate(announcement.createdAt)} |
| [Admin/components/admin/admin-dashboard.tsx:2456](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2456) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 900 | 12 / — | — | End |
| [Admin/components/admin/admin-dashboard.tsx:2459](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2459) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 700 | — / — | — | Your published announcements will appear here. |
| [Admin/components/admin/admin-dashboard.tsx:2496](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2496) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 900 | 24 / — | — | {selectedQuest.title} |
| [Admin/components/admin/admin-dashboard.tsx:2497](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2497) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 700 | — / — | — | Created by {selectedQuest.createdByLabel} · Updated {formatDate(selectedQuest.updatedAt)} |
| [Admin/components/admin/admin-dashboard.tsx:2503](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2503) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 900 | — / — | — | Review note |
| [Admin/components/admin/admin-dashboard.tsx:2504](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2504) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 700 | — / 20 | — | {selectedQuest.reviewNote} |
| [Admin/components/admin/admin-dashboard.tsx:2509](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2509) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 900 | — / — | — | Archived quests are locked |
| [Admin/components/admin/admin-dashboard.tsx:2510](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2510) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 700 | — / — | — | Move this quest back to draft before editing content. |
| [Admin/components/admin/admin-dashboard.tsx:2515](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2515) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 900 | 12 / — | — | Status actions |
| [Admin/components/admin/admin-dashboard.tsx:2553](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2553) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 900 | 20 / — | — | Review Requests |
| [Admin/components/admin/admin-dashboard.tsx:2554](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2554) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 700 | — / — | — | {reviewQuests.length} quests waiting |
| [Admin/components/admin/admin-dashboard.tsx:2571](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2571) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 900 | 16 / — | — | {quest.title} |
| [Admin/components/admin/admin-dashboard.tsx:2572](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2572) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 700 | — / 19 | — | {quest.description} |
| [Admin/components/admin/admin-dashboard.tsx:2573](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2573) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 800 | 12 / — | — | {quest.createdByLabel} · {quest.category} · +{quest.xp} XP |
| [Admin/components/admin/admin-dashboard.tsx:2582](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2582) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 900 | 28 / — | — | {selectedReviewQuest.title} |
| [Admin/components/admin/admin-dashboard.tsx:2583](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2583) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 700 | — / 22 | — | {selectedReviewQuest.description} |
| [Admin/components/admin/admin-dashboard.tsx:2585](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2585) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 900 | — / — | — | Quest Info |
| [Admin/components/admin/admin-dashboard.tsx:2586](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2586) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 700 | — / — | — | Submitted by {selectedReviewQuest.createdByLabel} |
| [Admin/components/admin/admin-dashboard.tsx:2587](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2587) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 700 | — / — | — | {selectedReviewQuest.category} · {selectedReviewQuest.difficulty} · +{selectedReviewQuest.xp} XP · {selectedReviewQuest.timeLabel} |
| [Admin/components/admin/admin-dashboard.tsx:2588](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2588) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 700 | — / — | — | Updated {formatDate(selectedReviewQuest.updatedAt)} |
| [Admin/components/admin/admin-dashboard.tsx:2591](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2591) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 900 | — / — | — | Steps |
| [Admin/components/admin/admin-dashboard.tsx:2593](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2593) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 700 | — / 20 | — | {index + 1}. {step} |
| [Admin/components/admin/admin-dashboard.tsx:2628](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2628) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 900 | 20 / — | — | Pack Library |
| [Admin/components/admin/admin-dashboard.tsx:2629](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2629) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 700 | — / — | — | {adventurePacks.length} collections |
| [Admin/components/admin/admin-dashboard.tsx:2651](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2651) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 900 | 16 / — | — | {pack.title} |
| [Admin/components/admin/admin-dashboard.tsx:2652](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2652) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 700 | 12 / — | — | {pack.questCount} quests · {statusLabel(pack.status)} |
| [Admin/components/admin/admin-dashboard.tsx:2658](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2658) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 700 | — / — | — | No packs created yet. |
| [Admin/components/admin/admin-dashboard.tsx:2715](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2715) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 900 | 18 / — | — | Quests |
| [Admin/components/admin/admin-dashboard.tsx:2716](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2716) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 700 | — / — | — | {packForm.questIds.length} selected from published quests |
| [Admin/components/admin/admin-dashboard.tsx:2734](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2734) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 700 | — / — | — | No published quests match that search. |
| [Admin/components/admin/admin-dashboard.tsx:2774](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2774) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 900 | 20 / — | — | Daily Lineup |
| [Admin/components/admin/admin-dashboard.tsx:2775](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2775) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 700 | — / — | — | {featuredQuestIds.length}/6 quests selected for {featuredDate} |
| [Admin/components/admin/admin-dashboard.tsx:2800](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2800) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 900 | 13 / — | — | {date} |
| [Admin/components/admin/admin-dashboard.tsx:2801](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2801) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 900 | 10 / — | — | {date === today ? "TODAY" : past ? "PAST" : "UPCOMING"} |
| [Admin/components/admin/admin-dashboard.tsx:2811](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2811) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 900 | 20 / — | — | Selected Order |
| [Admin/components/admin/admin-dashboard.tsx:2812](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2812) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 700 | — / — | — | Appears in this sequence inside Explore. |
| [Admin/components/admin/admin-dashboard.tsx:2819](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2819) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 900 | 16 / — | — | {index + 1} |
| [Admin/components/admin/admin-dashboard.tsx:2822](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2822) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 900 | 15 / — | — | {quest.title} |
| [Admin/components/admin/admin-dashboard.tsx:2823](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2823) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 700 | 12 / — | — | {quest.category} · +{quest.xp} XP |
| [Admin/components/admin/admin-dashboard.tsx:2846](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2846) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 700 | — / — | — | No quests scheduled for this date yet. |
| [Admin/components/admin/admin-dashboard.tsx:2855](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2855) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 900 | 20 / — | — | Published Quests |
| [Admin/components/admin/admin-dashboard.tsx:2856](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2856) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 700 | — / — | — | Pick exactly 6 quests for the daily carousel. |
| [Admin/components/admin/admin-dashboard.tsx:2883](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2883) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 700 | — / — | — | No published quests match that search. |
| [Admin/components/admin/admin-dashboard.tsx:2894](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2894) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 700 | 13 / — | — | Delete content permission is required to edit an existing featured batch. |
| [Admin/components/admin/admin-dashboard.tsx:2923](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2923) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 900 | 22 / — | — | Admin users |
| [Admin/components/admin/admin-dashboard.tsx:2924](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2924) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 700 | — / — | — | Open an admin to review identity details and manage their tool access. |
| [Admin/components/admin/admin-dashboard.tsx:2943](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2943) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 900 | 16 / — | — | {profile.displayName \|\| profile.email \|\| "Unnamed admin"} |
| [Admin/components/admin/admin-dashboard.tsx:2944](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2944) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 700 | 13 / — | — | {profile.email \|\| profile.userId} |
| [Admin/components/admin/admin-dashboard.tsx:2951](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2951) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 700 | 13 / — | — | Last active {formatDate(profile.lastLogin)} |
| [Admin/components/admin/admin-dashboard.tsx:2972](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2972) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 900 | 16 / — | — | {invite.email} |
| [Admin/components/admin/admin-dashboard.tsx:2973](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2973) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 700 | 13 / — | — | Invitation expires {formatDate(invite.expiresAt)} |
| [Admin/components/admin/admin-dashboard.tsx:2979](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2979) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 700 | — / — | — | No admin users yet. Send an invite to get started. |
| [Admin/components/admin/admin-dashboard.tsx:2989](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2989) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 900 | — / — | — | All admin users |
| [Admin/components/admin/admin-dashboard.tsx:2999](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:2999) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 900 | 26 / — | — | {selectedAdmin.displayName \|\| "Unnamed admin"} |
| [Admin/components/admin/admin-dashboard.tsx:3010](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:3010) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 900 | 12 / — | — | About this admin |
| [Admin/components/admin/admin-dashboard.tsx:3012](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:3012) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 800 | 12 / — | — | FULL NAME |
| [Admin/components/admin/admin-dashboard.tsx:3012](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:3012) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 800 | — / — | — | {selectedAdmin.displayName \|\| "Not provided"} |
| [Admin/components/admin/admin-dashboard.tsx:3013](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:3013) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 800 | 12 / — | — | EMAIL |
| [Admin/components/admin/admin-dashboard.tsx:3013](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:3013) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 800 | — / — | — | {selectedAdmin.email \|\| "Not available"} |
| [Admin/components/admin/admin-dashboard.tsx:3014](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:3014) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 800 | 12 / — | — | DESCRIPTION |
| [Admin/components/admin/admin-dashboard.tsx:3014](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:3014) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 700 | — / 20 | — | {selectedAdmin.bio?.trim() \|\| "No description has been added yet."} |
| [Admin/components/admin/admin-dashboard.tsx:3015](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:3015) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 800 | 12 / — | — | LAST ACTIVE |
| [Admin/components/admin/admin-dashboard.tsx:3015](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:3015) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 800 | — / — | — | {formatDate(selectedAdmin.lastLogin)} |
| [Admin/components/admin/admin-dashboard.tsx:3021](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:3021) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 900 | 20 / — | — | Permissions |
| [Admin/components/admin/admin-dashboard.tsx:3022](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:3022) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 700 | — / — | — | {selectedAdmin.role === "super_admin" ? "Super Admin access is managed only in Supabase." : "Choose the dashboard tools this admin can use."} |
| [Admin/components/admin/admin-dashboard.tsx:3030](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:3030) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 900 | — / — | — | {permissionLabels[permission]} |
| [Admin/components/admin/admin-dashboard.tsx:3031](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:3031) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 600 | 13 / 18 | — | {permissionDescriptions[permission]} |
| [Admin/components/admin/admin-dashboard.tsx:3049](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:3049) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 800 | — / — | — | You have unsaved permission changes. |
| [Admin/components/admin/admin-dashboard.tsx:3062](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:3062) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 900 | 24 / — | — | Invite an admin |
| [Admin/components/admin/admin-dashboard.tsx:3063](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:3063) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 700 | — / — | — | They will receive a secure dashboard link to create their password. |
| [Admin/components/admin/admin-dashboard.tsx:3069](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:3069) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 900 | 20 / — | — | Permissions |
| [Admin/components/admin/admin-dashboard.tsx:3070](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:3070) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 700 | — / — | — | Grant only the tools this admin needs. You can change these later. |
| [Admin/components/admin/admin-dashboard.tsx:3078](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:3078) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 900 | — / — | — | {permissionLabels[permission]} |
| [Admin/components/admin/admin-dashboard.tsx:3079](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:3079) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 600 | 13 / 18 | — | {permissionDescriptions[permission]} |
| [Admin/components/admin/admin-dashboard.tsx:3104](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:3104) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 900 | 22 / — | — | Admin Profile |
| [Admin/components/admin/admin-dashboard.tsx:3110](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:3110) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 900 | 22 / — | — | Your Permissions |
| [Admin/components/admin/admin-dashboard.tsx:3111](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:3111) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 700 | — / — | — | {membership?.role} access for {membership?.email \|\| membership?.userId} |
| [Admin/components/admin/admin-dashboard.tsx:3131](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:3131) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 900 | 22 / — | — | Notifications |
| [Admin/components/admin/admin-dashboard.tsx:3132](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:3132) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 700 | — / — | — | {unreadCount} unread · {selectedNotifications.length} selected |
| [Admin/components/admin/admin-dashboard.tsx:3153](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:3153) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 900 | 13 / — | — | {allNotificationsSelected ? "Clear" : "Select all"} |
| [Admin/components/admin/admin-dashboard.tsx:3174](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:3174) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 900 | 13 / — | — | Read all |
| [Admin/components/admin/admin-dashboard.tsx:3193](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:3193) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 900 | 13 / — | — | Mark read |
| [Admin/components/admin/admin-dashboard.tsx:3212](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:3212) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 900 | 13 / — | — | Mark unread |
| [Admin/components/admin/admin-dashboard.tsx:3231](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:3231) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 900 | 13 / — | — | Delete selected |
| [Admin/components/admin/admin-dashboard.tsx:3249](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:3249) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 900 | 13 / — | — | Delete all |
| [Admin/components/admin/admin-dashboard.tsx:3289](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:3289) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | notification.readAt ? "800" : "900" | 17 / — | — | {notification.title} |
| [Admin/components/admin/admin-dashboard.tsx:3292](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:3292) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 700 | — / 20 | — | {notification.body} |
| [Admin/components/admin/admin-dashboard.tsx:3293](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/admin/admin-dashboard.tsx:3293) | AdminDashboardScreen / AdminDashboardScreen | No family specified; default/inherited/merged | 800 | 12 / — | — | {formatDate(notification.createdAt)} |

### Admin/components/auth/AuthControls.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [Admin/components/auth/AuthControls.tsx:180](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/auth/AuthControls.tsx:180) | styles.input | No family specified; default/inherited/merged | 700 | 15 / — | — | Reusable style/token |
| [Admin/components/auth/AuthControls.tsx:190](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/auth/AuthControls.tsx:190) | styles.error | No family specified; default/inherited/merged | 800 | 12 / — | — | Reusable style/token |
| [Admin/components/auth/AuthControls.tsx:205](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/auth/AuthControls.tsx:205) | styles.label | No family specified; default/inherited/merged | 900 | 12 / — | — | Reusable style/token |
| [Admin/components/auth/AuthControls.tsx:211](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/auth/AuthControls.tsx:211) | styles.primaryLabel | No family specified; default/inherited/merged | 900 | 15 / — | — | Reusable style/token |
| [Admin/components/auth/AuthControls.tsx:228](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/auth/AuthControls.tsx:228) | styles.outlineLabel | No family specified; default/inherited/merged | 900 | 14 / — | — | Reusable style/token |
| [Admin/components/auth/AuthControls.tsx:246](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/auth/AuthControls.tsx:246) | styles.backLabel | No family specified; default/inherited/merged | 800 | 14 / — | — | Reusable style/token |
| [Admin/components/auth/AuthControls.tsx:261](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/auth/AuthControls.tsx:261) | styles.dividerText | No family specified; default/inherited/merged | 800 | 12 / — | — | Reusable style/token |
| [Admin/components/auth/AuthControls.tsx:276](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/auth/AuthControls.tsx:276) | styles.googleG | No family specified; default/inherited/merged | 900 | 13 / — | — | Reusable style/token |

### Admin/components/auth/AuthText.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [Admin/components/auth/AuthText.tsx:27](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/auth/AuthText.tsx:27) | styles.brand | No family specified; default/inherited/merged | 900 | 13 / — | — | Reusable style/token |
| [Admin/components/auth/AuthText.tsx:35](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/auth/AuthText.tsx:35) | styles.title | No family specified; default/inherited/merged | 900 | 40 / 45 | — | Reusable style/token |
| [Admin/components/auth/AuthText.tsx:42](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/auth/AuthText.tsx:42) | styles.subtitle | No family specified; default/inherited/merged | 700 | 14 / 22 | — | Reusable style/token |

### Admin/components/auth/OtpInput.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [Admin/components/auth/OtpInput.tsx:81](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/auth/OtpInput.tsx:81) | styles.cellText | No family specified; default/inherited/merged | 900 | 20 / — | — | Reusable style/token |

### Admin/components/auth/PasswordStrength.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [Admin/components/auth/PasswordStrength.tsx:58](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/auth/PasswordStrength.tsx:58) | styles.label | No family specified; default/inherited/merged | 900 | 11 / — | — | Reusable style/token |
| [Admin/components/auth/PasswordStrength.tsx:72](/Users/jabiullah/Documents/QuestLifeProject/Admin/components/auth/PasswordStrength.tsx:72) | styles.requirementText | No family specified; default/inherited/merged | 700 | 12 / — | — | Reusable style/token |

### App/app/(auth)/auth-options.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/app/(auth)/auth-options.tsx:226](/Users/jabiullah/Documents/QuestLifeProject/App/app/(auth)/auth-options.tsx:226) | styles.subtitle | Rubik Regular 400 | 700 | 15 / 21 | — | Reusable style/token |
| [App/app/(auth)/auth-options.tsx:230](/Users/jabiullah/Documents/QuestLifeProject/App/app/(auth)/auth-options.tsx:230) | styles.loginPrompt | Rubik Regular 400 | 700 | 13 / — | — | Reusable style/token |
| [App/app/(auth)/auth-options.tsx:231](/Users/jabiullah/Documents/QuestLifeProject/App/app/(auth)/auth-options.tsx:231) | styles.loginLink | Rubik Bold 700 | 900 | — / — | — | Reusable style/token |
| [App/app/(auth)/auth-options.tsx:232](/Users/jabiullah/Documents/QuestLifeProject/App/app/(auth)/auth-options.tsx:232) | styles.legal | Rubik Regular 400 | 500 | 11 / 16 | — | Reusable style/token |
| [App/app/(auth)/auth-options.tsx:233](/Users/jabiullah/Documents/QuestLifeProject/App/app/(auth)/auth-options.tsx:233) | styles.legalLink | Rubik Bold 700 | — | — / — | — | Reusable style/token |

### App/app/(auth)/login.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/app/(auth)/login.tsx:210](/Users/jabiullah/Documents/QuestLifeProject/App/app/(auth)/login.tsx:210) | styles.forgotText | No family specified; default/inherited/merged | 800 | 12 / — | — | Reusable style/token |
| [App/app/(auth)/login.tsx:224](/Users/jabiullah/Documents/QuestLifeProject/App/app/(auth)/login.tsx:224) | styles.link | No family specified; default/inherited/merged | 900 | — / — | — | Reusable style/token |

### App/app/(auth)/register.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/app/(auth)/register.tsx:266](/Users/jabiullah/Documents/QuestLifeProject/App/app/(auth)/register.tsx:266) | styles.brand | No family specified; default/inherited/merged | 900 | 13 / — | — | Reusable style/token |
| [App/app/(auth)/register.tsx:274](/Users/jabiullah/Documents/QuestLifeProject/App/app/(auth)/register.tsx:274) | styles.title | No family specified; default/inherited/merged | 900 | 36 / 41 | — | Reusable style/token |
| [App/app/(auth)/register.tsx:287](/Users/jabiullah/Documents/QuestLifeProject/App/app/(auth)/register.tsx:287) | styles.submitButtonLabel | Rubik Bold 700 | — | 16 / 20 | — | Reusable style/token |
| [App/app/(auth)/register.tsx:297](/Users/jabiullah/Documents/QuestLifeProject/App/app/(auth)/register.tsx:297) | styles.link | No family specified; default/inherited/merged | 900 | — / — | — | Reusable style/token |
| [App/app/(auth)/register.tsx:299](/Users/jabiullah/Documents/QuestLifeProject/App/app/(auth)/register.tsx:299) | styles.legal | Rubik Regular 400 | 500 | 11 / 15 | — | Reusable style/token |
| [App/app/(auth)/register.tsx:300](/Users/jabiullah/Documents/QuestLifeProject/App/app/(auth)/register.tsx:300) | styles.legalLink | Rubik Bold 700 | — | — / — | — | Reusable style/token |

### App/app/(auth)/verify-email.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/app/(auth)/verify-email.tsx:124](/Users/jabiullah/Documents/QuestLifeProject/App/app/(auth)/verify-email.tsx:124) | styles.resendText | No family specified; default/inherited/merged | 800 | 13 / — | — | Reusable style/token |

### App/app/index.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/app/index.tsx:99](/Users/jabiullah/Documents/QuestLifeProject/App/app/index.tsx:99) | OnboardingWelcomeScreen / OnboardingWelcomeScreen | Rubik Black 900 | — | 40 / 48 | — | Your next story starts here. |
| [App/app/index.tsx:99](/Users/jabiullah/Documents/QuestLifeProject/App/app/index.tsx:99) | OnboardingWelcomeScreen / OnboardingWelcomeScreen | Rubik Regular 400 | — | 17 / 27 | — | Find a quest for today. Make a plan with friends. Keep the memories along the way. |
| [App/app/index.tsx:189](/Users/jabiullah/Documents/QuestLifeProject/App/app/index.tsx:189) | styles.getStartedActionText | Rubik Regular 400 | 700 | 16 / 21 | — | Reusable style/token |
| [App/app/index.tsx:201](/Users/jabiullah/Documents/QuestLifeProject/App/app/index.tsx:201) | styles.authPrompt | Rubik Regular 400 | 700 | 15 / 20 | — | Reusable style/token |
| [App/app/index.tsx:207](/Users/jabiullah/Documents/QuestLifeProject/App/app/index.tsx:207) | styles.signInText | Rubik Bold 700 | 900 | — / — | — | Reusable style/token |
| [App/app/index.tsx:217](/Users/jabiullah/Documents/QuestLifeProject/App/app/index.tsx:217) | styles.nameSheetTitle | Rubik Black 900 | — | 25 / 31 | — | Reusable style/token |
| [App/app/index.tsx:229](/Users/jabiullah/Documents/QuestLifeProject/App/app/index.tsx:229) | styles.nameInput | Rubik Regular 400 | 700 | 16 / — | — | Reusable style/token |
| [App/app/index.tsx:253](/Users/jabiullah/Documents/QuestLifeProject/App/app/index.tsx:253) | styles.nameContinueButtonText | Rubik Bold 700 | 900 | 15 / — | — | Reusable style/token |

### App/app/onboarding/about-you.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/app/onboarding/about-you.tsx:237](/Users/jabiullah/Documents/QuestLifeProject/App/app/onboarding/about-you.tsx:237) | styles.title | Rubik Black 900 | — | 23 / 28 | — | Reusable style/token |
| [App/app/onboarding/about-you.tsx:239](/Users/jabiullah/Documents/QuestLifeProject/App/app/onboarding/about-you.tsx:239) | styles.helper | Rubik Bold 700 | — | 13 / 18 | — | Reusable style/token |
| [App/app/onboarding/about-you.tsx:245](/Users/jabiullah/Documents/QuestLifeProject/App/app/onboarding/about-you.tsx:245) | styles.optionLabel | Rubik Regular 400 | 600 | 15.5 / 20 | — | Reusable style/token |
| [App/app/onboarding/about-you.tsx:253](/Users/jabiullah/Documents/QuestLifeProject/App/app/onboarding/about-you.tsx:253) | styles.continueText | Rubik Bold 700 | — | 15 / 20 | — | Reusable style/token |

### App/app/onboarding/claim-username.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/app/onboarding/claim-username.tsx:135](/Users/jabiullah/Documents/QuestLifeProject/App/app/onboarding/claim-username.tsx:135) | styles.title | Rubik Black 900 | — | 29 / 35 | — | Reusable style/token |
| [App/app/onboarding/claim-username.tsx:137](/Users/jabiullah/Documents/QuestLifeProject/App/app/onboarding/claim-username.tsx:137) | styles.body | Rubik Regular 400 | 700 | 16 / 22 | — | Reusable style/token |
| [App/app/onboarding/claim-username.tsx:140](/Users/jabiullah/Documents/QuestLifeProject/App/app/onboarding/claim-username.tsx:140) | styles.atSign | Rubik Bold 700 | — | 18 / 22 | — | Reusable style/token |
| [App/app/onboarding/claim-username.tsx:141](/Users/jabiullah/Documents/QuestLifeProject/App/app/onboarding/claim-username.tsx:141) | styles.input | Rubik Regular 400 | 700 | 17 / — | — | Reusable style/token |
| [App/app/onboarding/claim-username.tsx:142](/Users/jabiullah/Documents/QuestLifeProject/App/app/onboarding/claim-username.tsx:142) | styles.feedback | Rubik Bold 700 | — | 13 / 18 | — | Reusable style/token |
| [App/app/onboarding/claim-username.tsx:147](/Users/jabiullah/Documents/QuestLifeProject/App/app/onboarding/claim-username.tsx:147) | styles.continueText | Rubik Bold 700 | — | 15 / 20 | — | Reusable style/token |

### App/app/onboarding/follow-up-questions.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/app/onboarding/follow-up-questions.tsx:202](/Users/jabiullah/Documents/QuestLifeProject/App/app/onboarding/follow-up-questions.tsx:202) | styles.title | Rubik Black 900 | — | 23 / 28 | — | Reusable style/token |
| [App/app/onboarding/follow-up-questions.tsx:204](/Users/jabiullah/Documents/QuestLifeProject/App/app/onboarding/follow-up-questions.tsx:204) | styles.helper | Rubik Bold 700 | — | 13 / 18 | — | Reusable style/token |
| [App/app/onboarding/follow-up-questions.tsx:214](/Users/jabiullah/Documents/QuestLifeProject/App/app/onboarding/follow-up-questions.tsx:214) | styles.optionLabel | Rubik Regular 400 | 600 | 15.5 / 20 | — | Reusable style/token |
| [App/app/onboarding/follow-up-questions.tsx:219](/Users/jabiullah/Documents/QuestLifeProject/App/app/onboarding/follow-up-questions.tsx:219) | styles.continueText | Rubik Bold 700 | — | 15 / 20 | — | Reusable style/token |

### App/app/onboarding/frequency.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/app/onboarding/frequency.tsx:60](/Users/jabiullah/Documents/QuestLifeProject/App/app/onboarding/frequency.tsx:60) | styles.title | Rubik Black 900 | — | 23 / 28 | — | Reusable style/token |
| [App/app/onboarding/frequency.tsx:66](/Users/jabiullah/Documents/QuestLifeProject/App/app/onboarding/frequency.tsx:66) | styles.continueText | Rubik Bold 700 | — | 15 / 20 | — | Reusable style/token |

### App/app/onboarding/personalizing.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/app/onboarding/personalizing.tsx:243](/Users/jabiullah/Documents/QuestLifeProject/App/app/onboarding/personalizing.tsx:243) | styles.compassLabel | Rubik Bold 700 | 900 | 11 / — | — | Reusable style/token |
| [App/app/onboarding/personalizing.tsx:249](/Users/jabiullah/Documents/QuestLifeProject/App/app/onboarding/personalizing.tsx:249) | styles.percentage | Rubik Black 900 | — | 46 / 54 | — | Reusable style/token |
| [App/app/onboarding/personalizing.tsx:253](/Users/jabiullah/Documents/QuestLifeProject/App/app/onboarding/personalizing.tsx:253) | styles.completionCheck | Rubik Black 900 | — | 15 / 17 | — | Reusable style/token |
| [App/app/onboarding/personalizing.tsx:255](/Users/jabiullah/Documents/QuestLifeProject/App/app/onboarding/personalizing.tsx:255) | styles.status | Rubik Black 900 | — | 17 / 24 | — | Reusable style/token |
| [App/app/onboarding/personalizing.tsx:257](/Users/jabiullah/Documents/QuestLifeProject/App/app/onboarding/personalizing.tsx:257) | styles.rainbowDot | Rubik Black 900 | — | 24 / 24 | — | Reusable style/token |
| [App/app/onboarding/personalizing.tsx:260](/Users/jabiullah/Documents/QuestLifeProject/App/app/onboarding/personalizing.tsx:260) | styles.profileCompletionTitle | Rubik Black 900 | — | 24 / 29 | — | Reusable style/token |

### App/app/onboarding/questions-intro.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/app/onboarding/questions-intro.tsx:227](/Users/jabiullah/Documents/QuestLifeProject/App/app/onboarding/questions-intro.tsx:227) | styles.title | Rubik Black 900 | — | 23 / 28 | — | Reusable style/token |
| [App/app/onboarding/questions-intro.tsx:229](/Users/jabiullah/Documents/QuestLifeProject/App/app/onboarding/questions-intro.tsx:229) | styles.helper | Rubik Bold 700 | — | 13 / 18 | — | Reusable style/token |
| [App/app/onboarding/questions-intro.tsx:240](/Users/jabiullah/Documents/QuestLifeProject/App/app/onboarding/questions-intro.tsx:240) | styles.optionLabel | Rubik Regular 400 | 600 | 15.5 / 20 | — | Reusable style/token |
| [App/app/onboarding/questions-intro.tsx:245](/Users/jabiullah/Documents/QuestLifeProject/App/app/onboarding/questions-intro.tsx:245) | styles.continueText | Rubik Bold 700 | — | 15 / 20 | — | Reusable style/token |

### App/app/onboarding/questions-path.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/app/onboarding/questions-path.tsx:51](/Users/jabiullah/Documents/QuestLifeProject/App/app/onboarding/questions-path.tsx:51) | styles.title | Rubik Black 900 | — | 32 / 39 | — | Reusable style/token |
| [App/app/onboarding/questions-path.tsx:53](/Users/jabiullah/Documents/QuestLifeProject/App/app/onboarding/questions-path.tsx:53) | styles.body | Rubik Regular 400 | — | 17 / 26 | — | Reusable style/token |
| [App/app/onboarding/questions-path.tsx:55](/Users/jabiullah/Documents/QuestLifeProject/App/app/onboarding/questions-path.tsx:55) | styles.primaryButtonText | Rubik Bold 700 | — | 15 / 20 | — | Reusable style/token |

### App/app/onboarding/reassurance.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/app/onboarding/reassurance.tsx:165](/Users/jabiullah/Documents/QuestLifeProject/App/app/onboarding/reassurance.tsx:165) | styles.cardTitle | Rubik Bold 700 | — | 17 / 22 | — | Reusable style/token |
| [App/app/onboarding/reassurance.tsx:166](/Users/jabiullah/Documents/QuestLifeProject/App/app/onboarding/reassurance.tsx:166) | styles.cardDescription | Rubik Regular 400 | — | 13.5 / 18 | — | Reusable style/token |
| [App/app/onboarding/reassurance.tsx:168](/Users/jabiullah/Documents/QuestLifeProject/App/app/onboarding/reassurance.tsx:168) | styles.destinationEyebrow | Rubik Bold 700 | — | 14 / 19 | — | Reusable style/token |
| [App/app/onboarding/reassurance.tsx:171](/Users/jabiullah/Documents/QuestLifeProject/App/app/onboarding/reassurance.tsx:171) | styles.destinationTitle | Rubik Bold 700 | — | 17 / 22 | — | Reusable style/token |
| [App/app/onboarding/reassurance.tsx:173](/Users/jabiullah/Documents/QuestLifeProject/App/app/onboarding/reassurance.tsx:173) | styles.reassuranceTitle | Rubik Black 900 | — | 26 / 31 | — | Reusable style/token |
| [App/app/onboarding/reassurance.tsx:174](/Users/jabiullah/Documents/QuestLifeProject/App/app/onboarding/reassurance.tsx:174) | styles.reassuranceBody | Rubik Regular 400 | — | 16.5 / 22 | — | Reusable style/token |
| [App/app/onboarding/reassurance.tsx:177](/Users/jabiullah/Documents/QuestLifeProject/App/app/onboarding/reassurance.tsx:177) | styles.continueText | Rubik Bold 700 | — | 15 / 20 | — | Reusable style/token |

### App/components/activity-chart-card.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/components/activity-chart-card.tsx:46](/Users/jabiullah/Documents/QuestLifeProject/App/components/activity-chart-card.tsx:46) | ActivityChartCard / ActivityChartCard | Rubik Black 900 | — | 19 / 24 | — | {title} |
| [App/components/activity-chart-card.tsx:47](/Users/jabiullah/Documents/QuestLifeProject/App/components/activity-chart-card.tsx:47) | ActivityChartCard / ActivityChartCard | Rubik Regular 400 | 700 | 12 / 16 | — | Completed quests · last 7 days |
| [App/components/activity-chart-card.tsx:50](/Users/jabiullah/Documents/QuestLifeProject/App/components/activity-chart-card.tsx:50) | ActivityChartCard / ActivityChartCard | Rubik Black 900 | — | 25 / 29 | ["tabular-nums"] | {totalValue} |
| [App/components/activity-chart-card.tsx:51](/Users/jabiullah/Documents/QuestLifeProject/App/components/activity-chart-card.tsx:51) | ActivityChartCard / ActivityChartCard | Rubik Bold 700 | — | 10 / 13 | — | this week |
| [App/components/activity-chart-card.tsx:62](/Users/jabiullah/Documents/QuestLifeProject/App/components/activity-chart-card.tsx:62) | ActivityChartCard / ActivityChartCard | Rubik Bold 700 | — | 11 / 15 | — | {item.day} |
| [App/components/activity-chart-card.tsx:69](/Users/jabiullah/Documents/QuestLifeProject/App/components/activity-chart-card.tsx:69) | ActivityChartCard / ActivityChartCard | Rubik Regular 400 | 700 | 12 / 16 | — | Each bar is a day of completed quests. |

### App/components/album-sort-header.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/components/album-sort-header.tsx:40](/Users/jabiullah/Documents/QuestLifeProject/App/components/album-sort-header.tsx:40) | AlbumSortHeader / AlbumSortHeader | Rubik Regular 400 | 900 | 14 / — | — | Sort |
| [App/components/album-sort-header.tsx:45](/Users/jabiullah/Documents/QuestLifeProject/App/components/album-sort-header.tsx:45) | AlbumSortHeader / AlbumSortHeader | Rubik Regular 400 | 800 | 12 / — | — | {option.charAt(0).toUpperCase() + option.slice(1)} |

### App/components/album-viewer.ios.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/components/album-viewer.ios.tsx:52](/Users/jabiullah/Documents/QuestLifeProject/App/components/album-viewer.ios.tsx:52) | MainMedia / MainMedia | Rubik Bold 700 | — | — / — | — | Try again |
| [App/components/album-viewer.ios.tsx:118](/Users/jabiullah/Documents/QuestLifeProject/App/components/album-viewer.ios.tsx:118) | AlbumViewer / AlbumViewer | Rubik Bold 700 | — | 16 / — | — | {album.title} |
| [App/components/album-viewer.ios.tsx:126](/Users/jabiullah/Documents/QuestLifeProject/App/components/album-viewer.ios.tsx:126) | AlbumViewer / AlbumViewer | Rubik Regular 400 | — | 15 / — | — | {Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} |

### App/components/auth/AuthControls.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/components/auth/AuthControls.tsx:192](/Users/jabiullah/Documents/QuestLifeProject/App/components/auth/AuthControls.tsx:192) | styles.input | No family specified; default/inherited/merged | 700 | 15 / — | — | Reusable style/token |
| [App/components/auth/AuthControls.tsx:202](/Users/jabiullah/Documents/QuestLifeProject/App/components/auth/AuthControls.tsx:202) | styles.error | No family specified; default/inherited/merged | 800 | 12 / — | — | Reusable style/token |
| [App/components/auth/AuthControls.tsx:219](/Users/jabiullah/Documents/QuestLifeProject/App/components/auth/AuthControls.tsx:219) | styles.label | No family specified; default/inherited/merged | 900 | 12 / — | — | Reusable style/token |
| [App/components/auth/AuthControls.tsx:225](/Users/jabiullah/Documents/QuestLifeProject/App/components/auth/AuthControls.tsx:225) | styles.primaryLabel | No family specified; default/inherited/merged | 900 | 15 / — | — | Reusable style/token |
| [App/components/auth/AuthControls.tsx:242](/Users/jabiullah/Documents/QuestLifeProject/App/components/auth/AuthControls.tsx:242) | styles.outlineLabel | No family specified; default/inherited/merged | 900 | 14 / — | — | Reusable style/token |
| [App/components/auth/AuthControls.tsx:256](/Users/jabiullah/Documents/QuestLifeProject/App/components/auth/AuthControls.tsx:256) | styles.appleLabel | No family specified; default/inherited/merged | 900 | 16 / — | — | Reusable style/token |
| [App/components/auth/AuthControls.tsx:285](/Users/jabiullah/Documents/QuestLifeProject/App/components/auth/AuthControls.tsx:285) | styles.dividerText | Rubik Bold 700 | 800 | 12 / — | — | Reusable style/token |
| [App/components/auth/AuthControls.tsx:302](/Users/jabiullah/Documents/QuestLifeProject/App/components/auth/AuthControls.tsx:302) | styles.googleG | No family specified; default/inherited/merged | 900 | 13 / — | — | Reusable style/token |

### App/components/auth/AuthScaffold.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/components/auth/AuthScaffold.tsx:37](/Users/jabiullah/Documents/QuestLifeProject/App/components/auth/AuthScaffold.tsx:37) | AuthScaffold / AuthScaffold | Rubik Black 900 | — | 24 / — | — | QuestLife |
| [App/components/auth/AuthScaffold.tsx:37](/Users/jabiullah/Documents/QuestLifeProject/App/components/auth/AuthScaffold.tsx:37) | AuthScaffold / AuthScaffold | Rubik Black 900 | — | 38 / 46 | — | Make room for your next adventure. |
| [App/components/auth/AuthScaffold.tsx:37](/Users/jabiullah/Documents/QuestLifeProject/App/components/auth/AuthScaffold.tsx:37) | AuthScaffold / AuthScaffold | Rubik Regular 400 | — | 17 / 27 | — | Discover quests, keep the moments that matter, and share the journey with your crew. |

### App/components/auth/AuthText.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/components/auth/AuthText.tsx:27](/Users/jabiullah/Documents/QuestLifeProject/App/components/auth/AuthText.tsx:27) | styles.brand | No family specified; default/inherited/merged | 900 | 13 / — | — | Reusable style/token |
| [App/components/auth/AuthText.tsx:35](/Users/jabiullah/Documents/QuestLifeProject/App/components/auth/AuthText.tsx:35) | styles.title | No family specified; default/inherited/merged | 900 | 40 / 45 | — | Reusable style/token |
| [App/components/auth/AuthText.tsx:42](/Users/jabiullah/Documents/QuestLifeProject/App/components/auth/AuthText.tsx:42) | styles.subtitle | No family specified; default/inherited/merged | 700 | 14 / 22 | — | Reusable style/token |

### App/components/auth/OtpInput.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/components/auth/OtpInput.tsx:80](/Users/jabiullah/Documents/QuestLifeProject/App/components/auth/OtpInput.tsx:80) | styles.cellText | No family specified; default/inherited/merged | 900 | 20 / — | — | Reusable style/token |

### App/components/auth/PasswordStrength.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/components/auth/PasswordStrength.tsx:58](/Users/jabiullah/Documents/QuestLifeProject/App/components/auth/PasswordStrength.tsx:58) | styles.label | No family specified; default/inherited/merged | 900 | 11 / — | — | Reusable style/token |
| [App/components/auth/PasswordStrength.tsx:72](/Users/jabiullah/Documents/QuestLifeProject/App/components/auth/PasswordStrength.tsx:72) | styles.requirementText | No family specified; default/inherited/merged | 700 | 12 / — | — | Reusable style/token |

### App/components/avatar-pile.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/components/avatar-pile.tsx:40](/Users/jabiullah/Documents/QuestLifeProject/App/components/avatar-pile.tsx:40) | AvatarPile / AvatarPile | No family specified; default/inherited/merged | 900 | 9 / — | — | +{overflow} |

### App/components/global-announcement.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/components/global-announcement.tsx:77](/Users/jabiullah/Documents/QuestLifeProject/App/components/global-announcement.tsx:77) | GlobalAnnouncement / GlobalAnnouncement | No family specified; default/inherited/merged | 900 | 22 / — | — | {announcement?.title} |
| [App/components/global-announcement.tsx:78](/Users/jabiullah/Documents/QuestLifeProject/App/components/global-announcement.tsx:78) | GlobalAnnouncement / GlobalAnnouncement | No family specified; default/inherited/merged | 600 | 16 / 23 | — | {announcement?.body} |
| [App/components/global-announcement.tsx:80](/Users/jabiullah/Documents/QuestLifeProject/App/components/global-announcement.tsx:80) | GlobalAnnouncement / GlobalAnnouncement | No family specified; default/inherited/merged | 800 | — / — | — | {error} |
| [App/components/global-announcement.tsx:82](/Users/jabiullah/Documents/QuestLifeProject/App/components/global-announcement.tsx:82) | GlobalAnnouncement / GlobalAnnouncement | No family specified; default/inherited/merged | 900 | 16 / — | — | Got it |

### App/components/journal-album.ios.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/components/journal-album.ios.tsx:38](/Users/jabiullah/Documents/QuestLifeProject/App/components/journal-album.ios.tsx:38) | AlbumStrip | Rubik Black 900 | — | 18 / 22 | — | {album.title} |
| [App/components/journal-album.ios.tsx:39](/Users/jabiullah/Documents/QuestLifeProject/App/components/journal-album.ios.tsx:39) | AlbumStrip | Rubik Regular 400 | — | 11 / 16 | — | {new Date(album.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} |
| [App/components/journal-album.ios.tsx:59](/Users/jabiullah/Documents/QuestLifeProject/App/components/journal-album.ios.tsx:59) | AlbumStrip | Rubik Regular 400 | — | 22 / — | ["tabular-nums"] | +{geometry.extra} |

### App/components/journal-mood-check-in.ios.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/components/journal-mood-check-in.ios.tsx:248](/Users/jabiullah/Documents/QuestLifeProject/App/components/journal-mood-check-in.ios.tsx:248) | MoodForm / MoodForm | Rubik Bold 700 | — | — / — | — | +{successXp} XP gained |
| [App/components/journal-mood-check-in.ios.tsx:267](/Users/jabiullah/Documents/QuestLifeProject/App/components/journal-mood-check-in.ios.tsx:267) | MoodForm / MoodForm | No family specified; default/inherited/merged | 700 | — / — | — | Try again |
| [App/components/journal-mood-check-in.ios.tsx:295](/Users/jabiullah/Documents/QuestLifeProject/App/components/journal-mood-check-in.ios.tsx:295) | MoodCheckInCard / MoodCheckInCard | Rubik Bold 700 | — | 15 / — | — | {props.editable ? "Mood check-in" : `Feeling ${option?.label.toLowerCase()}`} |
| [App/components/journal-mood-check-in.ios.tsx:315](/Users/jabiullah/Documents/QuestLifeProject/App/components/journal-mood-check-in.ios.tsx:315) | styles.question | Rubik Regular 400 | — | 24 / 31 | — | Reusable style/token |
| [App/components/journal-mood-check-in.ios.tsx:316](/Users/jabiullah/Documents/QuestLifeProject/App/components/journal-mood-check-in.ios.tsx:316) | styles.word | Rubik Black 900 | — | 60 / — | — | Reusable style/token |
| [App/components/journal-mood-check-in.ios.tsx:318](/Users/jabiullah/Documents/QuestLifeProject/App/components/journal-mood-check-in.ios.tsx:318) | styles.tickLabel | Rubik Regular 400 | — | 16 / — | — | Reusable style/token |
| [App/components/journal-mood-check-in.ios.tsx:321](/Users/jabiullah/Documents/QuestLifeProject/App/components/journal-mood-check-in.ios.tsx:321) | styles.noteInput | Rubik Regular 400 | — | 15 / 21 | — | Reusable style/token |
| [App/components/journal-mood-check-in.ios.tsx:322](/Users/jabiullah/Documents/QuestLifeProject/App/components/journal-mood-check-in.ios.tsx:322) | styles.thanks | Rubik Bold 700 | — | 28 / 32 | — | Reusable style/token |
| [App/components/journal-mood-check-in.ios.tsx:323](/Users/jabiullah/Documents/QuestLifeProject/App/components/journal-mood-check-in.ios.tsx:323) | styles.message | Rubik Regular 400 | — | 15 / 21 | — | Reusable style/token |

### App/components/journal-mood-check-in.native.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/components/journal-mood-check-in.native.tsx:244](/Users/jabiullah/Documents/QuestLifeProject/App/components/journal-mood-check-in.native.tsx:244) | MoodForm / MoodForm | No family specified; default/inherited/merged | 700 | — / — | — | Try again |
| [App/components/journal-mood-check-in.native.tsx:254](/Users/jabiullah/Documents/QuestLifeProject/App/components/journal-mood-check-in.native.tsx:254) | MoodForm / MoodForm | Rubik Regular 400 | — | 13 / — | — | {loadingNote ? "Loading note…" : note ? "Edit note" : "Add note"} |
| [App/components/journal-mood-check-in.native.tsx:275](/Users/jabiullah/Documents/QuestLifeProject/App/components/journal-mood-check-in.native.tsx:275) | JournalMoodCheckIn / JournalMoodCheckIn | Rubik Bold 700 | — | 15 / — | — | {props.editable ? "Mood check-in" : `Feeling ${option?.label.toLowerCase()}`} |
| [App/components/journal-mood-check-in.native.tsx:286](/Users/jabiullah/Documents/QuestLifeProject/App/components/journal-mood-check-in.native.tsx:286) | styles.question | Rubik Regular 400 | — | 20 / 24 | — | Reusable style/token |
| [App/components/journal-mood-check-in.native.tsx:287](/Users/jabiullah/Documents/QuestLifeProject/App/components/journal-mood-check-in.native.tsx:287) | styles.word | Rubik Black 900 | — | 60 / — | — | Reusable style/token |
| [App/components/journal-mood-check-in.native.tsx:289](/Users/jabiullah/Documents/QuestLifeProject/App/components/journal-mood-check-in.native.tsx:289) | styles.tickLabel | Rubik Regular 400 | — | 13 / — | — | Reusable style/token |
| [App/components/journal-mood-check-in.native.tsx:292](/Users/jabiullah/Documents/QuestLifeProject/App/components/journal-mood-check-in.native.tsx:292) | styles.submitText | Rubik Regular 400 | — | 13 / — | — | Reusable style/token |
| [App/components/journal-mood-check-in.native.tsx:294](/Users/jabiullah/Documents/QuestLifeProject/App/components/journal-mood-check-in.native.tsx:294) | styles.noteInput | Rubik Regular 400 | — | 15 / 21 | — | Reusable style/token |
| [App/components/journal-mood-check-in.native.tsx:295](/Users/jabiullah/Documents/QuestLifeProject/App/components/journal-mood-check-in.native.tsx:295) | styles.thanks | Rubik Bold 700 | — | 28 / 32 | — | Reusable style/token |
| [App/components/journal-mood-check-in.native.tsx:296](/Users/jabiullah/Documents/QuestLifeProject/App/components/journal-mood-check-in.native.tsx:296) | styles.message | Rubik Regular 400 | — | 15 / 21 | — | Reusable style/token |

### App/components/lobby-design.ts

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/components/lobby-design.ts:38](/Users/jabiullah/Documents/QuestLifeProject/App/components/lobby-design.ts:38) | lobbyDesign.type.pageTitle | No family specified; default/inherited/merged | 900 | 30 / 36 | — | Reusable style/token |
| [App/components/lobby-design.ts:39](/Users/jabiullah/Documents/QuestLifeProject/App/components/lobby-design.ts:39) | lobbyDesign.type.sectionTitle | No family specified; default/inherited/merged | 900 | 18 / 24 | — | Reusable style/token |
| [App/components/lobby-design.ts:40](/Users/jabiullah/Documents/QuestLifeProject/App/components/lobby-design.ts:40) | lobbyDesign.type.cardTitle | No family specified; default/inherited/merged | 900 | 21 / 28 | — | Reusable style/token |
| [App/components/lobby-design.ts:41](/Users/jabiullah/Documents/QuestLifeProject/App/components/lobby-design.ts:41) | lobbyDesign.type.body | No family specified; default/inherited/merged | 700 | 16 / 22 | — | Reusable style/token |
| [App/components/lobby-design.ts:42](/Users/jabiullah/Documents/QuestLifeProject/App/components/lobby-design.ts:42) | lobbyDesign.type.supporting | No family specified; default/inherited/merged | 700 | 13 / 18 | — | Reusable style/token |
| [App/components/lobby-design.ts:43](/Users/jabiullah/Documents/QuestLifeProject/App/components/lobby-design.ts:43) | lobbyDesign.type.metadata | No family specified; default/inherited/merged | 800 | 12 / 16 | — | Reusable style/token |

### App/components/log-lore-flow.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/components/log-lore-flow.tsx:201](/Users/jabiullah/Documents/QuestLifeProject/App/components/log-lore-flow.tsx:201) | LogLoreFlow / LogLoreFlow | Rubik Bold 700 | — | 26 / 34 | — | How was your quest? |
| [App/components/log-lore-flow.tsx:202](/Users/jabiullah/Documents/QuestLifeProject/App/components/log-lore-flow.tsx:202) | LogLoreFlow / LogLoreFlow | Rubik Regular 400 | — | 16 / 23 | — | {quest.title} |
| [App/components/log-lore-flow.tsx:205](/Users/jabiullah/Documents/QuestLifeProject/App/components/log-lore-flow.tsx:205) | LogLoreFlow / LogLoreFlow | Rubik Bold 700 | — | 13 / — | — | Rate this quest |
| [App/components/log-lore-flow.tsx:207](/Users/jabiullah/Documents/QuestLifeProject/App/components/log-lore-flow.tsx:207) | LogLoreFlow / LogLoreFlow | Rubik Bold 700 | — | 13 / — | — | Please rate this quest to continue. |
| [App/components/log-lore-flow.tsx:209](/Users/jabiullah/Documents/QuestLifeProject/App/components/log-lore-flow.tsx:209) | LogLoreFlow / LogLoreFlow | Rubik Regular 400 | — | 13 / 19 | — | {error} |
| [App/components/log-lore-flow.tsx:211](/Users/jabiullah/Documents/QuestLifeProject/App/components/log-lore-flow.tsx:211) | LogLoreFlow / LogLoreFlow | Rubik Bold 700 | — | 14 / — | — | Back to summary |

### App/components/onboarding-intro.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/components/onboarding-intro.tsx:149](/Users/jabiullah/Documents/QuestLifeProject/App/components/onboarding-intro.tsx:149) | styles.introText | Rubik Black 900 | — | 21 / 31 | — | Reusable style/token |

### App/components/onboarding-understanding-demo.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/components/onboarding-understanding-demo.tsx:410](/Users/jabiullah/Documents/QuestLifeProject/App/components/onboarding-understanding-demo.tsx:410) | styles.title | Rubik Black 900 | — | — / — | — | Reusable style/token |
| [App/components/onboarding-understanding-demo.tsx:411](/Users/jabiullah/Documents/QuestLifeProject/App/components/onboarding-understanding-demo.tsx:411) | styles.subtitle | Rubik Bold 700 | — | 19 / 25 | — | Reusable style/token |

### App/components/profile-insights-dashboard.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/components/profile-insights-dashboard.tsx:37](/Users/jabiullah/Documents/QuestLifeProject/App/components/profile-insights-dashboard.tsx:37) | InsightTile / InsightTile | Rubik Black 900 | — | 22 / 27 | ["tabular-nums"] | {value} |
| [App/components/profile-insights-dashboard.tsx:38](/Users/jabiullah/Documents/QuestLifeProject/App/components/profile-insights-dashboard.tsx:38) | InsightTile / InsightTile | Rubik Bold 700 | — | 10 / 13 | — | {label} |
| [App/components/profile-insights-dashboard.tsx:38](/Users/jabiullah/Documents/QuestLifeProject/App/components/profile-insights-dashboard.tsx:38) | InsightTile / InsightTile | Rubik Regular 400 | 700 | 11 / 15 | — | {detail} |
| [App/components/profile-insights-dashboard.tsx:49](/Users/jabiullah/Documents/QuestLifeProject/App/components/profile-insights-dashboard.tsx:49) | ProfileInsightsDashboard / ProfileInsightsDashboard | Rubik Black 900 | — | 19 / 24 | — | This month |
| [App/components/profile-insights-dashboard.tsx:49](/Users/jabiullah/Documents/QuestLifeProject/App/components/profile-insights-dashboard.tsx:49) | ProfileInsightsDashboard / ProfileInsightsDashboard | Rubik Regular 400 | 700 | 12 / 17 | — | Keep your adventure rhythm going. |
| [App/components/profile-insights-dashboard.tsx:49](/Users/jabiullah/Documents/QuestLifeProject/App/components/profile-insights-dashboard.tsx:49) | ProfileInsightsDashboard / ProfileInsightsDashboard | Rubik Black 900 | — | 24 / 29 | ["tabular-nums"] | {insights.completedThisMonth}/{insights.monthlyGoal} |
| [App/components/profile-insights-dashboard.tsx:49](/Users/jabiullah/Documents/QuestLifeProject/App/components/profile-insights-dashboard.tsx:49) | ProfileInsightsDashboard / ProfileInsightsDashboard | Rubik Bold 700 | — | 10 / — | — | quest goal |
| [App/components/profile-insights-dashboard.tsx:63](/Users/jabiullah/Documents/QuestLifeProject/App/components/profile-insights-dashboard.tsx:63) | ProfileInsightsDashboard / ProfileInsightsDashboard | Rubik Black 900 | — | 19 / 24 | — | Your adventure mix |
| [App/components/profile-insights-dashboard.tsx:63](/Users/jabiullah/Documents/QuestLifeProject/App/components/profile-insights-dashboard.tsx:63) | ProfileInsightsDashboard / ProfileInsightsDashboard | Rubik Regular 400 | 700 | 12 / 17 | — | {insights.preferredTimeLabel ?? "Complete a quest to find your rhythm."} |
| [App/components/profile-insights-dashboard.tsx:66](/Users/jabiullah/Documents/QuestLifeProject/App/components/profile-insights-dashboard.tsx:66) | ProfileInsightsDashboard / ProfileInsightsDashboard | Rubik Bold 700 | — | 13 / 17 | — | {entry.category} |
| [App/components/profile-insights-dashboard.tsx:66](/Users/jabiullah/Documents/QuestLifeProject/App/components/profile-insights-dashboard.tsx:66) | ProfileInsightsDashboard / ProfileInsightsDashboard | Rubik Bold 700 | — | 12 / — | — | {entry.count} |
| [App/components/profile-insights-dashboard.tsx:67](/Users/jabiullah/Documents/QuestLifeProject/App/components/profile-insights-dashboard.tsx:67) | ProfileInsightsDashboard / ProfileInsightsDashboard | Rubik Regular 400 | 700 | 13 / 19 | — | Your category mix will appear after your first completed quest. |
| [App/components/profile-insights-dashboard.tsx:71](/Users/jabiullah/Documents/QuestLifeProject/App/components/profile-insights-dashboard.tsx:71) | ProfileInsightsDashboard / ProfileInsightsDashboard | Rubik Black 900 | — | 19 / 24 | — | Four-week rhythm |
| [App/components/profile-insights-dashboard.tsx:71](/Users/jabiullah/Documents/QuestLifeProject/App/components/profile-insights-dashboard.tsx:71) | ProfileInsightsDashboard / ProfileInsightsDashboard | Rubik Regular 400 | 700 | 12 / 17 | — | Completed quests by week. |
| [App/components/profile-insights-dashboard.tsx:72](/Users/jabiullah/Documents/QuestLifeProject/App/components/profile-insights-dashboard.tsx:72) | ProfileInsightsDashboard / ProfileInsightsDashboard | Rubik Bold 700 | — | 10 / 13 | — | {week.label} |
| [App/components/profile-insights-dashboard.tsx:73](/Users/jabiullah/Documents/QuestLifeProject/App/components/profile-insights-dashboard.tsx:73) | ProfileInsightsDashboard / ProfileInsightsDashboard | Rubik Bold 700 | — | 10 / — | — | {entry.difficulty} |
| [App/components/profile-insights-dashboard.tsx:73](/Users/jabiullah/Documents/QuestLifeProject/App/components/profile-insights-dashboard.tsx:73) | ProfileInsightsDashboard / ProfileInsightsDashboard | Rubik Bold 700 | — | 10 / — | — | {entry.count} |

### App/components/quest-activity-ui.ios.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/components/quest-activity-ui.ios.tsx:22](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-activity-ui.ios.tsx:22) | QuestSectionPlaceholder / QuestSectionPlaceholder | Rubik Bold 700 | — | 15 / — | — | {title} |
| [App/components/quest-activity-ui.ios.tsx:22](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-activity-ui.ios.tsx:22) | QuestSectionPlaceholder / QuestSectionPlaceholder | Rubik Regular 400 | — | 13 / 19 | — | {detail} |
| [App/components/quest-activity-ui.ios.tsx:63](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-activity-ui.ios.tsx:63) | QuestNotification / QuestNotification | Rubik Bold 700 | — | 11 / — | — | Open |
| [App/components/quest-activity-ui.ios.tsx:64](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-activity-ui.ios.tsx:64) | QuestNotification / QuestNotification | Rubik Bold 700 | — | 11 / — | — | Dismiss |
| [App/components/quest-activity-ui.ios.tsx:67](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-activity-ui.ios.tsx:67) | QuestNotification / QuestNotification | Rubik Bold 700 | — | 15 / — | — | {title} |
| [App/components/quest-activity-ui.ios.tsx:67](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-activity-ui.ios.tsx:67) | QuestNotification / QuestNotification | Rubik Regular 400 | — | 13 / 18 | — | {detail} |
| [App/components/quest-activity-ui.ios.tsx:67](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-activity-ui.ios.tsx:67) | QuestNotification / QuestNotification | Rubik Bold 700 | — | 11 / — | ["tabular-nums"] | {countdown} left |
| [App/components/quest-activity-ui.ios.tsx:79](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-activity-ui.ios.tsx:79) | QuestVideoMoment / QuestVideoMoment | Rubik Bold 700 | — | 11 / — | — | {event.uri ? `${Math.ceil(event.durationSeconds ?? 0)}s` : "Unavailable"} |

### App/components/quest-camera.ios.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/components/quest-camera.ios.tsx:117](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-camera.ios.tsx:117) | QuestCamera / QuestCamera | Rubik Bold 700 | — | 16 / — | — | {capture ? "Your quest moment" : recording ? `● ${seconds}s / 30s` : "Capture a moment"} |
| [App/components/quest-camera.ios.tsx:133](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-camera.ios.tsx:133) | QuestCamera / QuestCamera | Rubik Bold 700 | — | — / — | — | Add more |
| [App/components/quest-camera.ios.tsx:134](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-camera.ios.tsx:134) | QuestCamera / QuestCamera | Rubik Bold 700 | — | — / — | — | {busy ? "Saving…" : "Save moment"} |
| [App/components/quest-camera.ios.tsx:139](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-camera.ios.tsx:139) | QuestCamera / QuestCamera | Rubik Regular 400 | — | — / — | — | Allow camera access to capture your quest. |
| [App/components/quest-camera.ios.tsx:139](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-camera.ios.tsx:139) | QuestCamera / QuestCamera | Rubik Bold 700 | — | — / — | — | Allow camera |
| [App/components/quest-camera.ios.tsx:143](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-camera.ios.tsx:143) | QuestCamera / QuestCamera | Rubik Bold 700 | — | — / — | — | {value === "picture" ? "Photo" : "Video"} |
| [App/components/quest-camera.ios.tsx:149](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-camera.ios.tsx:149) | QuestCamera / QuestCamera | Rubik Bold 700 | — | — / — | — | Done · {captures.length} captured |

### App/components/quest-comments-sheet.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/components/quest-comments-sheet.tsx:80](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-comments-sheet.tsx:80) | QuestCommentsSheet / QuestCommentsSheet | No family specified; default/inherited/merged | 900 | 18 / — | — | Comments |
| [App/components/quest-comments-sheet.tsx:87](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-comments-sheet.tsx:87) | QuestCommentsSheet / QuestCommentsSheet | No family specified; default/inherited/merged | 900 | 13 / — | — | @{comment.username ?? comment.displayName.replace(/\s+/g, "").toLowerCase()} |
| [App/components/quest-comments-sheet.tsx:88](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-comments-sheet.tsx:88) | QuestCommentsSheet / QuestCommentsSheet | No family specified; default/inherited/merged | 600 | 14 / 20 | — | {comment.body} |
| [App/components/quest-comments-sheet.tsx:90](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-comments-sheet.tsx:90) | QuestCommentsSheet / QuestCommentsSheet | No family specified; default/inherited/merged | 900 | 11 / — | — | Reply |
| [App/components/quest-comments-sheet.tsx:91](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-comments-sheet.tsx:91) | QuestCommentsSheet / QuestCommentsSheet | No family specified; default/inherited/merged | 900 | 11 / — | — | {deletingCommentId === comment.id ? "Deleting…" : "Delete"} |
| [App/components/quest-comments-sheet.tsx:98](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-comments-sheet.tsx:98) | QuestCommentsSheet / QuestCommentsSheet | No family specified; default/inherited/merged | 900 | 12 / — | — | @{reply.username ?? reply.displayName.replace(/\s+/g, "").toLowerCase()} |
| [App/components/quest-comments-sheet.tsx:99](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-comments-sheet.tsx:99) | QuestCommentsSheet / QuestCommentsSheet | No family specified; default/inherited/merged | 600 | 13 / 18 | — | {reply.body} |
| [App/components/quest-comments-sheet.tsx:100](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-comments-sheet.tsx:100) | QuestCommentsSheet / QuestCommentsSheet | No family specified; default/inherited/merged | 900 | 11 / — | — | {deletingCommentId === reply.id ? "Deleting…" : "Delete"} |
| [App/components/quest-comments-sheet.tsx:103](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-comments-sheet.tsx:103) | QuestCommentsSheet / QuestCommentsSheet | No family specified; default/inherited/merged | 700 | 14 / — | — | Start the conversation. |
| [App/components/quest-comments-sheet.tsx:106](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-comments-sheet.tsx:106) | QuestCommentsSheet / QuestCommentsSheet | No family specified; default/inherited/merged | 800 | 11 / — | — | {replyTo ? `Replying to @${replyTo.username ?? replyTo.displayName}` : "Add a comment"} |
| [App/components/quest-comments-sheet.tsx:108](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-comments-sheet.tsx:108) | QuestCommentsSheet / QuestCommentsSheet | No family specified; default/inherited/merged | 600 | — / — | — | <TextInput value={draft} onChangeText={setDraft} placeholder="Write a comment…" placeholderTextColor={T.muted} multiline style={{ flex: 1, minHeight:  |

### App/components/quest-completion-effects.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/components/quest-completion-effects.tsx:78](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-completion-effects.tsx:78) | RewardHeading / typography | Rubik Bold 700 | — | intro ? 32 : 26 / intro ? 39 : 34 | — | Reusable style/token |

### App/components/quest-completion-scene.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/components/quest-completion-scene.tsx:182](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-completion-scene.tsx:182) | QuestCompletionScene / QuestCompletionScene | Rubik Regular 400 | — | 12 / 18 | — | {questTitle} |
| [App/components/quest-completion-scene.tsx:213](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-completion-scene.tsx:213) | styles.subtitle | Rubik Regular 400 | — | 17 / 24 | — | Reusable style/token |
| [App/components/quest-completion-scene.tsx:219](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-completion-scene.tsx:219) | styles.statLabel | Rubik Bold 700 | — | 9 / 13 | — | Reusable style/token |
| [App/components/quest-completion-scene.tsx:221](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-completion-scene.tsx:221) | styles.statValue | Rubik Bold 700 | — | 18 / — | ["tabular-nums"] | Reusable style/token |
| [App/components/quest-completion-scene.tsx:226](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-completion-scene.tsx:226) | styles.error | Rubik Regular 400 | — | 13 / 19 | — | Reusable style/token |

### App/components/quest-feed-card.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/components/quest-feed-card.tsx:43](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-feed-card.tsx:43) | CompletionStatus / CompletionStatus | No family specified; default/inherited/merged | 700 | 11 / 15 | — | Gave a rating of |
| [App/components/quest-feed-card.tsx:43](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-feed-card.tsx:43) | CompletionStatus / CompletionStatus | No family specified; default/inherited/merged | 700 | 11 / 15 | — | Finished in |
| [App/components/quest-feed-card.tsx:43](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-feed-card.tsx:43) | CompletionStatus / CompletionStatus | No family specified; default/inherited/merged | 900 | 11 / 15 | ["tabular-nums"] | {formatPostDurationLabel(durationSeconds!)} |
| [App/components/quest-feed-card.tsx:51](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-feed-card.tsx:51) | FeedEngagement / FeedEngagement | No family specified; default/inherited/merged | 900 | 13 / 16 | ["tabular-nums"] | {post.likeCount} |
| [App/components/quest-feed-card.tsx:60](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-feed-card.tsx:60) | PostActionBar / PostActionBar | No family specified; default/inherited/merged | 900 | 13 / 16 | ["tabular-nums"] | {commentCount} |
| [App/components/quest-feed-card.tsx:65](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-feed-card.tsx:65) | PhotoCarousel / PhotoCarousel | No family specified; default/inherited/merged | 900 | 11 / — | ["tabular-nums"] | {page + 1}/{urls.length} |
| [App/components/quest-feed-card.tsx:70](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-feed-card.tsx:70) | FeedMedia / FeedMedia | No family specified; default/inherited/merged | 900 | 19 / 26 | — | {post.postTitle?.trim() \|\| post.questTitle} |
| [App/components/quest-feed-card.tsx:70](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-feed-card.tsx:70) | FeedMedia / FeedMedia | No family specified; default/inherited/merged | 600 | 14 / 20 | — | {description} |
| [App/components/quest-feed-card.tsx:71](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-feed-card.tsx:71) | FeedMedia / FeedMedia | No family specified; default/inherited/merged | 900 | 18 / 25 | — | {post.postTitle?.trim() \|\| post.questTitle} |
| [App/components/quest-feed-card.tsx:71](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-feed-card.tsx:71) | FeedMedia / FeedMedia | No family specified; default/inherited/merged | 600 | 14 / 21 | — | {description} |
| [App/components/quest-feed-card.tsx:115](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-feed-card.tsx:115) | QuestFeedCard / QuestFeedCard | No family specified; default/inherited/merged | 900 | 13 / — | — | {displayProfileName(managedPost.displayName, managedPost.firstName)} |
| [App/components/quest-feed-card.tsx:115](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-feed-card.tsx:115) | QuestFeedCard / QuestFeedCard | No family specified; default/inherited/merged | 700 | 11 / 14 | — | {postedAt} |
| [App/components/quest-feed-card.tsx:118](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-feed-card.tsx:118) | QuestFeedThumbnail / QuestFeedThumbnail | No family specified; default/inherited/merged | 900 | 11 / 13 | — | {post.postTitle?.trim() \|\| post.questTitle} |

### App/components/quest-journey.ios.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/components/quest-journey.ios.tsx:31](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-journey.ios.tsx:31) | QuestMoodGraph / QuestMoodGraph | Rubik Bold 700 | — | 18 / — | — | Your mood journey |
| [App/components/quest-journey.ios.tsx:38](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-journey.ios.tsx:38) | QuestMoodGraph / QuestMoodGraph | Rubik Regular 400 | — | 11 / — | — | {label} |
| [App/components/quest-journey.ios.tsx:40](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-journey.ios.tsx:40) | QuestMoodGraph / QuestMoodGraph | Rubik Regular 400 | — | — / — | — | {labels[focused.mood!]} · {focused.activeElapsedMs === 0 ? "At the start" : `${Math.floor(focused.activeElapsedMs / 60000)} active minutes`} |
| [App/components/quest-journey.ios.tsx:42](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-journey.ios.tsx:42) | QuestMoodGraph / QuestMoodGraph | Rubik Bold 700 | — | 12 / — | — | {Math.floor(e.activeElapsedMs / 60000)}m · {labels[e.mood!]} |
| [App/components/quest-journey.ios.tsx:52](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-journey.ios.tsx:52) | QuestJourneyVideos / QuestJourneyVideos | Rubik Black 900 | — | 20 / — | — | {recent ? "Recent videos" : "Video moments"} |
| [App/components/quest-journey.ios.tsx:52](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-journey.ios.tsx:52) | QuestJourneyVideos / QuestJourneyVideos | Rubik Bold 700 | — | 12 / — | — | {loading ? "Loading…" : videos.length ? `${videos.length} captured` : "No videos yet"} |
| [App/components/quest-journey.ios.tsx:60](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-journey.ios.tsx:60) | QuestTimelineXpPill / QuestTimelineXpPill | Rubik Bold 700 | — | 10 / — | — | {pending ? "XP pending" : `+${event.xp} XP`} |
| [App/components/quest-journey.ios.tsx:67](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-journey.ios.tsx:67) | QuestJourneyTimelineRow / QuestJourneyTimelineRow | No family specified; default/inherited/merged | 900 | 11 / 15 | — | {new Date(event.capturedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} |
| [App/components/quest-journey.ios.tsx:70](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-journey.ios.tsx:70) | QuestJourneyTimelineRow / QuestJourneyTimelineRow | Rubik Bold 700 | — | 11 / 15 | — | {label} |
| [App/components/quest-journey.ios.tsx:71](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-journey.ios.tsx:71) | QuestJourneyTimelineRow / QuestJourneyTimelineRow | Rubik Regular 400 | — | 16 / 23 | — | {event.body} |
| [App/components/quest-journey.ios.tsx:71](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-journey.ios.tsx:71) | QuestJourneyTimelineRow / QuestJourneyTimelineRow | Rubik Regular 400 | — | 16 / — | — | Feeling {event.mood ? labels[event.mood].toLowerCase() : "checked in"} |
| [App/components/quest-journey.ios.tsx:116](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-journey.ios.tsx:116) | QuestJourneyPanel / QuestJourneyPanel | Rubik Regular 400 | — | 12 / — | — | Sync / XP pending |
| [App/components/quest-journey.ios.tsx:116](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-journey.ios.tsx:116) | QuestJourneyPanel / QuestJourneyPanel | Rubik Bold 700 | — | — / — | — | {retrying ? "Syncing…" : "Retry"} |
| [App/components/quest-journey.ios.tsx:138](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-journey.ios.tsx:138) | CompletedQuestJourney / CompletedQuestJourney | Rubik Regular 400 | — | — / — | — | +{journey.events.reduce((sum, e) => sum + e.xp, 0)} activity bonus XP earned during this quest |

### App/components/quest-post-management-sheet.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/components/quest-post-management-sheet.tsx:25](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-post-management-sheet.tsx:25) | ActionRow / ActionRow | Rubik Bold 700 | — | 15 / — | — | {label} |
| [App/components/quest-post-management-sheet.tsx:25](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-post-management-sheet.tsx:25) | ActionRow / ActionRow | Rubik Regular 400 | — | 12 / 16 | — | {detail} |
| [App/components/quest-post-management-sheet.tsx:108](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-post-management-sheet.tsx:108) | QuestPostManagementSheet / QuestPostManagementSheet | Rubik Black 900 | — | 23 / — | — | Manage post |
| [App/components/quest-post-management-sheet.tsx:108](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-post-management-sheet.tsx:108) | QuestPostManagementSheet / QuestPostManagementSheet | Rubik Regular 400 | — | 13 / — | — | {post.postTitle ?? post.questTitle} |
| [App/components/quest-post-management-sheet.tsx:109](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-post-management-sheet.tsx:109) | QuestPostManagementSheet / QuestPostManagementSheet | Rubik Bold 700 | — | 12 / — | — | {error} |
| [App/components/quest-post-management-sheet.tsx:116](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-post-management-sheet.tsx:116) | QuestPostManagementSheet / QuestPostManagementSheet | Rubik Black 900 | — | 19 / — | — | Edit post |
| [App/components/quest-post-management-sheet.tsx:117](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-post-management-sheet.tsx:117) | QuestPostManagementSheet / QuestPostManagementSheet | Rubik Bold 700 | — | 15 / — | — | {saving ? "Saving…" : "Save"} |
| [App/components/quest-post-management-sheet.tsx:120](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-post-management-sheet.tsx:120) | QuestPostManagementSheet / QuestPostManagementSheet | Rubik Bold 700 | — | 11 / — | — | Title |
| [App/components/quest-post-management-sheet.tsx:120](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-post-management-sheet.tsx:120) | QuestPostManagementSheet / QuestPostManagementSheet | Rubik Bold 700 | — | 16 / — | — | <TextInput value={title} onChangeText={setTitle} maxLength={120} placeholder="Post title" placeholderTextColor={T.muted} style={{ minHeight: 54, borde |
| [App/components/quest-post-management-sheet.tsx:121](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-post-management-sheet.tsx:121) | QuestPostManagementSheet / QuestPostManagementSheet | Rubik Bold 700 | — | 11 / — | — | Description |
| [App/components/quest-post-management-sheet.tsx:121](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-post-management-sheet.tsx:121) | QuestPostManagementSheet / QuestPostManagementSheet | Rubik Regular 400 | — | 14 / 20 | — | <TextInput value={caption} onChangeText={setCaption} maxLength={1_000} multiline textAlignVertical="top" placeholder="What do you want to share?" plac |
| [App/components/quest-post-management-sheet.tsx:122](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-post-management-sheet.tsx:122) | QuestPostManagementSheet / QuestPostManagementSheet | Rubik Bold 700 | — | 11 / — | — | Photos |
| [App/components/quest-post-management-sheet.tsx:122](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-post-management-sheet.tsx:122) | QuestPostManagementSheet / QuestPostManagementSheet | Rubik Bold 700 | — | 11 / — | — | {photos.length}/4 |
| [App/components/quest-post-management-sheet.tsx:122](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-post-management-sheet.tsx:122) | QuestPostManagementSheet / QuestPostManagementSheet | Rubik Bold 700 | — | 13 / — | — | Add photo |
| [App/components/quest-post-management-sheet.tsx:123](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-post-management-sheet.tsx:123) | QuestPostManagementSheet / QuestPostManagementSheet | Rubik Bold 700 | — | 11 / — | — | Who can see this? |
| [App/components/quest-post-management-sheet.tsx:123](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-post-management-sheet.tsx:123) | QuestPostManagementSheet / QuestPostManagementSheet | Rubik Bold 700 | — | 11 / — | — | {option.label} |
| [App/components/quest-post-management-sheet.tsx:124](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-post-management-sheet.tsx:124) | QuestPostManagementSheet / QuestPostManagementSheet | Rubik Bold 700 | — | 12 / 17 | — | {error} |

### App/components/quest-save-sheet.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/components/quest-save-sheet.tsx:57](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-save-sheet.tsx:57) | RaisedCollectionButton / RaisedCollectionButton | Rubik Bold 700 | — | 15 / — | — | START A COLLECTION |
| [App/components/quest-save-sheet.tsx:220](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-save-sheet.tsx:220) | QuestSaveSheet / QuestSaveSheet | Rubik Black 900 | — | 23 / 28 | — | Save quest |
| [App/components/quest-save-sheet.tsx:221](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-save-sheet.tsx:221) | QuestSaveSheet / QuestSaveSheet | Rubik Bold 700 | — | 13 / 18 | — | {quest.title} |
| [App/components/quest-save-sheet.tsx:224](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-save-sheet.tsx:224) | QuestSaveSheet / QuestSaveSheet | Rubik Bold 700 | — | 15 / — | — | {savingState ? "Saving…" : "Save"} |
| [App/components/quest-save-sheet.tsx:233](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-save-sheet.tsx:233) | QuestSaveSheet / QuestSaveSheet | Rubik Black 900 | — | 16 / — | — | Saved Quests |
| [App/components/quest-save-sheet.tsx:234](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-save-sheet.tsx:234) | QuestSaveSheet / QuestSaveSheet | Rubik Bold 700 | — | 12 / — | — | Private · available in My Stuff |
| [App/components/quest-save-sheet.tsx:252](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-save-sheet.tsx:252) | QuestSaveSheet / QuestSaveSheet | Rubik Black 900 | — | 16 / — | — | Add to a collection |
| [App/components/quest-save-sheet.tsx:254](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-save-sheet.tsx:254) | QuestSaveSheet / QuestSaveSheet | Rubik Bold 700 | — | 13 / — | — | New collection |
| [App/components/quest-save-sheet.tsx:281](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-save-sheet.tsx:281) | QuestSaveSheet / QuestSaveSheet | Rubik Black 900 | — | 15 / — | — | {pack.title} |
| [App/components/quest-save-sheet.tsx:282](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-save-sheet.tsx:282) | QuestSaveSheet / QuestSaveSheet | Rubik Bold 700 | — | 12 / — | — | {pack.questIds.length} {pack.questIds.length === 1 ? "quest" : "quests"} |
| [App/components/quest-save-sheet.tsx:292](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-save-sheet.tsx:292) | QuestSaveSheet / QuestSaveSheet | Rubik Black 900 | — | 22 / 27 | — | Collect the quests you want to try |
| [App/components/quest-save-sheet.tsx:293](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-save-sheet.tsx:293) | QuestSaveSheet / QuestSaveSheet | Rubik Regular 400 | — | 14 / 20 | — | Save quests into private collections for future adventures, goals, and ideas. |
| [App/components/quest-save-sheet.tsx:301](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-save-sheet.tsx:301) | QuestSaveSheet / QuestSaveSheet | Rubik Bold 700 | — | 13 / 18 | — | {error} |
| [App/components/quest-save-sheet.tsx:307](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-save-sheet.tsx:307) | QuestSaveSheet / QuestSaveSheet | Rubik Bold 700 | — | 15 / — | — | Cancel |
| [App/components/quest-save-sheet.tsx:309](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-save-sheet.tsx:309) | QuestSaveSheet / QuestSaveSheet | Rubik Black 900 | — | 18 / — | — | New collection |
| [App/components/quest-save-sheet.tsx:311](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-save-sheet.tsx:311) | QuestSaveSheet / QuestSaveSheet | Rubik Bold 700 | — | 15 / — | — | {creating ? "Saving…" : "Save"} |
| [App/components/quest-save-sheet.tsx:320](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-save-sheet.tsx:320) | QuestSaveSheet / QuestSaveSheet | Rubik Bold 700 | — | 12 / — | — | Adding “{quest.title}” |
| [App/components/quest-save-sheet.tsx:321](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-save-sheet.tsx:321) | QuestSaveSheet / QuestSaveSheet | Rubik Bold 700 | — | 13 / — | — | {coverUri ? "Change cover photo" : "Add an optional cover photo"} |
| [App/components/quest-save-sheet.tsx:337](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-save-sheet.tsx:337) | QuestSaveSheet / QuestSaveSheet | Rubik Regular 400 | — | 16 / — | — | <TextInput autoFocus value={collectionName} onChangeText={setCollectionName} onFocus={() => setInputFocused(true)} onBlur={() => setInputFocused(false |
| [App/components/quest-save-sheet.tsx:343](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-save-sheet.tsx:343) | QuestSaveSheet / QuestSaveSheet | Rubik Regular 400 | — | 12 / 18 | — | Collections are private. This quest will remain in Saved Quests too. |
| [App/components/quest-save-sheet.tsx:344](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-save-sheet.tsx:344) | QuestSaveSheet / QuestSaveSheet | Rubik Bold 700 | — | 13 / 18 | — | {error} |

### App/components/quest-start-block.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/components/quest-start-block.tsx:35](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-start-block.tsx:35) | QuestStartBlockSheet / QuestStartBlockSheet | No family specified; default/inherited/merged | 900 | 20 / — | — | Daily limit reached |
| [App/components/quest-start-block.tsx:36](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-start-block.tsx:36) | QuestStartBlockSheet / QuestStartBlockSheet | No family specified; default/inherited/merged | 700 | — / 20 | — | You've used all 5 quests for today. Your energy resets at midnight — rest up and come back tomorrow! |
| [App/components/quest-start-block.tsx:50](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-start-block.tsx:50) | QuestStartBlockSheet / QuestStartBlockSheet | Rubik Bold 700 | — | 11 / 15 | — | {block.quest.category} |
| [App/components/quest-start-block.tsx:51](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-start-block.tsx:51) | QuestStartBlockSheet / QuestStartBlockSheet | Rubik Black 900 | — | 24 / 30 | — | Give it another go? |
| [App/components/quest-start-block.tsx:52](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-start-block.tsx:52) | QuestStartBlockSheet / QuestStartBlockSheet | Rubik Regular 400 | 700 | 14 / 20 | — | Repeat this quest for {block.repeatXp} XP. {presentation.encouragement} |
| [App/components/quest-start-block.tsx:71](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-start-block.tsx:71) | QuestStartBlockSheet / QuestStartBlockSheet | Rubik Black 900 | — | 24 / 30 | — | {requestedQuest ? "A quest is active right now" : "An unfinished quest was found"} |
| [App/components/quest-start-block.tsx:72](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-start-block.tsx:72) | QuestStartBlockSheet / QuestStartBlockSheet | Rubik Regular 400 | 700 | 14 / 20 | — | {requestedQuest ? `Abandon your active quest and start “${requestedQuest.title}” instead?` : `${block.quest ? `${block.quest.title} is still active.`  |
| [App/components/quest-start-block.tsx:83](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-start-block.tsx:83) | QuestStartBlockSheet / QuestStartBlockSheet | No family specified; default/inherited/merged | 900 | — / — | — | {block.message} |

### App/components/quest-start-countdown.ios.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/components/quest-start-countdown.ios.tsx:77](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-start-countdown.ios.tsx:77) | QuestStartCountdown / QuestStartCountdown | Rubik Bold 700 | — | — / — | — | Try again |
| [App/components/quest-start-countdown.ios.tsx:79](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-start-countdown.ios.tsx:79) | QuestStartCountdown / QuestStartCountdown | Rubik Regular 400 | — | 12 / — | — | A little focus. A new adventure. |
| [App/components/quest-start-countdown.ios.tsx:85](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-start-countdown.ios.tsx:85) | styles.eyebrow | Rubik Bold 700 | — | 12 / — | — | Reusable style/token |
| [App/components/quest-start-countdown.ios.tsx:86](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-start-countdown.ios.tsx:86) | styles.title | Rubik Regular 400 | — | 18 / 24 | — | Reusable style/token |
| [App/components/quest-start-countdown.ios.tsx:87](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-start-countdown.ios.tsx:87) | styles.number | Rubik Black 900 | — | — / — | — | Reusable style/token |
| [App/components/quest-start-countdown.ios.tsx:88](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-start-countdown.ios.tsx:88) | styles.caption | Rubik Bold 700 | — | 22 / — | — | Reusable style/token |

### App/components/quest-start-countdown.native.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/components/quest-start-countdown.native.tsx:64](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-start-countdown.native.tsx:64) | QuestStartCountdown / QuestStartCountdown | Rubik Regular 400 | — | 12 / — | — | A little focus. A new adventure. |
| [App/components/quest-start-countdown.native.tsx:70](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-start-countdown.native.tsx:70) | styles.eyebrow | Rubik Bold 700 | — | 12 / — | — | Reusable style/token |
| [App/components/quest-start-countdown.native.tsx:71](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-start-countdown.native.tsx:71) | styles.title | Rubik Regular 400 | — | 18 / 24 | — | Reusable style/token |
| [App/components/quest-start-countdown.native.tsx:72](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-start-countdown.native.tsx:72) | styles.number | Rubik Black 900 | — | — / — | — | Reusable style/token |
| [App/components/quest-start-countdown.native.tsx:73](/Users/jabiullah/Documents/QuestLifeProject/App/components/quest-start-countdown.native.tsx:73) | styles.caption | Rubik Bold 700 | — | 22 / — | — | Reusable style/token |

### App/components/required-profile-name.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/components/required-profile-name.tsx:121](/Users/jabiullah/Documents/QuestLifeProject/App/components/required-profile-name.tsx:121) | styles.body | No family specified; default/inherited/merged | 600 | 14 / 21 | — | Reusable style/token |
| [App/components/required-profile-name.tsx:123](/Users/jabiullah/Documents/QuestLifeProject/App/components/required-profile-name.tsx:123) | styles.eyebrow | No family specified; default/inherited/merged | 900 | 11 / — | — | Reusable style/token |
| [App/components/required-profile-name.tsx:124](/Users/jabiullah/Documents/QuestLifeProject/App/components/required-profile-name.tsx:124) | styles.input | No family specified; default/inherited/merged | 700 | 16 / — | — | Reusable style/token |
| [App/components/required-profile-name.tsx:125](/Users/jabiullah/Documents/QuestLifeProject/App/components/required-profile-name.tsx:125) | styles.title | Rubik Bold 700 | — | 25 / — | — | Reusable style/token |

### App/components/streak-pill.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/components/streak-pill.tsx:40](/Users/jabiullah/Documents/QuestLifeProject/App/components/streak-pill.tsx:40) | StreakPill / StreakPill | No family specified; default/inherited/merged | 900 | 14 / — | ["tabular-nums"] | {count} |

### App/components/ui.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/components/ui.tsx:298](/Users/jabiullah/Documents/QuestLifeProject/App/components/ui.tsx:298) | SoftButton / SoftButton | Rubik Bold 700 | — | 15 / 20 | — | {label} |
| [App/components/ui.tsx:364](/Users/jabiullah/Documents/QuestLifeProject/App/components/ui.tsx:364) | IconButton / IconButton | No family specified; default/inherited/merged | 900 | 10 / — | — | {badge} |
| [App/components/ui.tsx:375](/Users/jabiullah/Documents/QuestLifeProject/App/components/ui.tsx:375) | Tag / Tag | No family specified; default/inherited/merged | 900 | 10 / — | — | {label} |
| [App/components/ui.tsx:384](/Users/jabiullah/Documents/QuestLifeProject/App/components/ui.tsx:384) | PillStat / PillStat | No family specified; default/inherited/merged | 900 | 12 / — | — | {text} |
| [App/components/ui.tsx:546](/Users/jabiullah/Documents/QuestLifeProject/App/components/ui.tsx:546) | SearchInput / SearchInput | Rubik Regular 400 | — | 15 / 20 | — | <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} accessibilityLabel={placeholder} placeholderTextColor={T.muted} style={ |
| [App/components/ui.tsx:643](/Users/jabiullah/Documents/QuestLifeProject/App/components/ui.tsx:643) | EmptyState / EmptyState | Rubik Black 900 | — | 21 / 27 | — | {title} |
| [App/components/ui.tsx:644](/Users/jabiullah/Documents/QuestLifeProject/App/components/ui.tsx:644) | EmptyState / EmptyState | Rubik Regular 400 | — | 15 / 22 | — | {body} |
| [App/components/ui.tsx:655](/Users/jabiullah/Documents/QuestLifeProject/App/components/ui.tsx:655) | getHeaderStyles / getHeaderStyles.eyebrow | No family specified; default/inherited/merged | 800 | 12 / — | — | Reusable style/token |
| [App/components/ui.tsx:664](/Users/jabiullah/Documents/QuestLifeProject/App/components/ui.tsx:664) | getHeaderStyles / getHeaderStyles.title | No family specified; default/inherited/merged | 900 | 30 / 36 | — | Reusable style/token |
| [App/components/ui.tsx:670](/Users/jabiullah/Documents/QuestLifeProject/App/components/ui.tsx:670) | getHeaderStyles / getHeaderStyles.subtitle | No family specified; default/inherited/merged | 900 | 13 / 18 | — | Reusable style/token |

### App/components/web-app-shell.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/components/web-app-shell.tsx:35](/Users/jabiullah/Documents/QuestLifeProject/App/components/web-app-shell.tsx:35) | WebAppShell / WebAppShell | Rubik Black 900 | — | 22 / — | — | QuestLife |
| [App/components/web-app-shell.tsx:40](/Users/jabiullah/Documents/QuestLifeProject/App/components/web-app-shell.tsx:40) | WebAppShell / WebAppShell | Rubik Bold 700 | — | 14 / — | — | {label} |

### App/components/weekly-frequency-slider.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/components/weekly-frequency-slider.tsx:127](/Users/jabiullah/Documents/QuestLifeProject/App/components/weekly-frequency-slider.tsx:127) | styles.valuePrefix | Rubik Bold 700 | — | 17 / 22 | — | Reusable style/token |
| [App/components/weekly-frequency-slider.tsx:128](/Users/jabiullah/Documents/QuestLifeProject/App/components/weekly-frequency-slider.tsx:128) | styles.value | Rubik Black 900 | — | 36 / 40 | — | Reusable style/token |
| [App/components/weekly-frequency-slider.tsx:129](/Users/jabiullah/Documents/QuestLifeProject/App/components/weekly-frequency-slider.tsx:129) | styles.valueUnit | Rubik Bold 700 | — | 17 / 22 | — | Reusable style/token |
| [App/components/weekly-frequency-slider.tsx:137](/Users/jabiullah/Documents/QuestLifeProject/App/components/weekly-frequency-slider.tsx:137) | styles.label | Rubik Bold 700 | — | 10 / 14 | — | Reusable style/token |

### App/components/weekly-frequency-slider.web.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/components/weekly-frequency-slider.web.tsx:4](/Users/jabiullah/Documents/QuestLifeProject/App/components/weekly-frequency-slider.web.tsx:4) | WeeklyFrequencySlider / WeeklyFrequencySlider | Rubik, sans-serif; regular unless inherited/overridden | — | — / — | — | Every {value} {value === 1 ? "day" : "days"} a week onChange(Number(event.target.value))} style={{ display: "block", width: "100%", height: 44, accent |

### App/contexts/AppFeedbackContext.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/contexts/AppFeedbackContext.tsx:69](/Users/jabiullah/Documents/QuestLifeProject/App/contexts/AppFeedbackContext.tsx:69) | AppFeedbackProvider / AppFeedbackProvider | Rubik Regular 400 | — | 13 / 18 | — | {feedback.message} |
| [App/contexts/AppFeedbackContext.tsx:71](/Users/jabiullah/Documents/QuestLifeProject/App/contexts/AppFeedbackContext.tsx:71) | AppFeedbackProvider / AppFeedbackProvider | Rubik Bold 700 | — | 14 / — | — | {feedback.actionLabel} |

### App/screens/active-quest-screen.ios.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/screens/active-quest-screen.ios.tsx:129](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:129) | QuestNoticePill / QuestNoticePill | No family specified; default/inherited/merged | 900 | 13 / 17 | — | {detail.label} |
| [App/screens/active-quest-screen.ios.tsx:148](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:148) | QuestCountdownOverlay / QuestCountdownOverlay | No family specified; default/inherited/merged | 900 | isGo ? 36 : 68 / isGo ? 42 : 74 | ["tabular-nums"] | {step} |
| [App/screens/active-quest-screen.ios.tsx:159](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:159) | ActiveQuestTabs / ActiveQuestTabs | No family specified; default/inherited/merged | 900 | 16 / 21 | — | {tab.label} |
| [App/screens/active-quest-screen.ios.tsx:190](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:190) | QuestInstructions / QuestInstructions | Rubik Bold 700 | — | 13 / 18 | — | Need a hand? |
| [App/screens/active-quest-screen.ios.tsx:194](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:194) | QuestInstructions / QuestInstructions | Rubik Black 900 | — | 18 / 23 | — | How it works |
| [App/screens/active-quest-screen.ios.tsx:195](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:195) | QuestInstructions / QuestInstructions | Rubik Bold 700 | — | 12 / — | — | {index + 1} |
| [App/screens/active-quest-screen.ios.tsx:195](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:195) | QuestInstructions / QuestInstructions | Rubik Regular 400 | — | 13 / 19 | — | {step} |
| [App/screens/active-quest-screen.ios.tsx:217](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:217) | QuestRouteCard / QuestRouteCard | Rubik Bold 700 | — | 13 / — | — | Waiting for your location |
| [App/screens/active-quest-screen.ios.tsx:219](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:219) | QuestRouteCard / QuestRouteCard | Rubik Bold 700 | — | 10 / 13 | — | {hasLiveFix ? "Your current location" : lastPoint ? "Last recorded position" : "Location pending"} |
| [App/screens/active-quest-screen.ios.tsx:220](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:220) | QuestRouteCard / QuestRouteCard | Rubik Bold 700 | — | 30 / 38 | ["tabular-nums"] | {miles} mi |
| [App/screens/active-quest-screen.ios.tsx:220](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:220) | QuestRouteCard / QuestRouteCard | Rubik Regular 400 | — | 23 / — | — | mi |
| [App/screens/active-quest-screen.ios.tsx:221](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:221) | QuestRouteCard / QuestRouteCard | Rubik Bold 700 | — | 12 / — | — | {trackingMessage ?? "Location is unavailable."} Tap to retry. |
| [App/screens/active-quest-screen.ios.tsx:227](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:227) | RecentQuestPhotos / RecentQuestPhotos | Rubik Black 900 | — | 20 / — | — | Recent photos |
| [App/screens/active-quest-screen.ios.tsx:227](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:227) | RecentQuestPhotos / RecentQuestPhotos | Rubik Bold 700 | — | 12 / — | — | {loading ? "Loading…" : photos.length ? `${photos.length} captured` : "No photos yet"} |
| [App/screens/active-quest-screen.ios.tsx:292](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:292) | LiveMap | No family specified; default/inherited/merged | 900 | 19 / 25 | — | {fallbackTitle} |
| [App/screens/active-quest-screen.ios.tsx:293](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:293) | LiveMap | No family specified; default/inherited/merged | 600 | 14 / 20 | — | {trackingMessage ?? (waitingForFix ? "Location access is enabled. Move outdoors for a clearer GPS signal; your map will appear as soon as a location a |
| [App/screens/active-quest-screen.ios.tsx:294](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:294) | LiveMap | No family specified; default/inherited/merged | 900 | 14 / — | — | {waitingForFix ? "Retry location" : "Enable route recording"} |
| [App/screens/active-quest-screen.ios.tsx:316](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:316) | LiveMap | Rubik Bold 700 | — | 13 / — | — | {style.label} |
| [App/screens/active-quest-screen.ios.tsx:320](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:320) | LiveMap | No family specified; default/inherited/merged | 700 | 13 / — | — | {trackingMessage ?? "Route recording is unavailable."} Tap to retry. |
| [App/screens/active-quest-screen.ios.tsx:327](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:327) | QuestStartupSurface / QuestStartupSurface | No family specified; default/inherited/merged | 900 | 18 / 24 | — | Get ready to begin |
| [App/screens/active-quest-screen.ios.tsx:327](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:327) | QuestStartupSurface / QuestStartupSurface | No family specified; default/inherited/merged | 900 | 18 / 24 | — | Get ready to begin |
| [App/screens/active-quest-screen.ios.tsx:386](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:386) | ActivityTimeline / ActivityTimeline | Rubik Black 900 | — | 20 / — | — | Quest timeline |
| [App/screens/active-quest-screen.ios.tsx:398](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:398) | ActivityTimeline / ActivityTimeline | No family specified; default/inherited/merged | 900 | 11 / 15 | — | {activityTime(item.createdAt)} |
| [App/screens/active-quest-screen.ios.tsx:405](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:405) | ActivityTimeline / ActivityTimeline | No family specified; default/inherited/merged | 900 | 11 / 15 | — | {label} |
| [App/screens/active-quest-screen.ios.tsx:407](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:407) | ActivityTimeline / ActivityTimeline | No family specified; default/inherited/merged | 800 | 16 / 23 | — | {item.caption} |
| [App/screens/active-quest-screen.ios.tsx:409](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:409) | ActivityTimeline / ActivityTimeline | No family specified; default/inherited/merged | 700 | 16 / 24 | — | {item.kind === "badge" ? item.badgeLabel : item.body} |
| [App/screens/active-quest-screen.ios.tsx:454](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:454) | FloatingQuestControls / FloatingQuestControls | Rubik Bold 700 | — | 13 / — | — | {paused ? "Quest paused" : "Quest time"} |
| [App/screens/active-quest-screen.ios.tsx:455](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:455) | FloatingQuestControls / FloatingQuestControls | Rubik Black 900 | — | 30 / — | ["tabular-nums"] | {duration} |
| [App/screens/active-quest-screen.ios.tsx:470](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:470) | FloatingQuestControls / FloatingQuestControls | No family specified; default/inherited/merged | 900 | 22 / 27 | ["tabular-nums"] | {duration} |
| [App/screens/active-quest-screen.ios.tsx:471](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:471) | FloatingQuestControls / FloatingQuestControls | No family specified; default/inherited/merged | 900 | 13 / 15 | — | {paused ? "Quest paused" : "Quest time"} |
| [App/screens/active-quest-screen.ios.tsx:479](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:479) | FloatingQuestControls / FloatingQuestControls | No family specified; default/inherited/merged | 900 | 13 / 17 | — | {action.label} |
| [App/screens/active-quest-screen.ios.tsx:496](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:496) | StaleQuestActionButton / StaleQuestActionButton | Rubik Bold 700 | 900 | 17 / 22 | — | {label} |
| [App/screens/active-quest-screen.ios.tsx:518](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:518) | StaleQuestReminder / StaleQuestReminder | No family specified; default/inherited/merged | 900 | 23 / 29 | — | Still on this quest? |
| [App/screens/active-quest-screen.ios.tsx:519](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:519) | StaleQuestReminder / StaleQuestReminder | No family specified; default/inherited/merged | 700 | 13 / 19 | — | It has been active for {elapsedLabel}. Continue when you are ready, or clear it from your day. |
| [App/screens/active-quest-screen.ios.tsx:523](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:523) | StaleQuestReminder / StaleQuestReminder | Rubik Bold 700 | 900 | 16 / 21 | — | Abandon this quest |
| [App/screens/active-quest-screen.ios.tsx:533](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:533) | FinishQuestReviewSheet / FinishQuestReviewSheet | Rubik Black 900 | — | 25 / 31 | — | {prompt.title} |
| [App/screens/active-quest-screen.ios.tsx:543](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:543) | ActiveQuestLoadingSkeleton / ActiveQuestLoadingSkeleton | Rubik Black 900 | — | 20 / — | — | {title} |
| [App/screens/active-quest-screen.ios.tsx:966](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:966) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 800 | 10 / 14 | — | ACTIVE QUEST |
| [App/screens/active-quest-screen.ios.tsx:967](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:967) | ActiveQuestScreen / ActiveQuestScreen | Rubik Black 900 | 900 | 22 / 27 | — | {quest.title} |
| [App/screens/active-quest-screen.ios.tsx:1010](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:1010) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 900 | 24 / 30 | — | Quick note |
| [App/screens/active-quest-screen.ios.tsx:1010](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:1010) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 700 | 13 / 19 | — | Capture something before it slips away. |
| [App/screens/active-quest-screen.ios.tsx:1011](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:1011) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 700 | 16 / 23 | — | <TextInput value={quickNote} onChangeText={setQuickNote} autoFocus multiline textAlignVertical="top" placeholder="Found a hidden café." placeholderTex |
| [App/screens/active-quest-screen.ios.tsx:1012](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:1012) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 900 | 16 / — | — | Delete |
| [App/screens/active-quest-screen.ios.tsx:1012](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:1012) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 900 | 16 / — | — | Save |
| [App/screens/active-quest-screen.ios.tsx:1017](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:1017) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 900 | 24 / 30 | — | {pendingPhotoIsTutorialMock ? "A sample quest moment" : "Your quest moment"} |
| [App/screens/active-quest-screen.ios.tsx:1017](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:1017) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 700 | 13 / 19 | — | {pendingPhotoIsTutorialMock ? "This tutorial sample helps introduce the app’s features. It won’t be saved to your official journal." : "This is the ph |
| [App/screens/active-quest-screen.ios.tsx:1019](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:1019) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 900 | 11 / — | — | Caption |
| [App/screens/active-quest-screen.ios.tsx:1019](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:1019) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 700 | 15 / 21 | — | <TextInput value={pendingPhotoCaption} onChangeText={setPendingPhotoCaption} multiline textAlignVertical="top" placeholder="What made this moment memo |
| [App/screens/active-quest-screen.ios.tsx:1020](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:1020) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 900 | 15 / — | — | Retake photo |
| [App/screens/active-quest-screen.ios.tsx:1020](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:1020) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 900 | 15 / — | — | Never mind |
| [App/screens/active-quest-screen.ios.tsx:1021](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:1021) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 900 | 17 / — | — | Save photo |
| [App/screens/active-quest-screen.ios.tsx:1026](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:1026) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 900 | 24 / 30 | — | {managedPhoto ? "Manage photo" : "Manage quick note"} |
| [App/screens/active-quest-screen.ios.tsx:1026](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:1026) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 700 | 13 / 19 | — | {managedPhoto ? "Update its caption or remove it from this quest." : "Make a change or remove this note."} |
| [App/screens/active-quest-screen.ios.tsx:1028](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:1028) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 700 | 15 / 22 | — | <TextInput value={activityDraft} onChangeText={setActivityDraft} multiline textAlignVertical="top" placeholder={managedPhoto ? "Add a caption" : "Writ |
| [App/screens/active-quest-screen.ios.tsx:1029](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:1029) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 900 | 15 / — | — | Delete |
| [App/screens/active-quest-screen.ios.tsx:1029](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:1029) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 900 | 15 / — | — | Save changes |
| [App/screens/active-quest-screen.ios.tsx:1034](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.ios.tsx:1034) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 900 | 22 / — | — | {managedPhoto \|\| managedActivity?.photoId ? "Delete photo?" : "Delete quick note?"} |

### App/screens/active-quest-screen.native.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/screens/active-quest-screen.native.tsx:103](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:103) | QuestNoticePill / QuestNoticePill | No family specified; default/inherited/merged | 900 | 13 / 17 | — | {detail.label} |
| [App/screens/active-quest-screen.native.tsx:122](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:122) | QuestCountdownOverlay / QuestCountdownOverlay | No family specified; default/inherited/merged | 900 | isGo ? 36 : 68 / isGo ? 42 : 74 | ["tabular-nums"] | {step} |
| [App/screens/active-quest-screen.native.tsx:133](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:133) | ActiveQuestTabs / ActiveQuestTabs | No family specified; default/inherited/merged | 900 | 16 / 21 | — | {tab.label} |
| [App/screens/active-quest-screen.native.tsx:164](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:164) | QuestInstructions / QuestInstructions | Rubik Bold 700 | — | 13 / 18 | — | Need a hand? |
| [App/screens/active-quest-screen.native.tsx:168](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:168) | QuestInstructions / QuestInstructions | Rubik Black 900 | — | 18 / 23 | — | How it works |
| [App/screens/active-quest-screen.native.tsx:169](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:169) | QuestInstructions / QuestInstructions | Rubik Bold 700 | — | 12 / — | — | {index + 1} |
| [App/screens/active-quest-screen.native.tsx:169](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:169) | QuestInstructions / QuestInstructions | Rubik Regular 400 | — | 13 / 19 | — | {step} |
| [App/screens/active-quest-screen.native.tsx:191](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:191) | QuestRouteCard / QuestRouteCard | Rubik Bold 700 | — | 13 / — | — | Waiting for your location |
| [App/screens/active-quest-screen.native.tsx:193](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:193) | QuestRouteCard / QuestRouteCard | Rubik Bold 700 | — | 10 / 13 | — | {hasLiveFix ? "Your current location" : lastPoint ? "Last recorded position" : "Location pending"} |
| [App/screens/active-quest-screen.native.tsx:194](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:194) | QuestRouteCard / QuestRouteCard | Rubik Bold 700 | — | 30 / 38 | ["tabular-nums"] | {miles} mi |
| [App/screens/active-quest-screen.native.tsx:194](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:194) | QuestRouteCard / QuestRouteCard | Rubik Regular 400 | — | 23 / — | — | mi |
| [App/screens/active-quest-screen.native.tsx:195](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:195) | QuestRouteCard / QuestRouteCard | Rubik Bold 700 | — | 12 / — | — | {trackingMessage ?? "Location is unavailable."} Tap to retry. |
| [App/screens/active-quest-screen.native.tsx:201](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:201) | RecentQuestPhotos / RecentQuestPhotos | Rubik Black 900 | — | 20 / — | — | Recent photos |
| [App/screens/active-quest-screen.native.tsx:201](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:201) | RecentQuestPhotos / RecentQuestPhotos | Rubik Bold 700 | — | 12 / — | — | {photos.length ? `${photos.length} captured` : "No photos yet"} |
| [App/screens/active-quest-screen.native.tsx:202](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:202) | RecentQuestPhotos / RecentQuestPhotos | Rubik Bold 700 | — | 15 / — | — | No photos yet |
| [App/screens/active-quest-screen.native.tsx:202](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:202) | RecentQuestPhotos / RecentQuestPhotos | Rubik Regular 400 | — | 13 / 19 | — | Take a photo to remember the little moments along the way. |
| [App/screens/active-quest-screen.native.tsx:237](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:237) | LiveMap | No family specified; default/inherited/merged | 900 | 19 / 25 | — | Ready to map your quest |
| [App/screens/active-quest-screen.native.tsx:238](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:238) | LiveMap | No family specified; default/inherited/merged | 600 | 14 / 20 | — | Enable location to centre the map on where you actually are and start recording your route. |
| [App/screens/active-quest-screen.native.tsx:239](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:239) | LiveMap | No family specified; default/inherited/merged | 900 | 14 / — | — | Enable route recording |
| [App/screens/active-quest-screen.native.tsx:254](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:254) | LiveMap | No family specified; default/inherited/merged | 700 | 13 / — | — | {trackingMessage ?? "Route recording is unavailable."} Tap to retry. |
| [App/screens/active-quest-screen.native.tsx:261](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:261) | QuestStartupSurface / QuestStartupSurface | No family specified; default/inherited/merged | 900 | 18 / 24 | — | Get ready to begin |
| [App/screens/active-quest-screen.native.tsx:261](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:261) | QuestStartupSurface / QuestStartupSurface | No family specified; default/inherited/merged | 900 | 18 / 24 | — | Get ready to begin |
| [App/screens/active-quest-screen.native.tsx:267](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:267) | Album / Album | No family specified; default/inherited/merged | 900 | 17 / — | — | Capture the little moments |
| [App/screens/active-quest-screen.native.tsx:267](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:267) | Album / Album | No family specified; default/inherited/merged | 700 | 13 / 19 | — | Photos from this quest will appear here as a two-column memory stream. |
| [App/screens/active-quest-screen.native.tsx:296](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:296) | ActivityTimeline / emptyTimeline | No family specified; default/inherited/merged | 900 | 19 / 25 | — | Your quest story starts here |
| [App/screens/active-quest-screen.native.tsx:297](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:297) | ActivityTimeline / emptyTimeline | No family specified; default/inherited/merged | 700 | 14 / 20 | — | Add a quick note or photo and every moment will appear in this timeline. |
| [App/screens/active-quest-screen.native.tsx:311](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:311) | ActivityTimeline / ActivityTimeline | Rubik Black 900 | — | 20 / — | — | Quest timeline |
| [App/screens/active-quest-screen.native.tsx:321](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:321) | ActivityTimeline / ActivityTimeline | No family specified; default/inherited/merged | 900 | 11 / 15 | — | {activityTime(item.createdAt)} |
| [App/screens/active-quest-screen.native.tsx:328](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:328) | ActivityTimeline / ActivityTimeline | No family specified; default/inherited/merged | 900 | 11 / 15 | — | {label} |
| [App/screens/active-quest-screen.native.tsx:330](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:330) | ActivityTimeline / ActivityTimeline | No family specified; default/inherited/merged | 800 | 16 / 23 | — | {item.caption} |
| [App/screens/active-quest-screen.native.tsx:332](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:332) | ActivityTimeline / ActivityTimeline | No family specified; default/inherited/merged | 700 | 16 / 24 | — | {item.kind === "badge" ? item.badgeLabel : item.body} |
| [App/screens/active-quest-screen.native.tsx:376](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:376) | FloatingQuestControls / FloatingQuestControls | Rubik Bold 700 | — | 13 / — | — | {paused ? "Quest paused" : "Quest time"} |
| [App/screens/active-quest-screen.native.tsx:377](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:377) | FloatingQuestControls / FloatingQuestControls | Rubik Black 900 | — | 30 / — | ["tabular-nums"] | {duration} |
| [App/screens/active-quest-screen.native.tsx:392](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:392) | FloatingQuestControls / FloatingQuestControls | No family specified; default/inherited/merged | 900 | 22 / 27 | ["tabular-nums"] | {duration} |
| [App/screens/active-quest-screen.native.tsx:393](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:393) | FloatingQuestControls / FloatingQuestControls | No family specified; default/inherited/merged | 900 | 13 / 15 | — | {paused ? "Quest paused" : "Quest time"} |
| [App/screens/active-quest-screen.native.tsx:401](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:401) | FloatingQuestControls / FloatingQuestControls | No family specified; default/inherited/merged | 900 | 13 / 17 | — | {action.label} |
| [App/screens/active-quest-screen.native.tsx:418](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:418) | StaleQuestActionButton / StaleQuestActionButton | Rubik Bold 700 | 900 | 17 / 22 | — | {label} |
| [App/screens/active-quest-screen.native.tsx:440](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:440) | StaleQuestReminder / StaleQuestReminder | No family specified; default/inherited/merged | 900 | 23 / 29 | — | Still on this quest? |
| [App/screens/active-quest-screen.native.tsx:441](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:441) | StaleQuestReminder / StaleQuestReminder | No family specified; default/inherited/merged | 700 | 13 / 19 | — | It has been active for {elapsedLabel}. Continue when you are ready, or clear it from your day. |
| [App/screens/active-quest-screen.native.tsx:445](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:445) | StaleQuestReminder / StaleQuestReminder | Rubik Bold 700 | 900 | 16 / 21 | — | Abandon this quest |
| [App/screens/active-quest-screen.native.tsx:455](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:455) | FinishQuestReviewSheet / FinishQuestReviewSheet | Rubik Black 900 | — | 25 / 31 | — | {prompt.title} |
| [App/screens/active-quest-screen.native.tsx:876](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:876) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 900 | 13 / 17 | — | {paused ? "Quest paused" : "Active now"} |
| [App/screens/active-quest-screen.native.tsx:877](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:877) | ActiveQuestScreen / ActiveQuestScreen | Rubik Black 900 | 900 | 22 / 31 | — | {quest.title} |
| [App/screens/active-quest-screen.native.tsx:895](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:895) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 900 | 24 / 30 | — | Quick note |
| [App/screens/active-quest-screen.native.tsx:895](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:895) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 700 | 13 / 19 | — | Capture something before it slips away. |
| [App/screens/active-quest-screen.native.tsx:896](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:896) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 700 | 16 / 23 | — | <TextInput value={quickNote} onChangeText={setQuickNote} autoFocus multiline textAlignVertical="top" placeholder="Found a hidden café." placeholderTex |
| [App/screens/active-quest-screen.native.tsx:897](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:897) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 900 | 16 / — | — | Delete |
| [App/screens/active-quest-screen.native.tsx:897](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:897) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 900 | 16 / — | — | Save |
| [App/screens/active-quest-screen.native.tsx:902](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:902) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 900 | 24 / 30 | — | {pendingPhotoIsTutorialMock ? "A sample quest moment" : "Your quest moment"} |
| [App/screens/active-quest-screen.native.tsx:902](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:902) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 700 | 13 / 19 | — | {pendingPhotoIsTutorialMock ? "This tutorial sample helps introduce the app’s features. It won’t be saved to your official journal." : "This is the ph |
| [App/screens/active-quest-screen.native.tsx:904](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:904) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 900 | 11 / — | — | Caption |
| [App/screens/active-quest-screen.native.tsx:904](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:904) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 700 | 15 / 21 | — | <TextInput value={pendingPhotoCaption} onChangeText={setPendingPhotoCaption} multiline textAlignVertical="top" placeholder="What made this moment memo |
| [App/screens/active-quest-screen.native.tsx:905](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:905) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 900 | 15 / — | — | Retake photo |
| [App/screens/active-quest-screen.native.tsx:905](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:905) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 900 | 15 / — | — | Never mind |
| [App/screens/active-quest-screen.native.tsx:906](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:906) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 900 | 17 / — | — | Save photo |
| [App/screens/active-quest-screen.native.tsx:911](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:911) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 900 | 24 / 30 | — | {managedPhoto ? "Manage photo" : "Manage quick note"} |
| [App/screens/active-quest-screen.native.tsx:911](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:911) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 700 | 13 / 19 | — | {managedPhoto ? "Update its caption or remove it from this quest." : "Make a change or remove this note."} |
| [App/screens/active-quest-screen.native.tsx:913](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:913) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 700 | 15 / 22 | — | <TextInput value={activityDraft} onChangeText={setActivityDraft} multiline textAlignVertical="top" placeholder={managedPhoto ? "Add a caption" : "Writ |
| [App/screens/active-quest-screen.native.tsx:914](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:914) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 900 | 15 / — | — | Delete |
| [App/screens/active-quest-screen.native.tsx:914](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:914) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 900 | 15 / — | — | Save changes |
| [App/screens/active-quest-screen.native.tsx:919](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.native.tsx:919) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 900 | 22 / — | — | {managedPhoto \|\| managedActivity?.photoId ? "Delete photo?" : "Delete quick note?"} |

### App/screens/active-quest-screen.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/screens/active-quest-screen.tsx:101](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:101) | QuestNoticePill / QuestNoticePill | No family specified; default/inherited/merged | 900 | 13 / 17 | — | {detail.label} |
| [App/screens/active-quest-screen.tsx:120](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:120) | QuestCountdownOverlay / QuestCountdownOverlay | No family specified; default/inherited/merged | 900 | isGo ? 36 : 68 / isGo ? 42 : 74 | ["tabular-nums"] | {step} |
| [App/screens/active-quest-screen.tsx:131](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:131) | ActiveQuestTabs / ActiveQuestTabs | No family specified; default/inherited/merged | 900 | 16 / 21 | — | {tab.label} |
| [App/screens/active-quest-screen.tsx:162](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:162) | QuestInstructions / QuestInstructions | Rubik Bold 700 | — | 13 / 18 | — | Need a hand? |
| [App/screens/active-quest-screen.tsx:166](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:166) | QuestInstructions / QuestInstructions | Rubik Black 900 | — | 18 / 23 | — | How it works |
| [App/screens/active-quest-screen.tsx:167](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:167) | QuestInstructions / QuestInstructions | Rubik Bold 700 | — | 12 / — | — | {index + 1} |
| [App/screens/active-quest-screen.tsx:167](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:167) | QuestInstructions / QuestInstructions | Rubik Regular 400 | — | 13 / 19 | — | {step} |
| [App/screens/active-quest-screen.tsx:189](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:189) | QuestRouteCard / QuestRouteCard | Rubik Bold 700 | — | 13 / — | — | Waiting for your location |
| [App/screens/active-quest-screen.tsx:191](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:191) | QuestRouteCard / QuestRouteCard | Rubik Bold 700 | — | 10 / 13 | — | {hasLiveFix ? "Your current location" : lastPoint ? "Last recorded position" : "Location pending"} |
| [App/screens/active-quest-screen.tsx:192](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:192) | QuestRouteCard / QuestRouteCard | Rubik Bold 700 | — | 30 / 38 | ["tabular-nums"] | {miles} mi |
| [App/screens/active-quest-screen.tsx:192](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:192) | QuestRouteCard / QuestRouteCard | Rubik Regular 400 | — | 23 / — | — | mi |
| [App/screens/active-quest-screen.tsx:193](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:193) | QuestRouteCard / QuestRouteCard | Rubik Bold 700 | — | 12 / — | — | {trackingMessage ?? "Location is unavailable."} Tap to retry. |
| [App/screens/active-quest-screen.tsx:199](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:199) | RecentQuestPhotos / RecentQuestPhotos | Rubik Black 900 | — | 20 / — | — | Recent photos |
| [App/screens/active-quest-screen.tsx:199](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:199) | RecentQuestPhotos / RecentQuestPhotos | Rubik Bold 700 | — | 12 / — | — | {photos.length ? `${photos.length} captured` : "No photos yet"} |
| [App/screens/active-quest-screen.tsx:200](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:200) | RecentQuestPhotos / RecentQuestPhotos | Rubik Bold 700 | — | 15 / — | — | No photos yet |
| [App/screens/active-quest-screen.tsx:200](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:200) | RecentQuestPhotos / RecentQuestPhotos | Rubik Regular 400 | — | 13 / 19 | — | Take a photo to remember the little moments along the way. |
| [App/screens/active-quest-screen.tsx:235](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:235) | LiveMap | No family specified; default/inherited/merged | 900 | 19 / 25 | — | Ready to map your quest |
| [App/screens/active-quest-screen.tsx:236](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:236) | LiveMap | No family specified; default/inherited/merged | 600 | 14 / 20 | — | Enable location to centre the map on where you actually are and start recording your route. |
| [App/screens/active-quest-screen.tsx:237](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:237) | LiveMap | No family specified; default/inherited/merged | 900 | 14 / — | — | Enable route recording |
| [App/screens/active-quest-screen.tsx:252](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:252) | LiveMap | No family specified; default/inherited/merged | 700 | 13 / — | — | {trackingMessage ?? "Route recording is unavailable."} Tap to retry. |
| [App/screens/active-quest-screen.tsx:259](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:259) | QuestStartupSurface / QuestStartupSurface | No family specified; default/inherited/merged | 900 | 18 / 24 | — | Get ready to begin |
| [App/screens/active-quest-screen.tsx:259](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:259) | QuestStartupSurface / QuestStartupSurface | No family specified; default/inherited/merged | 900 | 18 / 24 | — | Get ready to begin |
| [App/screens/active-quest-screen.tsx:265](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:265) | Album / Album | No family specified; default/inherited/merged | 900 | 17 / — | — | Capture the little moments |
| [App/screens/active-quest-screen.tsx:265](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:265) | Album / Album | No family specified; default/inherited/merged | 700 | 13 / 19 | — | Photos from this quest will appear here as a two-column memory stream. |
| [App/screens/active-quest-screen.tsx:294](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:294) | ActivityTimeline / emptyTimeline | No family specified; default/inherited/merged | 900 | 19 / 25 | — | Your quest story starts here |
| [App/screens/active-quest-screen.tsx:295](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:295) | ActivityTimeline / emptyTimeline | No family specified; default/inherited/merged | 700 | 14 / 20 | — | Add a quick note or photo and every moment will appear in this timeline. |
| [App/screens/active-quest-screen.tsx:309](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:309) | ActivityTimeline / ActivityTimeline | Rubik Black 900 | — | 20 / — | — | Quest timeline |
| [App/screens/active-quest-screen.tsx:319](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:319) | ActivityTimeline / ActivityTimeline | No family specified; default/inherited/merged | 900 | 11 / 15 | — | {activityTime(item.createdAt)} |
| [App/screens/active-quest-screen.tsx:326](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:326) | ActivityTimeline / ActivityTimeline | No family specified; default/inherited/merged | 900 | 11 / 15 | — | {label} |
| [App/screens/active-quest-screen.tsx:328](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:328) | ActivityTimeline / ActivityTimeline | No family specified; default/inherited/merged | 800 | 16 / 23 | — | {item.caption} |
| [App/screens/active-quest-screen.tsx:330](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:330) | ActivityTimeline / ActivityTimeline | No family specified; default/inherited/merged | 700 | 16 / 24 | — | {item.kind === "badge" ? item.badgeLabel : item.body} |
| [App/screens/active-quest-screen.tsx:374](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:374) | FloatingQuestControls / FloatingQuestControls | Rubik Bold 700 | — | 13 / — | — | {paused ? "Quest paused" : "Quest time"} |
| [App/screens/active-quest-screen.tsx:375](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:375) | FloatingQuestControls / FloatingQuestControls | Rubik Black 900 | — | 30 / — | ["tabular-nums"] | {duration} |
| [App/screens/active-quest-screen.tsx:390](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:390) | FloatingQuestControls / FloatingQuestControls | No family specified; default/inherited/merged | 900 | 22 / 27 | ["tabular-nums"] | {duration} |
| [App/screens/active-quest-screen.tsx:391](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:391) | FloatingQuestControls / FloatingQuestControls | No family specified; default/inherited/merged | 900 | 13 / 15 | — | {paused ? "Quest paused" : "Quest time"} |
| [App/screens/active-quest-screen.tsx:399](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:399) | FloatingQuestControls / FloatingQuestControls | No family specified; default/inherited/merged | 900 | 13 / 17 | — | {action.label} |
| [App/screens/active-quest-screen.tsx:416](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:416) | StaleQuestActionButton / StaleQuestActionButton | Rubik Bold 700 | 900 | 17 / 22 | — | {label} |
| [App/screens/active-quest-screen.tsx:438](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:438) | StaleQuestReminder / StaleQuestReminder | No family specified; default/inherited/merged | 900 | 23 / 29 | — | Still on this quest? |
| [App/screens/active-quest-screen.tsx:439](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:439) | StaleQuestReminder / StaleQuestReminder | No family specified; default/inherited/merged | 700 | 13 / 19 | — | It has been active for {elapsedLabel}. Continue when you are ready, or clear it from your day. |
| [App/screens/active-quest-screen.tsx:443](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:443) | StaleQuestReminder / StaleQuestReminder | Rubik Bold 700 | 900 | 16 / 21 | — | Abandon this quest |
| [App/screens/active-quest-screen.tsx:453](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:453) | FinishQuestReviewSheet / FinishQuestReviewSheet | Rubik Black 900 | — | 25 / 31 | — | {prompt.title} |
| [App/screens/active-quest-screen.tsx:857](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:857) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 900 | 13 / 17 | — | {paused ? "Quest paused" : "Active now"} |
| [App/screens/active-quest-screen.tsx:858](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:858) | ActiveQuestScreen / ActiveQuestScreen | Rubik Black 900 | 900 | 22 / 31 | — | {quest.title} |
| [App/screens/active-quest-screen.tsx:876](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:876) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 900 | 24 / 30 | — | Quick note |
| [App/screens/active-quest-screen.tsx:876](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:876) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 700 | 13 / 19 | — | Capture something before it slips away. |
| [App/screens/active-quest-screen.tsx:877](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:877) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 700 | 16 / 23 | — | <TextInput value={quickNote} onChangeText={setQuickNote} autoFocus multiline textAlignVertical="top" placeholder="Found a hidden café." placeholderTex |
| [App/screens/active-quest-screen.tsx:878](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:878) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 900 | 16 / — | — | Delete |
| [App/screens/active-quest-screen.tsx:878](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:878) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 900 | 16 / — | — | Save |
| [App/screens/active-quest-screen.tsx:883](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:883) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 900 | 24 / 30 | — | {pendingPhotoIsTutorialMock ? "A sample quest moment" : "Your quest moment"} |
| [App/screens/active-quest-screen.tsx:883](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:883) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 700 | 13 / 19 | — | {pendingPhotoIsTutorialMock ? "This tutorial sample helps introduce the app’s features. It won’t be saved to your official journal." : "This is the ph |
| [App/screens/active-quest-screen.tsx:885](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:885) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 900 | 11 / — | — | Caption |
| [App/screens/active-quest-screen.tsx:885](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:885) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 700 | 15 / 21 | — | <TextInput value={pendingPhotoCaption} onChangeText={setPendingPhotoCaption} multiline textAlignVertical="top" placeholder="What made this moment memo |
| [App/screens/active-quest-screen.tsx:886](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:886) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 900 | 15 / — | — | Retake photo |
| [App/screens/active-quest-screen.tsx:886](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:886) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 900 | 15 / — | — | Never mind |
| [App/screens/active-quest-screen.tsx:887](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:887) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 900 | 17 / — | — | Save photo |
| [App/screens/active-quest-screen.tsx:892](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:892) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 900 | 24 / 30 | — | {managedPhoto ? "Manage photo" : "Manage quick note"} |
| [App/screens/active-quest-screen.tsx:892](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:892) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 700 | 13 / 19 | — | {managedPhoto ? "Update its caption or remove it from this quest." : "Make a change or remove this note."} |
| [App/screens/active-quest-screen.tsx:894](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:894) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 700 | 15 / 22 | — | <TextInput value={activityDraft} onChangeText={setActivityDraft} multiline textAlignVertical="top" placeholder={managedPhoto ? "Add a caption" : "Writ |
| [App/screens/active-quest-screen.tsx:895](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:895) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 900 | 15 / — | — | Delete |
| [App/screens/active-quest-screen.tsx:895](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:895) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 900 | 15 / — | — | Save changes |
| [App/screens/active-quest-screen.tsx:900](/Users/jabiullah/Documents/QuestLifeProject/App/screens/active-quest-screen.tsx:900) | ActiveQuestScreen / ActiveQuestScreen | No family specified; default/inherited/merged | 900 | 22 / — | — | {managedPhoto \|\| managedActivity?.photoId ? "Delete photo?" : "Delete quick note?"} |

### App/screens/add-friends-screen.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/screens/add-friends-screen.tsx:23](/Users/jabiullah/Documents/QuestLifeProject/App/screens/add-friends-screen.tsx:23) | DiscoveryTabButton / DiscoveryTabButton | No family specified; default/inherited/merged | 900 | 11 / — | — | {label} |
| [App/screens/add-friends-screen.tsx:60](/Users/jabiullah/Documents/QuestLifeProject/App/screens/add-friends-screen.tsx:60) | FriendActionButton / FriendActionButton | No family specified; default/inherited/merged | 900 | compact ? 13 : 14 / — | — | {label} |
| [App/screens/add-friends-screen.tsx:69](/Users/jabiullah/Documents/QuestLifeProject/App/screens/add-friends-screen.tsx:69) | PersonRow / PersonRow | No family specified; default/inherited/merged | 900 | 15 / — | — | {person.displayName} |
| [App/screens/add-friends-screen.tsx:70](/Users/jabiullah/Documents/QuestLifeProject/App/screens/add-friends-screen.tsx:70) | PersonRow / PersonRow | No family specified; default/inherited/merged | 700 | 12 / — | — | {person.username ? `@${person.username}` : "QuestLife adventurer"} |
| [App/screens/add-friends-screen.tsx:72](/Users/jabiullah/Documents/QuestLifeProject/App/screens/add-friends-screen.tsx:72) | PersonRow / PersonRow | No family specified; default/inherited/merged | 900 | 11 / — | — | {status} |
| [App/screens/add-friends-screen.tsx:72](/Users/jabiullah/Documents/QuestLifeProject/App/screens/add-friends-screen.tsx:72) | PersonRow / PersonRow | No family specified; default/inherited/merged | 900 | 12 / — | — | ADD FRIEND |
| [App/screens/add-friends-screen.tsx:199](/Users/jabiullah/Documents/QuestLifeProject/App/screens/add-friends-screen.tsx:199) | AddFriendsScreen / AddFriendsScreen | No family specified; default/inherited/merged | 700 | 15 / — | — | <TextInput autoFocus value={query} onChangeText={setQuery} placeholder="Search by username" placeholderTextColor={T.muted} autoCapitalize="none" autoC |
| [App/screens/add-friends-screen.tsx:211](/Users/jabiullah/Documents/QuestLifeProject/App/screens/add-friends-screen.tsx:211) | AddFriendsScreen / AddFriendsScreen | No family specified; default/inherited/merged | 900 | 13 / — | — | {query.trim().length >= 2 ? "Search results" : activeTab === "contacts" ? "Friends from your contacts" : "People you might know"} |
| [App/screens/add-friends-screen.tsx:212](/Users/jabiullah/Documents/QuestLifeProject/App/screens/add-friends-screen.tsx:212) | AddFriendsScreen / AddFriendsScreen | No family specified; default/inherited/merged | 900 | 18 / — | — | {contactsLoaded ? "No contacts on QuestLife yet" : "Connect your contacts"} |
| [App/screens/add-friends-screen.tsx:212](/Users/jabiullah/Documents/QuestLifeProject/App/screens/add-friends-screen.tsx:212) | AddFriendsScreen / AddFriendsScreen | No family specified; default/inherited/merged | 700 | 13 / 19 | — | {contactsLoaded ? "Invite them below, or search by username instead." : "We’ll only look for people already using QuestLife."} |
| [App/screens/add-friends-screen.tsx:218](/Users/jabiullah/Documents/QuestLifeProject/App/screens/add-friends-screen.tsx:218) | AddFriendsScreen / AddFriendsScreen | No family specified; default/inherited/merged | 900 | 19 / — | — | Your QuestLife QR code |
| [App/screens/add-friends-screen.tsx:221](/Users/jabiullah/Documents/QuestLifeProject/App/screens/add-friends-screen.tsx:221) | AddFriendsScreen / AddFriendsScreen | No family specified; default/inherited/merged | 700 | 12 / 18 | — | Friends can scan this with their phone camera to open your profile and add you. |

### App/screens/explore-screen.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/screens/explore-screen.tsx:38](/Users/jabiullah/Documents/QuestLifeProject/App/screens/explore-screen.tsx:38) | ExploreTag / ExploreTag | No family specified; default/inherited/merged | 900 | compact ? 10 : 12 / compact ? 15 : 16 | — | {label} |
| [App/screens/explore-screen.tsx:97](/Users/jabiullah/Documents/QuestLifeProject/App/screens/explore-screen.tsx:97) | ExploreSearch / ExploreSearch | Rubik Bold 700 | — | 16 / 21 | — | <TextInput value={value} onChangeText={onChangeText} placeholder="Search Quests" placeholderTextColor={T.muted} accessibilityLabel="Search quests" sty |
| [App/screens/explore-screen.tsx:145](/Users/jabiullah/Documents/QuestLifeProject/App/screens/explore-screen.tsx:145) | SortOptionIcon / SortOptionIcon | No family specified; default/inherited/merged | 900 | 7 / — | — | XP |
| [App/screens/explore-screen.tsx:191](/Users/jabiullah/Documents/QuestLifeProject/App/screens/explore-screen.tsx:191) | FilterChoice / FilterChoice | No family specified; default/inherited/merged | 800 | 12 / — | — | {label} |
| [App/screens/explore-screen.tsx:200](/Users/jabiullah/Documents/QuestLifeProject/App/screens/explore-screen.tsx:200) | MetaPill / MetaPill | No family specified; default/inherited/merged | 900 | 12 / 16 | — | {text} |
| [App/screens/explore-screen.tsx:242](/Users/jabiullah/Documents/QuestLifeProject/App/screens/explore-screen.tsx:242) | QuestFeedCard / QuestFeedCard | No family specified; default/inherited/merged | 900 | 18 / 23 | — | {quest.title} |
| [App/screens/explore-screen.tsx:243](/Users/jabiullah/Documents/QuestLifeProject/App/screens/explore-screen.tsx:243) | QuestFeedCard / QuestFeedCard | No family specified; default/inherited/merged | 700 | 13 / 19 | — | {quest.description} |
| [App/screens/explore-screen.tsx:252](/Users/jabiullah/Documents/QuestLifeProject/App/screens/explore-screen.tsx:252) | QuestFeedCard / QuestFeedCard | Rubik Black 900 | — | 13 / — | — | MORE INFO |
| [App/screens/explore-screen.tsx:354](/Users/jabiullah/Documents/QuestLifeProject/App/screens/explore-screen.tsx:354) | ExploreScreen / ExploreScreen | No family specified; default/inherited/merged | 900 | 13 / — | — | {item} |
| [App/screens/explore-screen.tsx:358](/Users/jabiullah/Documents/QuestLifeProject/App/screens/explore-screen.tsx:358) | ExploreScreen / ExploreScreen | No family specified; default/inherited/merged | 900 | 21 / 28 | — | {category === "All" ? "All Quests" : `${category.charAt(0)}${category.slice(1).toLowerCase()}`} |
| [App/screens/explore-screen.tsx:359](/Users/jabiullah/Documents/QuestLifeProject/App/screens/explore-screen.tsx:359) | ExploreScreen / ExploreScreen | No family specified; default/inherited/merged | 800 | 13 / — | — | {feed.length} quests |
| [App/screens/explore-screen.tsx:384](/Users/jabiullah/Documents/QuestLifeProject/App/screens/explore-screen.tsx:384) | ExploreScreen / ExploreScreen | No family specified; default/inherited/merged | 900 | 20 / 24 | — | Sort & Filter |
| [App/screens/explore-screen.tsx:385](/Users/jabiullah/Documents/QuestLifeProject/App/screens/explore-screen.tsx:385) | ExploreScreen / ExploreScreen | No family specified; default/inherited/merged | 700 | 12 / 16 | — | Customize how you see quests |
| [App/screens/explore-screen.tsx:390](/Users/jabiullah/Documents/QuestLifeProject/App/screens/explore-screen.tsx:390) | ExploreScreen / ExploreScreen | No family specified; default/inherited/merged | 800 | 12 / — | — | Reset |
| [App/screens/explore-screen.tsx:395](/Users/jabiullah/Documents/QuestLifeProject/App/screens/explore-screen.tsx:395) | ExploreScreen / ExploreScreen | No family specified; default/inherited/merged | 900 | 11 / — | — | Sort by |
| [App/screens/explore-screen.tsx:403](/Users/jabiullah/Documents/QuestLifeProject/App/screens/explore-screen.tsx:403) | ExploreScreen / ExploreScreen | No family specified; default/inherited/merged | 800 | 11 / 14 | — | {option.label} |
| [App/screens/explore-screen.tsx:413](/Users/jabiullah/Documents/QuestLifeProject/App/screens/explore-screen.tsx:413) | ExploreScreen / ExploreScreen | No family specified; default/inherited/merged | 900 | 11 / — | — | Duration |
| [App/screens/explore-screen.tsx:426](/Users/jabiullah/Documents/QuestLifeProject/App/screens/explore-screen.tsx:426) | ExploreScreen / ExploreScreen | No family specified; default/inherited/merged | 900 | 11 / — | — | Difficulty |
| [App/screens/explore-screen.tsx:437](/Users/jabiullah/Documents/QuestLifeProject/App/screens/explore-screen.tsx:437) | ExploreScreen / ExploreScreen | Rubik Bold 700 | — | 16 / — | — | Done |

### App/screens/friend-profile-screen.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/screens/friend-profile-screen.tsx:91](/Users/jabiullah/Documents/QuestLifeProject/App/screens/friend-profile-screen.tsx:91) | FriendProfileScreen / FriendProfileScreen | Rubik Black 900 | — | 22 / 28 | — | Profile |
| [App/screens/friend-profile-screen.tsx:97](/Users/jabiullah/Documents/QuestLifeProject/App/screens/friend-profile-screen.tsx:97) | FriendProfileScreen / FriendProfileScreen | Rubik Black 900 | — | 22 / 28 | — | {friend.displayName} |
| [App/screens/friend-profile-screen.tsx:98](/Users/jabiullah/Documents/QuestLifeProject/App/screens/friend-profile-screen.tsx:98) | FriendProfileScreen / FriendProfileScreen | Rubik Bold 700 | — | 13 / 18 | — | {friend.username ? `@${friend.username}` : "QuestLife adventurer"} |
| [App/screens/friend-profile-screen.tsx:100](/Users/jabiullah/Documents/QuestLifeProject/App/screens/friend-profile-screen.tsx:100) | FriendProfileScreen / FriendProfileScreen | Rubik Regular 400 | — | 14 / 20 | — | {friend.bio} |
| [App/screens/friend-profile-screen.tsx:105](/Users/jabiullah/Documents/QuestLifeProject/App/screens/friend-profile-screen.tsx:105) | FriendProfileScreen / FriendProfileScreen | Rubik Black 900 | — | 22 / 28 | — | {profile.displayName} |
| [App/screens/friend-profile-screen.tsx:105](/Users/jabiullah/Documents/QuestLifeProject/App/screens/friend-profile-screen.tsx:105) | FriendProfileScreen / FriendProfileScreen | Rubik Bold 700 | — | 13 / 18 | — | {profile.username ? `@${profile.username}` : "QuestLife adventurer"} |
| [App/screens/friend-profile-screen.tsx:108](/Users/jabiullah/Documents/QuestLifeProject/App/screens/friend-profile-screen.tsx:108) | FriendProfileScreen / FriendProfileScreen | Rubik Black 900 | — | 20 / 25 | — | {friend?.displayName ?? profile?.displayName ?? "QuestLife adventurer"} |
| [App/screens/friend-profile-screen.tsx:108](/Users/jabiullah/Documents/QuestLifeProject/App/screens/friend-profile-screen.tsx:108) | FriendProfileScreen / FriendProfileScreen | Rubik Bold 700 | — | 13 / 18 | — | {profile?.username ? `@${profile.username}` : "QuestLife adventurer"} |
| [App/screens/friend-profile-screen.tsx:109](/Users/jabiullah/Documents/QuestLifeProject/App/screens/friend-profile-screen.tsx:109) | FriendProfileScreen / FriendProfileScreen | Rubik Bold 700 | — | 21 / — | — | Remove {profile?.displayName}? |
| [App/screens/friend-profile-screen.tsx:109](/Users/jabiullah/Documents/QuestLifeProject/App/screens/friend-profile-screen.tsx:109) | FriendProfileScreen / FriendProfileScreen | Rubik Regular 400 | — | 13 / 19 | — | You won’t see their activity or appear on each other’s friends leaderboard. They won’t be notified. |
| [App/screens/friend-profile-screen.tsx:109](/Users/jabiullah/Documents/QuestLifeProject/App/screens/friend-profile-screen.tsx:109) | FriendProfileScreen / FriendProfileScreen | Rubik Bold 700 | — | 13 / — | — | Cancel |
| [App/screens/friend-profile-screen.tsx:109](/Users/jabiullah/Documents/QuestLifeProject/App/screens/friend-profile-screen.tsx:109) | FriendProfileScreen / FriendProfileScreen | Rubik Bold 700 | — | 13 / — | — | {saving ? "Removing…" : "Remove"} |
| [App/screens/friend-profile-screen.tsx:114](/Users/jabiullah/Documents/QuestLifeProject/App/screens/friend-profile-screen.tsx:114) | FriendRequestSentButton / FriendRequestSentButton | Rubik Bold 700 | — | 15 / — | — | Friend request sent |
| [App/screens/friend-profile-screen.tsx:118](/Users/jabiullah/Documents/QuestLifeProject/App/screens/friend-profile-screen.tsx:118) | FriendsButton / FriendsButton | Rubik Bold 700 | — | 15 / — | — | Friends |

### App/screens/friends-screen.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/screens/friends-screen.tsx:17](/Users/jabiullah/Documents/QuestLifeProject/App/screens/friends-screen.tsx:17) | FriendRow / FriendRow | No family specified; default/inherited/merged | 900 | 16 / — | — | {friend.displayName} |
| [App/screens/friends-screen.tsx:17](/Users/jabiullah/Documents/QuestLifeProject/App/screens/friends-screen.tsx:17) | FriendRow / FriendRow | No family specified; default/inherited/merged | 700 | 12 / — | — | {friend.username ? `@${friend.username}` : "QuestLife friend"} |
| [App/screens/friends-screen.tsx:36](/Users/jabiullah/Documents/QuestLifeProject/App/screens/friends-screen.tsx:36) | FriendsScreen / FriendsScreen | No family specified; default/inherited/merged | 700 | 15 / — | — | <TextInput value={query} onChangeText={setQuery} placeholder="Search your friends" placeholderTextColor={T.muted} autoCapitalize="none" autoCorrect={f |
| [App/screens/friends-screen.tsx:37](/Users/jabiullah/Documents/QuestLifeProject/App/screens/friends-screen.tsx:37) | FriendsScreen / FriendsScreen | No family specified; default/inherited/merged | 900 | 13 / — | — | {query ? "Search results" : "Your friends"} |
| [App/screens/friends-screen.tsx:37](/Users/jabiullah/Documents/QuestLifeProject/App/screens/friends-screen.tsx:37) | FriendsScreen / FriendsScreen | No family specified; default/inherited/merged | 800 | 12 / — | — | {friends.length} |

### App/screens/in-progress-quest-screen.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/screens/in-progress-quest-screen.tsx:32](/Users/jabiullah/Documents/QuestLifeProject/App/screens/in-progress-quest-screen.tsx:32) | AddReflectionPhotoCard / AddReflectionPhotoCard | Rubik Bold 700 | — | 13 / — | — | Add photo |
| [App/screens/in-progress-quest-screen.tsx:98](/Users/jabiullah/Documents/QuestLifeProject/App/screens/in-progress-quest-screen.tsx:98) | InProgressQuestScreen / InProgressQuestScreen | Rubik Black 900 | — | 22 / — | — | Quest unavailable |
| [App/screens/in-progress-quest-screen.tsx:98](/Users/jabiullah/Documents/QuestLifeProject/App/screens/in-progress-quest-screen.tsx:98) | InProgressQuestScreen / InProgressQuestScreen | Rubik Bold 700 | — | — / — | — | Back to Home |
| [App/screens/in-progress-quest-screen.tsx:101](/Users/jabiullah/Documents/QuestLifeProject/App/screens/in-progress-quest-screen.tsx:101) | InProgressQuestScreen / InProgressQuestScreen | Rubik Black 900 | — | 23 / 28 | — | Add to Journal |
| [App/screens/in-progress-quest-screen.tsx:103](/Users/jabiullah/Documents/QuestLifeProject/App/screens/in-progress-quest-screen.tsx:103) | InProgressQuestScreen / InProgressQuestScreen | Rubik Bold 700 | — | 15 / — | — | Quest photos |
| [App/screens/in-progress-quest-screen.tsx:103](/Users/jabiullah/Documents/QuestLifeProject/App/screens/in-progress-quest-screen.tsx:103) | InProgressQuestScreen / InProgressQuestScreen | Rubik Bold 700 | — | 12 / — | — | {photos.length}/{MAX_JOURNAL_PHOTOS} |
| [App/screens/in-progress-quest-screen.tsx:104](/Users/jabiullah/Documents/QuestLifeProject/App/screens/in-progress-quest-screen.tsx:104) | InProgressQuestScreen / InProgressQuestScreen | Rubik Black 900 | — | 26 / 32 | — | {displayedQuest.title} |
| [App/screens/in-progress-quest-screen.tsx:104](/Users/jabiullah/Documents/QuestLifeProject/App/screens/in-progress-quest-screen.tsx:104) | InProgressQuestScreen / InProgressQuestScreen | Rubik Bold 700 | — | 16 / — | — | Write your Reflection |
| [App/screens/in-progress-quest-screen.tsx:104](/Users/jabiullah/Documents/QuestLifeProject/App/screens/in-progress-quest-screen.tsx:104) | InProgressQuestScreen / InProgressQuestScreen | Rubik Regular 400 | 600 | 15 / 22 | — | <TextInput value={note} onChangeText={(value) => setNote(value.slice(0, 1_000))} editable={!savingDestination} multiline textAlignVertical="top" maxLe |
| [App/screens/in-progress-quest-screen.tsx:104](/Users/jabiullah/Documents/QuestLifeProject/App/screens/in-progress-quest-screen.tsx:104) | InProgressQuestScreen / InProgressQuestScreen | Rubik Bold 700 | — | 11 / — | — | {note.length}/1000 |
| [App/screens/in-progress-quest-screen.tsx:105](/Users/jabiullah/Documents/QuestLifeProject/App/screens/in-progress-quest-screen.tsx:105) | InProgressQuestScreen / InProgressQuestScreen | Rubik Bold 700 | — | 16 / — | — | Rate this quest |
| [App/screens/in-progress-quest-screen.tsx:105](/Users/jabiullah/Documents/QuestLifeProject/App/screens/in-progress-quest-screen.tsx:105) | InProgressQuestScreen / InProgressQuestScreen | Rubik Bold 700 | — | 12 / 17 | — | Choose a star rating to continue. |
| [App/screens/in-progress-quest-screen.tsx:107](/Users/jabiullah/Documents/QuestLifeProject/App/screens/in-progress-quest-screen.tsx:107) | InProgressQuestScreen / InProgressQuestScreen | Rubik Bold 700 | — | 12 / 17 | — | {saveError} |
| [App/screens/in-progress-quest-screen.tsx:107](/Users/jabiullah/Documents/QuestLifeProject/App/screens/in-progress-quest-screen.tsx:107) | InProgressQuestScreen / InProgressQuestScreen | Rubik Bold 700 | — | 16 / 22 | — | {savingDestination === "journal" ? "Saving…" : "Done"} |
| [App/screens/in-progress-quest-screen.tsx:107](/Users/jabiullah/Documents/QuestLifeProject/App/screens/in-progress-quest-screen.tsx:107) | InProgressQuestScreen / InProgressQuestScreen | Rubik Bold 700 | 700 | 16 / 22 | — | {savingDestination === "share" ? "Saving…" : "Share your adventure"} |

### App/screens/journal-screen.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/screens/journal-screen.tsx:150](/Users/jabiullah/Documents/QuestLifeProject/App/screens/journal-screen.tsx:150) | JournalTabs / JournalTabs | No family specified; default/inherited/merged | 900 | 13 / — | — | {tab === "journal" ? "My Journal" : tab === "album" ? "My Album" : "Your Stats"} |
| [App/screens/journal-screen.tsx:384](/Users/jabiullah/Documents/QuestLifeProject/App/screens/journal-screen.tsx:384) | renderCell / renderCell | No family specified; default/inherited/merged | isActive \|\| isToday ? "900" : "700" | 14 / — | ["tabular-nums"] | {day.getDate()} |
| [App/screens/journal-screen.tsx:404](/Users/jabiullah/Documents/QuestLifeProject/App/screens/journal-screen.tsx:404) | renderWeekTile / renderWeekTile | No family specified; default/inherited/merged | 900 | 10 / 13 | — | {day.toLocaleDateString("en-US", { weekday: "short" })} |
| [App/screens/journal-screen.tsx:405](/Users/jabiullah/Documents/QuestLifeProject/App/screens/journal-screen.tsx:405) | renderWeekTile / renderWeekTile | No family specified; default/inherited/merged | 900 | 18 / 23 | ["tabular-nums"] | {day.getDate()} |
| [App/screens/journal-screen.tsx:414](/Users/jabiullah/Documents/QuestLifeProject/App/screens/journal-screen.tsx:414) | JournalCalendar / JournalCalendar | No family specified; default/inherited/merged | 900 | 14 / — | — | {label} |
| [App/screens/journal-screen.tsx:462](/Users/jabiullah/Documents/QuestLifeProject/App/screens/journal-screen.tsx:462) | JournalCalendar / JournalCalendar | No family specified; default/inherited/merged | 900 | 10 / — | — | {weekday} |
| [App/screens/journal-screen.tsx:540](/Users/jabiullah/Documents/QuestLifeProject/App/screens/journal-screen.tsx:540) | MoodSelector / MoodSelector | No family specified; default/inherited/merged | 900 | 15 / — | — | {editable ? "Today's mood" : "Mood"} |
| [App/screens/journal-screen.tsx:541](/Users/jabiullah/Documents/QuestLifeProject/App/screens/journal-screen.tsx:541) | MoodSelector / MoodSelector | No family specified; default/inherited/merged | 700 | 12 / — | — | {saving ? "Saving your mood…" : selectedMood ? selectedMood.description : editable ? "Choose what feels most like you" : "No mood recorded"} |
| [App/screens/journal-screen.tsx:543](/Users/jabiullah/Documents/QuestLifeProject/App/screens/journal-screen.tsx:543) | MoodSelector / MoodSelector | No family specified; default/inherited/merged | 900 | 11 / — | — | {selectedMood.label} |
| [App/screens/journal-screen.tsx:577](/Users/jabiullah/Documents/QuestLifeProject/App/screens/journal-screen.tsx:577) | MoodSelector / MoodSelector | No family specified; default/inherited/merged | 900 | 11 / — | — | {option.label} |
| [App/screens/journal-screen.tsx:639](/Users/jabiullah/Documents/QuestLifeProject/App/screens/journal-screen.tsx:639) | TodayMediaSection / TodayMediaSection | No family specified; default/inherited/merged | 900 | 11 / — | — | Today's media |
| [App/screens/journal-screen.tsx:640](/Users/jabiullah/Documents/QuestLifeProject/App/screens/journal-screen.tsx:640) | TodayMediaSection / TodayMediaSection | No family specified; default/inherited/merged | 800 | 11 / — | — | {items.length} photo{items.length === 1 ? "" : "s"} |
| [App/screens/journal-screen.tsx:643](/Users/jabiullah/Documents/QuestLifeProject/App/screens/journal-screen.tsx:643) | TodayMediaSection / TodayMediaSection | No family specified; default/inherited/merged | 800 | 12 / — | — | {failed ? "Couldn't load today's photos. Tap to retry." : loading ? "Preparing today's photo…" : "No photos are ready yet."} |
| [App/screens/journal-screen.tsx:645](/Users/jabiullah/Documents/QuestLifeProject/App/screens/journal-screen.tsx:645) | TodayMediaSection / TodayMediaSection | No family specified; default/inherited/merged | 900 | 11 / — | — | {activeItem.questTitle} |
| [App/screens/journal-screen.tsx:649](/Users/jabiullah/Documents/QuestLifeProject/App/screens/journal-screen.tsx:649) | TodayMediaSection / TodayMediaSection | No family specified; default/inherited/merged | 800 | 11 / — | — | {resolvedItems.length} photos in today’s album |
| [App/screens/journal-screen.tsx:662](/Users/jabiullah/Documents/QuestLifeProject/App/screens/journal-screen.tsx:662) | AlbumQuestGroupCard / AlbumQuestGroupCard | No family specified; default/inherited/merged | 900 | 15 / 20 | — | {quest.questTitle} |
| [App/screens/journal-screen.tsx:662](/Users/jabiullah/Documents/QuestLifeProject/App/screens/journal-screen.tsx:662) | AlbumQuestGroupCard / AlbumQuestGroupCard | No family specified; default/inherited/merged | 700 | 11 / 16 | — | · {displayDate} |
| [App/screens/journal-screen.tsx:663](/Users/jabiullah/Documents/QuestLifeProject/App/screens/journal-screen.tsx:663) | AlbumQuestGroupCard / AlbumQuestGroupCard | No family specified; default/inherited/merged | 800 | 12 / — | — | {failed ? "Photos unavailable — tap to retry" : loading ? "Loading photos…" : "No photos available"} |
| [App/screens/journal-screen.tsx:701](/Users/jabiullah/Documents/QuestLifeProject/App/screens/journal-screen.tsx:701) | DayStatStrip / DayStatStrip | No family specified; default/inherited/merged | 900 | 10 / 13 | — | {cell.label} |
| [App/screens/journal-screen.tsx:704](/Users/jabiullah/Documents/QuestLifeProject/App/screens/journal-screen.tsx:704) | DayStatStrip / DayStatStrip | No family specified; default/inherited/merged | 900 | 18 / 24 | ["tabular-nums"] | {cell.value} |
| [App/screens/journal-screen.tsx:735](/Users/jabiullah/Documents/QuestLifeProject/App/screens/journal-screen.tsx:735) | routeTile / routeTile | No family specified; default/inherited/merged | 900 | 9 / — | — | Route |
| [App/screens/journal-screen.tsx:739](/Users/jabiullah/Documents/QuestLifeProject/App/screens/journal-screen.tsx:739) | MemoryCard / visual | No family specified; default/inherited/merged | 900 | 11 / — | — | Preparing photos… |
| [App/screens/journal-screen.tsx:770](/Users/jabiullah/Documents/QuestLifeProject/App/screens/journal-screen.tsx:770) | MemoryCard / MemoryCard | No family specified; default/inherited/merged | 900 | 17 / 22 | — | {memory.title} |
| [App/screens/journal-screen.tsx:771](/Users/jabiullah/Documents/QuestLifeProject/App/screens/journal-screen.tsx:771) | MemoryCard / MemoryCard | No family specified; default/inherited/merged | 800 | 12 / 16 | — | {sentenceCase(memory.category)} {" · "} {sentenceCase(memory.difficulty)} {" · "} {time} |
| [App/screens/journal-screen.tsx:776](/Users/jabiullah/Documents/QuestLifeProject/App/screens/journal-screen.tsx:776) | MemoryCard / MemoryCard | No family specified; default/inherited/merged | — | — / — | ["tabular-nums"] | {time} |
| [App/screens/journal-screen.tsx:783](/Users/jabiullah/Documents/QuestLifeProject/App/screens/journal-screen.tsx:783) | MemoryCard / MemoryCard | No family specified; default/inherited/merged | 800 | 13 / 17 | ["tabular-nums"] | +{memory.xp} XP {stats.map((stat) => {` · ${stat}`} )} |
| [App/screens/journal-screen.tsx:784](/Users/jabiullah/Documents/QuestLifeProject/App/screens/journal-screen.tsx:784) | MemoryCard / MemoryCard | No family specified; default/inherited/merged | 900 | — / — | — | +{memory.xp} XP |
| [App/screens/journal-screen.tsx:790](/Users/jabiullah/Documents/QuestLifeProject/App/screens/journal-screen.tsx:790) | MemoryCard / MemoryCard | No family specified; default/inherited/merged | 700 | 13 / 19 | — | {`“${memory.reflection}”`} |
| [App/screens/journal-screen.tsx:806](/Users/jabiullah/Documents/QuestLifeProject/App/screens/journal-screen.tsx:806) | ActiveQuestJournalCard / ActiveQuestJournalCard | No family specified; default/inherited/merged | 900 | 11 / — | — | {statusLabel} |
| [App/screens/journal-screen.tsx:808](/Users/jabiullah/Documents/QuestLifeProject/App/screens/journal-screen.tsx:808) | ActiveQuestJournalCard / ActiveQuestJournalCard | No family specified; default/inherited/merged | 900 | 16 / 21 | — | {quest.title} |
| [App/screens/journal-screen.tsx:808](/Users/jabiullah/Documents/QuestLifeProject/App/screens/journal-screen.tsx:808) | ActiveQuestJournalCard / ActiveQuestJournalCard | No family specified; default/inherited/merged | 700 | 12 / 17 | — | Tap to continue your active quest |
| [App/screens/journal-screen.tsx:827](/Users/jabiullah/Documents/QuestLifeProject/App/screens/journal-screen.tsx:827) | EmptyDayCard / EmptyDayCard | No family specified; default/inherited/merged | 900 | 15 / 20 | — | {isToday ? "No quests yet today" : "A quiet day"} |
| [App/screens/journal-screen.tsx:830](/Users/jabiullah/Documents/QuestLifeProject/App/screens/journal-screen.tsx:830) | EmptyDayCard / EmptyDayCard | No family specified; default/inherited/merged | 600 | 13 / 19 | — | {isToday ? "That's okay — a small quest still counts, and tomorrow works too." : "No quests this day. Every good story has quiet chapters."} |
| [App/screens/journal-screen.tsx:894](/Users/jabiullah/Documents/QuestLifeProject/App/screens/journal-screen.tsx:894) | DaySection / DaySection | No family specified; default/inherited/merged | 900 | 20 / 25 | — | Day {dayNumber} {customTitle ? `: ${customTitle}` : ""} |
| [App/screens/journal-screen.tsx:923](/Users/jabiullah/Documents/QuestLifeProject/App/screens/journal-screen.tsx:923) | DaySection / DaySection | No family specified; default/inherited/merged | 800 | 12 / 16 | — | {dateLabel} |
| [App/screens/journal-screen.tsx:936](/Users/jabiullah/Documents/QuestLifeProject/App/screens/journal-screen.tsx:936) | DaySection / DaySection | No family specified; default/inherited/merged | 900 | 11 / — | — | {milestone} |
| [App/screens/journal-screen.tsx:945](/Users/jabiullah/Documents/QuestLifeProject/App/screens/journal-screen.tsx:945) | DaySection / DaySection | No family specified; default/inherited/merged | 900 | 11 / — | — | In progress |
| [App/screens/journal-screen.tsx:949](/Users/jabiullah/Documents/QuestLifeProject/App/screens/journal-screen.tsx:949) | DaySection / DaySection | No family specified; default/inherited/merged | 900 | 11 / — | — | Memories |
| [App/screens/journal-screen.tsx:962](/Users/jabiullah/Documents/QuestLifeProject/App/screens/journal-screen.tsx:962) | DaySection / DaySection | No family specified; default/inherited/merged | 700 | 13 / — | — | A quiet day in your story. |
| [App/screens/journal-screen.tsx:973](/Users/jabiullah/Documents/QuestLifeProject/App/screens/journal-screen.tsx:973) | BeforeJoinMarker / BeforeJoinMarker | No family specified; default/inherited/merged | 800 | 12 / — | — | ✦ You weren't here yet ✦ |
| [App/screens/journal-screen.tsx:974](/Users/jabiullah/Documents/QuestLifeProject/App/screens/journal-screen.tsx:974) | BeforeJoinMarker / BeforeJoinMarker | No family specified; default/inherited/merged | 600 | 11 / — | — | Your story starts on Day 1 — {joinDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}. |
| [App/screens/journal-screen.tsx:1317](/Users/jabiullah/Documents/QuestLifeProject/App/screens/journal-screen.tsx:1317) | JournalScreen / JournalScreen | No family specified; default/inherited/merged | 800 | 13 / — | — | {error} |
| [App/screens/journal-screen.tsx:1334](/Users/jabiullah/Documents/QuestLifeProject/App/screens/journal-screen.tsx:1334) | JournalScreen / JournalScreen | No family specified; default/inherited/merged | 900 | 20 / — | — | Name today's chapter |
| [App/screens/journal-screen.tsx:1335](/Users/jabiullah/Documents/QuestLifeProject/App/screens/journal-screen.tsx:1335) | JournalScreen / JournalScreen | No family specified; default/inherited/merged | 600 | 13 / 19 | — | Give today a title you'll want to reread. You can change it until midnight. |
| [App/screens/journal-screen.tsx:1344](/Users/jabiullah/Documents/QuestLifeProject/App/screens/journal-screen.tsx:1344) | JournalScreen / JournalScreen | No family specified; default/inherited/merged | 800 | — / — | — | <TextInput value={titleDraft} onChangeText={setTitleDraft} placeholder="The sweet memories" placeholderTextColor={T.muted} maxLength={60} style={{ hei |
| [App/screens/journal-screen.tsx:1367](/Users/jabiullah/Documents/QuestLifeProject/App/screens/journal-screen.tsx:1367) | JournalScreen / JournalScreen | No family specified; default/inherited/merged | 900 | 15 / — | — | {savingEntryDates.has(todayKey) ? "Saving…" : "Save title"} |

### App/screens/lobby-screen.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/screens/lobby-screen.tsx:389](/Users/jabiullah/Documents/QuestLifeProject/App/screens/lobby-screen.tsx:389) | RestoredActiveQuestCard / RestoredActiveQuestCard | Rubik Black 900 | — | 21 / 27 | — | Your active quest is ready |
| [App/screens/lobby-screen.tsx:390](/Users/jabiullah/Documents/QuestLifeProject/App/screens/lobby-screen.tsx:390) | RestoredActiveQuestCard / RestoredActiveQuestCard | Rubik Regular 400 | — | 14 / 20 | — | Open it to pick up where you left off. |
| [App/screens/lobby-screen.tsx:398](/Users/jabiullah/Documents/QuestLifeProject/App/screens/lobby-screen.tsx:398) | ActiveQuestMetaPill / ActiveQuestMetaPill | Rubik Bold 700 | — | 11 / 14 | — | {label} |
| [App/screens/lobby-screen.tsx:402](/Users/jabiullah/Documents/QuestLifeProject/App/screens/lobby-screen.tsx:402) | InProgressMetaPill / InProgressMetaPill | No family specified; default/inherited/merged | 900 | 10 / 15 | — | {label} |
| [App/screens/lobby-screen.tsx:439](/Users/jabiullah/Documents/QuestLifeProject/App/screens/lobby-screen.tsx:439) | InProgressQuestRow / InProgressQuestRow | No family specified; default/inherited/merged | 900 | 18 / 23 | — | {quest.title} |
| [App/screens/lobby-screen.tsx:441](/Users/jabiullah/Documents/QuestLifeProject/App/screens/lobby-screen.tsx:441) | InProgressQuestRow / InProgressQuestRow | No family specified; default/inherited/merged | 700 | 15 / 20 | — | {label} |
| [App/screens/lobby-screen.tsx:442](/Users/jabiullah/Documents/QuestLifeProject/App/screens/lobby-screen.tsx:442) | InProgressQuestRow / InProgressQuestRow | Rubik Black 900 | — | 13 / — | — | OPEN |
| [App/screens/lobby-screen.tsx:704](/Users/jabiullah/Documents/QuestLifeProject/App/screens/lobby-screen.tsx:704) | LobbyScreen / LobbyScreen | Rubik Black 900 | — | 24 / — | — | Your quest is still waiting! |
| [App/screens/lobby-screen.tsx:705](/Users/jabiullah/Documents/QuestLifeProject/App/screens/lobby-screen.tsx:705) | LobbyScreen / LobbyScreen | No family specified; default/inherited/merged | 700 | 14 / 20 | — | You haven’t opened QuestLife in {formatElapsedCompact(timeAwayMs)}. You started {activeQuest?.title ?? "your active quest"}{questStartedLabel ? ` on $ |
| [App/screens/lobby-screen.tsx:708](/Users/jabiullah/Documents/QuestLifeProject/App/screens/lobby-screen.tsx:708) | LobbyScreen / LobbyScreen | Rubik Bold 700 | — | 16 / — | ["tabular-nums"] | {formatElapsedCompact(recoveryDuration)} |
| [App/screens/lobby-screen.tsx:708](/Users/jabiullah/Documents/QuestLifeProject/App/screens/lobby-screen.tsx:708) | LobbyScreen / LobbyScreen | Rubik Bold 700 | — | 10 / — | — | Time spent |
| [App/screens/lobby-screen.tsx:709](/Users/jabiullah/Documents/QuestLifeProject/App/screens/lobby-screen.tsx:709) | LobbyScreen / LobbyScreen | Rubik Bold 700 | — | 16 / — | — | {snapshot?.photoCount ?? 0} |
| [App/screens/lobby-screen.tsx:709](/Users/jabiullah/Documents/QuestLifeProject/App/screens/lobby-screen.tsx:709) | LobbyScreen / LobbyScreen | Rubik Bold 700 | — | 10 / — | — | Photos |
| [App/screens/lobby-screen.tsx:710](/Users/jabiullah/Documents/QuestLifeProject/App/screens/lobby-screen.tsx:710) | LobbyScreen / LobbyScreen | Rubik Bold 700 | — | 16 / — | — | {snapshot?.activity.filter((item) => item.kind === "note").length ?? 0} |
| [App/screens/lobby-screen.tsx:710](/Users/jabiullah/Documents/QuestLifeProject/App/screens/lobby-screen.tsx:710) | LobbyScreen / LobbyScreen | Rubik Bold 700 | — | 10 / — | — | Notes |
| [App/screens/lobby-screen.tsx:759](/Users/jabiullah/Documents/QuestLifeProject/App/screens/lobby-screen.tsx:759) | styles.greeting | Rubik Black 900 | — | 20 / 22 | — | Reusable style/token |
| [App/screens/lobby-screen.tsx:770](/Users/jabiullah/Documents/QuestLifeProject/App/screens/lobby-screen.tsx:770) | styles.headerName | Rubik Black 900 | — | 20 / 22 | — | Reusable style/token |
| [App/screens/lobby-screen.tsx:861](/Users/jabiullah/Documents/QuestLifeProject/App/screens/lobby-screen.tsx:861) | styles.energyTitle | No family specified; default/inherited/merged | 900 | 20 / 25 | — | Reusable style/token |
| [App/screens/lobby-screen.tsx:867](/Users/jabiullah/Documents/QuestLifeProject/App/screens/lobby-screen.tsx:867) | styles.energySubtitle | No family specified; default/inherited/merged | 600 | 13 / 18 | — | Reusable style/token |
| [App/screens/lobby-screen.tsx:894](/Users/jabiullah/Documents/QuestLifeProject/App/screens/lobby-screen.tsx:894) | styles.energyPillText | No family specified; default/inherited/merged | 900 | 10 / 13 | — | Reusable style/token |
| [App/screens/lobby-screen.tsx:937](/Users/jabiullah/Documents/QuestLifeProject/App/screens/lobby-screen.tsx:937) | styles.sectionTitle | No family specified; default/inherited/merged | 900 | 20 / 25 | — | Reusable style/token |
| [App/screens/lobby-screen.tsx:943](/Users/jabiullah/Documents/QuestLifeProject/App/screens/lobby-screen.tsx:943) | styles.sectionLink | No family specified; default/inherited/merged | 900 | 13 / 18 | — | Reusable style/token |
| [App/screens/lobby-screen.tsx:970](/Users/jabiullah/Documents/QuestLifeProject/App/screens/lobby-screen.tsx:970) | styles.activeTitle | No family specified; default/inherited/merged | 900 | 23 / 28 | — | Reusable style/token |
| [App/screens/lobby-screen.tsx:982](/Users/jabiullah/Documents/QuestLifeProject/App/screens/lobby-screen.tsx:982) | styles.activeDescription | Rubik Regular 400 | 600 | 14 / 19 | — | Reusable style/token |
| [App/screens/lobby-screen.tsx:1024](/Users/jabiullah/Documents/QuestLifeProject/App/screens/lobby-screen.tsx:1024) | styles.statLabel | Rubik Black 900 | 600 | 15.5 / 20 | — | Reusable style/token |
| [App/screens/lobby-screen.tsx:1033](/Users/jabiullah/Documents/QuestLifeProject/App/screens/lobby-screen.tsx:1033) | styles.statValue | No family specified; default/inherited/merged | 900 | 17 / 23 | — | Reusable style/token |
| [App/screens/lobby-screen.tsx:1039](/Users/jabiullah/Documents/QuestLifeProject/App/screens/lobby-screen.tsx:1039) | styles.elapsedStatValue | No family specified; default/inherited/merged | — | — / — | ["tabular-nums"] | Reusable style/token |
| [App/screens/lobby-screen.tsx:1061](/Users/jabiullah/Documents/QuestLifeProject/App/screens/lobby-screen.tsx:1061) | styles.activePrimaryText | Rubik Bold 700 | 700 | 16 / 22 | — | Reusable style/token |
| [App/screens/lobby-screen.tsx:1081](/Users/jabiullah/Documents/QuestLifeProject/App/screens/lobby-screen.tsx:1081) | styles.emptyQuestTitle | Rubik Black 900 | 900 | 21 / 26 | — | Reusable style/token |
| [App/screens/lobby-screen.tsx:1088](/Users/jabiullah/Documents/QuestLifeProject/App/screens/lobby-screen.tsx:1088) | styles.emptyQuestBody | Rubik Regular 400 | 700 | 13 / 18 | — | Reusable style/token |
| [App/screens/lobby-screen.tsx:1120](/Users/jabiullah/Documents/QuestLifeProject/App/screens/lobby-screen.tsx:1120) | styles.completedEmptyTitle | No family specified; default/inherited/merged | 900 | 16 / 20 | — | Reusable style/token |
| [App/screens/lobby-screen.tsx:1126](/Users/jabiullah/Documents/QuestLifeProject/App/screens/lobby-screen.tsx:1126) | styles.completedEmptyBody | No family specified; default/inherited/merged | 600 | 13 / 18 | — | Reusable style/token |
| [App/screens/lobby-screen.tsx:1152](/Users/jabiullah/Documents/QuestLifeProject/App/screens/lobby-screen.tsx:1152) | styles.completedTitle | No family specified; default/inherited/merged | 900 | 16 / 20 | — | Reusable style/token |
| [App/screens/lobby-screen.tsx:1156](/Users/jabiullah/Documents/QuestLifeProject/App/screens/lobby-screen.tsx:1156) | styles.completedMeta | No family specified; default/inherited/merged | 600 | 12 / 18 | — | Reusable style/token |
| [App/screens/lobby-screen.tsx:1168](/Users/jabiullah/Documents/QuestLifeProject/App/screens/lobby-screen.tsx:1168) | styles.sheetTitle | No family specified; default/inherited/merged | 900 | 22 / — | — | Reusable style/token |
| [App/screens/lobby-screen.tsx:1174](/Users/jabiullah/Documents/QuestLifeProject/App/screens/lobby-screen.tsx:1174) | styles.sheetSubtitle | No family specified; default/inherited/merged | 700 | 13 / 19 | — | Reusable style/token |
| [App/screens/lobby-screen.tsx:1189](/Users/jabiullah/Documents/QuestLifeProject/App/screens/lobby-screen.tsx:1189) | styles.savedTitle | No family specified; default/inherited/merged | 900 | 20 / — | — | Reusable style/token |
| [App/screens/lobby-screen.tsx:1193](/Users/jabiullah/Documents/QuestLifeProject/App/screens/lobby-screen.tsx:1193) | styles.savedBody | No family specified; default/inherited/merged | 700 | — / — | — | Reusable style/token |

### App/screens/manage-saved-quests-screen.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/screens/manage-saved-quests-screen.tsx:14](/Users/jabiullah/Documents/QuestLifeProject/App/screens/manage-saved-quests-screen.tsx:14) | ManageQuest / ManageQuest | Rubik Bold 700 | — | 15 / — | — | {quest.title} |
| [App/screens/manage-saved-quests-screen.tsx:14](/Users/jabiullah/Documents/QuestLifeProject/App/screens/manage-saved-quests-screen.tsx:14) | ManageQuest / ManageQuest | Rubik Bold 700 | — | 10 / — | — | {quest.category} · {quest.timeLabel} |
| [App/screens/manage-saved-quests-screen.tsx:33](/Users/jabiullah/Documents/QuestLifeProject/App/screens/manage-saved-quests-screen.tsx:33) | ManageSavedQuestsScreen / ManageSavedQuestsScreen | Rubik Black 900 | — | 20 / — | — | {selectedIds.length ? `${selectedIds.length} Selected` : "Manage Saved"} |
| [App/screens/manage-saved-quests-screen.tsx:33](/Users/jabiullah/Documents/QuestLifeProject/App/screens/manage-saved-quests-screen.tsx:33) | ManageSavedQuestsScreen / ManageSavedQuestsScreen | Rubik Bold 700 | — | 13 / — | — | {selectedIds.length === available.length ? "Clear" : "Select all"} |
| [App/screens/manage-saved-quests-screen.tsx:34](/Users/jabiullah/Documents/QuestLifeProject/App/screens/manage-saved-quests-screen.tsx:34) | ManageSavedQuestsScreen / ManageSavedQuestsScreen | Rubik Bold 700 | — | 14 / — | — | {saving ? "Working…" : "Unsave"} |
| [App/screens/manage-saved-quests-screen.tsx:34](/Users/jabiullah/Documents/QuestLifeProject/App/screens/manage-saved-quests-screen.tsx:34) | ManageSavedQuestsScreen / ManageSavedQuestsScreen | Rubik Bold 700 | — | 14 / — | — | Add to collection |
| [App/screens/manage-saved-quests-screen.tsx:35](/Users/jabiullah/Documents/QuestLifeProject/App/screens/manage-saved-quests-screen.tsx:35) | ManageSavedQuestsScreen / ManageSavedQuestsScreen | Rubik Black 900 | — | 20 / — | — | Add to collection |
| [App/screens/manage-saved-quests-screen.tsx:35](/Users/jabiullah/Documents/QuestLifeProject/App/screens/manage-saved-quests-screen.tsx:35) | ManageSavedQuestsScreen / ManageSavedQuestsScreen | Rubik Bold 700 | — | 15 / — | — | {saving ? "Saving…" : "Save"} |
| [App/screens/manage-saved-quests-screen.tsx:35](/Users/jabiullah/Documents/QuestLifeProject/App/screens/manage-saved-quests-screen.tsx:35) | ManageSavedQuestsScreen / ManageSavedQuestsScreen | Rubik Regular 400 | — | 13 / — | — | Choose one or more collections for these {selectedIds.length} quests. |
| [App/screens/manage-saved-quests-screen.tsx:35](/Users/jabiullah/Documents/QuestLifeProject/App/screens/manage-saved-quests-screen.tsx:35) | ManageSavedQuestsScreen / ManageSavedQuestsScreen | Rubik Bold 700 | — | 15 / — | — | {pack.title} |
| [App/screens/manage-saved-quests-screen.tsx:35](/Users/jabiullah/Documents/QuestLifeProject/App/screens/manage-saved-quests-screen.tsx:35) | ManageSavedQuestsScreen / ManageSavedQuestsScreen | Rubik Regular 400 | — | 12 / — | — | {pack.questIds.length} quests |
| [App/screens/manage-saved-quests-screen.tsx:35](/Users/jabiullah/Documents/QuestLifeProject/App/screens/manage-saved-quests-screen.tsx:35) | ManageSavedQuestsScreen / ManageSavedQuestsScreen | Rubik Bold 700 | — | — / — | — | Go to Collections |

### App/screens/memory-detail-screen.ios.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/screens/memory-detail-screen.ios.tsx:18](/Users/jabiullah/Documents/QuestLifeProject/App/screens/memory-detail-screen.ios.tsx:18) | MemoryStat / MemoryStat | Rubik Black 900 | — | 20 / — | — | {value} |
| [App/screens/memory-detail-screen.ios.tsx:18](/Users/jabiullah/Documents/QuestLifeProject/App/screens/memory-detail-screen.ios.tsx:18) | MemoryStat / MemoryStat | Rubik Bold 700 | — | 10 / — | — | {label} |
| [App/screens/memory-detail-screen.ios.tsx:23](/Users/jabiullah/Documents/QuestLifeProject/App/screens/memory-detail-screen.ios.tsx:23) | MemoryAction / MemoryAction | Rubik Bold 700 | — | 14 / — | — | {label} |
| [App/screens/memory-detail-screen.ios.tsx:58](/Users/jabiullah/Documents/QuestLifeProject/App/screens/memory-detail-screen.ios.tsx:58) | MemorySheetButton / MemorySheetButton | Rubik Bold 700 | — | 15 / — | — | {label} |
| [App/screens/memory-detail-screen.ios.tsx:251](/Users/jabiullah/Documents/QuestLifeProject/App/screens/memory-detail-screen.ios.tsx:251) | MemoryDetailScreen / MemoryDetailScreen | Rubik Bold 700 | — | 16 / — | — | Journal |
| [App/screens/memory-detail-screen.ios.tsx:253](/Users/jabiullah/Documents/QuestLifeProject/App/screens/memory-detail-screen.ios.tsx:253) | MemoryDetailScreen / MemoryDetailScreen | Rubik Black 900 | — | 29 / 32 | — | {memory.title} |
| [App/screens/memory-detail-screen.ios.tsx:265](/Users/jabiullah/Documents/QuestLifeProject/App/screens/memory-detail-screen.ios.tsx:265) | MemoryDetailScreen / MemoryDetailScreen | Rubik Bold 700 | — | 14 / — | — | Shared adventure |
| [App/screens/memory-detail-screen.ios.tsx:265](/Users/jabiullah/Documents/QuestLifeProject/App/screens/memory-detail-screen.ios.tsx:265) | MemoryDetailScreen / MemoryDetailScreen | Rubik Regular 400 | — | 12 / 17 | — | You completed this with {memory.participants.length} other{memory.participants.length > 1 ? "s" : ""}. |
| [App/screens/memory-detail-screen.ios.tsx:268](/Users/jabiullah/Documents/QuestLifeProject/App/screens/memory-detail-screen.ios.tsx:268) | MemoryDetailScreen / MemoryDetailScreen | Rubik Black 900 | — | 21 / — | — | Photos from this quest |
| [App/screens/memory-detail-screen.ios.tsx:268](/Users/jabiullah/Documents/QuestLifeProject/App/screens/memory-detail-screen.ios.tsx:268) | MemoryDetailScreen / MemoryDetailScreen | Rubik Bold 700 | — | 12 / — | — | Add photo |
| [App/screens/memory-detail-screen.ios.tsx:269](/Users/jabiullah/Documents/QuestLifeProject/App/screens/memory-detail-screen.ios.tsx:269) | MemoryDetailScreen / MemoryDetailScreen | Rubik Bold 700 | — | 13 / — | — | {photosLoading ? "Loading your photos…" : photosFailed ? "Photos couldn’t load" : "No photos saved yet"} |
| [App/screens/memory-detail-screen.ios.tsx:269](/Users/jabiullah/Documents/QuestLifeProject/App/screens/memory-detail-screen.ios.tsx:269) | MemoryDetailScreen / MemoryDetailScreen | No family specified; default/inherited/merged | 700 | 12 / 17 | — | Add a photo to keep this moment in your Journal. |
| [App/screens/memory-detail-screen.ios.tsx:273](/Users/jabiullah/Documents/QuestLifeProject/App/screens/memory-detail-screen.ios.tsx:273) | MemoryDetailScreen / MemoryDetailScreen | Rubik Black 900 | — | 21 / — | — | Your reflection |
| [App/screens/memory-detail-screen.ios.tsx:273](/Users/jabiullah/Documents/QuestLifeProject/App/screens/memory-detail-screen.ios.tsx:273) | MemoryDetailScreen / MemoryDetailScreen | Rubik Bold 700 | — | 12 / 16 | — | {memory.reflection ? "Edit" : "Add"} |
| [App/screens/memory-detail-screen.ios.tsx:274](/Users/jabiullah/Documents/QuestLifeProject/App/screens/memory-detail-screen.ios.tsx:274) | MemoryDetailScreen / MemoryDetailScreen | Rubik Regular 400 | — | 16 / 24 | — | “{memory.reflection}” |
| [App/screens/memory-detail-screen.ios.tsx:274](/Users/jabiullah/Documents/QuestLifeProject/App/screens/memory-detail-screen.ios.tsx:274) | MemoryDetailScreen / MemoryDetailScreen | Rubik Bold 700 | — | 14 / — | — | Add a thought to this memory |
| [App/screens/memory-detail-screen.ios.tsx:274](/Users/jabiullah/Documents/QuestLifeProject/App/screens/memory-detail-screen.ios.tsx:274) | MemoryDetailScreen / MemoryDetailScreen | Rubik Regular 400 | — | 12 / 18 | — | A sentence is enough to help future you remember this moment. |
| [App/screens/memory-detail-screen.ios.tsx:278](/Users/jabiullah/Documents/QuestLifeProject/App/screens/memory-detail-screen.ios.tsx:278) | MemoryDetailScreen / MemoryDetailScreen | Rubik Black 900 | — | 21 / — | — | Shared post |
| [App/screens/memory-detail-screen.ios.tsx:280](/Users/jabiullah/Documents/QuestLifeProject/App/screens/memory-detail-screen.ios.tsx:280) | MemoryDetailScreen / MemoryDetailScreen | Rubik Bold 700 | — | 15 / — | — | Shared with {sharedPost.visibility === "public" ? "everyone" : sharedPost.visibility === "friends" ? "friends" : "only you"} |
| [App/screens/memory-detail-screen.ios.tsx:280](/Users/jabiullah/Documents/QuestLifeProject/App/screens/memory-detail-screen.ios.tsx:280) | MemoryDetailScreen / MemoryDetailScreen | Rubik Regular 400 | — | 12 / — | — | {new Date(sharedPost.createdAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })} · Comments {sharedPost.commentsEnab |
| [App/screens/memory-detail-screen.ios.tsx:281](/Users/jabiullah/Documents/QuestLifeProject/App/screens/memory-detail-screen.ios.tsx:281) | MemoryDetailScreen / MemoryDetailScreen | Rubik Regular 400 | — | 14 / 21 | — | “{sharedPost.caption.trim()}” |
| [App/screens/memory-detail-screen.ios.tsx:287](/Users/jabiullah/Documents/QuestLifeProject/App/screens/memory-detail-screen.ios.tsx:287) | MemoryDetailScreen / MemoryDetailScreen | Rubik Bold 700 | — | 17 / — | — | Your recorded route |
| [App/screens/memory-detail-screen.ios.tsx:301](/Users/jabiullah/Documents/QuestLifeProject/App/screens/memory-detail-screen.ios.tsx:301) | MemoryDetailScreen / MemoryDetailScreen | No family specified; default/inherited/merged | 900 | 22 / 28 | — | Edit reflection |
| [App/screens/memory-detail-screen.ios.tsx:301](/Users/jabiullah/Documents/QuestLifeProject/App/screens/memory-detail-screen.ios.tsx:301) | MemoryDetailScreen / MemoryDetailScreen | No family specified; default/inherited/merged | 700 | 13 / 18 | — | This stays private in your Journal. |
| [App/screens/memory-detail-screen.ios.tsx:302](/Users/jabiullah/Documents/QuestLifeProject/App/screens/memory-detail-screen.ios.tsx:302) | MemoryDetailScreen / MemoryDetailScreen | No family specified; default/inherited/merged | 700 | 15 / 22 | — | <TextInput value={reflectionDraft} onChangeText={setReflectionDraft} multiline textAlignVertical="top" autoFocus placeholder="What do you want to reme |
| [App/screens/memory-detail-screen.ios.tsx:303](/Users/jabiullah/Documents/QuestLifeProject/App/screens/memory-detail-screen.ios.tsx:303) | MemoryDetailScreen / MemoryDetailScreen | No family specified; default/inherited/merged | 800 | 12 / 17 | — | {reflectionError} |
| [App/screens/memory-detail-screen.ios.tsx:309](/Users/jabiullah/Documents/QuestLifeProject/App/screens/memory-detail-screen.ios.tsx:309) | MemoryDetailScreen / MemoryDetailScreen | No family specified; default/inherited/merged | 900 | 22 / 28 | — | Manage photo |
| [App/screens/memory-detail-screen.ios.tsx:309](/Users/jabiullah/Documents/QuestLifeProject/App/screens/memory-detail-screen.ios.tsx:309) | MemoryDetailScreen / MemoryDetailScreen | No family specified; default/inherited/merged | 700 | 13 / 19 | — | Replace it with another moment or remove it from this memory. |

### App/screens/memory-detail-screen.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/screens/memory-detail-screen.tsx:17](/Users/jabiullah/Documents/QuestLifeProject/App/screens/memory-detail-screen.tsx:17) | MemoryStat / MemoryStat | Rubik Black 900 | — | 20 / — | — | {value} |
| [App/screens/memory-detail-screen.tsx:17](/Users/jabiullah/Documents/QuestLifeProject/App/screens/memory-detail-screen.tsx:17) | MemoryStat / MemoryStat | Rubik Bold 700 | — | 10 / — | — | {label} |
| [App/screens/memory-detail-screen.tsx:22](/Users/jabiullah/Documents/QuestLifeProject/App/screens/memory-detail-screen.tsx:22) | MemoryAction / MemoryAction | Rubik Bold 700 | — | 14 / — | — | {label} |
| [App/screens/memory-detail-screen.tsx:57](/Users/jabiullah/Documents/QuestLifeProject/App/screens/memory-detail-screen.tsx:57) | MemorySheetButton / MemorySheetButton | Rubik Bold 700 | — | 15 / — | — | {label} |
| [App/screens/memory-detail-screen.tsx:250](/Users/jabiullah/Documents/QuestLifeProject/App/screens/memory-detail-screen.tsx:250) | MemoryDetailScreen / MemoryDetailScreen | Rubik Bold 700 | — | 16 / — | — | Journal |
| [App/screens/memory-detail-screen.tsx:252](/Users/jabiullah/Documents/QuestLifeProject/App/screens/memory-detail-screen.tsx:252) | MemoryDetailScreen / MemoryDetailScreen | Rubik Black 900 | — | 29 / 32 | — | {memory.title} |
| [App/screens/memory-detail-screen.tsx:263](/Users/jabiullah/Documents/QuestLifeProject/App/screens/memory-detail-screen.tsx:263) | MemoryDetailScreen / MemoryDetailScreen | Rubik Bold 700 | — | 14 / — | — | Shared adventure |
| [App/screens/memory-detail-screen.tsx:263](/Users/jabiullah/Documents/QuestLifeProject/App/screens/memory-detail-screen.tsx:263) | MemoryDetailScreen / MemoryDetailScreen | Rubik Regular 400 | — | 12 / 17 | — | You completed this with {memory.participants.length} other{memory.participants.length > 1 ? "s" : ""}. |
| [App/screens/memory-detail-screen.tsx:266](/Users/jabiullah/Documents/QuestLifeProject/App/screens/memory-detail-screen.tsx:266) | MemoryDetailScreen / MemoryDetailScreen | Rubik Black 900 | — | 21 / — | — | Photos from this quest |
| [App/screens/memory-detail-screen.tsx:266](/Users/jabiullah/Documents/QuestLifeProject/App/screens/memory-detail-screen.tsx:266) | MemoryDetailScreen / MemoryDetailScreen | Rubik Bold 700 | — | 12 / — | — | Add photo |
| [App/screens/memory-detail-screen.tsx:267](/Users/jabiullah/Documents/QuestLifeProject/App/screens/memory-detail-screen.tsx:267) | MemoryDetailScreen / MemoryDetailScreen | Rubik Bold 700 | — | 13 / — | — | {photosLoading ? "Loading your photos…" : photosFailed ? "Photos couldn’t load" : "No photos saved yet"} |
| [App/screens/memory-detail-screen.tsx:267](/Users/jabiullah/Documents/QuestLifeProject/App/screens/memory-detail-screen.tsx:267) | MemoryDetailScreen / MemoryDetailScreen | No family specified; default/inherited/merged | 700 | 12 / 17 | — | Add a photo to keep this moment in your Journal. |
| [App/screens/memory-detail-screen.tsx:271](/Users/jabiullah/Documents/QuestLifeProject/App/screens/memory-detail-screen.tsx:271) | MemoryDetailScreen / MemoryDetailScreen | Rubik Black 900 | — | 21 / — | — | Your reflection |
| [App/screens/memory-detail-screen.tsx:271](/Users/jabiullah/Documents/QuestLifeProject/App/screens/memory-detail-screen.tsx:271) | MemoryDetailScreen / MemoryDetailScreen | Rubik Bold 700 | — | 12 / 16 | — | {memory.reflection ? "Edit" : "Add"} |
| [App/screens/memory-detail-screen.tsx:272](/Users/jabiullah/Documents/QuestLifeProject/App/screens/memory-detail-screen.tsx:272) | MemoryDetailScreen / MemoryDetailScreen | Rubik Regular 400 | — | 16 / 24 | — | “{memory.reflection}” |
| [App/screens/memory-detail-screen.tsx:272](/Users/jabiullah/Documents/QuestLifeProject/App/screens/memory-detail-screen.tsx:272) | MemoryDetailScreen / MemoryDetailScreen | Rubik Bold 700 | — | 14 / — | — | Add a thought to this memory |
| [App/screens/memory-detail-screen.tsx:272](/Users/jabiullah/Documents/QuestLifeProject/App/screens/memory-detail-screen.tsx:272) | MemoryDetailScreen / MemoryDetailScreen | Rubik Regular 400 | — | 12 / 18 | — | A sentence is enough to help future you remember this moment. |
| [App/screens/memory-detail-screen.tsx:276](/Users/jabiullah/Documents/QuestLifeProject/App/screens/memory-detail-screen.tsx:276) | MemoryDetailScreen / MemoryDetailScreen | Rubik Black 900 | — | 21 / — | — | Shared post |
| [App/screens/memory-detail-screen.tsx:278](/Users/jabiullah/Documents/QuestLifeProject/App/screens/memory-detail-screen.tsx:278) | MemoryDetailScreen / MemoryDetailScreen | Rubik Bold 700 | — | 15 / — | — | Shared with {sharedPost.visibility === "public" ? "everyone" : sharedPost.visibility === "friends" ? "friends" : "only you"} |
| [App/screens/memory-detail-screen.tsx:278](/Users/jabiullah/Documents/QuestLifeProject/App/screens/memory-detail-screen.tsx:278) | MemoryDetailScreen / MemoryDetailScreen | Rubik Regular 400 | — | 12 / — | — | {new Date(sharedPost.createdAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })} · Comments {sharedPost.commentsEnab |
| [App/screens/memory-detail-screen.tsx:279](/Users/jabiullah/Documents/QuestLifeProject/App/screens/memory-detail-screen.tsx:279) | MemoryDetailScreen / MemoryDetailScreen | Rubik Regular 400 | — | 14 / 21 | — | “{sharedPost.caption.trim()}” |
| [App/screens/memory-detail-screen.tsx:285](/Users/jabiullah/Documents/QuestLifeProject/App/screens/memory-detail-screen.tsx:285) | MemoryDetailScreen / MemoryDetailScreen | Rubik Bold 700 | — | 17 / — | — | Your recorded route |
| [App/screens/memory-detail-screen.tsx:299](/Users/jabiullah/Documents/QuestLifeProject/App/screens/memory-detail-screen.tsx:299) | MemoryDetailScreen / MemoryDetailScreen | No family specified; default/inherited/merged | 900 | 22 / 28 | — | Edit reflection |
| [App/screens/memory-detail-screen.tsx:299](/Users/jabiullah/Documents/QuestLifeProject/App/screens/memory-detail-screen.tsx:299) | MemoryDetailScreen / MemoryDetailScreen | No family specified; default/inherited/merged | 700 | 13 / 18 | — | This stays private in your Journal. |
| [App/screens/memory-detail-screen.tsx:300](/Users/jabiullah/Documents/QuestLifeProject/App/screens/memory-detail-screen.tsx:300) | MemoryDetailScreen / MemoryDetailScreen | No family specified; default/inherited/merged | 700 | 15 / 22 | — | <TextInput value={reflectionDraft} onChangeText={setReflectionDraft} multiline textAlignVertical="top" autoFocus placeholder="What do you want to reme |
| [App/screens/memory-detail-screen.tsx:301](/Users/jabiullah/Documents/QuestLifeProject/App/screens/memory-detail-screen.tsx:301) | MemoryDetailScreen / MemoryDetailScreen | No family specified; default/inherited/merged | 800 | 12 / 17 | — | {reflectionError} |
| [App/screens/memory-detail-screen.tsx:307](/Users/jabiullah/Documents/QuestLifeProject/App/screens/memory-detail-screen.tsx:307) | MemoryDetailScreen / MemoryDetailScreen | No family specified; default/inherited/merged | 900 | 22 / 28 | — | Manage photo |
| [App/screens/memory-detail-screen.tsx:307](/Users/jabiullah/Documents/QuestLifeProject/App/screens/memory-detail-screen.tsx:307) | MemoryDetailScreen / MemoryDetailScreen | No family specified; default/inherited/merged | 700 | 13 / 19 | — | Replace it with another moment or remove it from this memory. |

### App/screens/notifications-screen.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/screens/notifications-screen.tsx:46](/Users/jabiullah/Documents/QuestLifeProject/App/screens/notifications-screen.tsx:46) | CategoryChip / CategoryChip | Rubik Bold 700 | — | 12 / — | — | {category} |
| [App/screens/notifications-screen.tsx:52](/Users/jabiullah/Documents/QuestLifeProject/App/screens/notifications-screen.tsx:52) | NotificationRow / NotificationRow | Rubik Bold 700 | — | 15 / 20 | — | {item.title} |
| [App/screens/notifications-screen.tsx:52](/Users/jabiullah/Documents/QuestLifeProject/App/screens/notifications-screen.tsx:52) | NotificationRow / NotificationRow | Rubik Bold 700 | — | 12 / 17 | — | {formatTime(item.createdAt)} |
| [App/screens/notifications-screen.tsx:52](/Users/jabiullah/Documents/QuestLifeProject/App/screens/notifications-screen.tsx:52) | NotificationRow / NotificationRow | Rubik Regular 400 | — | 13 / 19 | — | {item.body} |
| [App/screens/notifications-screen.tsx:52](/Users/jabiullah/Documents/QuestLifeProject/App/screens/notifications-screen.tsx:52) | NotificationRow / NotificationRow | Rubik Bold 700 | — | 11 / — | — | {reward} |
| [App/screens/notifications-screen.tsx:56](/Users/jabiullah/Documents/QuestLifeProject/App/screens/notifications-screen.tsx:56) | FeedSection / FeedSection | Rubik Black 900 | — | 22 / 28 | — | {title} |
| [App/screens/notifications-screen.tsx:56](/Users/jabiullah/Documents/QuestLifeProject/App/screens/notifications-screen.tsx:56) | FeedSection / FeedSection | Rubik Bold 700 | — | 12 / — | — | {items.length} update{items.length === 1 ? "" : "s"} |

### App/screens/profile-screen.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/screens/profile-screen.tsx:53](/Users/jabiullah/Documents/QuestLifeProject/App/screens/profile-screen.tsx:53) | HeaderControl / HeaderControl | Rubik Bold 700 | — | 14 / 18 | — | {label} |
| [App/screens/profile-screen.tsx:110](/Users/jabiullah/Documents/QuestLifeProject/App/screens/profile-screen.tsx:110) | ProfileTitleBadge / ProfileTitleBadge | Rubik Bold 700 | — | 11 / 14 | — | {value} |
| [App/screens/profile-screen.tsx:248](/Users/jabiullah/Documents/QuestLifeProject/App/screens/profile-screen.tsx:248) | pill / pill | Rubik Bold 700 | — | 13 / 16 | — | {metric.value} |
| [App/screens/profile-screen.tsx:248](/Users/jabiullah/Documents/QuestLifeProject/App/screens/profile-screen.tsx:248) | pill / pill | Rubik Bold 700 | — | 9 / 12 | — | {metric.label} |
| [App/screens/profile-screen.tsx:251](/Users/jabiullah/Documents/QuestLifeProject/App/screens/profile-screen.tsx:251) | ProfileStatMarquee / ProfileStatMarquee | Rubik Bold 700 | — | 12 / — | — | These profile stats are private. |
| [App/screens/profile-screen.tsx:273](/Users/jabiullah/Documents/QuestLifeProject/App/screens/profile-screen.tsx:273) | ProfileStatVisibilityBento / ProfileStatVisibilityBento | Rubik Bold 700 | — | 15 / 20 | — | Carousel stats |
| [App/screens/profile-screen.tsx:273](/Users/jabiullah/Documents/QuestLifeProject/App/screens/profile-screen.tsx:273) | ProfileStatVisibilityBento / ProfileStatVisibilityBento | Rubik Regular 400 | — | 11 / 15 | — | Choose what to include · keep at least 3. |
| [App/screens/profile-screen.tsx:273](/Users/jabiullah/Documents/QuestLifeProject/App/screens/profile-screen.tsx:273) | ProfileStatVisibilityBento / ProfileStatVisibilityBento | Rubik Bold 700 | — | 11 / — | — | {shownCount}/6 shown |
| [App/screens/profile-screen.tsx:280](/Users/jabiullah/Documents/QuestLifeProject/App/screens/profile-screen.tsx:280) | ProfileStatVisibilityBento / ProfileStatVisibilityBento | Rubik Bold 700 | — | 11 / 14 | — | {metric.label} |
| [App/screens/profile-screen.tsx:280](/Users/jabiullah/Documents/QuestLifeProject/App/screens/profile-screen.tsx:280) | ProfileStatVisibilityBento / ProfileStatVisibilityBento | Rubik Bold 700 | — | 12 / 15 | — | {metric.value} |
| [App/screens/profile-screen.tsx:296](/Users/jabiullah/Documents/QuestLifeProject/App/screens/profile-screen.tsx:296) | ProfilePrivacyControls / ProfilePrivacyControls | Rubik Bold 700 | — | 15 / 20 | — | Profile visibility |
| [App/screens/profile-screen.tsx:296](/Users/jabiullah/Documents/QuestLifeProject/App/screens/profile-screen.tsx:296) | ProfilePrivacyControls / ProfilePrivacyControls | Rubik Regular 400 | — | 11 / 15 | — | Your name and @username are always visible. |
| [App/screens/profile-screen.tsx:297](/Users/jabiullah/Documents/QuestLifeProject/App/screens/profile-screen.tsx:297) | ProfilePrivacyControls / ProfilePrivacyControls | Rubik Bold 700 | — | 12 / 16 | — | {row.label} |
| [App/screens/profile-screen.tsx:297](/Users/jabiullah/Documents/QuestLifeProject/App/screens/profile-screen.tsx:297) | ProfilePrivacyControls / ProfilePrivacyControls | Rubik Regular 400 | — | 10 / 14 | — | {row.detail} |
| [App/screens/profile-screen.tsx:297](/Users/jabiullah/Documents/QuestLifeProject/App/screens/profile-screen.tsx:297) | ProfilePrivacyControls / ProfilePrivacyControls | Rubik Bold 700 | — | 10 / — | — | {audienceLabels[option]} |
| [App/screens/profile-screen.tsx:307](/Users/jabiullah/Documents/QuestLifeProject/App/screens/profile-screen.tsx:307) | FollowerManagerSheet / FollowerManagerSheet | Rubik Bold 700 | — | 22 / — | — | Friends |
| [App/screens/profile-screen.tsx:307](/Users/jabiullah/Documents/QuestLifeProject/App/screens/profile-screen.tsx:307) | FollowerManagerSheet / FollowerManagerSheet | Rubik Regular 400 | — | 12 / — | — | Remove anyone you no longer want in your friend circle. |
| [App/screens/profile-screen.tsx:307](/Users/jabiullah/Documents/QuestLifeProject/App/screens/profile-screen.tsx:307) | FollowerManagerSheet / FollowerManagerSheet | Rubik Bold 700 | — | 13 / — | — | {person.displayName} |
| [App/screens/profile-screen.tsx:307](/Users/jabiullah/Documents/QuestLifeProject/App/screens/profile-screen.tsx:307) | FollowerManagerSheet / FollowerManagerSheet | Rubik Regular 400 | — | 11 / — | — | {person.username ? `@${person.username}` : "QuestLife adventurer"} |
| [App/screens/profile-screen.tsx:307](/Users/jabiullah/Documents/QuestLifeProject/App/screens/profile-screen.tsx:307) | FollowerManagerSheet / FollowerManagerSheet | Rubik Bold 700 | — | 11 / — | — | {removingId === person.userId ? "Removing…" : "Remove"} |
| [App/screens/profile-screen.tsx:332](/Users/jabiullah/Documents/QuestLifeProject/App/screens/profile-screen.tsx:332) | ProfileFollowersButton / ProfileFollowersButton | Rubik Bold 700 | — | 12 / 16 | — | {count.toLocaleString()} friend{count === 1 ? "" : "s"} |
| [App/screens/profile-screen.tsx:336](/Users/jabiullah/Documents/QuestLifeProject/App/screens/profile-screen.tsx:336) | ProfilePrivacySheet / ProfilePrivacySheet | Rubik Black 900 | — | 22 / 28 | — | Privacy settings |
| [App/screens/profile-screen.tsx:336](/Users/jabiullah/Documents/QuestLifeProject/App/screens/profile-screen.tsx:336) | ProfilePrivacySheet / ProfilePrivacySheet | Rubik Regular 400 | — | 13 / 19 | — | Your bio is always visible. Choose who can see other profile details. |
| [App/screens/profile-screen.tsx:347](/Users/jabiullah/Documents/QuestLifeProject/App/screens/profile-screen.tsx:347) | QuestTrail / QuestTrail | Rubik Black 900 | — | 19 / 24 | — | Your Quest Trail |
| [App/screens/profile-screen.tsx:348](/Users/jabiullah/Documents/QuestLifeProject/App/screens/profile-screen.tsx:348) | QuestTrail / QuestTrail | Rubik Regular 400 | 700 | 12 / 17 | — | The adventures you return to most |
| [App/screens/profile-screen.tsx:357](/Users/jabiullah/Documents/QuestLifeProject/App/screens/profile-screen.tsx:357) | QuestTrail / QuestTrail | Rubik Black 900 | — | 12 / 15 | — | {index + 1} |
| [App/screens/profile-screen.tsx:359](/Users/jabiullah/Documents/QuestLifeProject/App/screens/profile-screen.tsx:359) | QuestTrail / QuestTrail | Rubik Bold 700 | — | 14 / 19 | — | {categoryLabel(entry.category)} |
| [App/screens/profile-screen.tsx:360](/Users/jabiullah/Documents/QuestLifeProject/App/screens/profile-screen.tsx:360) | QuestTrail / QuestTrail | Rubik Bold 700 | — | 12 / 16 | ["tabular-nums"] | {entry.completedQuests} {entry.completedQuests === 1 ? "quest" : "quests"} |
| [App/screens/profile-screen.tsx:364](/Users/jabiullah/Documents/QuestLifeProject/App/screens/profile-screen.tsx:364) | QuestTrail / QuestTrail | Rubik Bold 700 | — | 14 / 19 | — | Your trail starts with one quest. |
| [App/screens/profile-screen.tsx:364](/Users/jabiullah/Documents/QuestLifeProject/App/screens/profile-screen.tsx:364) | QuestTrail / QuestTrail | Rubik Regular 400 | 700 | 12 / 17 | — | Complete adventures to reveal the categories you love most. |
| [App/screens/profile-screen.tsx:386](/Users/jabiullah/Documents/QuestLifeProject/App/screens/profile-screen.tsx:386) | YourStatsDashboard / YourStatsDashboard | Rubik Black 900 | — | 23 / 28 | — | Level {level} |
| [App/screens/profile-screen.tsx:387](/Users/jabiullah/Documents/QuestLifeProject/App/screens/profile-screen.tsx:387) | YourStatsDashboard / YourStatsDashboard | Rubik Regular 400 | 700 | 12 / 17 | — | {xpRemaining.toLocaleString()} XP to level {nextLevel} |
| [App/screens/profile-screen.tsx:391](/Users/jabiullah/Documents/QuestLifeProject/App/screens/profile-screen.tsx:391) | YourStatsDashboard / YourStatsDashboard | Rubik Bold 700 | — | 12 / 16 | — | {intoLevel.toLocaleString()} / {toNext.toLocaleString()} XP |
| [App/screens/profile-screen.tsx:391](/Users/jabiullah/Documents/QuestLifeProject/App/screens/profile-screen.tsx:391) | YourStatsDashboard / YourStatsDashboard | Rubik Bold 700 | — | 11 / 15 | — | Level {nextLevel} |
| [App/screens/profile-screen.tsx:396](/Users/jabiullah/Documents/QuestLifeProject/App/screens/profile-screen.tsx:396) | YourStatsDashboard / YourStatsDashboard | Rubik Black 900 | — | 19 / 24 | — | Overview |
| [App/screens/profile-screen.tsx:401](/Users/jabiullah/Documents/QuestLifeProject/App/screens/profile-screen.tsx:401) | YourStatsDashboard / YourStatsDashboard | Rubik Bold 700 | — | 23 / 28 | ["tabular-nums"] | {metric.value} |
| [App/screens/profile-screen.tsx:403](/Users/jabiullah/Documents/QuestLifeProject/App/screens/profile-screen.tsx:403) | YourStatsDashboard / YourStatsDashboard | Rubik Bold 700 | — | 11 / 15 | — | {metric.label} |
| [App/screens/profile-screen.tsx:572](/Users/jabiullah/Documents/QuestLifeProject/App/screens/profile-screen.tsx:572) | ProfileScreen / ProfileScreen | Rubik Bold 700 | — | 15 / 20 | — | <TextInput value={draftFirstName} onChangeText={setDraftFirstName} accessibilityLabel="First name" autoCapitalize="words" placeholder="First name" pla |
| [App/screens/profile-screen.tsx:572](/Users/jabiullah/Documents/QuestLifeProject/App/screens/profile-screen.tsx:572) | ProfileScreen / ProfileScreen | Rubik Bold 700 | — | 15 / 20 | — | <TextInput value={draftLastName} onChangeText={setDraftLastName} accessibilityLabel="Last name" autoCapitalize="words" placeholder="Last name (optiona |
| [App/screens/profile-screen.tsx:572](/Users/jabiullah/Documents/QuestLifeProject/App/screens/profile-screen.tsx:572) | ProfileScreen / ProfileScreen | Rubik Black 900 | — | 22 / 28 | — | {displayName} |
| [App/screens/profile-screen.tsx:573](/Users/jabiullah/Documents/QuestLifeProject/App/screens/profile-screen.tsx:573) | ProfileScreen / ProfileScreen | Rubik Bold 700 | — | 13 / 18 | — | @{username} |
| [App/screens/profile-screen.tsx:576](/Users/jabiullah/Documents/QuestLifeProject/App/screens/profile-screen.tsx:576) | ProfileScreen / ProfileScreen | Rubik Regular 400 | — | 15 / 20 | — | <TextInput value={draftBio} onChangeText={setDraftBio} accessibilityLabel="Bio" placeholder="Write a bio…" placeholderTextColor={T.muted} multiline ma |
| [App/screens/profile-screen.tsx:576](/Users/jabiullah/Documents/QuestLifeProject/App/screens/profile-screen.tsx:576) | ProfileScreen / ProfileScreen | Rubik Regular 400 | — | 15 / 20 | — | {profile.bio \|\| "Tap the pencil icon to add a bio."} |
| [App/screens/profile-screen.tsx:579](/Users/jabiullah/Documents/QuestLifeProject/App/screens/profile-screen.tsx:579) | ProfileScreen / ProfileScreen | Rubik Bold 700 | — | 12 / — | — | {error} |

### App/screens/quest-collections-screen.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/screens/quest-collections-screen.tsx:29](/Users/jabiullah/Documents/QuestLifeProject/App/screens/quest-collections-screen.tsx:29) | CollectionCard / CollectionCard | Rubik Black 900 | — | 15 / — | — | {pack.title} |
| [App/screens/quest-collections-screen.tsx:30](/Users/jabiullah/Documents/QuestLifeProject/App/screens/quest-collections-screen.tsx:30) | CollectionCard / CollectionCard | Rubik Regular 400 | — | 11 / — | — | {quest.title} |
| [App/screens/quest-collections-screen.tsx:30](/Users/jabiullah/Documents/QuestLifeProject/App/screens/quest-collections-screen.tsx:30) | CollectionCard / CollectionCard | Rubik Regular 400 | — | 11 / — | — | No quests yet |
| [App/screens/quest-collections-screen.tsx:30](/Users/jabiullah/Documents/QuestLifeProject/App/screens/quest-collections-screen.tsx:30) | CollectionCard / CollectionCard | Rubik Bold 700 | — | 11 / — | — | +{quests.length - 3} more |
| [App/screens/quest-collections-screen.tsx:31](/Users/jabiullah/Documents/QuestLifeProject/App/screens/quest-collections-screen.tsx:31) | CollectionCard / CollectionCard | Rubik Bold 700 | — | 11 / — | — | {quests.length} {quests.length === 1 ? "quest" : "quests"} |
| [App/screens/quest-collections-screen.tsx:31](/Users/jabiullah/Documents/QuestLifeProject/App/screens/quest-collections-screen.tsx:31) | CollectionCard / CollectionCard | Rubik Bold 700 | — | 11 / — | — | View all |
| [App/screens/quest-collections-screen.tsx:38](/Users/jabiullah/Documents/QuestLifeProject/App/screens/quest-collections-screen.tsx:38) | SavedQuestPicker / SavedQuestPicker | Rubik Bold 700 | — | 14 / — | — | {quest.title} |
| [App/screens/quest-collections-screen.tsx:38](/Users/jabiullah/Documents/QuestLifeProject/App/screens/quest-collections-screen.tsx:38) | SavedQuestPicker / SavedQuestPicker | Rubik Bold 700 | — | 10 / — | — | {quest.category} |
| [App/screens/quest-collections-screen.tsx:96](/Users/jabiullah/Documents/QuestLifeProject/App/screens/quest-collections-screen.tsx:96) | QuestCollectionsScreen / QuestCollectionsScreen | Rubik Black 900 | — | 22 / — | — | Quest Collections |
| [App/screens/quest-collections-screen.tsx:99](/Users/jabiullah/Documents/QuestLifeProject/App/screens/quest-collections-screen.tsx:99) | QuestCollectionsScreen / QuestCollectionsScreen | Rubik Bold 700 | — | 15 / — | — | Cancel |
| [App/screens/quest-collections-screen.tsx:99](/Users/jabiullah/Documents/QuestLifeProject/App/screens/quest-collections-screen.tsx:99) | QuestCollectionsScreen / QuestCollectionsScreen | Rubik Black 900 | — | 18 / — | — | New collection |
| [App/screens/quest-collections-screen.tsx:99](/Users/jabiullah/Documents/QuestLifeProject/App/screens/quest-collections-screen.tsx:99) | QuestCollectionsScreen / QuestCollectionsScreen | Rubik Bold 700 | — | 15 / — | — | Next |
| [App/screens/quest-collections-screen.tsx:99](/Users/jabiullah/Documents/QuestLifeProject/App/screens/quest-collections-screen.tsx:99) | QuestCollectionsScreen / QuestCollectionsScreen | Rubik Bold 700 | — | 11 / — | — | Add photo |
| [App/screens/quest-collections-screen.tsx:99](/Users/jabiullah/Documents/QuestLifeProject/App/screens/quest-collections-screen.tsx:99) | QuestCollectionsScreen / QuestCollectionsScreen | Rubik Regular 400 | — | 16 / — | — | <TextInput autoFocus value={name} onChangeText={setName} placeholder="Collection name" placeholderTextColor={T.muted} style={{ minHeight: 58, borderRa |
| [App/screens/quest-collections-screen.tsx:99](/Users/jabiullah/Documents/QuestLifeProject/App/screens/quest-collections-screen.tsx:99) | QuestCollectionsScreen / QuestCollectionsScreen | Rubik Regular 400 | — | 12 / 17 | — | Private collection · you can add a cover photo now or later. |
| [App/screens/quest-collections-screen.tsx:100](/Users/jabiullah/Documents/QuestLifeProject/App/screens/quest-collections-screen.tsx:100) | QuestCollectionsScreen / QuestCollectionsScreen | Rubik Black 900 | — | 18 / — | — | Add from Saved |
| [App/screens/quest-collections-screen.tsx:100](/Users/jabiullah/Documents/QuestLifeProject/App/screens/quest-collections-screen.tsx:100) | QuestCollectionsScreen / QuestCollectionsScreen | Rubik Bold 700 | — | 15 / — | — | {saving ? "Saving…" : "Save"} |
| [App/screens/quest-collections-screen.tsx:100](/Users/jabiullah/Documents/QuestLifeProject/App/screens/quest-collections-screen.tsx:100) | QuestCollectionsScreen / QuestCollectionsScreen | Rubik Bold 700 | — | 13 / — | — | {error} |

### App/screens/quest-detail-screen.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/screens/quest-detail-screen.tsx:44](/Users/jabiullah/Documents/QuestLifeProject/App/screens/quest-detail-screen.tsx:44) | QuestHeaderPill / QuestHeaderPill | Rubik Black 900 | — | 10 / 12 | — | {label} |
| [App/screens/quest-detail-screen.tsx:51](/Users/jabiullah/Documents/QuestLifeProject/App/screens/quest-detail-screen.tsx:51) | QuestAction / QuestAction | Rubik Bold 700 | — | 14 / — | — | {label} |
| [App/screens/quest-detail-screen.tsx:55](/Users/jabiullah/Documents/QuestLifeProject/App/screens/quest-detail-screen.tsx:55) | Stat / Stat | Rubik Black 900 | — | 20 / — | — | {value} |
| [App/screens/quest-detail-screen.tsx:55](/Users/jabiullah/Documents/QuestLifeProject/App/screens/quest-detail-screen.tsx:55) | Stat / Stat | Rubik Bold 700 | — | 10 / — | — | {label} |
| [App/screens/quest-detail-screen.tsx:158](/Users/jabiullah/Documents/QuestLifeProject/App/screens/quest-detail-screen.tsx:158) | QuestDetailScreen / QuestDetailScreen | Rubik Black 900 | — | 29 / 32 | — | {quest.title} |
| [App/screens/quest-detail-screen.tsx:158](/Users/jabiullah/Documents/QuestLifeProject/App/screens/quest-detail-screen.tsx:158) | QuestDetailScreen / QuestDetailScreen | Rubik Bold 700 | — | 13 / 18 | — | by {creatorHandle} |
| [App/screens/quest-detail-screen.tsx:161](/Users/jabiullah/Documents/QuestLifeProject/App/screens/quest-detail-screen.tsx:161) | QuestDetailScreen / QuestDetailScreen | Rubik Black 900 | — | 21 / — | — | About this quest |
| [App/screens/quest-detail-screen.tsx:161](/Users/jabiullah/Documents/QuestLifeProject/App/screens/quest-detail-screen.tsx:161) | QuestDetailScreen / QuestDetailScreen | Rubik Regular 400 | — | 16 / 25 | — | {quest.description} |
| [App/screens/quest-detail-screen.tsx:162](/Users/jabiullah/Documents/QuestLifeProject/App/screens/quest-detail-screen.tsx:162) | QuestDetailScreen / QuestDetailScreen | Rubik Black 900 | — | 20 / — | — | How it works |
| [App/screens/quest-detail-screen.tsx:162](/Users/jabiullah/Documents/QuestLifeProject/App/screens/quest-detail-screen.tsx:162) | QuestDetailScreen / QuestDetailScreen | Rubik Bold 700 | — | 13 / — | — | {index + 1} |
| [App/screens/quest-detail-screen.tsx:162](/Users/jabiullah/Documents/QuestLifeProject/App/screens/quest-detail-screen.tsx:162) | QuestDetailScreen / QuestDetailScreen | Rubik Regular 400 | — | 14 / 20 | — | {step} |
| [App/screens/quest-detail-screen.tsx:166](/Users/jabiullah/Documents/QuestLifeProject/App/screens/quest-detail-screen.tsx:166) | QuestDetailScreen / QuestDetailScreen | Rubik Black 900 | — | 24 / — | — | {questMode === "focused" ? "Ready to begin?" : "Add this quest to In progress?"} |
| [App/screens/quest-detail-screen.tsx:166](/Users/jabiullah/Documents/QuestLifeProject/App/screens/quest-detail-screen.tsx:166) | QuestDetailScreen / QuestDetailScreen | Rubik Regular 400 | — | 14 / 20 | — | {questMode === "focused" ? "Your live quest timer will start and you can capture moments as you go." : "No timer will start. This quest will stay with |
| [App/screens/quest-detail-screen.tsx:167](/Users/jabiullah/Documents/QuestLifeProject/App/screens/quest-detail-screen.tsx:167) | QuestDetailScreen / QuestDetailScreen | Rubik Black 900 | — | 23 / — | — | You already have an active quest |
| [App/screens/quest-detail-screen.tsx:167](/Users/jabiullah/Documents/QuestLifeProject/App/screens/quest-detail-screen.tsx:167) | QuestDetailScreen / QuestDetailScreen | Rubik Regular 400 | — | 14 / 20 | — | Finish or abandon your current focused quest before starting another. |
| [App/screens/quest-detail-screen.tsx:168](/Users/jabiullah/Documents/QuestLifeProject/App/screens/quest-detail-screen.tsx:168) | QuestDetailScreen / QuestDetailScreen | Rubik Black 900 | — | 22 / — | — | Challenge friends |
| [App/screens/quest-detail-screen.tsx:168](/Users/jabiullah/Documents/QuestLifeProject/App/screens/quest-detail-screen.tsx:168) | QuestDetailScreen / QuestDetailScreen | Rubik Regular 400 | — | 13 / — | — | Invite a friend or share this quest in another app. |
| [App/screens/quest-detail-screen.tsx:168](/Users/jabiullah/Documents/QuestLifeProject/App/screens/quest-detail-screen.tsx:168) | QuestDetailScreen / QuestDetailScreen | Rubik Bold 700 | — | 15 / — | — | {friend.displayName} |

### App/screens/saved-screen.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/screens/saved-screen.tsx:62](/Users/jabiullah/Documents/QuestLifeProject/App/screens/saved-screen.tsx:62) | CollectionPreview / CollectionPreview | Rubik Bold 700 | — | 13 / — | — | {pack.title} |
| [App/screens/saved-screen.tsx:63](/Users/jabiullah/Documents/QuestLifeProject/App/screens/saved-screen.tsx:63) | CollectionPreview / CollectionPreview | Rubik Regular 400 | — | 11 / — | — | Private |
| [App/screens/saved-screen.tsx:78](/Users/jabiullah/Documents/QuestLifeProject/App/screens/saved-screen.tsx:78) | QuestRow / QuestRow | No family specified; default/inherited/merged | 900 | 18 / 23 | — | {quest.title} |
| [App/screens/saved-screen.tsx:79](/Users/jabiullah/Documents/QuestLifeProject/App/screens/saved-screen.tsx:79) | QuestRow / QuestRow | No family specified; default/inherited/merged | 700 | 13 / 19 | — | {quest.description} |
| [App/screens/saved-screen.tsx:80](/Users/jabiullah/Documents/QuestLifeProject/App/screens/saved-screen.tsx:80) | QuestRow / QuestRow | No family specified; default/inherited/merged | 900 | 12 / 16 | — | +{quest.xp} XP |
| [App/screens/saved-screen.tsx:80](/Users/jabiullah/Documents/QuestLifeProject/App/screens/saved-screen.tsx:80) | QuestRow / QuestRow | No family specified; default/inherited/merged | 900 | 12 / 16 | — | {quest.timeLabel} |
| [App/screens/saved-screen.tsx:80](/Users/jabiullah/Documents/QuestLifeProject/App/screens/saved-screen.tsx:80) | QuestRow / QuestRow | Rubik Black 900 | — | 13 / — | — | MORE INFO |
| [App/screens/saved-screen.tsx:87](/Users/jabiullah/Documents/QuestLifeProject/App/screens/saved-screen.tsx:87) | SavedSearch / SavedSearch | Rubik Bold 700 | — | 16 / 21 | — | <TextInput value={value} onChangeText={onChangeText} placeholder="Search Quests" placeholderTextColor={T.muted} accessibilityLabel="Search saved quest |
| [App/screens/saved-screen.tsx:98](/Users/jabiullah/Documents/QuestLifeProject/App/screens/saved-screen.tsx:98) | SavedSortOptionIcon / SavedSortOptionIcon | No family specified; default/inherited/merged | 900 | 7 / — | — | XP |
| [App/screens/saved-screen.tsx:103](/Users/jabiullah/Documents/QuestLifeProject/App/screens/saved-screen.tsx:103) | SavedFilterChoice / SavedFilterChoice | No family specified; default/inherited/merged | 800 | 12 / — | — | {label} |
| [App/screens/saved-screen.tsx:109](/Users/jabiullah/Documents/QuestLifeProject/App/screens/saved-screen.tsx:109) | SavedQuestFiltersSheet / SavedQuestFiltersSheet | No family specified; default/inherited/merged | 900 | 20 / 24 | — | Sort & Filter |
| [App/screens/saved-screen.tsx:109](/Users/jabiullah/Documents/QuestLifeProject/App/screens/saved-screen.tsx:109) | SavedQuestFiltersSheet / SavedQuestFiltersSheet | No family specified; default/inherited/merged | 700 | 12 / 16 | — | Customize your saved quests |
| [App/screens/saved-screen.tsx:109](/Users/jabiullah/Documents/QuestLifeProject/App/screens/saved-screen.tsx:109) | SavedQuestFiltersSheet / SavedQuestFiltersSheet | No family specified; default/inherited/merged | 800 | 12 / — | — | Reset |
| [App/screens/saved-screen.tsx:109](/Users/jabiullah/Documents/QuestLifeProject/App/screens/saved-screen.tsx:109) | SavedQuestFiltersSheet / SavedQuestFiltersSheet | No family specified; default/inherited/merged | 900 | 11 / — | — | Sort by |
| [App/screens/saved-screen.tsx:109](/Users/jabiullah/Documents/QuestLifeProject/App/screens/saved-screen.tsx:109) | SavedQuestFiltersSheet / SavedQuestFiltersSheet | No family specified; default/inherited/merged | 800 | 11 / 14 | — | {option.label} |
| [App/screens/saved-screen.tsx:109](/Users/jabiullah/Documents/QuestLifeProject/App/screens/saved-screen.tsx:109) | SavedQuestFiltersSheet / SavedQuestFiltersSheet | No family specified; default/inherited/merged | 900 | 11 / — | — | Duration |
| [App/screens/saved-screen.tsx:109](/Users/jabiullah/Documents/QuestLifeProject/App/screens/saved-screen.tsx:109) | SavedQuestFiltersSheet / SavedQuestFiltersSheet | No family specified; default/inherited/merged | 900 | 11 / — | — | Difficulty |
| [App/screens/saved-screen.tsx:109](/Users/jabiullah/Documents/QuestLifeProject/App/screens/saved-screen.tsx:109) | SavedQuestFiltersSheet / SavedQuestFiltersSheet | Rubik Bold 700 | — | 16 / — | — | Done |
| [App/screens/saved-screen.tsx:139](/Users/jabiullah/Documents/QuestLifeProject/App/screens/saved-screen.tsx:139) | SavedScreen / SavedScreen | Rubik Black 900 | — | 20 / — | — | Collections |
| [App/screens/saved-screen.tsx:139](/Users/jabiullah/Documents/QuestLifeProject/App/screens/saved-screen.tsx:139) | SavedScreen / SavedScreen | Rubik Bold 700 | — | 13 / — | — | See all |
| [App/screens/saved-screen.tsx:140](/Users/jabiullah/Documents/QuestLifeProject/App/screens/saved-screen.tsx:140) | SavedScreen / SavedScreen | Rubik Bold 700 | — | 14 / — | — | Group quests you want to do |
| [App/screens/saved-screen.tsx:140](/Users/jabiullah/Documents/QuestLifeProject/App/screens/saved-screen.tsx:140) | SavedScreen / SavedScreen | Rubik Regular 400 | — | 12 / — | — | Create a collection from Saved. |
| [App/screens/saved-screen.tsx:142](/Users/jabiullah/Documents/QuestLifeProject/App/screens/saved-screen.tsx:142) | SavedScreen / SavedScreen | Rubik Black 900 | — | 20 / — | — | Saved Quests |
| [App/screens/saved-screen.tsx:142](/Users/jabiullah/Documents/QuestLifeProject/App/screens/saved-screen.tsx:142) | SavedScreen / SavedScreen | Rubik Bold 700 | — | 13 / — | — | Manage |
| [App/screens/saved-screen.tsx:149](/Users/jabiullah/Documents/QuestLifeProject/App/screens/saved-screen.tsx:149) | FilterGroup / FilterGroup | Rubik Bold 700 | — | 11 / — | — | {title} |

### App/screens/settings-screen.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/screens/settings-screen.tsx:37](/Users/jabiullah/Documents/QuestLifeProject/App/screens/settings-screen.tsx:37) | SettingsHeader / SettingsHeader | Rubik Bold 700 | — | 11 / — | — | {eyebrow} |
| [App/screens/settings-screen.tsx:37](/Users/jabiullah/Documents/QuestLifeProject/App/screens/settings-screen.tsx:37) | SettingsHeader / SettingsHeader | Rubik Black 900 | — | 25 / 30 | — | {title} |
| [App/screens/settings-screen.tsx:46](/Users/jabiullah/Documents/QuestLifeProject/App/screens/settings-screen.tsx:46) | SettingGroup / SettingGroup | Rubik Bold 700 | — | 11 / — | — | {title} |
| [App/screens/settings-screen.tsx:50](/Users/jabiullah/Documents/QuestLifeProject/App/screens/settings-screen.tsx:50) | SettingRow / body | Rubik Bold 700 | — | 15 / 19 | — | {title} |
| [App/screens/settings-screen.tsx:50](/Users/jabiullah/Documents/QuestLifeProject/App/screens/settings-screen.tsx:50) | SettingRow / body | Rubik Regular 400 | — | 12 / 16 | — | {detail} |
| [App/screens/settings-screen.tsx:50](/Users/jabiullah/Documents/QuestLifeProject/App/screens/settings-screen.tsx:50) | SettingRow / body | Rubik Bold 700 | — | 12 / — | — | {value} |
| [App/screens/settings-screen.tsx:69](/Users/jabiullah/Documents/QuestLifeProject/App/screens/settings-screen.tsx:69) | AppearanceSelector / AppearanceSelector | Rubik Bold 700 | — | 12 / — | — | {choice.label} |
| [App/screens/settings-screen.tsx:109](/Users/jabiullah/Documents/QuestLifeProject/App/screens/settings-screen.tsx:109) | ConfirmationDialog / ConfirmationDialog | Rubik Black 900 | — | 23 / — | — | {isDelete ? "Delete account?" : "Sign out?"} |
| [App/screens/settings-screen.tsx:110](/Users/jabiullah/Documents/QuestLifeProject/App/screens/settings-screen.tsx:110) | ConfirmationDialog / ConfirmationDialog | Rubik Regular 400 | — | 13 / 19 | — | {isDelete ? "This permanently removes your account and its data. This cannot be undone." : "Your active quest, streak, and progress stay safely stored |
| [App/screens/settings-screen.tsx:115](/Users/jabiullah/Documents/QuestLifeProject/App/screens/settings-screen.tsx:115) | ConfirmationDialog / ConfirmationDialog | Rubik Bold 700 | — | 12 / — | — | Type DELETE to confirm |
| [App/screens/settings-screen.tsx:116](/Users/jabiullah/Documents/QuestLifeProject/App/screens/settings-screen.tsx:116) | ConfirmationDialog / ConfirmationDialog | Rubik Bold 700 | — | 15 / — | — | <TextInput value={confirmation} onChangeText={setConfirmation} autoCapitalize="characters" autoCorrect={false} placeholder="DELETE" placeholderTextCol |
| [App/screens/settings-screen.tsx:118](/Users/jabiullah/Documents/QuestLifeProject/App/screens/settings-screen.tsx:118) | ConfirmationDialog / ConfirmationDialog | Rubik Bold 700 | — | 12 / 17 | — | {error} |
| [App/screens/settings-screen.tsx:163](/Users/jabiullah/Documents/QuestLifeProject/App/screens/settings-screen.tsx:163) | NotificationPreferencesScreen / NotificationPreferencesScreen | Rubik Bold 700 | — | 14 / — | — | Manage device notification permissions |
| [App/screens/settings-screen.tsx:171](/Users/jabiullah/Documents/QuestLifeProject/App/screens/settings-screen.tsx:171) | PrivacySettingsScreen / PrivacySettingsScreen | Rubik Regular 400 | — | 12 / 17 | — | You can change the audience for any shared post from its post menu. |
| [App/screens/settings-screen.tsx:180](/Users/jabiullah/Documents/QuestLifeProject/App/screens/settings-screen.tsx:180) | AppPreferencesScreen / AppPreferencesScreen | Rubik Bold 700 | — | 15 / — | — | Appearance |
| [App/screens/settings-screen.tsx:180](/Users/jabiullah/Documents/QuestLifeProject/App/screens/settings-screen.tsx:180) | AppPreferencesScreen / AppPreferencesScreen | Rubik Regular 400 | — | 12 / 16 | — | Choose how QuestLife looks on this device |
| [App/screens/settings-screen.tsx:185](/Users/jabiullah/Documents/QuestLifeProject/App/screens/settings-screen.tsx:185) | FaqRow / FaqRow | Rubik Bold 700 | — | 14 / 19 | — | {question} |
| [App/screens/settings-screen.tsx:185](/Users/jabiullah/Documents/QuestLifeProject/App/screens/settings-screen.tsx:185) | FaqRow / FaqRow | Rubik Regular 400 | — | 13 / 19 | — | {answer} |
| [App/screens/settings-screen.tsx:190](/Users/jabiullah/Documents/QuestLifeProject/App/screens/settings-screen.tsx:190) | HelpSupportScreen / HelpSupportScreen | Rubik Black 900 | — | 18 / — | — | Need direct help? |
| [App/screens/settings-screen.tsx:190](/Users/jabiullah/Documents/QuestLifeProject/App/screens/settings-screen.tsx:190) | HelpSupportScreen / HelpSupportScreen | Rubik Regular 400 | — | 13 / 18 | — | The team is available Monday-Friday. We typically reply within 24 hours. |
| [App/screens/settings-screen.tsx:195](/Users/jabiullah/Documents/QuestLifeProject/App/screens/settings-screen.tsx:195) | AboutQuestLifeScreen / AboutQuestLifeScreen | Rubik Black 900 | — | 25 / — | — | QuestLife |
| [App/screens/settings-screen.tsx:195](/Users/jabiullah/Documents/QuestLifeProject/App/screens/settings-screen.tsx:195) | AboutQuestLifeScreen / AboutQuestLifeScreen | Rubik Bold 700 | — | 12 / — | — | Version 1.0.0 |
| [App/screens/settings-screen.tsx:195](/Users/jabiullah/Documents/QuestLifeProject/App/screens/settings-screen.tsx:195) | AboutQuestLifeScreen / AboutQuestLifeScreen | Rubik Regular 400 | — | 13 / 20 | — | QuestLife helps you turn everyday moments into real-world adventures. Build streaks, collect memories, and grow with the people around you. |
| [App/screens/settings-screen.tsx:195](/Users/jabiullah/Documents/QuestLifeProject/App/screens/settings-screen.tsx:195) | AboutQuestLifeScreen / AboutQuestLifeScreen | Rubik Regular 400 | — | 12 / — | — | Made with care for people who want to live a bigger life. |

### App/screens/share-adventure-screen.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/screens/share-adventure-screen.tsx:55](/Users/jabiullah/Documents/QuestLifeProject/App/screens/share-adventure-screen.tsx:55) | AddPhotoCard / AddPhotoCard | Rubik Bold 700 | — | 13 / — | — | Add photo |
| [App/screens/share-adventure-screen.tsx:142](/Users/jabiullah/Documents/QuestLifeProject/App/screens/share-adventure-screen.tsx:142) | ShareAdventureScreen / labelStyle | Rubik Bold 700 | — | 14 / — | — | Reusable style/token |
| [App/screens/share-adventure-screen.tsx:143](/Users/jabiullah/Documents/QuestLifeProject/App/screens/share-adventure-screen.tsx:143) | ShareAdventureScreen / supportingStyle | Rubik Regular 400 | — | 12 / 18 | — | Reusable style/token |
| [App/screens/share-adventure-screen.tsx:160](/Users/jabiullah/Documents/QuestLifeProject/App/screens/share-adventure-screen.tsx:160) | ShareAdventureScreen / ShareAdventureScreen | Rubik Black 900 | — | wide ? 32 : 27 / wide ? 39 : 34 | — | {questTitle} |
| [App/screens/share-adventure-screen.tsx:161](/Users/jabiullah/Documents/QuestLifeProject/App/screens/share-adventure-screen.tsx:161) | ShareAdventureScreen / ShareAdventureScreen | Rubik Bold 700 | — | 12 / 18 | — | +{memory.xp} XP earned |
| [App/screens/share-adventure-screen.tsx:166](/Users/jabiullah/Documents/QuestLifeProject/App/screens/share-adventure-screen.tsx:166) | ShareAdventureScreen / ShareAdventureScreen | Rubik Regular 400 | — | 17 / 26 | — | <TextInput accessibilityLabel="Your quest story" value={review} onChangeText={(value) => { setReview(value.slice(0, 1_000)); setEdited(true); }} onFoc |
| [App/screens/share-adventure-screen.tsx:167](/Users/jabiullah/Documents/QuestLifeProject/App/screens/share-adventure-screen.tsx:167) | ShareAdventureScreen / ShareAdventureScreen | Rubik Regular 400 | — | 12 / 18 | ["tabular-nums"] | {review.length}/1000 |

### App/screens/social-screen.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/screens/social-screen.tsx:23](/Users/jabiullah/Documents/QuestLifeProject/App/screens/social-screen.tsx:23) | FeedScopeTab / FeedScopeTab | No family specified; default/inherited/merged | 900 | 12 / — | — | {label} |
| [App/screens/social-screen.tsx:39](/Users/jabiullah/Documents/QuestLifeProject/App/screens/social-screen.tsx:39) | FriendRequestCard / FriendRequestCard | No family specified; default/inherited/merged | 900 | 16 / — | — | {request.displayName} |
| [App/screens/social-screen.tsx:39](/Users/jabiullah/Documents/QuestLifeProject/App/screens/social-screen.tsx:39) | FriendRequestCard / FriendRequestCard | No family specified; default/inherited/merged | 700 | 12 / — | — | wants to be friends |
| [App/screens/social-screen.tsx:43](/Users/jabiullah/Documents/QuestLifeProject/App/screens/social-screen.tsx:43) | FriendCard / FriendCard | No family specified; default/inherited/merged | 900 | 15 / — | — | {friend.displayName} |
| [App/screens/social-screen.tsx:43](/Users/jabiullah/Documents/QuestLifeProject/App/screens/social-screen.tsx:43) | FriendCard / FriendCard | No family specified; default/inherited/merged | 700 | 12 / — | — | {friend.lastQuestTitle ?? "Ready for a new quest"} |
| [App/screens/social-screen.tsx:97](/Users/jabiullah/Documents/QuestLifeProject/App/screens/social-screen.tsx:97) | SocialScreen / header | No family specified; default/inherited/merged | 900 | 13 / — | — | {item} |
| [App/screens/social-screen.tsx:104](/Users/jabiullah/Documents/QuestLifeProject/App/screens/social-screen.tsx:104) | SocialScreen / SocialScreen | No family specified; default/inherited/merged | 800 | — / — | — | {feedError} |
| [App/screens/social-screen.tsx:104](/Users/jabiullah/Documents/QuestLifeProject/App/screens/social-screen.tsx:104) | SocialScreen / SocialScreen | No family specified; default/inherited/merged | 800 | — / — | — | {error} |
| [App/screens/social-screen.tsx:104](/Users/jabiullah/Documents/QuestLifeProject/App/screens/social-screen.tsx:104) | SocialScreen / SocialScreen | No family specified; default/inherited/merged | 900 | 13 / — | — | Friend requests |
| [App/screens/social-screen.tsx:104](/Users/jabiullah/Documents/QuestLifeProject/App/screens/social-screen.tsx:104) | SocialScreen / SocialScreen | No family specified; default/inherited/merged | 900 | 13 / — | — | Friends · {overview.friends.length} |

### App/screens/streak-invite-friends-screen.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/screens/streak-invite-friends-screen.tsx:19](/Users/jabiullah/Documents/QuestLifeProject/App/screens/streak-invite-friends-screen.tsx:19) | InviteButton / InviteButton | No family specified; default/inherited/merged | 900 | 12 / — | — | {label} |
| [App/screens/streak-invite-friends-screen.tsx:52](/Users/jabiullah/Documents/QuestLifeProject/App/screens/streak-invite-friends-screen.tsx:52) | StreakInviteFriendsScreen / StreakInviteFriendsScreen | No family specified; default/inherited/merged | 900 | 23 / — | — | Invite a friend |
| [App/screens/streak-invite-friends-screen.tsx:52](/Users/jabiullah/Documents/QuestLifeProject/App/screens/streak-invite-friends-screen.tsx:52) | StreakInviteFriendsScreen / StreakInviteFriendsScreen | No family specified; default/inherited/merged | 700 | 13 / — | — | It starts after they accept and advances when you both quest that day. |
| [App/screens/streak-invite-friends-screen.tsx:57](/Users/jabiullah/Documents/QuestLifeProject/App/screens/streak-invite-friends-screen.tsx:57) | StreakInviteFriendsScreen / StreakInviteFriendsScreen | No family specified; default/inherited/merged | 700 | 15 / — | — | <TextInput autoFocus value={query} onChangeText={setQuery} placeholder="Search your friends" placeholderTextColor={T.muted} autoCapitalize="none" auto |
| [App/screens/streak-invite-friends-screen.tsx:63](/Users/jabiullah/Documents/QuestLifeProject/App/screens/streak-invite-friends-screen.tsx:63) | StreakInviteFriendsScreen / StreakInviteFriendsScreen | No family specified; default/inherited/merged | 800 | — / — | — | Finding your friends… |
| [App/screens/streak-invite-friends-screen.tsx:67](/Users/jabiullah/Documents/QuestLifeProject/App/screens/streak-invite-friends-screen.tsx:67) | StreakInviteFriendsScreen / StreakInviteFriendsScreen | No family specified; default/inherited/merged | 900 | 16 / — | — | {friend.displayName} |
| [App/screens/streak-invite-friends-screen.tsx:67](/Users/jabiullah/Documents/QuestLifeProject/App/screens/streak-invite-friends-screen.tsx:67) | StreakInviteFriendsScreen / StreakInviteFriendsScreen | No family specified; default/inherited/merged | 700 | 12 / — | — | {friend.username ? `@${friend.username}` : "QuestLife friend"} |

### App/screens/streak-screen.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/screens/streak-screen.tsx:72](/Users/jabiullah/Documents/QuestLifeProject/App/screens/streak-screen.tsx:72) | StreakActionButton / StreakActionButton | No family specified; default/inherited/merged | 900 | 14 / — | — | {label} |
| [App/screens/streak-screen.tsx:164](/Users/jabiullah/Documents/QuestLifeProject/App/screens/streak-screen.tsx:164) | StreakHero / StreakHero | No family specified; default/inherited/merged | 900 | 54 / 60 | ["tabular-nums"] | {days} |
| [App/screens/streak-screen.tsx:165](/Users/jabiullah/Documents/QuestLifeProject/App/screens/streak-screen.tsx:165) | StreakHero / StreakHero | No family specified; default/inherited/merged | 900 | 29 / 36 | — | day streak |
| [App/screens/streak-screen.tsx:170](/Users/jabiullah/Documents/QuestLifeProject/App/screens/streak-screen.tsx:170) | StreakHero / StreakHero | No family specified; default/inherited/merged | 900 | 16 / — | — | 7 Day Challenge |
| [App/screens/streak-screen.tsx:171](/Users/jabiullah/Documents/QuestLifeProject/App/screens/streak-screen.tsx:171) | StreakHero / StreakHero | No family specified; default/inherited/merged | 800 | 13 / — | — | Day {currentDay} of 7 |
| [App/screens/streak-screen.tsx:177](/Users/jabiullah/Documents/QuestLifeProject/App/screens/streak-screen.tsx:177) | StreakHero / StreakHero | No family specified; default/inherited/merged | 900 | 12 / — | — | {day} |
| [App/screens/streak-screen.tsx:202](/Users/jabiullah/Documents/QuestLifeProject/App/screens/streak-screen.tsx:202) | StreakTabs / StreakTabs | No family specified; default/inherited/merged | 900 | 15 / 20 | — | {label} |
| [App/screens/streak-screen.tsx:202](/Users/jabiullah/Documents/QuestLifeProject/App/screens/streak-screen.tsx:202) | StreakTabs / StreakTabs | No family specified; default/inherited/merged | 900 | 9 / — | — | {inviteCount} |
| [App/screens/streak-screen.tsx:273](/Users/jabiullah/Documents/QuestLifeProject/App/screens/streak-screen.tsx:273) | CalendarCard / CalendarCard | No family specified; default/inherited/merged | 900 | 22 / 27 | — | {MONTH_NAMES[month]} {year} |
| [App/screens/streak-screen.tsx:273](/Users/jabiullah/Documents/QuestLifeProject/App/screens/streak-screen.tsx:273) | CalendarCard / CalendarCard | No family specified; default/inherited/merged | 900 | 12 / — | — | {day} |
| [App/screens/streak-screen.tsx:273](/Users/jabiullah/Documents/QuestLifeProject/App/screens/streak-screen.tsx:273) | CalendarCard / CalendarCard | No family specified; default/inherited/merged | 900 | 13 / — | — | {date.getDate()} |
| [App/screens/streak-screen.tsx:273](/Users/jabiullah/Documents/QuestLifeProject/App/screens/streak-screen.tsx:273) | CalendarCard / CalendarCard | No family specified; default/inherited/merged | 700 | 11 / — | — | Orange marks your current streak · dates show completed quests |
| [App/screens/streak-screen.tsx:315](/Users/jabiullah/Documents/QuestLifeProject/App/screens/streak-screen.tsx:315) | PersonalContent / PersonalContent | No family specified; default/inherited/merged | 900 | 19 / — | — | Streak leaderboard |
| [App/screens/streak-screen.tsx:315](/Users/jabiullah/Documents/QuestLifeProject/App/screens/streak-screen.tsx:315) | PersonalContent / PersonalContent | No family specified; default/inherited/merged | 800 | 12 / — | — | Personal streaks |
| [App/screens/streak-screen.tsx:319](/Users/jabiullah/Documents/QuestLifeProject/App/screens/streak-screen.tsx:319) | PersonalContent / PersonalContent | No family specified; default/inherited/merged | 900 | 16 / — | — | {index + 1} |
| [App/screens/streak-screen.tsx:321](/Users/jabiullah/Documents/QuestLifeProject/App/screens/streak-screen.tsx:321) | PersonalContent / PersonalContent | No family specified; default/inherited/merged | 900 | 16 / — | — | {row.name} |
| [App/screens/streak-screen.tsx:322](/Users/jabiullah/Documents/QuestLifeProject/App/screens/streak-screen.tsx:322) | PersonalContent / PersonalContent | No family specified; default/inherited/merged | 900 | 16 / — | — | {row.streak} |
| [App/screens/streak-screen.tsx:333](/Users/jabiullah/Documents/QuestLifeProject/App/screens/streak-screen.tsx:333) | PersonalContent / PersonalContent | No family specified; default/inherited/merged | 900 | 15 / — | — | Yesterday can be a grace day |
| [App/screens/streak-screen.tsx:334](/Users/jabiullah/Documents/QuestLifeProject/App/screens/streak-screen.tsx:334) | PersonalContent / PersonalContent | No family specified; default/inherited/merged | 700 | 12 / 17 | — | Restore this streak once every 30 days. It never creates a fake quest. |
| [App/screens/streak-screen.tsx:341](/Users/jabiullah/Documents/QuestLifeProject/App/screens/streak-screen.tsx:341) | PersonalContent / PersonalContent | No family specified; default/inherited/merged | 900 | 15 / — | — | Show my streak |
| [App/screens/streak-screen.tsx:341](/Users/jabiullah/Documents/QuestLifeProject/App/screens/streak-screen.tsx:341) | PersonalContent / PersonalContent | No family specified; default/inherited/merged | 700 | 12 / 17 | — | Let friends see you on their leaderboard |
| [App/screens/streak-screen.tsx:346](/Users/jabiullah/Documents/QuestLifeProject/App/screens/streak-screen.tsx:346) | PersonalContent / PersonalContent | No family specified; default/inherited/merged | 900 | 19 / — | — | Monthly Overview |
| [App/screens/streak-screen.tsx:352](/Users/jabiullah/Documents/QuestLifeProject/App/screens/streak-screen.tsx:352) | DuoCard / DuoCard | No family specified; default/inherited/merged | 900 | 16 / — | — | {duo.partnerName} |
| [App/screens/streak-screen.tsx:352](/Users/jabiullah/Documents/QuestLifeProject/App/screens/streak-screen.tsx:352) | DuoCard / DuoCard | No family specified; default/inherited/merged | 700 | 12 / — | — | Together since {MONTH_NAMES[parseDateKey(duo.startedOn).getMonth()].slice(0, 3)} {parseDateKey(duo.startedOn).getDate()} |
| [App/screens/streak-screen.tsx:352](/Users/jabiullah/Documents/QuestLifeProject/App/screens/streak-screen.tsx:352) | DuoCard / DuoCard | No family specified; default/inherited/merged | 900 | 22 / — | — | {duo.currentStreak} |
| [App/screens/streak-screen.tsx:352](/Users/jabiullah/Documents/QuestLifeProject/App/screens/streak-screen.tsx:352) | DuoCard / DuoCard | No family specified; default/inherited/merged | 800 | 11 / — | — | You |
| [App/screens/streak-screen.tsx:352](/Users/jabiullah/Documents/QuestLifeProject/App/screens/streak-screen.tsx:352) | DuoCard / DuoCard | No family specified; default/inherited/merged | 800 | 11 / — | — | {duo.partnerName} |
| [App/screens/streak-screen.tsx:352](/Users/jabiullah/Documents/QuestLifeProject/App/screens/streak-screen.tsx:352) | DuoCard / DuoCard | No family specified; default/inherited/merged | 900 | 12 / — | — | Streak safe for today |
| [App/screens/streak-screen.tsx:352](/Users/jabiullah/Documents/QuestLifeProject/App/screens/streak-screen.tsx:352) | DuoCard / DuoCard | No family specified; default/inherited/merged | 800 | 12 / — | — | End this streak |
| [App/screens/streak-screen.tsx:363](/Users/jabiullah/Documents/QuestLifeProject/App/screens/streak-screen.tsx:363) | FriendsContent / FriendsContent | No family specified; default/inherited/merged | 900 | 19 / — | — | New invites |
| [App/screens/streak-screen.tsx:363](/Users/jabiullah/Documents/QuestLifeProject/App/screens/streak-screen.tsx:363) | FriendsContent / FriendsContent | No family specified; default/inherited/merged | 900 | — / — | — | {invite.senderName} |
| [App/screens/streak-screen.tsx:366](/Users/jabiullah/Documents/QuestLifeProject/App/screens/streak-screen.tsx:366) | FriendsContent / FriendsContent | No family specified; default/inherited/merged | 900 | 19 / — | — | Shared streaks |
| [App/screens/streak-screen.tsx:366](/Users/jabiullah/Documents/QuestLifeProject/App/screens/streak-screen.tsx:366) | FriendsContent / FriendsContent | No family specified; default/inherited/merged | 700 | 12 / 17 | — | Both friends must complete a quest on the same day. |
| [App/screens/streak-screen.tsx:368](/Users/jabiullah/Documents/QuestLifeProject/App/screens/streak-screen.tsx:368) | FriendsContent / FriendsContent | No family specified; default/inherited/merged | 900 | — / — | — | {invite.recipientName} |
| [App/screens/streak-screen.tsx:368](/Users/jabiullah/Documents/QuestLifeProject/App/screens/streak-screen.tsx:368) | FriendsContent / FriendsContent | No family specified; default/inherited/merged | 700 | 12 / — | — | Streak invite pending |
| [App/screens/streak-screen.tsx:368](/Users/jabiullah/Documents/QuestLifeProject/App/screens/streak-screen.tsx:368) | FriendsContent / FriendsContent | No family specified; default/inherited/merged | 900 | 12 / — | — | CANCEL |
| [App/screens/streak-screen.tsx:371](/Users/jabiullah/Documents/QuestLifeProject/App/screens/streak-screen.tsx:371) | FriendsContent / FriendsContent | No family specified; default/inherited/merged | 900 | 16 / — | — | Invite a friend |
| [App/screens/streak-screen.tsx:375](/Users/jabiullah/Documents/QuestLifeProject/App/screens/streak-screen.tsx:375) | FriendsContent / FriendsContent | No family specified; default/inherited/merged | 900 | 23 / — | — | End your streak with {endTarget.partnerName}? |
| [App/screens/streak-screen.tsx:382](/Users/jabiullah/Documents/QuestLifeProject/App/screens/streak-screen.tsx:382) | AchievementsContent / AchievementsContent | No family specified; default/inherited/merged | 900 | 19 / — | — | Streak achievements |
| [App/screens/streak-screen.tsx:382](/Users/jabiullah/Documents/QuestLifeProject/App/screens/streak-screen.tsx:382) | AchievementsContent / AchievementsContent | No family specified; default/inherited/merged | 700 | 13 / — | — | Every day you show up makes your flame stronger. |
| [App/screens/streak-screen.tsx:382](/Users/jabiullah/Documents/QuestLifeProject/App/screens/streak-screen.tsx:382) | AchievementsContent / AchievementsContent | No family specified; default/inherited/merged | 900 | 14 / — | — | {achievement.days}-day streak |
| [App/screens/streak-screen.tsx:382](/Users/jabiullah/Documents/QuestLifeProject/App/screens/streak-screen.tsx:382) | AchievementsContent / AchievementsContent | No family specified; default/inherited/merged | 700 | 11 / — | — | {achievement.label} |
| [App/screens/streak-screen.tsx:382](/Users/jabiullah/Documents/QuestLifeProject/App/screens/streak-screen.tsx:382) | AchievementsContent / AchievementsContent | No family specified; default/inherited/merged | 900 | 11 / — | — | {unlocked ? "UNLOCKED" : `${currentStreak}/${achievement.days}`} |
| [App/screens/streak-screen.tsx:395](/Users/jabiullah/Documents/QuestLifeProject/App/screens/streak-screen.tsx:395) | StreakScreen / StreakScreen | No family specified; default/inherited/merged | 900 | — / — | — | {error} |

### App/screens/user-collection-detail-screen.tsx

| Exact location | Component / style | Font / bundled variant | Requested weight | Size / line height | Numeric variant | Text / purpose |
|---|---|---|---|---|---|---|
| [App/screens/user-collection-detail-screen.tsx:33](/Users/jabiullah/Documents/QuestLifeProject/App/screens/user-collection-detail-screen.tsx:33) | CollectionQuestCard / CollectionQuestCard | No family specified; default/inherited/merged | 900 | 18 / 23 | — | {quest.title} |
| [App/screens/user-collection-detail-screen.tsx:33](/Users/jabiullah/Documents/QuestLifeProject/App/screens/user-collection-detail-screen.tsx:33) | CollectionQuestCard / CollectionQuestCard | No family specified; default/inherited/merged | 700 | 13 / 19 | — | {quest.description} |
| [App/screens/user-collection-detail-screen.tsx:33](/Users/jabiullah/Documents/QuestLifeProject/App/screens/user-collection-detail-screen.tsx:33) | CollectionQuestCard / CollectionQuestCard | No family specified; default/inherited/merged | 900 | 12 / 16 | — | +{quest.xp} XP |
| [App/screens/user-collection-detail-screen.tsx:33](/Users/jabiullah/Documents/QuestLifeProject/App/screens/user-collection-detail-screen.tsx:33) | CollectionQuestCard / CollectionQuestCard | No family specified; default/inherited/merged | 900 | 12 / 16 | — | {quest.timeLabel} |
| [App/screens/user-collection-detail-screen.tsx:33](/Users/jabiullah/Documents/QuestLifeProject/App/screens/user-collection-detail-screen.tsx:33) | CollectionQuestCard / CollectionQuestCard | Rubik Black 900 | — | 13 / — | — | MORE INFO |
| [App/screens/user-collection-detail-screen.tsx:40](/Users/jabiullah/Documents/QuestLifeProject/App/screens/user-collection-detail-screen.tsx:40) | CollectionQuestPickerCard / CollectionQuestPickerCard | No family specified; default/inherited/merged | 900 | 18 / 23 | — | {quest.title} |
| [App/screens/user-collection-detail-screen.tsx:40](/Users/jabiullah/Documents/QuestLifeProject/App/screens/user-collection-detail-screen.tsx:40) | CollectionQuestPickerCard / CollectionQuestPickerCard | No family specified; default/inherited/merged | 700 | 13 / 19 | — | {quest.description} |
| [App/screens/user-collection-detail-screen.tsx:40](/Users/jabiullah/Documents/QuestLifeProject/App/screens/user-collection-detail-screen.tsx:40) | CollectionQuestPickerCard / CollectionQuestPickerCard | No family specified; default/inherited/merged | 900 | 12 / 16 | — | +{quest.xp} XP |
| [App/screens/user-collection-detail-screen.tsx:40](/Users/jabiullah/Documents/QuestLifeProject/App/screens/user-collection-detail-screen.tsx:40) | CollectionQuestPickerCard / CollectionQuestPickerCard | No family specified; default/inherited/merged | 900 | 12 / 16 | — | {quest.timeLabel} |
| [App/screens/user-collection-detail-screen.tsx:40](/Users/jabiullah/Documents/QuestLifeProject/App/screens/user-collection-detail-screen.tsx:40) | CollectionQuestPickerCard / CollectionQuestPickerCard | Rubik Black 900 | — | 13 / — | — | MORE INFO |
| [App/screens/user-collection-detail-screen.tsx:49](/Users/jabiullah/Documents/QuestLifeProject/App/screens/user-collection-detail-screen.tsx:49) | CollectionQuestDetail / CollectionQuestDetail | Rubik Black 900 | — | 29 / 32 | — | {quest.title} |
| [App/screens/user-collection-detail-screen.tsx:49](/Users/jabiullah/Documents/QuestLifeProject/App/screens/user-collection-detail-screen.tsx:49) | CollectionQuestDetail / CollectionQuestDetail | Rubik Bold 700 | — | 13 / — | — | by {handle} |
| [App/screens/user-collection-detail-screen.tsx:49](/Users/jabiullah/Documents/QuestLifeProject/App/screens/user-collection-detail-screen.tsx:49) | CollectionQuestDetail / CollectionQuestDetail | Rubik Black 900 | — | 20 / — | — | {quest.completed ? "1" : "0"} |
| [App/screens/user-collection-detail-screen.tsx:49](/Users/jabiullah/Documents/QuestLifeProject/App/screens/user-collection-detail-screen.tsx:49) | CollectionQuestDetail / CollectionQuestDetail | Rubik Bold 700 | — | 10 / — | — | COMPLETED |
| [App/screens/user-collection-detail-screen.tsx:49](/Users/jabiullah/Documents/QuestLifeProject/App/screens/user-collection-detail-screen.tsx:49) | CollectionQuestDetail / CollectionQuestDetail | Rubik Black 900 | — | 20 / — | — | {quest.saved ? "1" : "0"} |
| [App/screens/user-collection-detail-screen.tsx:49](/Users/jabiullah/Documents/QuestLifeProject/App/screens/user-collection-detail-screen.tsx:49) | CollectionQuestDetail / CollectionQuestDetail | Rubik Bold 700 | — | 10 / — | — | SAVED |
| [App/screens/user-collection-detail-screen.tsx:49](/Users/jabiullah/Documents/QuestLifeProject/App/screens/user-collection-detail-screen.tsx:49) | CollectionQuestDetail / CollectionQuestDetail | Rubik Black 900 | — | 20 / — | — | — |
| [App/screens/user-collection-detail-screen.tsx:49](/Users/jabiullah/Documents/QuestLifeProject/App/screens/user-collection-detail-screen.tsx:49) | CollectionQuestDetail / CollectionQuestDetail | Rubik Bold 700 | — | 10 / — | — | RATING |
| [App/screens/user-collection-detail-screen.tsx:49](/Users/jabiullah/Documents/QuestLifeProject/App/screens/user-collection-detail-screen.tsx:49) | CollectionQuestDetail / CollectionQuestDetail | Rubik Black 900 | — | 21 / — | — | About this quest |
| [App/screens/user-collection-detail-screen.tsx:49](/Users/jabiullah/Documents/QuestLifeProject/App/screens/user-collection-detail-screen.tsx:49) | CollectionQuestDetail / CollectionQuestDetail | Rubik Regular 400 | — | 16 / 25 | — | {quest.description} |
| [App/screens/user-collection-detail-screen.tsx:49](/Users/jabiullah/Documents/QuestLifeProject/App/screens/user-collection-detail-screen.tsx:49) | CollectionQuestDetail / CollectionQuestDetail | Rubik Black 900 | — | 20 / — | — | How it works |
| [App/screens/user-collection-detail-screen.tsx:49](/Users/jabiullah/Documents/QuestLifeProject/App/screens/user-collection-detail-screen.tsx:49) | CollectionQuestDetail / CollectionQuestDetail | Rubik Bold 700 | — | 13 / — | — | {index + 1} |
| [App/screens/user-collection-detail-screen.tsx:49](/Users/jabiullah/Documents/QuestLifeProject/App/screens/user-collection-detail-screen.tsx:49) | CollectionQuestDetail / CollectionQuestDetail | Rubik Regular 400 | — | 14 / 20 | — | {step} |
| [App/screens/user-collection-detail-screen.tsx:49](/Users/jabiullah/Documents/QuestLifeProject/App/screens/user-collection-detail-screen.tsx:49) | CollectionQuestDetail / CollectionQuestDetail | Rubik Black 900 | — | 16 / — | — | Add to collection |
| [App/screens/user-collection-detail-screen.tsx:115](/Users/jabiullah/Documents/QuestLifeProject/App/screens/user-collection-detail-screen.tsx:115) | UserCollectionDetailScreen / UserCollectionDetailScreen | Rubik Black 900 | — | 23 / — | — | {pack.title} |
| [App/screens/user-collection-detail-screen.tsx:115](/Users/jabiullah/Documents/QuestLifeProject/App/screens/user-collection-detail-screen.tsx:115) | UserCollectionDetailScreen / UserCollectionDetailScreen | Rubik Regular 400 | — | 12 / — | — | Private · {packQuests.length} {packQuests.length === 1 ? "quest" : "quests"} |
| [App/screens/user-collection-detail-screen.tsx:116](/Users/jabiullah/Documents/QuestLifeProject/App/screens/user-collection-detail-screen.tsx:116) | UserCollectionDetailScreen / UserCollectionDetailScreen | Rubik Black 900 | — | 19 / — | — | Quests |
| [App/screens/user-collection-detail-screen.tsx:117](/Users/jabiullah/Documents/QuestLifeProject/App/screens/user-collection-detail-screen.tsx:117) | UserCollectionDetailScreen / UserCollectionDetailScreen | Rubik Bold 700 | — | 15 / — | — | Explore |
| [App/screens/user-collection-detail-screen.tsx:117](/Users/jabiullah/Documents/QuestLifeProject/App/screens/user-collection-detail-screen.tsx:117) | UserCollectionDetailScreen / UserCollectionDetailScreen | Rubik Black 900 | — | 18 / — | — | Quest details |
| [App/screens/user-collection-detail-screen.tsx:117](/Users/jabiullah/Documents/QuestLifeProject/App/screens/user-collection-detail-screen.tsx:117) | UserCollectionDetailScreen / UserCollectionDetailScreen | Rubik Black 900 | — | 25 / 31 | — | {pickerQuest.title} |
| [App/screens/user-collection-detail-screen.tsx:117](/Users/jabiullah/Documents/QuestLifeProject/App/screens/user-collection-detail-screen.tsx:117) | UserCollectionDetailScreen / UserCollectionDetailScreen | Rubik Regular 400 | — | 15 / 23 | — | {pickerQuest.description} |
| [App/screens/user-collection-detail-screen.tsx:117](/Users/jabiullah/Documents/QuestLifeProject/App/screens/user-collection-detail-screen.tsx:117) | UserCollectionDetailScreen / UserCollectionDetailScreen | Rubik Bold 700 | — | 13 / — | — | +{pickerQuest.xp} XP |
| [App/screens/user-collection-detail-screen.tsx:117](/Users/jabiullah/Documents/QuestLifeProject/App/screens/user-collection-detail-screen.tsx:117) | UserCollectionDetailScreen / UserCollectionDetailScreen | Rubik Bold 700 | — | 13 / — | — | {pickerQuest.timeLabel} |
| [App/screens/user-collection-detail-screen.tsx:117](/Users/jabiullah/Documents/QuestLifeProject/App/screens/user-collection-detail-screen.tsx:117) | UserCollectionDetailScreen / UserCollectionDetailScreen | Rubik Black 900 | — | 16 / — | — | Add to collection |
| [App/screens/user-collection-detail-screen.tsx:117](/Users/jabiullah/Documents/QuestLifeProject/App/screens/user-collection-detail-screen.tsx:117) | UserCollectionDetailScreen / UserCollectionDetailScreen | Rubik Black 900 | — | 21 / — | — | Explore quests |
| [App/screens/user-collection-detail-screen.tsx:117](/Users/jabiullah/Documents/QuestLifeProject/App/screens/user-collection-detail-screen.tsx:117) | UserCollectionDetailScreen / UserCollectionDetailScreen | Rubik Bold 700 | — | 16 / — | — | <TextInput value={pickerSearch} onChangeText={setPickerSearch} placeholder="Search Quests" placeholderTextColor={T.muted} style={{ flex: 1, color: T.d |
| [App/screens/user-collection-detail-screen.tsx:117](/Users/jabiullah/Documents/QuestLifeProject/App/screens/user-collection-detail-screen.tsx:117) | UserCollectionDetailScreen / UserCollectionDetailScreen | No family specified; default/inherited/merged | 900 | 12 / — | — | {item} |
| [App/screens/user-collection-detail-screen.tsx:119](/Users/jabiullah/Documents/QuestLifeProject/App/screens/user-collection-detail-screen.tsx:119) | UserCollectionDetailScreen / UserCollectionDetailScreen | Rubik Bold 700 | — | 15 / — | — | Cancel |
| [App/screens/user-collection-detail-screen.tsx:119](/Users/jabiullah/Documents/QuestLifeProject/App/screens/user-collection-detail-screen.tsx:119) | UserCollectionDetailScreen / UserCollectionDetailScreen | Rubik Black 900 | — | 18 / — | — | Edit collection |
| [App/screens/user-collection-detail-screen.tsx:119](/Users/jabiullah/Documents/QuestLifeProject/App/screens/user-collection-detail-screen.tsx:119) | UserCollectionDetailScreen / UserCollectionDetailScreen | Rubik Bold 700 | — | 15 / — | — | Delete |
| [App/screens/user-collection-detail-screen.tsx:119](/Users/jabiullah/Documents/QuestLifeProject/App/screens/user-collection-detail-screen.tsx:119) | UserCollectionDetailScreen / UserCollectionDetailScreen | Rubik Bold 700 | — | 13 / — | — | Change photo |
| [App/screens/user-collection-detail-screen.tsx:119](/Users/jabiullah/Documents/QuestLifeProject/App/screens/user-collection-detail-screen.tsx:119) | UserCollectionDetailScreen / UserCollectionDetailScreen | Rubik Bold 700 | — | 13 / — | — | Remove photo |
| [App/screens/user-collection-detail-screen.tsx:119](/Users/jabiullah/Documents/QuestLifeProject/App/screens/user-collection-detail-screen.tsx:119) | UserCollectionDetailScreen / UserCollectionDetailScreen | Rubik Regular 400 | — | 16 / — | — | <TextInput value={title} onChangeText={setTitle} placeholder="Collection name" placeholderTextColor={T.muted} style={{ minHeight: 58, borderRadius: 18 |
| [App/screens/user-collection-detail-screen.tsx:119](/Users/jabiullah/Documents/QuestLifeProject/App/screens/user-collection-detail-screen.tsx:119) | UserCollectionDetailScreen / UserCollectionDetailScreen | Rubik Black 900 | — | 15 / — | — | Save |

## CSS and native font rules

| Exact location | Selector / rule |
|---|---|
| [App/lib/web-bootstrap.web.ts:58](/Users/jabiullah/Documents/QuestLifeProject/App/lib/web-bootstrap.web.ts:58) | .questlife-dialog { max-width: min(460px, calc(100vw - 32px)); max-height: calc(100dvh - 32px); overflow: auto; padding: 24px; border: 2px solid #e8dfd5; border-radius: 20px; background: #fffcf5; color: #3d3438; font-family: Rubik, sans-serif; } |
| [App/lib/web-bootstrap.web.ts:63](/Users/jabiullah/Documents/QuestLifeProject/App/lib/web-bootstrap.web.ts:63) | .questlife-dialog button { min-height: 44px; padding: 10px 18px; border-radius: 12px; border: 1px solid #e8dfd5; color: #3d3438; background: white; font: inherit; font-weight: 700; } |
| [Website/legal.css:1](/Users/jabiullah/Documents/QuestLifeProject/Website/legal.css:1) | @font-face{font-family:Rubik;src:url('/assets/fonts/Rubik-Regular.ttf') format('truetype');font-display:swap} |
| [Website/legal.css:2](/Users/jabiullah/Documents/QuestLifeProject/Website/legal.css:2) | @font-face{font-family:Rubik;src:url('/assets/fonts/Rubik-Bold.ttf') format('truetype');font-weight:700;font-display:swap} |
| [Website/legal.css:3](/Users/jabiullah/Documents/QuestLifeProject/Website/legal.css:3) | @font-face{font-family:GeistPixel;src:url('/assets/fonts/GeistPixel-Regular-Variable.ttf') format('truetype');font-display:swap} |
| [Website/legal.css:4](/Users/jabiullah/Documents/QuestLifeProject/Website/legal.css:4) | :root{color-scheme:light;--paper:#fbfaf6;--ink:#26333c;--muted:#50616b;--blue:#1769b5;--line:#d9e0df;--surface:#fff;--yellow:#f5ca65;font-family:Rubik,Arial,sans-serif} |
| [Website/legal.css:17](/Users/jabiullah/Documents/QuestLifeProject/Website/legal.css:17) | .header-links a,.footer-links a{font-weight:700;text-decoration:none} |
| [Website/legal.css:25](/Users/jabiullah/Documents/QuestLifeProject/Website/legal.css:25) | .legal-kicker{font-family:GeistPixel,Rubik,sans-serif;color:var(--blue);font-size:.95rem} |
| [Website/pages.css:1](/Users/jabiullah/Documents/QuestLifeProject/Website/pages.css:1) | :root{--site-paper:oklch(98% .004 90);--site-ink:oklch(16% .018 245);--site-blue:oklch(58% .19 250);font-family:Rubik,Arial,sans-serif;color:var(--site-ink);background:var(--site-paper)} |
| [Website/pages.css:1](/Users/jabiullah/Documents/QuestLifeProject/Website/pages.css:1) | .page-links{display:flex;gap:clamp(22px,3.2vw,52px);font-size:clamp(.88rem,1vw,1rem);font-weight:700} |
| [Website/pages.css:1](/Users/jabiullah/Documents/QuestLifeProject/Website/pages.css:1) | .page-store strong{font-size:1.08rem;font-weight:500;letter-spacing:-.025em} |
| [Website/pages.css:1](/Users/jabiullah/Documents/QuestLifeProject/Website/pages.css:1) | .page-intro h1{margin:0;font-family:Georgia,serif;font-size:clamp(3rem,6vw,6rem);line-height:.91;letter-spacing:-.045em;text-wrap:balance} |
| [Website/pages.css:1](/Users/jabiullah/Documents/QuestLifeProject/Website/pages.css:1) | .founder-photo{display:grid;aspect-ratio:.84;place-items:center;overflow:hidden;border:1px solid oklch(16% .018 245/.12);border-radius:20px;background:linear-gradient(145deg,oklch(94% .025 250),oklch(88% .065 245));box-shadow:0 10px 24px oklch(16% .018 245/.08);color:oklch(35% .07 245);font-family:Georgia,serif;font-size:clamp(3rem,7vw,6rem);letter-spacing:-.08em} |
| [Website/pages.css:1](/Users/jabiullah/Documents/QuestLifeProject/Website/pages.css:1) | .founder-role{margin:5px 0 0;color:oklch(48% .02 245);font-size:.86rem;font-weight:700} |
| [Website/pages.css:1](/Users/jabiullah/Documents/QuestLifeProject/Website/pages.css:1) | .memory-tile figcaption{margin-top:9px;font-weight:700} |
| [Website/pages.css:1](/Users/jabiullah/Documents/QuestLifeProject/Website/pages.css:1) | .faq-list summary{cursor:pointer;font-size:clamp(1.05rem,1.5vw,1.32rem);font-weight:700;list-style:none} |
| [Website/pages.css:1](/Users/jabiullah/Documents/QuestLifeProject/Website/pages.css:1) | .faq-list summary::after{float:right;content:"+";font-size:1.45em;font-weight:400;line-height:.8} |
| [Website/styles.css:1](/Users/jabiullah/Documents/QuestLifeProject/Website/styles.css:1) | @font-face{font-family:Rubik;src:url('/assets/fonts/Rubik-Regular.ttf')} |
| [Website/styles.css:1](/Users/jabiullah/Documents/QuestLifeProject/Website/styles.css:1) | @font-face{font-family:Rubik;src:url('/assets/fonts/Rubik-Bold.ttf');font-weight:700} |
| [Website/styles.css:1](/Users/jabiullah/Documents/QuestLifeProject/Website/styles.css:1) | @font-face{font-family:Rubik;src:url('/assets/fonts/Rubik-Black.ttf');font-weight:900} |
| [Website/styles.css:2](/Users/jabiullah/Documents/QuestLifeProject/Website/styles.css:2) | :root{--paper:oklch(98% .004 90);--ink:oklch(16% .018 245);font-family:Rubik,Arial,sans-serif;color:var(--ink);background:var(--paper)} |
| [Website/styles.css:2](/Users/jabiullah/Documents/QuestLifeProject/Website/styles.css:2) | .landing h1{position:relative;z-index:2;margin:clamp(30px,5vh,58px) 0 0;text-align:center;font-family:Georgia,serif;font-size:clamp(3.8rem,7.3vw,8rem);font-weight:700;letter-spacing:-.04em;line-height:.82;animation:title-in 1.05s cubic-bezier(.16,1,.3,1) both .16s} |
| [Website/styles.css:2](/Users/jabiullah/Documents/QuestLifeProject/Website/styles.css:2) | .landing h1 em{font-style:italic} |
| [Website/styles.css:4](/Users/jabiullah/Documents/QuestLifeProject/Website/styles.css:4) | .legal{display:grid;grid-template-columns:auto auto auto;gap:4px 7px;align-items:center;font-weight:700} |
| [Website/styles.css:4](/Users/jabiullah/Documents/QuestLifeProject/Website/styles.css:4) | .legal small{grid-column:1/-1;font-size:.76em;font-weight:400} |
| [Website/styles.css:4](/Users/jabiullah/Documents/QuestLifeProject/Website/styles.css:4) | .footer-links{display:flex;gap:clamp(15px,3vw,43px);font-weight:700} |
| [Website/styles.css:11](/Users/jabiullah/Documents/QuestLifeProject/Website/styles.css:11) | .site-links{display:flex;align-items:center;gap:clamp(22px,3.2vw,52px);font-size:clamp(.88rem,1vw,1rem);font-weight:700} |
| [Website/styles.css:11](/Users/jabiullah/Documents/QuestLifeProject/Website/styles.css:11) | .app-store-link strong{font-size:1.08rem;font-weight:500;letter-spacing:-.025em} |
| [Website/styles.css:11](/Users/jabiullah/Documents/QuestLifeProject/Website/styles.css:11) | .legal{display:block;font-weight:700;line-height:1.12} |
| [Website/styles.css:11](/Users/jabiullah/Documents/QuestLifeProject/Website/styles.css:11) | .legal small{display:block;margin-top:7px;font-size:.72em;font-weight:400} |
| [Website/styles.css:17](/Users/jabiullah/Documents/QuestLifeProject/Website/styles.css:17) | .memory-card__caption strong{font-family:Georgia,serif;font-size:clamp(2.7rem,5vw,5.3rem);line-height:.8;letter-spacing:-.07em} |
| [Website/styles.css:17](/Users/jabiullah/Documents/QuestLifeProject/Website/styles.css:17) | .memory-card__caption span{padding-bottom:.1em;text-align:right;font-size:clamp(.76rem,1vw,1rem);font-weight:700} |
| [Website/styles.css:17](/Users/jabiullah/Documents/QuestLifeProject/Website/styles.css:17) | .hero-cta{margin-top:clamp(22px,3vw,34px);padding:13px 20px;border-radius:999px;background:oklch(58% .19 250);box-shadow:0 7px 0 oklch(45% .17 250);color:#fff;font-weight:700;text-decoration:none;transition:transform .2s cubic-bezier(.16,1,.3,1),box-shadow .2s cubic-bezier(.16,1,.3,1)} |
| [Website/styles.css:22](/Users/jabiullah/Documents/QuestLifeProject/Website/styles.css:22) | .auth-kicker{margin:0 0 9px;color:#655a5f;font-size:12px;font-weight:700;letter-spacing:.045em;text-transform:uppercase} |
| [Website/styles.css:22](/Users/jabiullah/Documents/QuestLifeProject/Website/styles.css:22) | .auth-panel h1{margin:0;color:#171214;font-size:clamp(2rem,7vw,2.6rem);font-weight:900;letter-spacing:-.035em;line-height:1.02;text-wrap:balance} |
| [Website/styles.css:22](/Users/jabiullah/Documents/QuestLifeProject/Website/styles.css:22) | .auth-action{display:flex;min-height:56px;align-items:center;justify-content:center;gap:10px;margin-top:30px;padding:14px 20px;border-radius:16px;background:#006dcc;border-bottom:5px solid #004e92;color:#fff;font-size:16px;font-weight:900;text-decoration:none;transition:transform .18s cubic-bezier(.16,1,.3,1)} |
| [Website/styles.css:28](/Users/jabiullah/Documents/QuestLifeProject/Website/styles.css:28) | .memory-card__caption strong{max-inline-size:100%;overflow:hidden;font-family:Georgia,serif;font-size:clamp(1.15rem,7.2cqi,1.85rem);line-height:1;letter-spacing:-.045em;text-overflow:clip;white-space:nowrap} |
| [Website/styles.css:28](/Users/jabiullah/Documents/QuestLifeProject/Website/styles.css:28) | .memory-card__caption .memory-card__location{display:flex;align-items:center;gap:6px;padding:0;color:oklch(50% .012 250);font-size:clamp(.73rem,.9vw,.9rem);font-weight:500;letter-spacing:0;text-align:left} |
