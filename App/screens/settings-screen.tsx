import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Modal, Pressable, ScrollView, Share, Text, TextInput, View } from "react-native";

import { QuestlifeFlame } from "@/components/questlife-flame";
import { T } from "@/components/theme";
import { Screen, SoftButton, useResponsiveScreenLayout } from "@/components/ui";
import { deleteOwnAccount } from "@/services/account/accountService";
import { useAppFeedback } from "@/contexts/AppFeedbackContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useStreaks } from "@/contexts/StreaksContext";
import { NotificationPreferenceKey } from "@/types/settings";

type IconName = keyof typeof Ionicons.glyphMap;
type SettingsIcon = IconName | "streak-flame";
type AccountAction = "sign-out" | "delete" | null;

const FAQS = [
  ["How do I start a quest?", "Choose a quest in Explore, then tap Start Quest. Your progress begins when the active quest opens."],
  ["What is a streak and how does it work?", "Complete at least one quest on consecutive days to build your streak. A streak alert can warn you before it breaks."],
  ["Can I create my own quests?", "QuestLife currently curates the quest catalog. You can make your own collections from the quests you save."],
  ["How do Parties work?", "Create or join a Party from Social, invite friends, and choose whether to race together or complete quests independently."],
  ["How do I earn badges and titles?", "Badges and titles unlock as you complete quests, build streaks, and reach XP milestones."],
  ["Can I use QuestLife offline?", "Your active quest and journal draft stay available on your device. Sharing, friends, and new quests need a connection."],
] as const;

function iconTint(color: string) {
  return `${color}18`;
}

function SettingsHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  const router = useRouter();
  return <View style={{ paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1.5, borderBottomColor: T.border }}><View style={{ minHeight: 76, flexDirection: "row", alignItems: "center", gap: 12 }}><Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={({ pressed }) => ({ width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: T.border, alignItems: "center", justifyContent: "center", backgroundColor: T.white, boxShadow: "2px 2px 0px #e8dfd5", opacity: pressed ? 0.72 : 1 })}><Ionicons name="chevron-back" size={21} color={T.dark} /></Pressable><View style={{ gap: 2 }}><Text style={{ color: T.muted, fontFamily: "RubikBold", fontSize: 11, letterSpacing: 0.55, textTransform: "uppercase" }}>{eyebrow}</Text><Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 25, lineHeight: 30 }}>{title}</Text></View></View></View>;
}

function SettingsPage({ eyebrow = "Your account", title, children }: { eyebrow?: string; title: string; children: React.ReactNode }) {
  const { contentWidth } = useResponsiveScreenLayout();
  return <Screen padded={false} contentStyle={{ alignItems: "center", gap: 0 }}><View style={{ width: contentWidth, minHeight: "100%" }}><SettingsHeader eyebrow={eyebrow} title={title} /><View style={{ padding: 20, gap: 20 }}>{children}</View></View></Screen>;
}

function SettingGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={{ gap: 8 }}><Text style={{ paddingLeft: 2, color: T.muted, fontFamily: "RubikBold", fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase" }}>{title}</Text><View style={{ borderRadius: 23, borderWidth: 2, borderColor: T.border, borderBottomWidth: 5, borderBottomColor: "#dfd6cc", backgroundColor: T.white, overflow: "hidden" }}>{children}</View></View>;
}

function SettingRow({ icon, color, title, detail, value, destructive = false, onPress, children }: { icon: SettingsIcon; color: string; title: string; detail?: string; value?: string; destructive?: boolean; onPress?: () => void; children?: React.ReactNode }) {
  const body = <View style={{ minHeight: 67, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 11 }}><View style={{ width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: iconTint(color) }}>{icon === "streak-flame" ? <QuestlifeFlame size={24} /> : <Ionicons name={icon} size={19} color={color} />}</View><View style={{ flex: 1, minWidth: 0, gap: 2 }}><Text style={{ color: destructive ? T.red : T.dark, fontFamily: "RubikBold", fontSize: 15, lineHeight: 19 }} numberOfLines={1}>{title}</Text>{detail ? <Text style={{ color: T.muted, fontFamily: "Rubik", fontSize: 12, lineHeight: 16 }} numberOfLines={2}>{detail}</Text> : null}</View>{value ? <Text style={{ color: T.muted, fontFamily: "RubikBold", fontSize: 12 }} numberOfLines={1}>{value}</Text> : null}{children ?? (onPress ? <Ionicons name="chevron-forward" size={19} color={T.muted} /> : null)}</View>;
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.68 : 1 })}>{body}</Pressable> : body;
}

function Divider() { return <View style={{ height: 1, marginLeft: 61, backgroundColor: T.border }} />; }

function Toggle({ value, onChange, label }: { value: boolean; onChange: () => void; label: string }) {
  return <Pressable accessibilityRole="switch" accessibilityState={{ checked: value }} accessibilityLabel={label} onPress={onChange} style={({ pressed }) => ({ width: 45, height: 28, padding: 3, borderRadius: 14, alignItems: value ? "flex-end" : "flex-start", justifyContent: "center", backgroundColor: value ? T.blue : "#e5ddd3", opacity: pressed ? 0.72 : 1 })}><View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: T.white, boxShadow: "0px 1px 2px rgba(61,52,56,0.22)" }} /></Pressable>;
}

function ConfirmationDialog({ action, onClose }: { action: AccountAction; onClose: () => void }) {
  const { signOut } = useAuth();
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!action) return null;
  const isDelete = action === "delete";
  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      if (isDelete) await deleteOwnAccount();
      await signOut();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "We couldn't complete that account action. Please try again.");
      setBusy(false);
    }
  };
  const actionReady = !isDelete || confirmation.trim().toUpperCase() === "DELETE";
  const color = isDelete ? T.red : "#e17055";
  return <Modal transparent animationType="fade" visible onRequestClose={busy ? undefined : onClose}><View style={{ flex: 1, justifyContent: "center", padding: 24, backgroundColor: "rgba(30,25,28,0.48)" }}><View style={{ borderRadius: 28, borderWidth: 2, borderColor: T.border, backgroundColor: T.white, padding: 24, gap: 14, boxShadow: "5px 6px 0px rgba(61,52,56,0.18)" }}><View style={{ alignItems: "center", gap: 8 }}><View style={{ width: 58, height: 58, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: iconTint(color) }}><Ionicons name={isDelete ? "trash-outline" : "log-out-outline"} size={28} color={color} /></View><Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 23 }}>{isDelete ? "Delete account?" : "Sign out?"}</Text><Text style={{ color: T.muted, fontFamily: "Rubik", fontSize: 13, lineHeight: 19, textAlign: "center" }}>{isDelete ? "This permanently removes your account and its data. This cannot be undone." : "Your quests, streak, and progress are safely stored. You can sign back in anytime."}</Text></View>{isDelete ? <View style={{ gap: 7 }}><Text style={{ color: T.muted, fontFamily: "RubikBold", fontSize: 12, textAlign: "center" }}>Type DELETE to confirm</Text><TextInput value={confirmation} onChangeText={setConfirmation} autoCapitalize="characters" autoCorrect={false} placeholder="DELETE" placeholderTextColor={T.muted} style={{ minHeight: 52, borderRadius: 16, borderWidth: 2, borderColor: confirmation.trim().toUpperCase() === "DELETE" ? T.red : T.border, paddingHorizontal: 14, color: T.dark, fontFamily: "RubikBold", fontSize: 15, textAlign: "center" }} /></View> : null}{error ? <Text accessibilityRole="alert" style={{ color: T.red, fontFamily: "RubikBold", fontSize: 12, lineHeight: 17, textAlign: "center" }}>{error}</Text> : null}<SoftButton label={busy ? "Working…" : isDelete ? "Delete Account" : "Sign Out"} icon={isDelete ? "trash" : "log-out"} color={color} disabled={busy || !actionReady} onPress={() => void confirm()} /><SoftButton label="Cancel" inverse color={T.muted} disabled={busy} onPress={onClose} /></View></View></Modal>;
}

export function SettingsHomeScreen() {
  const router = useRouter();
  const [accountAction, setAccountAction] = useState<AccountAction>(null);
  const share = async () => { await Share.share({ message: "QuestLife turns everyday time into small real-world adventures. Come quest with me!" }); };
  return <><SettingsPage title="Settings"><SettingGroup title="Account"><SettingRow icon="notifications-outline" color={T.orange} title="Notifications" detail="Quests, streaks, and friends" onPress={() => router.push("/settings/notifications")} /><Divider /><SettingRow icon="lock-closed-outline" color={T.purple} title="Privacy & visibility" detail="Your streak and shared activity" onPress={() => router.push("/settings/privacy")} /><Divider /><SettingRow icon="options-outline" color={T.green} title="App preferences" detail="Haptics and device settings" onPress={() => router.push("/settings/preferences")} /></SettingGroup><SettingGroup title="Support"><SettingRow icon="help-circle-outline" color={T.cyan} title="Help & Support" detail="FAQ and contact the team" onPress={() => router.push("/settings/help")} /><Divider /><SettingRow icon="information-circle-outline" color={T.muted} title="About QuestLife" detail="Version, terms, and licenses" onPress={() => router.push("/settings/about")} /><Divider /><SettingRow icon="share-social-outline" color={T.blue} title="Share QuestLife" detail="Invite friends to try it" onPress={() => void share()} /></SettingGroup><SettingGroup title="Account actions"><SettingRow icon="log-out-outline" color="#e17055" title="Sign Out" onPress={() => setAccountAction("sign-out")} /><Divider /><SettingRow icon="trash-outline" color={T.red} title="Delete Account" detail="Permanently remove all your data" destructive onPress={() => setAccountAction("delete")} /></SettingGroup></SettingsPage><ConfirmationDialog action={accountAction} onClose={() => setAccountAction(null)} /></>;
}

const notificationRows: ReadonlyArray<{ key: NotificationPreferenceKey; icon: SettingsIcon; color: string; title: string; detail: string }> = [
  { key: "streakAlerts", icon: "streak-flame", color: T.orange, title: "Streak Alerts", detail: "Get warned before your streak breaks" },
  { key: "questReminders", icon: "flash-outline", color: T.blue, title: "Quest Reminders", detail: "Daily nudges to complete a quest" },
  { key: "milestones", icon: "ribbon-outline", color: T.green, title: "Milestones & Badges", detail: "When you unlock something new" },
  { key: "friendActivity", icon: "people-outline", color: T.cyan, title: "Friend Activity", detail: "When friends complete quests" },
  { key: "partyInvites", icon: "chatbox-outline", color: T.pink, title: "Party Invites", detail: "When someone invites you to a Party" },
  { key: "dailyMotivation", icon: "heart-outline", color: T.purple, title: "Daily Motivation", detail: "A morning nudge to get moving" },
  { key: "weeklyRecap", icon: "calendar-outline", color: T.muted, title: "Weekly Recap", detail: "Your week in quests every Sunday" },
];

function PreferenceRows({ keys }: { keys: NotificationPreferenceKey[] }) {
  const { settings, setNotificationPreference } = useSettings();
  const { showFeedback } = useAppFeedback();
  const rows = notificationRows.filter((row) => keys.includes(row.key));
  const togglePreference = async (row: typeof notificationRows[number]) => {
    const enabled = !settings.notifications[row.key];
    await setNotificationPreference(row.key, enabled);
    showFeedback({
      message: `${row.title} turned ${enabled ? "on" : "off"}.`,
      icon: enabled ? "notifications" : "notifications-off",
      color: row.color,
    });
  };

  return <>{rows.map((row, index) => <View key={row.key}>{index ? <Divider /> : null}<SettingRow icon={row.icon} color={row.color} title={row.title} detail={row.detail}><Toggle value={settings.notifications[row.key]} label={row.title} onChange={() => void togglePreference(row)} /></SettingRow></View>)}</>;
}

export function NotificationPreferencesScreen() {
  const openSystemSettings = () => { void Linking.openSettings().catch(() => undefined); };
  return <SettingsPage eyebrow="Account" title="Notifications"><SettingGroup title="Quests & streaks"><PreferenceRows keys={["streakAlerts", "questReminders", "milestones"]} /></SettingGroup><SettingGroup title="Social"><PreferenceRows keys={["friendActivity", "partyInvites"]} /></SettingGroup><SettingGroup title="Insights"><PreferenceRows keys={["dailyMotivation", "weeklyRecap"]} /></SettingGroup><Pressable accessibilityRole="button" accessibilityLabel="Open device notification settings" onPress={openSystemSettings} style={({ pressed }) => ({ minHeight: 52, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: `${T.blue}70`, backgroundColor: `${T.blue}10`, opacity: pressed ? 0.7 : 1 })}><Text style={{ color: T.blue, fontFamily: "RubikBold", fontSize: 14 }}>Manage device notification permissions</Text></Pressable></SettingsPage>;
}

export function PrivacySettingsScreen() {
  const { overview, setVisibility } = useStreaks();
  const { showFeedback } = useAppFeedback();
  const streakPublic = overview?.personal.streakVisibility !== "private";
  const changeStreakVisibility = async () => { try { await setVisibility(streakPublic ? "private" : "public"); showFeedback({ message: streakPublic ? "Streak hidden from your profile." : "Streak visible on your profile.", icon: "flame", color: T.orange }); } catch { showFeedback({ message: "We couldn't update your streak visibility.", icon: "alert-circle", color: T.red }); } };
  return <SettingsPage eyebrow="Account" title="Privacy"><SettingGroup title="Profile visibility"><SettingRow icon="people-outline" color={T.blue} title="Profile sharing" detail="Your profile is available to accepted friends" value="Friends" /><Divider /><SettingRow icon="streak-flame" color={T.orange} title="Show Streak" detail="Visible on your profile and leaderboard"><Toggle value={streakPublic} label="Show streak" onChange={() => void changeStreakVisibility()} /></SettingRow></SettingGroup><SettingGroup title="Activity"><SettingRow icon="flash-outline" color={T.cyan} title="Quest activity" detail="You choose who sees each post when you share it" value="Per post" /><Divider /><SettingRow icon="shield-checkmark-outline" color={T.purple} title="Journal reflections" detail="Always private and only visible to you" value="Private" /></SettingGroup><View style={{ borderRadius: 18, padding: 14, backgroundColor: T.white, borderWidth: 2, borderColor: T.border, flexDirection: "row", gap: 9 }}><Ionicons name="lock-closed" size={17} color={T.muted} /><Text style={{ flex: 1, color: T.muted, fontFamily: "Rubik", fontSize: 12, lineHeight: 17 }}>You can change the audience for any shared post from its post menu.</Text></View></SettingsPage>;
}

export function AppPreferencesScreen() {
  const { settings, setHapticFeedback, setHighContrast, setReduceMotion } = useSettings();
  const { showFeedback } = useAppFeedback();
  const updateHaptics = async () => { const enabled = !settings.hapticFeedback; await setHapticFeedback(enabled); showFeedback({ message: enabled ? "Haptic feedback is on." : "Haptic feedback is off.", icon: "phone-portrait-outline", color: T.pink }); };
  const updateReduceMotion = async () => { const enabled = !settings.reduceMotion; await setReduceMotion(enabled); showFeedback({ message: enabled ? "Motion is reduced in animated screens." : "Animations follow your device setting.", icon: "sparkles", color: T.purple }); };
  const updateHighContrast = async () => { const enabled = !settings.highContrast; await setHighContrast(enabled); showFeedback({ message: enabled ? "High contrast is on." : "High contrast is off.", icon: "contrast", color: T.blue }); };
  return <SettingsPage eyebrow="Account" title="Preferences"><SettingGroup title="App feel"><SettingRow icon="phone-portrait-outline" color={T.pink} title="Haptic Feedback" detail="Vibration on supported interactions"><Toggle value={settings.hapticFeedback} label="Haptic feedback" onChange={() => void updateHaptics()} /></SettingRow><Divider /><SettingRow icon="sparkles-outline" color={T.purple} title="Reduce Motion" detail="Minimize movement in animated screens"><Toggle value={settings.reduceMotion} label="Reduce motion" onChange={() => void updateReduceMotion()} /></SettingRow><Divider /><SettingRow icon="contrast-outline" color={T.blue} title="High Contrast" detail="Increase contrast across QuestLife"><Toggle value={settings.highContrast} label="High contrast" onChange={() => void updateHighContrast()} /></SettingRow><Divider /><SettingRow icon="text-outline" color={T.blue} title="Text size" detail="Use your device’s preferred text size" onPress={() => { void Linking.openSettings().catch(() => undefined); }} /><Divider /><SettingRow icon="settings-outline" color={T.blue} title="Device permissions" detail="Manage notification, location, and photo access" onPress={() => { void Linking.openSettings().catch(() => undefined); }} /></SettingGroup></SettingsPage>;
}

function FaqRow({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={question} onPress={() => setOpen((value) => !value)} style={({ pressed }) => ({ paddingVertical: 14, opacity: pressed ? 0.7 : 1 })}><View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><Text style={{ flex: 1, color: T.dark, fontFamily: "RubikBold", fontSize: 14, lineHeight: 19 }}>{question}</Text><Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={T.muted} /></View>{open ? <Text style={{ marginTop: 8, color: T.muted, fontFamily: "Rubik", fontSize: 13, lineHeight: 19 }}>{answer}</Text> : null}</Pressable>;
}

export function HelpSupportScreen() {
  const contactSupport = () => { void Linking.openURL("mailto:support@questlife.app?subject=QuestLife%20Support").catch(() => undefined); };
  return <SettingsPage eyebrow="Support" title="Help & Support"><View style={{ borderRadius: 22, padding: 18, borderWidth: 2, borderColor: `${T.blue}50`, borderBottomWidth: 5, borderBottomColor: "#bde3ff", backgroundColor: `${T.blue}0c`, gap: 7 }}><Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 18 }}>Need direct help?</Text><Text style={{ color: T.muted, fontFamily: "Rubik", fontSize: 13, lineHeight: 18 }}>The team is available Monday-Friday. We typically reply within 24 hours.</Text><SoftButton label="Contact Support" icon="chatbox-outline" color={T.blue} onPress={contactSupport} style={{ alignSelf: "center", marginTop: 5, minHeight: 46 }} /></View><SettingGroup title="Frequently asked questions">{FAQS.map(([question, answer], index) => <View key={question}>{index ? <Divider /> : null}<FaqRow question={question} answer={answer} /></View>)}</SettingGroup></SettingsPage>;
}

export function AboutQuestLifeScreen() {
  const open = (url: string) => { void Linking.openURL(url).catch(() => undefined); };
  return <SettingsPage eyebrow="Support" title="About QuestLife"><View style={{ borderRadius: 24, padding: 24, borderWidth: 2, borderColor: T.border, borderBottomWidth: 5, borderBottomColor: "#dfd6cc", backgroundColor: T.white, alignItems: "center", gap: 9 }}><View style={{ width: 66, height: 66, borderRadius: 23, backgroundColor: `${T.blue}15`, alignItems: "center", justifyContent: "center" }}><Ionicons name="map-outline" size={34} color={T.blue} /></View><Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 25 }}>QuestLife</Text><Text style={{ color: T.muted, fontFamily: "RubikBold", fontSize: 12 }}>Version 1.0.0</Text><Text style={{ marginTop: 7, color: T.muted, fontFamily: "Rubik", fontSize: 13, lineHeight: 20, textAlign: "center" }}>QuestLife helps you turn everyday moments into real-world adventures. Build streaks, collect memories, and grow with the people around you.</Text></View><SettingGroup title="Legal & credits"><SettingRow icon="open-outline" color={T.muted} title="Terms of Service" onPress={() => open("https://questlife.app/terms")} /><Divider /><SettingRow icon="open-outline" color={T.muted} title="Privacy Policy" onPress={() => open("https://questlife.app/privacy")} /><Divider /><SettingRow icon="open-outline" color={T.muted} title="Open Source Licenses" onPress={() => open("https://questlife.app/licenses")} /></SettingGroup><Text style={{ color: T.muted, fontFamily: "Rubik", fontSize: 12, textAlign: "center" }}>Made with care for people who want to live a bigger life.</Text></SettingsPage>;
}
