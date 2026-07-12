import { Ionicons } from "@expo/vector-icons";
import { Redirect, useRouter } from "expo-router";
import { PropsWithChildren, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Alert, Animated, Easing, Pressable, ScrollView, Switch, Text, TextInput, View, useWindowDimensions } from "react-native";

import { useAuth } from "@/contexts/AuthContext";
import { useContent } from "@/contexts/ContentContext";
import { signOut } from "@/services/auth/authService";
import {
  deleteAdventurePack,
  deleteAdminNotifications,
  deleteQuest,
  fetchAdminNotifications,
  fetchContentLibrary,
  getDailyQuestLimitEnabled,
  getAdminMembership,
  inviteAdmin,
  listAdminInvites,
  listAdminProfiles,
  markAdminNotificationsRead,
  markAdminNotificationRead,
  markAllAdminNotificationsRead,
  notifyQuestReviewResult,
  updateAdminAccess,
  updateOwnAdminProfile,
  setDailyQuestLimitEnabled as saveDailyQuestLimitEnabled,
  upsertAdventurePack,
  upsertQuest,
  deleteAdmin,
} from "@/services/content/contentService";
import {
  deleteFeaturedBatch,
  featuredDateKey,
  fetchFeaturedBatches,
  upsertFeaturedBatch,
} from "@/services/content/featuredService";
import { updatePassword } from "@/services/auth/authService";
import {
  adminPermissions,
  AdventurePack,
  AdventurePackFormInput,
  AdminInvite,
  AdminMembership,
  AdminNotification,
  AdminPermission,
  AdminProfile,
  AdminRole,
  Quest,
  QuestCategory,
  QuestDifficulty,
  QuestFormInput,
  QuestStatus,
  questCategories,
  questCategoryColors,
  questDifficulties,
  questStatuses,
} from "@/types/content";

type AdminView =
  | "published"
  | "all"
  | "create"
  | "review"
  | "adventurePacks"
  | "featured"
  | "detail"
  | "admins"
  | "profile"
  | "inbox";
type Mode = "dark" | "light";
type AdminManagementMode = "list" | "detail" | "invite";

const ADMIN_THEME_STORAGE_KEY = "questlife-admin-theme";
const ADMIN_SIDEBAR_COLLAPSED_STORAGE_KEY = "questlife-admin-sidebar-collapsed";
let adminThemeMemory: Mode = "dark";
let adminSidebarCollapsedMemory = false;

function isMode(value: string | null): value is Mode {
  return value === "dark" || value === "light";
}

function readAdminThemePreference(): Mode {
  if (typeof window === "undefined") {
    return adminThemeMemory;
  }

  try {
    const storedMode = window.localStorage.getItem(ADMIN_THEME_STORAGE_KEY);
    if (isMode(storedMode)) {
      adminThemeMemory = storedMode;
      return storedMode;
    }
  } catch {
    return adminThemeMemory;
  }

  return adminThemeMemory;
}

function saveAdminThemePreference(nextMode: Mode) {
  adminThemeMemory = nextMode;

  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(ADMIN_THEME_STORAGE_KEY, nextMode);
  } catch {
    // Keep the in-memory preference when browser storage is unavailable.
  }
}

function readAdminSidebarCollapsedPreference() {
  if (typeof window === "undefined") {
    return adminSidebarCollapsedMemory;
  }

  try {
    const storedValue = window.localStorage.getItem(ADMIN_SIDEBAR_COLLAPSED_STORAGE_KEY);
    if (storedValue === "true" || storedValue === "false") {
      adminSidebarCollapsedMemory = storedValue === "true";
    }
  } catch {
    // Keep the in-memory preference when browser storage is unavailable.
  }

  return adminSidebarCollapsedMemory;
}

function saveAdminSidebarCollapsedPreference(nextValue: boolean) {
  adminSidebarCollapsedMemory = nextValue;

  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(ADMIN_SIDEBAR_COLLAPSED_STORAGE_KEY, String(nextValue));
  } catch {
    // Keep the in-memory preference when browser storage is unavailable.
  }
}

const nova = {
  blue: "#2563eb",
  blueSoft: "#dbeafe",
  green: "#22c55e",
  greenText: "#15803d",
  orange: "#f97316",
  red: "#ef4444",
  violet: "#a855f7",
};

const themes = {
  light: {
    mode: "light" as const,
    page: "#f3f4fb",
    shell: "#ffffff",
    sidebar: "#fbfbff",
    card: "#ffffff",
    cardAlt: "#f8fafc",
    text: "#111827",
    muted: "#4b5563",
    faint: "#9ca3af",
    border: "#e5e7eb",
    active: "#dbe4ff",
    activeText: "#1d4ed8",
    shadow: "0 8px 18px rgba(15,23,42,0.10)",
    input: "#ffffff",
  },
  dark: {
    mode: "dark" as const,
    page: "#050608",
    shell: "#10131b",
    sidebar: "#11141c",
    card: "#1b1e27",
    cardAlt: "#151922",
    text: "#f8fafc",
    muted: "#a1a1aa",
    faint: "#71717a",
    border: "#272b36",
    active: "#14213f",
    activeText: "#bfdbfe",
    shadow: "none",
    input: "#181b24",
  },
};

type Theme = (typeof themes)[Mode];

const categoryOptions = questCategories.filter((item) => item !== "All") as QuestCategory[];
const statusFilterOptions = ["all", ...questStatuses] as const;
const defaultAdminPermissions: AdminPermission[] = ["quests.view_published", "inbox.view", "profile.manage"];
const grantableAdminPermissions = adminPermissions.filter(
  (permission) => permission !== "admins.manage" && permission !== "quests.review_publish",
);
const permissionLabels: Record<AdminPermission, string> = {
  "content.delete": "Delete content",
  "admins.manage": "Manage admins",
  "inbox.view": "Inbox",
  "profile.manage": "Profile",
  "quests.create_draft": "Create drafts",
  "quests.review_publish": "Review and publish",
  "quests.submit_review": "Submit for review",
  "quests.view_all": "View all quests",
  "quests.view_published": "View published",
};
const permissionDescriptions: Record<AdminPermission, string> = {
  "content.delete": "Delete adventure packs and scheduled featured batches.",
  "admins.manage": "Invite admins and manage their access to dashboard tools.",
  "inbox.view": "Review admin notifications and publication decisions.",
  "profile.manage": "Update the admin's own display name and password.",
  "quests.create_draft": "Create new quest drafts for the content library.",
  "quests.review_publish": "Review submitted quests and publish approved work.",
  "quests.submit_review": "Send draft quests to the review queue.",
  "quests.view_all": "View the complete quest library, including drafts and archived work.",
  "quests.view_published": "Browse the live quests available in the mobile app.",
};

const defaultQuest: QuestFormInput = {
  category: "ADVENTURE",
  color: questCategoryColors.ADVENTURE.text,
  description: "",
  difficulty: "EASY",
  featured: false,
  reviewNote: null,
  status: "draft",
  steps: ["", "", ""],
  timeMin: 30,
  title: "",
  xp: 50,
};

type AdventurePackForm = AdventurePackFormInput & { coverImageUrl?: string };

const defaultAdventurePackForm: AdventurePackForm = {
  title: "",
  subtitle: "",
  description: "",
  status: "draft",
  color: nova.blue,
  bgColor: nova.blueSoft,
  icon: "🧭",
  questIds: [],
  coverImageUrl: "",
};

function addDays(dateKey: string, days: number) {
  const d = new Date(`${dateKey}T12:00:00`);
  d.setDate(d.getDate() + days);
  return featuredDateKey(d);
}

function asForm(quest: Quest): QuestFormInput {
  return {
    category: quest.category,
    color: questCategoryColors[quest.category]?.text ?? quest.color,
    description: quest.description,
    difficulty: quest.difficulty,
    featured: quest.featured,
    reviewNote: quest.reviewNote ?? null,
    status: quest.status,
    steps: quest.steps.length ? quest.steps : ["", "", ""],
    timeMin: quest.timeMin,
    title: quest.title,
    xp: quest.xp,
  };
}

function statusLabel(status: QuestStatus) {
  if (status === "in_review") return "In Review";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function statusTone(status: QuestStatus) {
  if (status === "published") return { bg: "rgba(34,197,94,0.14)", text: "#16a34a", border: "rgba(34,197,94,0.32)" };
  if (status === "in_review") return { bg: "rgba(37,99,235,0.14)", text: nova.blue, border: "rgba(37,99,235,0.34)" };
  if (status === "archived") return { bg: "rgba(239,68,68,0.14)", text: "#dc2626", border: "rgba(239,68,68,0.32)" };
  return { bg: "rgba(249,115,22,0.14)", text: "#c2410c", border: "rgba(249,115,22,0.32)" };
}

function hasPermission(membership: AdminMembership | null, permission: AdminPermission) {
  if (membership?.role === "super_admin") return true;
  return membership?.permissions.includes(permission) ?? false;
}

function displayRole(role: AdminRole) {
  return role === "super_admin" ? "Super Admin" : "Admin";
}

function emailLocalPart(email?: string | null) {
  return email?.split("@")[0]?.trim().toLowerCase() ?? "";
}

function cleanDisplayName(displayName?: string | null, email?: string | null) {
  const trimmed = displayName?.trim() ?? "";
  if (!trimmed) return "";
  if (trimmed.toLowerCase() === emailLocalPart(email)) return "";
  return trimmed;
}

function formatDate(value?: string | null) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function AdminLogo({ t }: { t: Theme }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View style={{ width: 40, height: 40, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: nova.blue }}>
        <Ionicons name="flash" size={21} color="#ffffff" />
      </View>
      <View>
        <Text style={{ color: t.text, fontSize: 22, fontWeight: "900", letterSpacing: 0 }}>QuestLife</Text>
        <Text style={{ color: t.faint, fontSize: 12, fontWeight: "800", letterSpacing: 1.8 }}>ADMIN V1.0</Text>
      </View>
    </View>
  );
}

function Pill({ children, tone, t }: PropsWithChildren<{ tone?: ReturnType<typeof statusTone>; t: Theme }>) {
  return (
    <View
      style={{
        alignSelf: "flex-start",
        borderRadius: 999,
        borderWidth: 1,
        borderColor: tone?.border ?? t.border,
        backgroundColor: tone?.bg ?? t.cardAlt,
        paddingHorizontal: 12,
        paddingVertical: 6,
      }}
    >
      <Text style={{ color: tone?.text ?? t.muted, fontSize: 12, fontWeight: "900" }}>{children}</Text>
    </View>
  );
}

function StatusPill({ status, t }: { status: QuestStatus; t: Theme }) {
  return <Pill tone={statusTone(status)} t={t}>{statusLabel(status)}</Pill>;
}

function Panel({
  children,
  style,
  t,
}: PropsWithChildren<{ style?: Record<string, unknown>; t: Theme }>) {
  return (
    <View
      style={[
        {
          backgroundColor: t.card,
          borderColor: t.border,
          borderRadius: 12,
          borderWidth: 1,
          boxShadow: t.shadow,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

function useReducedMotionPreference() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReducedMotion(enabled);
    }).catch(() => undefined);

    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReducedMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reducedMotion;
}

function MotionFrame({
  children,
  delay = 0,
  motionKey,
  reducedMotion,
  style,
}: PropsWithChildren<{
  delay?: number;
  motionKey: string;
  reducedMotion: boolean;
  style?: Record<string, unknown>;
}>) {
  const opacity = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const translateY = useRef(new Animated.Value(reducedMotion ? 0 : 8)).current;

  useEffect(() => {
    opacity.stopAnimation();
    translateY.stopAnimation();

    if (reducedMotion) {
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }

    opacity.setValue(0);
    translateY.setValue(8);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 220, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [delay, motionKey, opacity, reducedMotion, translateY]);

  return <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>{children}</Animated.View>;
}

function LoadingPanel({ label, reducedMotion, t }: { label: string; reducedMotion: boolean; t: Theme }) {
  const pulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    if (reducedMotion) {
      pulse.setValue(0.72);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.9, duration: 560, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 560, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse, reducedMotion]);

  return (
    <Panel t={t} style={{ gap: 16, padding: 22 }}>
      <View accessibilityLabel={label} accessibilityRole="progressbar" style={{ gap: 14 }}>
        <Animated.View style={{ opacity: pulse, height: 18, width: "28%", borderRadius: 6, backgroundColor: t.border }} />
        <Animated.View style={{ opacity: pulse, height: 12, width: "54%", borderRadius: 6, backgroundColor: t.border }} />
        <View style={{ flexDirection: "row", gap: 12 }}>
          {[0, 1, 2].map((item) => (
            <Animated.View key={item} style={{ opacity: pulse, flex: 1, height: 126, borderRadius: 10, backgroundColor: t.cardAlt }} />
          ))}
        </View>
      </View>
      <Text style={{ color: t.muted, fontSize: 14, fontWeight: "800" }}>{label}</Text>
    </Panel>
  );
}

function Field({
  editable = true,
  label,
  multiline,
  onChangeText,
  placeholder,
  t,
  value,
}: {
  editable?: boolean;
  label: string;
  multiline?: boolean;
  onChangeText: (value: string) => void;
  placeholder?: string;
  t: Theme;
  value: string;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: t.faint, fontSize: 12, fontWeight: "900", letterSpacing: 1.3, textTransform: "uppercase" }}>{label}</Text>
      <TextInput
        editable={editable}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={t.faint}
        value={value}
        style={{
          minHeight: multiline ? 120 : 46,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: t.border,
          backgroundColor: editable ? t.input : t.cardAlt,
          color: t.text,
          fontSize: 15,
          fontWeight: "600",
          paddingHorizontal: 14,
          paddingVertical: multiline ? 12 : 0,
          textAlignVertical: multiline ? "top" : "center",
        }}
      />
    </View>
  );
}

function NumberField({
  editable = true,
  label,
  onChange,
  t,
  value,
}: {
  editable?: boolean;
  label: string;
  onChange: (value: number) => void;
  t: Theme;
  value: number;
}) {
  return (
    <Field
      editable={editable}
      label={label}
      onChangeText={(next) => onChange(Number(next.replace(/[^0-9]/g, "")) || 0)}
      t={t}
      value={String(value)}
    />
  );
}

function Segmented<TValue extends string>({
  options,
  renderLabel,
  t,
  value,
  onChange,
}: {
  options: readonly TValue[];
  renderLabel?: (value: TValue) => string;
  t: Theme;
  value: TValue;
  onChange: (value: TValue) => void;
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {options.map((option) => {
        const active = option === value;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            style={{
              minHeight: 36,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 8,
              borderWidth: 1,
              borderColor: active ? nova.blue : t.border,
              backgroundColor: active ? (t.mode === "dark" ? "#1d2b4f" : nova.blueSoft) : t.card,
              paddingHorizontal: 13,
            }}
          >
            <Text style={{ color: active ? (t.mode === "dark" ? "#bfdbfe" : "#1d4ed8") : t.muted, fontSize: 13, fontWeight: "900" }}>
              {renderLabel ? renderLabel(option) : option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function FilterCarousel<TValue extends string>({
  options,
  renderLabel,
  t,
  value,
  onChange,
}: {
  options: readonly TValue[];
  renderLabel?: (value: TValue) => string;
  t: Theme;
  value: TValue;
  onChange: (value: TValue) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 10, paddingRight: 18 }}
      style={{ maxWidth: "100%" }}
    >
      {options.map((option) => {
        const active = option === value;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            style={{
              minHeight: 40,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 8,
              borderWidth: 1,
              borderColor: active ? nova.blue : t.border,
              backgroundColor: active ? (t.mode === "dark" ? "#1d2b4f" : nova.blueSoft) : t.card,
              paddingHorizontal: 16,
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                color: active ? (t.mode === "dark" ? "#bfdbfe" : "#1d4ed8") : t.muted,
                fontSize: 13,
                fontWeight: "900",
              }}
            >
              {renderLabel ? renderLabel(option) : option}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function FormSectionLabel({ children, t }: PropsWithChildren<{ t: Theme }>) {
  return (
    <Text style={{ color: t.faint, fontSize: 12, fontWeight: "900", letterSpacing: 1.3, textTransform: "uppercase" }}>
      {children}
    </Text>
  );
}

function ChoiceGrid<TValue extends string>({
  minItemWidth = 132,
  options,
  renderLabel,
  t,
  toneForValue,
  value,
  onChange,
}: {
  minItemWidth?: number;
  options: readonly TValue[];
  renderLabel?: (value: TValue) => string;
  t: Theme;
  toneForValue?: (value: TValue) => { bg: string; text: string };
  value: TValue;
  onChange: (value: TValue) => void;
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {options.map((option) => {
        const active = option === value;
        const tone = toneForValue?.(option);
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            style={{
              minHeight: 44,
              minWidth: minItemWidth,
              flexGrow: 1,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 10,
              borderWidth: 1,
              borderColor: active ? tone?.text ?? nova.blue : t.border,
              backgroundColor: active ? tone?.bg ?? (t.mode === "dark" ? "#1d2b4f" : nova.blueSoft) : t.input,
              paddingHorizontal: 14,
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                color: active ? tone?.text ?? (t.mode === "dark" ? "#bfdbfe" : "#1d4ed8") : t.muted,
                fontSize: 13,
                fontWeight: "900",
              }}
            >
              {renderLabel ? renderLabel(option) : option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ActionButton({
  danger,
  disabled,
  icon,
  label,
  onPress,
  secondary,
  t,
}: {
  danger?: boolean;
  disabled?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  secondary?: boolean;
  t: Theme;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: danger ? (t.mode === "dark" ? "rgba(248,113,113,0.52)" : "rgba(220,38,38,0.42)") : secondary ? t.border : nova.blue,
        backgroundColor: disabled ? t.border : danger ? (t.mode === "dark" ? "rgba(127,29,29,0.34)" : "#fff1f2") : secondary ? t.card : nova.blue,
        paddingHorizontal: 18,
        opacity: disabled ? 0.68 : 1,
        transform: [{ scale: pressed && !disabled ? 0.98 : 1 }],
      })}
    >
      <Ionicons name={icon} size={18} color={danger ? (t.mode === "dark" ? "#fecaca" : "#b91c1c") : secondary ? t.text : "#ffffff"} />
      <Text style={{ color: danger ? (t.mode === "dark" ? "#fecaca" : "#b91c1c") : secondary ? t.text : "#ffffff", fontSize: 15, fontWeight: "900" }}>{label}</Text>
    </Pressable>
  );
}

function QuestStatCard({
  icon,
  label,
  tint,
  t,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tint: string;
  t: Theme;
  value: number | string;
}) {
  return (
    <Panel t={t} style={{ flex: 1, minWidth: 210, padding: 22, gap: 22 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View style={{ width: 50, height: 50, borderRadius: 10, backgroundColor: `${tint}18`, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={icon} size={22} color={tint} />
        </View>
        <Pill t={t} tone={{ bg: "rgba(34,197,94,0.16)", text: "#16a34a", border: "rgba(34,197,94,0.24)" }}>+ Live</Pill>
      </View>
      <View style={{ gap: 8 }}>
        <Text style={{ color: t.muted, fontSize: 16, fontWeight: "900", letterSpacing: 1.5, textTransform: "uppercase" }}>{label}</Text>
        <Text style={{ color: t.text, fontSize: 30, fontWeight: "900" }}>{value}</Text>
      </View>
    </Panel>
  );
}

function QuestRow({
  compact,
  onPress,
  quest,
  t,
  featuredDate,
}: {
  compact: boolean;
  onPress: () => void;
  quest: Quest;
  t: Theme;
  featuredDate?: string | null;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        borderTopColor: t.border,
        borderTopWidth: 1,
        flexDirection: "row",
        alignItems: "center",
        gap: compact ? 12 : 18,
        minHeight: compact ? 96 : 86,
        paddingHorizontal: compact ? 16 : 24,
        backgroundColor: pressed ? t.cardAlt : "transparent",
        transform: [{ scale: pressed ? 0.996 : 1 }],
      })}
    >
      <View style={{ width: 4, alignSelf: "stretch", minHeight: compact ? 64 : 44, borderRadius: 999, backgroundColor: quest.color }} />
      <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Text numberOfLines={compact ? 2 : 1} style={{ flexShrink: 1, color: t.text, fontSize: 16, fontWeight: "900" }}>{quest.title}</Text>
          {featuredDate ? (
            <View style={{ borderRadius: 999, backgroundColor: "rgba(168,85,247,0.14)", paddingHorizontal: 8, paddingVertical: 3 }}>
              <Text style={{ color: nova.violet, fontSize: 10, fontWeight: "900" }}>Featured {featuredDate}</Text>
            </View>
          ) : null}
        </View>
        <Text numberOfLines={1} style={{ color: t.muted, fontSize: 13, fontWeight: "600" }}>{quest.description}</Text>
        {compact ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Text style={{ color: t.muted, fontSize: 12, fontWeight: "800" }}>{quest.category}</Text>
            <Text style={{ color: t.text, fontSize: 12, fontWeight: "900" }}>+{quest.xp} XP</Text>
            <Text style={{ color: t.faint, fontSize: 12, fontWeight: "700" }}>{quest.timeLabel} · {quest.difficulty}</Text>
          </View>
        ) : null}
      </View>
      {!compact ? (
        <>
          <View style={{ width: 160 }}><Text style={{ color: t.muted, fontSize: 13, fontWeight: "800" }}>{quest.category}</Text></View>
          <View style={{ width: 130 }}><Text style={{ color: t.text, fontSize: 14, fontWeight: "900" }}>+{quest.xp} XP</Text><Text style={{ color: t.faint, fontSize: 12, fontWeight: "700" }}>{quest.timeLabel}</Text></View>
          <View style={{ width: 130 }}><Text style={{ color: t.text, fontSize: 13, fontWeight: "900" }}>{quest.difficulty}</Text><Text style={{ color: t.faint, fontSize: 12, fontWeight: "700" }}>{quest.createdByLabel}</Text></View>
          <View style={{ width: 108 }}><StatusPill status={quest.status} t={t} /></View>
        </>
      ) : null}
      {compact ? <StatusPill status={quest.status} t={t} /> : <Ionicons name="chevron-forward" size={18} color={t.faint} />}
    </Pressable>
  );
}

function QuestPreviewCard({ form, t }: { form: QuestFormInput; t: Theme }) {
  const categoryTone = questCategoryColors[form.category] ?? { text: form.color || nova.blue, bg: nova.blueSoft };
  const categoryAccent = categoryTone.text;
  const difficultyTone =
    form.difficulty === "EASY" ? { text: "#27ae60", bg: "rgba(39,174,96,0.12)" } :
    form.difficulty === "MEDIUM" ? { text: "#c05621", bg: "#fff0db" } :
    form.difficulty === "HARD" ? { text: "#ef4444", bg: "#ffecef" } :
    { text: "#7f1d1d", bg: "rgba(127,29,29,0.12)" };
  const timeLabel = form.timeMin < 60
    ? `${form.timeMin} min`
    : form.timeMin === 60
      ? "1 hour"
      : `${Number((form.timeMin / 60).toFixed(1))} hours`;

  function PreviewTag({ label, tone }: { label: string; tone: { text: string; bg: string } }) {
    return (
      <View style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: tone.bg, alignSelf: "flex-start" }}>
        <Text style={{ color: tone.text, fontSize: 12, lineHeight: 16, fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase" }}>{label}</Text>
      </View>
    );
  }

  function PreviewMetaPill({ icon, text, color, bg }: { icon: keyof typeof Ionicons.glyphMap; text: string; color: string; bg: string }) {
    return (
      <View style={{ borderRadius: 99, backgroundColor: bg, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6 }}>
        <Ionicons name={icon} size={12} color={color} />
        <Text style={{ color, fontSize: 12, lineHeight: 16, fontWeight: "900" }}>{text}</Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 16 }}>
      <Text style={{ color: t.text, fontSize: 18, fontWeight: "900" }}>Mobile Preview</Text>
      <View style={{ borderRadius: 28, backgroundColor: "#fffcf5", borderWidth: 1, borderColor: "#efe7dc", padding: 12 }}>
        <View style={{ width: "100%", minHeight: form.description.length > 84 ? 198 : 172, borderRadius: 24, backgroundColor: "#ffffff", borderWidth: 2, borderColor: "#e8dfd5", boxShadow: "4px 4px 0px #e8dfd5", overflow: "hidden" }}>
          <View style={{ flexDirection: "row" }}>
            <View style={{ width: 5, backgroundColor: categoryAccent }} />
            <View style={{ flex: 1, padding: 16, gap: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  <PreviewTag label={form.category} tone={categoryTone} />
                  <PreviewTag label={form.difficulty} tone={difficultyTone} />
                </View>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "#fffcf5", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="bookmark-outline" size={16} color="#8a8186" />
                </View>
              </View>
              <Text style={{ color: "#3d3438", fontSize: 18, lineHeight: 23, fontWeight: "900" }} numberOfLines={2}>{form.title || "Untitled quest"}</Text>
              <Text numberOfLines={2} style={{ color: "#8a8186", fontSize: 13, lineHeight: 19, fontWeight: "700" }}>{form.description || "Quest description preview will appear here."}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 2 }}>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, flex: 1 }}>
                  <PreviewMetaPill icon="flash" text={`+${form.xp} XP`} color="#4da8ff" bg="rgba(77,168,255,0.12)" />
                  <PreviewMetaPill icon="time" text={timeLabel} color="#3d3438" bg="rgba(61,52,56,0.08)" />
                </View>
                <View style={{ minWidth: 74, minHeight: 30, borderRadius: 16, backgroundColor: "#4da8ff", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 12 }}>
                  <Text style={{ color: "#ffffff", fontSize: 13, fontWeight: "900" }}>Start</Text>
                  <Ionicons name="chevron-forward" size={12} color="#ffffff" />
                </View>
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

function QuestForm({
  archived,
  compact,
  form,
  onChange,
  t,
}: {
  archived?: boolean;
  compact: boolean;
  form: QuestFormInput;
  onChange: (form: QuestFormInput) => void;
  t: Theme;
}) {
  const editable = !archived;
  const categoryAccent = questCategoryColors[form.category]?.text ?? form.color ?? nova.blue;
  const updateStep = (index: number, value: string) => {
    const next = [...form.steps];
    next[index] = value;
    onChange({ ...form, steps: next });
  };

  return (
    <View style={{ gap: 18 }}>
      <Field editable={editable} label="Quest title" t={t} value={form.title} onChangeText={(title) => onChange({ ...form, title })} placeholder="e.g. Sunrise Photo Walk" />
      <View style={{ gap: 10 }}>
        <FormSectionLabel t={t}>Category</FormSectionLabel>
        <ChoiceGrid
          minItemWidth={150}
          options={categoryOptions}
          t={t}
          toneForValue={(category) => questCategoryColors[category]}
          value={form.category}
          onChange={(category) => onChange({ ...form, category, color: questCategoryColors[category].text })}
        />
      </View>
      <View style={{ gap: 10 }}>
        <FormSectionLabel t={t}>Quest details</FormSectionLabel>
        <View style={{ flexDirection: compact ? "column" : "row", flexWrap: compact ? undefined : "wrap", gap: 14, alignItems: "flex-start" }}>
          <View style={{ flex: 2, width: compact ? "100%" : undefined, minWidth: compact ? undefined : 420, gap: 8 }}>
            <Text style={{ color: t.faint, fontSize: 11, fontWeight: "900", letterSpacing: 1.1, textTransform: "uppercase" }}>Difficulty</Text>
            <ChoiceGrid
              minItemWidth={112}
              options={questDifficulties}
              t={t}
              value={form.difficulty}
              onChange={(difficulty: QuestDifficulty) => onChange({ ...form, difficulty })}
            />
          </View>
          <View style={{ flex: 1, width: compact ? "100%" : undefined, minWidth: compact ? undefined : 180 }}>
            <NumberField editable={editable} label="Time in minutes" t={t} value={form.timeMin} onChange={(timeMin) => onChange({ ...form, timeMin })} />
          </View>
          <View style={{ flex: 1, width: compact ? "100%" : undefined, minWidth: compact ? undefined : 180 }}>
            <NumberField editable={editable} label="Experience points" t={t} value={form.xp} onChange={(xp) => onChange({ ...form, xp })} />
          </View>
        </View>
      </View>
      <Field editable={editable} label="Description" multiline t={t} value={form.description} onChangeText={(description) => onChange({ ...form, description })} placeholder="Describe what the user should do and what completion means." />
      <View style={{ gap: 10 }}>
        <FormSectionLabel t={t}>Quest steps</FormSectionLabel>
        {form.steps.map((step, index) => (
          <View key={index} style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: categoryAccent, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "900" }}>{index + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Field editable={editable} label={`Step ${index + 1}`} t={t} value={step} onChangeText={(value) => updateStep(index, value)} />
            </View>
            {editable && form.steps.length > 1 ? (
              <Pressable onPress={() => onChange({ ...form, steps: form.steps.filter((_, stepIndex) => stepIndex !== index) })} style={{ width: 42, height: 42, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: t.border }}>
                <Ionicons name="trash-outline" size={18} color={t.muted} />
              </Pressable>
            ) : null}
          </View>
        ))}
        {editable ? (
          <ActionButton icon="add" label="Add Step" onPress={() => onChange({ ...form, steps: [...form.steps, ""] })} secondary t={t} />
        ) : null}
      </View>
    </View>
  );
}

function EmptyPanel({ body, icon, t, title }: { body: string; icon: keyof typeof Ionicons.glyphMap; t: Theme; title: string }) {
  return (
    <Panel t={t} style={{ alignItems: "center", gap: 12, padding: 34 }}>
      <View style={{ width: 54, height: 54, borderRadius: 14, backgroundColor: t.active, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={24} color={nova.blue} />
      </View>
      <Text style={{ color: t.text, fontSize: 20, fontWeight: "900" }}>{title}</Text>
      <Text style={{ color: t.muted, textAlign: "center", lineHeight: 21, fontWeight: "600" }}>{body}</Text>
    </Panel>
  );
}

function DenyReviewPanel({
  note,
  onCancel,
  onChangeNote,
  onDeny,
  t,
}: {
  note: string;
  onCancel: () => void;
  onChangeNote: (note: string) => void;
  onDeny: () => void;
  t: Theme;
}) {
  return (
    <Panel t={t} style={{ padding: 20, gap: 16, borderColor: "rgba(239,68,68,0.34)" }}>
      <Text style={{ color: t.text, fontSize: 18, fontWeight: "900" }}>Deny Publication</Text>
      <Text style={{ color: t.muted, lineHeight: 20, fontWeight: "600" }}>Write exactly what needs to change. The quest will return to draft with this note attached.</Text>
      <Field label="Review report" multiline t={t} value={note} onChangeText={onChangeNote} placeholder="Explain the required changes before this can be published." />
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <ActionButton icon="close" label="Cancel" onPress={onCancel} secondary t={t} />
        </View>
        <View style={{ flex: 1 }}>
          <ActionButton disabled={!note.trim()} icon="ban-outline" label="Deny" onPress={onDeny} t={t} />
        </View>
      </View>
    </Panel>
  );
}

function SearchField({
  onChangeText,
  placeholder,
  t,
  value,
}: {
  onChangeText: (value: string) => void;
  placeholder: string;
  t: Theme;
  value: string;
}) {
  return (
    <View
      style={{
        minHeight: 46,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: t.border,
        backgroundColor: t.input,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 14,
      }}
    >
      <Ionicons name="search" size={17} color={t.faint} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={t.faint}
        style={{ flex: 1, color: t.text, fontSize: 14, fontWeight: "700", padding: 0 }}
      />
    </View>
  );
}

function QuestPickRow({
  disabled,
  onPress,
  quest,
  selected,
  t,
}: {
  disabled?: boolean;
  onPress: () => void;
  quest: Quest;
  selected: boolean;
  t: Theme;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        borderTopColor: t.border,
        borderTopWidth: 1,
        backgroundColor: selected ? t.active : pressed ? t.cardAlt : "transparent",
        opacity: disabled ? 0.45 : 1,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
      })}
    >
      <Ionicons name={selected ? "checkbox" : "square-outline"} size={20} color={selected ? nova.blue : t.faint} />
      <View style={{ width: 4, height: 36, borderRadius: 999, backgroundColor: quest.color }} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text numberOfLines={1} style={{ color: selected ? t.activeText : t.text, fontSize: 15, fontWeight: "900" }}>{quest.title}</Text>
        <Text style={{ color: t.muted, fontSize: 12, fontWeight: "700" }}>{quest.category} · +{quest.xp} XP · {quest.timeLabel}</Text>
      </View>
    </Pressable>
  );
}

function AdventurePackPreviewCard({
  form,
  previewQuests,
  t,
}: {
  form: AdventurePackForm;
  previewQuests: Quest[];
  t: Theme;
}) {
  return (
    <View style={{ gap: 16 }}>
      <Text style={{ color: t.text, fontSize: 18, fontWeight: "900" }}>Mobile Preview</Text>
      <View style={{ borderRadius: 26, backgroundColor: "#f7f0df", borderWidth: 1, borderColor: "#eadfcb", padding: 14 }}>
        <View style={{ borderRadius: 22, overflow: "hidden", borderWidth: 2, borderColor: "#f0dfbe", backgroundColor: form.bgColor || nova.blueSoft }}>
          {form.coverImageUrl ? (
            <View style={{ height: 120, backgroundColor: form.bgColor || nova.blueSoft, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#607087", fontWeight: "700", fontSize: 12 }}>Cover image set</Text>
            </View>
          ) : null}
          <View style={{ padding: 16, gap: 10 }}>
            <Text style={{ color: form.color || nova.blue, fontWeight: "900", fontSize: 11 }}>{previewQuests.length} QUESTS</Text>
            <Text style={{ color: "#152033", fontSize: 22, lineHeight: 27, fontWeight: "900" }}>
              {form.icon || "🧭"} {form.title || "Pack title"}
            </Text>
            <Text style={{ color: "#607087", fontWeight: "700", lineHeight: 20 }}>{form.subtitle || "Subtitle preview"}</Text>
            <View style={{ gap: 7, paddingTop: 4 }}>
              {(previewQuests.length ? previewQuests.slice(0, 4) : []).map((quest) => (
                <Text key={quest.id} numberOfLines={1} style={{ color: "#152033", fontWeight: "800", fontSize: 13 }}>
                  • {quest.title}
                </Text>
              ))}
              {!previewQuests.length ? (
                <Text style={{ color: "#607087", fontWeight: "700", fontSize: 13 }}>Selected quests will preview here.</Text>
              ) : null}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

export function AdminDashboardScreen({ questId, view }: { questId?: string; view: AdminView }) {
  const router = useRouter();
  const { isConfigured, session } = useAuth();
  const { refresh: refreshMobileContent } = useContent();
  const { width } = useWindowDimensions();
  const reducedMotion = useReducedMotionPreference();
  const [mode, setMode] = useState<Mode>(() => readAdminThemePreference());
  const t = themes[mode];
  const [membership, setMembership] = useState<AdminMembership | null>(null);
  const [adminProfiles, setAdminProfiles] = useState<AdminProfile[]>([]);
  const [adminInvites, setAdminInvites] = useState<AdminInvite[]>([]);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [checkingRole, setCheckingRole] = useState(true);
  const [loadingContent, setLoadingContent] = useState(true);
  const [loadingOperations, setLoadingOperations] = useState(false);
  const [loadingFeaturedBatch, setLoadingFeaturedBatch] = useState(false);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [adventurePacks, setAdventurePacks] = useState<AdventurePack[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<"All" | QuestCategory>("All");
  const [statusFilter, setStatusFilter] = useState<(typeof statusFilterOptions)[number]>("all");
  const [draftForm, setDraftForm] = useState<QuestFormInput>(defaultQuest);
  const [detailForm, setDetailForm] = useState<QuestFormInput | null>(null);
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const [packForm, setPackForm] = useState<AdventurePackForm>(defaultAdventurePackForm);
  const [packSearch, setPackSearch] = useState("");
  const [featuredDate, setFeaturedDate] = useState(featuredDateKey(new Date()));
  const [featuredQuestIds, setFeaturedQuestIds] = useState<string[]>([]);
  const [hasFeaturedBatch, setHasFeaturedBatch] = useState(false);
  const [featuredSearch, setFeaturedSearch] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePermissions, setInvitePermissions] = useState<AdminPermission[]>(defaultAdminPermissions);
  const [profileName, setProfileName] = useState("");
  const [profilePassword, setProfilePassword] = useState("");
  const [adminManagementMode, setAdminManagementMode] = useState<AdminManagementMode>("list");
  const [selectedAdminUserId, setSelectedAdminUserId] = useState<string | null>(null);
  const [draftAdminPermissions, setDraftAdminPermissions] = useState<AdminPermission[]>([]);
  const [selectedReviewQuestId, setSelectedReviewQuestId] = useState<string | null>(null);
  const [selectedNotificationIds, setSelectedNotificationIds] = useState<string[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => readAdminSidebarCollapsedPreference());
  const [dailyQuestLimitEnabled, setDailyQuestLimitEnabledState] = useState(true);
  const [updatingDailyQuestLimit, setUpdatingDailyQuestLimit] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [denyQuest, setDenyQuest] = useState<Quest | null>(null);
  const [denyNote, setDenyNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [featuredDatesByQuest, setFeaturedDatesByQuest] = useState<Record<string, string>>({});

  const compact = width < 980;
  const mobileNavigation = width < 640;
  const adventureSplitLayout = width >= 1180;
  const adventurePreviewInline = width >= 1600;
  const canViewPublished = hasPermission(membership, "quests.view_published");
  const canViewAll = hasPermission(membership, "quests.view_all");
  const canCreateDraft = hasPermission(membership, "quests.create_draft");
  const canSubmitReview = hasPermission(membership, "quests.submit_review");
  const canDeleteContent = hasPermission(membership, "content.delete");
  const canReview = membership?.role === "super_admin" && hasPermission(membership, "quests.review_publish");
  const canManageAdmins = membership?.role === "super_admin";
  const canManageProfile = hasPermission(membership, "profile.manage");
  const canViewInbox = hasPermission(membership, "inbox.view");
  const selectedQuest = questId ? quests.find((quest) => quest.id === questId) ?? null : null;
  const publishedQuests = quests.filter((quest) => quest.status === "published");
  const reviewQuests = quests.filter((quest) => quest.status === "in_review");
  const selectedReviewQuest = selectedReviewQuestId
    ? reviewQuests.find((quest) => quest.id === selectedReviewQuestId) ?? null
    : reviewQuests[0] ?? null;
  const selectedAdmin = selectedAdminUserId
    ? adminProfiles.find((profile) => profile.userId === selectedAdminUserId) ?? null
    : null;
  const selectedAdminPermissions = selectedAdmin?.role === "super_admin"
    ? [...adminPermissions]
    : selectedAdmin?.permissions ?? [];
  const hasUnsavedAdminPermissionChanges = selectedAdmin?.role !== "super_admin" && (
    draftAdminPermissions.length !== selectedAdminPermissions.length ||
    draftAdminPermissions.some((permission) => !selectedAdminPermissions.includes(permission))
  );
  const unreadCount = notifications.filter((notification) => !notification.readAt).length;
  const selectedNotificationSet = useMemo(() => new Set(selectedNotificationIds), [selectedNotificationIds]);
  const selectedNotifications = notifications.filter((notification) => selectedNotificationSet.has(notification.id));
  const allNotificationsSelected = notifications.length > 0 && selectedNotifications.length === notifications.length;
  const cleanAdminName = cleanDisplayName(membership?.displayName, membership?.email);
  const adminName = cleanAdminName || "Enter your name";
  const needsAdminName = !cleanAdminName;
  const today = featuredDateKey(new Date());
  const featuredDateOptions = [-2, -1, 0, 1, 2, 3, 4, 5, 6].map((offset) => addDays(today, offset));
  const isFeaturedPast = featuredDate < today;
  const adminMotionKey = `${view}:${adminManagementMode}`;

  useEffect(() => {
    saveAdminThemePreference(mode);
  }, [mode]);

  function toggleSidebarCollapsed() {
    const nextValue = !sidebarCollapsed;
    saveAdminSidebarCollapsedPreference(nextValue);
    setSidebarCollapsed(nextValue);
  }

  const stats = useMemo(() => ({
    archived: quests.filter((quest) => quest.status === "archived").length,
    draft: quests.filter((quest) => quest.status === "draft").length,
    inReview: quests.filter((quest) => quest.status === "in_review").length,
    published: quests.filter((quest) => quest.status === "published").length,
  }), [quests]);

  const visibleQuests = useMemo(() => {
    let next = quests;
    if (view === "published") next = next.filter((quest) => quest.status === "published");
    if (view === "review") next = next.filter((quest) => quest.status === "in_review");
    if (categoryFilter !== "All") next = next.filter((quest) => quest.category === categoryFilter);
    if (view === "all" && statusFilter !== "all") next = next.filter((quest) => quest.status === statusFilter);
    return next;
  }, [categoryFilter, quests, statusFilter, view]);

  const filteredPackQuests = useMemo(() => {
    const query = packSearch.trim().toLowerCase();
    if (!query) return publishedQuests;
    return publishedQuests.filter((quest) => `${quest.title} ${quest.category}`.toLowerCase().includes(query));
  }, [packSearch, quests]);

  const filteredFeaturedQuests = useMemo(() => {
    const query = featuredSearch.trim().toLowerCase();
    if (!query) return publishedQuests;
    return publishedQuests.filter((quest) => `${quest.title} ${quest.category}`.toLowerCase().includes(query));
  }, [featuredSearch, quests]);

  const packPreviewQuests = packForm.questIds
    .map((id) => publishedQuests.find((quest) => quest.id === id))
    .filter(Boolean) as Quest[];

  useEffect(() => {
    if (selectedQuest) {
      setDetailForm(asForm(selectedQuest));
    }
  }, [selectedQuest?.id, selectedQuest?.status, selectedQuest?.updatedAt]);

  useEffect(() => {
    if (!selectedPackId) {
      setPackForm(defaultAdventurePackForm);
      return;
    }

    const pack = adventurePacks.find((item) => item.id === selectedPackId);
    if (!pack) return;

    setPackForm({
      title: pack.title,
      subtitle: pack.subtitle,
      description: pack.description,
      status: pack.status,
      color: pack.color,
      bgColor: pack.bgColor,
      icon: pack.icon,
      questIds: pack.questIds,
      coverImageUrl: pack.coverImageUrl ?? "",
    });
  }, [adventurePacks, selectedPackId]);

  useEffect(() => {
    setProfileName(cleanDisplayName(membership?.displayName, membership?.email));
  }, [membership?.displayName, membership?.email]);

  useEffect(() => {
    if (reviewQuests.length && !selectedReviewQuestId) {
      setSelectedReviewQuestId(reviewQuests[0].id);
    }
  }, [reviewQuests.length, selectedReviewQuestId]);

  useEffect(() => {
    const validNotificationIds = new Set(notifications.map((notification) => notification.id));
    setSelectedNotificationIds((current) => current.filter((id) => validNotificationIds.has(id)));
  }, [notifications]);

  useEffect(() => {
    if (!hasUnsavedAdminPermissionChanges || typeof window === "undefined") return;

    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [hasUnsavedAdminPermissionChanges]);

  async function loadAdminContent() {
    setLoadingContent(true);
    try {
      const [content, featuredBatches] = await Promise.all([
        fetchContentLibrary({ admin: true }),
        fetchFeaturedBatches(featuredDateKey(new Date()), featuredDateKey(new Date(Date.now() + 1000 * 60 * 60 * 24 * 30))),
      ]);
      setQuests(content.quests);
      setAdventurePacks(content.adventurePacks);

      const nextFeaturedDates: Record<string, string> = {};
      for (const batch of featuredBatches) {
        for (const questId of batch.questIds) {
          if (!nextFeaturedDates[questId]) nextFeaturedDates[questId] = batch.featuredOn;
        }
      }
      setFeaturedDatesByQuest(nextFeaturedDates);
    } finally {
      setLoadingContent(false);
    }
  }

  async function loadAdminOperations() {
    setLoadingOperations(true);
    try {
      const nextNotifications = canViewInbox ? await fetchAdminNotifications() : [];
      setNotifications(nextNotifications);

      if (canManageAdmins) {
        const [profiles, invites, dailyLimitEnabled] = await Promise.all([
          listAdminProfiles(),
          listAdminInvites(),
          getDailyQuestLimitEnabled(),
        ]);
        setAdminProfiles(profiles);
        setAdminInvites(invites);
        setDailyQuestLimitEnabledState(dailyLimitEnabled);
      }
    } finally {
      setLoadingOperations(false);
    }
  }

  async function loadFeaturedBatch(date: string) {
    setError(null);
    setLoadingFeaturedBatch(true);
    try {
      const batches = await fetchFeaturedBatches(date, date);
      setHasFeaturedBatch(Boolean(batches[0]));
      setFeaturedQuestIds(batches[0]?.questIds ?? []);
    } catch (nextError) {
      setHasFeaturedBatch(false);
      setFeaturedQuestIds([]);
      setError(nextError instanceof Error ? nextError.message : "Unable to load featured batch.");
    } finally {
      setLoadingFeaturedBatch(false);
    }
  }

  useEffect(() => {
    if (!membership || view !== "featured") return;

    loadFeaturedBatch(featuredDate);
  }, [featuredDate, membership?.userId, view]);

  useEffect(() => {
    let mounted = true;

    async function checkRole() {
      if (!session || !isConfigured) {
        setCheckingRole(false);
        return;
      }

      try {
        const role = await getAdminMembership();
        if (!mounted) return;
        setMembership(role);
        if (role) await loadAdminContent();
      } catch (nextError) {
        if (mounted) setError(nextError instanceof Error ? nextError.message : "Unable to verify admin access.");
      } finally {
        if (mounted) setCheckingRole(false);
      }
    }

    checkRole();

    return () => {
      mounted = false;
    };
  }, [isConfigured, session]);

  useEffect(() => {
    if (!membership) return;

    loadAdminOperations().catch((nextError) => {
      setError(nextError instanceof Error ? nextError.message : "Unable to load admin operations.");
    });
  }, [membership?.userId, membership?.role, membership?.permissions.join("|")]);

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  async function saveQuest(input: QuestFormInput & { id?: string }, success: string) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await upsertQuest(input);
      await loadAdminContent();
      await refreshMobileContent();
      setMessage(success);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to save quest.");
    } finally {
      setLoadingFeaturedBatch(false);
      setSaving(false);
    }
  }

  function togglePackQuest(id: string) {
    setPackForm((current) => ({
      ...current,
      questIds: current.questIds.includes(id)
        ? current.questIds.filter((questId) => questId !== id)
        : [...current.questIds, id],
    }));
  }

  async function saveAdventurePack(status?: QuestStatus) {
    if (!canViewPublished) {
      setError("You do not have permission to manage adventure packs.");
      return;
    }
    if (!packForm.title.trim()) {
      setError("Adventure pack title is required.");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const savedPack = await upsertAdventurePack({
        id: selectedPackId ?? undefined,
        ...packForm,
        status: status ?? packForm.status,
        coverImageUrl: packForm.coverImageUrl?.trim() || undefined,
      });
      await loadAdminContent();
      await refreshMobileContent();
      setSelectedPackId(savedPack.id);
      setMessage(selectedPackId ? "Adventure pack updated." : "Adventure pack created.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to save adventure pack.");
    } finally {
      setSaving(false);
    }
  }

  function confirmDeleteAdventurePack() {
    if (!canDeleteContent) {
      setError("You do not have permission to delete content.");
      return;
    }

    const pack = adventurePacks.find((item) => item.id === selectedPackId);
    if (!pack) return;

    Alert.alert(
      "Delete adventure pack?",
      `Delete “${pack.title}” and remove its ${pack.questCount} quest ${pack.questCount === 1 ? "assignment" : "assignments"}? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete pack", style: "destructive", onPress: () => void deleteSelectedAdventurePack(pack) },
      ],
    );
  }

  async function deleteSelectedAdventurePack(pack: AdventurePack) {
    if (!canDeleteContent) {
      setError("You do not have permission to delete content.");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await deleteAdventurePack(pack.id);
      await loadAdminContent();
      await refreshMobileContent();
      setSelectedPackId(null);
      setPackForm(defaultAdventurePackForm);
      setMessage(`Deleted “${pack.title}”.`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to delete adventure pack.");
    } finally {
      setSaving(false);
    }
  }

  function toggleFeaturedQuest(id: string) {
    setFeaturedQuestIds((current) => {
      if (current.includes(id)) return current.filter((questId) => questId !== id);
      if (current.length >= 6) return current;
      return [...current, id];
    });
  }

  async function saveFeaturedBatch() {
    if (!canViewPublished) {
      setError("You do not have permission to manage featured quests.");
      return;
    }
    if (featuredQuestIds.length !== 6) {
      setError("Featured batches need exactly 6 quests.");
      return;
    }
    if (hasFeaturedBatch && !canDeleteContent) {
      setError("You need the Delete content permission to edit an existing featured batch.");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await upsertFeaturedBatch(featuredDate, featuredQuestIds);
      await loadAdminContent();
      await refreshMobileContent();
      setHasFeaturedBatch(true);
      setMessage(`Featured batch saved for ${featuredDate}.`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to save featured batch.");
    } finally {
      setSaving(false);
    }
  }

  async function clearFeaturedBatch() {
    if (!canDeleteContent) {
      setError("You do not have permission to delete content.");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await deleteFeaturedBatch(featuredDate);
      setFeaturedQuestIds([]);
      setHasFeaturedBatch(false);
      await loadAdminContent();
      await refreshMobileContent();
      setMessage(`Featured batch cleared for ${featuredDate}.`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to clear featured batch.");
    } finally {
      setSaving(false);
    }
  }

  function confirmClearFeaturedBatch() {
    if (!canDeleteContent) {
      setError("You do not have permission to delete content.");
      return;
    }

    if (!featuredQuestIds.length) return;

    Alert.alert(
      "Delete featured batch?",
      `Remove all ${featuredQuestIds.length} featured quests scheduled for ${featuredDate}? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete batch", style: "destructive", onPress: () => void clearFeaturedBatch() },
      ],
    );
  }

  function confirmRemoveFeaturedQuest(quest: Quest) {
    if (!canDeleteContent) {
      setError("You do not have permission to delete content.");
      return;
    }

    Alert.alert(
      "Remove featured quest?",
      `Remove “${quest.title}” from the ${featuredDate} lineup? Save the featured batch to publish this change.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            toggleFeaturedQuest(quest.id);
            setMessage(`Removed “${quest.title}” from the pending lineup. Save the batch to publish this change.`);
          },
        },
      ],
    );
  }

  async function saveDraft(submitForReview: boolean) {
    if (!canCreateDraft || (submitForReview && !canSubmitReview)) {
      setError("You do not have permission to save or submit drafts.");
      return;
    }

    const status: QuestStatus = submitForReview ? "in_review" : "draft";
    await saveQuest({ ...draftForm, featured: false, status }, submitForReview ? "Quest sent for review." : "Draft saved.");
    setDraftForm(defaultQuest);
  }

  async function updateSelectedQuest(status?: QuestStatus, reviewNote?: string | null) {
    if (!selectedQuest || !detailForm) return;
    if (selectedQuest.status === "draft" && status === "archived") {
      setError("Draft quests cannot be archived. Send them for review or delete the draft.");
      return;
    }
    if (status === "published") {
      setError("Publishing happens from the review screen only.");
      return;
    }
    if (status === "archived" && selectedQuest.status !== "published") {
      setError("Only published quests can move to archive.");
      return;
    }

    const nextStatus = status ?? detailForm.status;
    const nextReviewNote = reviewNote ?? detailForm.reviewNote;

    await saveQuest(
      {
        ...detailForm,
        id: selectedQuest.id,
        status: nextStatus,
        reviewNote: nextReviewNote,
      },
      "Quest updated.",
    );

    setDetailForm({ ...detailForm, status: nextStatus, reviewNote: nextReviewNote });
  }

  async function approveQuest(quest: Quest) {
    if (!canReview) {
      setError("You do not have permission to publish reviewed quests.");
      return;
    }

    await saveQuest({ ...asForm(quest), id: quest.id, status: "published", reviewNote: null }, "Quest approved and published.");
    await notifyQuestReviewResult({ quest, result: "approved" });
    await loadAdminOperations();
  }

  async function denyPublication() {
    if (!denyQuest) return;
    await saveQuest({ ...asForm(denyQuest), id: denyQuest.id, status: "draft", reviewNote: denyNote }, "Quest denied and returned to draft.");
    await notifyQuestReviewResult({ quest: denyQuest, report: denyNote, result: "denied" });
    await loadAdminOperations();
    setDenyQuest(null);
    setDenyNote("");
  }

  async function deleteSelectedDraft() {
    if (!selectedQuest || selectedQuest.status !== "draft") return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await deleteQuest(selectedQuest.id);
      await loadAdminContent();
      await refreshMobileContent();
      setMessage("Draft deleted.");
      router.replace("/admin/quests");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to delete draft.");
    } finally {
      setSaving(false);
    }
  }

  function toggleInvitePermission(permission: AdminPermission) {
    setInvitePermissions((current) =>
      current.includes(permission)
        ? current.filter((item) => item !== permission)
        : [...current, permission],
    );
  }

  function openAdminDetail(profile: AdminProfile) {
    setSelectedAdminUserId(profile.userId);
    setDraftAdminPermissions(profile.role === "super_admin" ? [...adminPermissions] : profile.permissions);
    setAdminManagementMode("detail");
  }

  function discardAdminPermissionChanges(callback: () => void) {
    if (!hasUnsavedAdminPermissionChanges) {
      callback();
      return;
    }

    Alert.alert(
      "Unsaved permission changes",
      "Save your permission changes before leaving this admin, or discard them to continue.",
      [
        { text: "Keep editing", style: "cancel" },
        {
          text: "Discard changes",
          style: "destructive",
          onPress: () => {
            setDraftAdminPermissions(selectedAdminPermissions);
            callback();
          },
        },
      ],
    );
  }

  function returnToAdminList() {
    discardAdminPermissionChanges(() => {
      setSelectedAdminUserId(null);
      setAdminManagementMode("list");
    });
  }

  function navigateAwayFromAdminDetail(route: string) {
    if (view === "admins" && adminManagementMode === "detail" && hasUnsavedAdminPermissionChanges) {
      discardAdminPermissionChanges(() => router.push(route));
      return;
    }
    router.push(route);
  }

  function toggleSelectedAdminPermission(permission: AdminPermission) {
    if (!selectedAdmin || selectedAdmin.role === "super_admin") return;
    setDraftAdminPermissions((current) =>
      current.includes(permission)
        ? current.filter((item) => item !== permission)
        : [...current, permission],
    );
  }

  async function handleInviteAdmin() {
    if (!inviteEmail.trim()) return false;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await inviteAdmin({
        email: inviteEmail,
        permissions: invitePermissions,
        role: "admin",
      });
      setInviteEmail("");
      setInvitePermissions(defaultAdminPermissions);
      await loadAdminOperations();
      setMessage("Admin invite saved.");
      return true;
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to invite admin.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveSelectedAdminAccess() {
    if (!selectedAdmin) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await updateAdminAccess({
        permissions: draftAdminPermissions,
        role: selectedAdmin.role,
        userId: selectedAdmin.userId,
      });
      await loadAdminOperations();
      setDraftAdminPermissions(draftAdminPermissions);
      setMessage("Admin permissions updated.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to update admin.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAdmin(profile: AdminProfile) {
    if (profile.role === "super_admin") return;

    Alert.alert(
      "Delete admin?",
      "This removes the admin account from Supabase Auth and cannot be undone.",
      [
        { style: "cancel", text: "Cancel" },
        {
          style: "destructive",
          text: "Delete",
          onPress: async () => {
            setSaving(true);
            setError(null);
            setMessage(null);
            try {
              await deleteAdmin(profile.userId);
              if (selectedAdminUserId === profile.userId) {
                setSelectedAdminUserId(null);
                setAdminManagementMode("list");
              }
              await loadAdminOperations();
              setMessage("Admin deleted.");
            } catch (nextError) {
              setError(nextError instanceof Error ? nextError.message : "Unable to delete admin.");
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  }

  async function saveProfile() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await updateOwnAdminProfile(profileName);
      if (profilePassword.trim()) {
        await updatePassword(profilePassword.trim());
        setProfilePassword("");
      }
      const nextMembership = await getAdminMembership();
      setMembership(nextMembership);
      setMessage("Profile updated.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to update profile.");
    } finally {
      setSaving(false);
    }
  }

  function toggleNotificationSelection(id: string) {
    setSelectedNotificationIds((current) =>
      current.includes(id) ? current.filter((selectedId) => selectedId !== id) : [...current, id],
    );
  }

  function toggleAllNotifications() {
    setSelectedNotificationIds(allNotificationsSelected ? [] : notifications.map((notification) => notification.id));
  }

  async function readAllNotifications() {
    if (!notifications.length || !unreadCount) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await markAllAdminNotificationsRead();
      await loadAdminOperations();
      setMessage("All notifications marked as read.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to mark notifications as read.");
    } finally {
      setSaving(false);
    }
  }

  async function markSelectedNotifications(read: boolean) {
    if (!selectedNotificationIds.length) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await markAdminNotificationsRead(selectedNotificationIds, read);
      await loadAdminOperations();
      setMessage(read ? "Selected notifications marked as read." : "Selected notifications marked as unread.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to update selected notifications.");
    } finally {
      setSaving(false);
    }
  }

  async function removeNotifications(ids?: string[]) {
    const deleteAll = !ids;
    const count = ids?.length ?? notifications.length;
    if (!count) return;

    Alert.alert(
      deleteAll ? "Delete all notifications?" : "Delete selected notifications?",
      deleteAll ? "This will clear every notification in your inbox." : `This will delete ${count} selected notification${count === 1 ? "" : "s"}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setSaving(true);
            setError(null);
            setMessage(null);
            try {
              await deleteAdminNotifications(ids);
              setSelectedNotificationIds([]);
              await loadAdminOperations();
              setMessage(deleteAll ? "Inbox cleared." : "Selected notifications deleted.");
            } catch (nextError) {
              setError(nextError instanceof Error ? nextError.message : "Unable to delete notifications.");
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  }

  async function openNotification(notification: AdminNotification) {
    if (selectedNotificationIds.length) {
      toggleNotificationSelection(notification.id);
      return;
    }

    if (!notification.readAt) {
      await markAdminNotificationRead(notification.id);
      await loadAdminOperations();
    }

    if (notification.relatedQuestId) {
      router.push(`/admin/quest/${notification.relatedQuestId}`);
    }
  }

  async function handleLogout() {
    setError(null);
    try {
      await signOut();
      router.replace("/(auth)/login");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to log out.");
    }
  }

  async function handleDailyQuestLimitToggle() {
    if (!canManageAdmins || updatingDailyQuestLimit) return;
    const nextValue = !dailyQuestLimitEnabled;
    setUpdatingDailyQuestLimit(true);
    setDailyQuestLimitEnabledState(nextValue);
    setError(null);
    try {
      const persistedValue = await saveDailyQuestLimitEnabled(nextValue);
      setDailyQuestLimitEnabledState(persistedValue);
      setMessage(persistedValue ? "Daily quest limit enabled for all users." : "Daily quest limit disabled for all users.");
    } catch (nextError) {
      setDailyQuestLimitEnabledState(!nextValue);
      setError(nextError instanceof Error ? nextError.message : "Unable to update the daily quest limit.");
    } finally {
      setUpdatingDailyQuestLimit(false);
    }
  }

  const currentTitle =
    view === "published" ? "Published Quests" :
    view === "all" ? "All Quests" :
    view === "create" ? "Create Quest Draft" :
    view === "review" ? "Publication Review" :
    view === "adventurePacks" ? "Adventure Packs" :
    view === "featured" ? "Featured Quests" :
    view === "admins" ? "Admin Tools" :
    view === "profile" ? "Profile" :
    view === "inbox" ? "Inbox" :
    "Quest Detail";

  const currentSubtitle =
    view === "published" ? "Only live quests that are visible inside the app." :
    view === "all" ? "Draft, review, published, and archived quests for internal operations." :
    view === "create" ? "Create a draft, add steps, preview the mobile card, then save or submit for review." :
    view === "review" ? "Approve requests for publication or return them with a clear report." :
    view === "adventurePacks" ? "Build official quest collections with ordering, cover art, and app-ready previews." :
    view === "featured" ? "Schedule the daily six-quest lineup for the Explore carousel." :
    view === "admins" ? "Manage admin access, review account details, and invite people into the dashboard." :
    view === "profile" ? "Manage your admin identity, password, and granted permissions." :
    view === "inbox" ? "Review publication decisions and admin tool notifications." :
    "Edit quest content and move it through draft, review, published, or archived states.";

  const nav = [
    ...(canViewPublished ? [{ label: "Published", icon: "grid-outline" as const, route: "/admin/published", active: view === "published" }] : []),
    ...(canViewAll ? [{ label: "All Quests", icon: "analytics-outline" as const, route: "/admin/quests", active: view === "all" }] : []),
    ...(canCreateDraft ? [{ label: "Create Draft", icon: "create-outline" as const, route: "/admin/create", active: view === "create" }] : []),
    ...(canReview ? [{ label: "Review", icon: "checkmark-done-outline" as const, route: "/admin/review", active: view === "review" }] : []),
    ...(canViewPublished ? [{ label: "Adventure Packs", icon: "albums-outline" as const, route: "/admin/adventure-packs", active: view === "adventurePacks" }] : []),
    ...(canViewPublished ? [{ label: "Featured", icon: "sparkles-outline" as const, route: "/admin/featured", active: view === "featured" }] : []),
    ...(canManageAdmins ? [{ label: "Admins", icon: "people-outline" as const, route: "/admin/admins", active: view === "admins" }] : []),
    ...(canViewInbox ? [{ label: "Inbox", icon: "notifications-outline" as const, route: "/admin/inbox", active: view === "inbox" }] : []),
    ...(canManageProfile ? [{ label: "Profile", icon: "person-circle-outline" as const, route: "/admin/profile", active: view === "profile" }] : []),
  ];

  const collapsedRail = sidebarCollapsed && !mobileNavigation;
  const iconOnlySidebarControl = collapsedRail;
  const sidebarWidth = mobileNavigation ? 280 : collapsedRail ? 72 : 260;
  const sidebarPaddingHorizontal = mobileNavigation ? 18 : collapsedRail ? 12 : 24;

  function renderNavItem(item: (typeof nav)[number]) {
    return (
      <Pressable
        key={item.route}
        accessibilityRole="button"
        accessibilityLabel={item.label}
        accessibilityState={{ selected: item.active }}
        onPress={() => {
          if (mobileNavigation) setMobileMenuOpen(false);
          navigateAwayFromAdminDetail(item.route);
        }}
        style={{
          minHeight: 48,
          width: iconOnlySidebarControl ? 48 : "100%",
          alignSelf: iconOnlySidebarControl ? "center" : "stretch",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: iconOnlySidebarControl ? "center" : "flex-start",
          gap: iconOnlySidebarControl ? 0 : 12,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: item.active ? nova.blue : "transparent",
          backgroundColor: item.active ? t.active : "transparent",
          paddingHorizontal: iconOnlySidebarControl ? 0 : 14,
        }}
      >
        <Ionicons name={item.icon} size={22} color={item.active ? nova.blue : t.muted} />
        {iconOnlySidebarControl ? null : (
          <Text style={{ color: item.active ? t.activeText : t.muted, fontSize: 16, fontWeight: "800" }}>{item.label}</Text>
        )}
      </Pressable>
    );
  }

  function renderSidebarAction(label: string, icon: keyof typeof Ionicons.glyphMap, onPress: () => void) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={{
          minHeight: 48,
          width: iconOnlySidebarControl ? 48 : "100%",
          alignSelf: iconOnlySidebarControl ? "center" : "stretch",
          borderRadius: 10,
          borderWidth: 1,
          borderColor: t.border,
          backgroundColor: t.card,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: iconOnlySidebarControl ? "center" : "flex-start",
          gap: iconOnlySidebarControl ? 0 : 10,
          paddingHorizontal: iconOnlySidebarControl ? 0 : 14,
        }}
      >
        <Ionicons name={icon} size={20} color={t.muted} />
        {iconOnlySidebarControl ? null : <Text style={{ color: t.muted, fontSize: 15, fontWeight: "900" }}>{label}</Text>}
      </Pressable>
    );
  }

  return (
    <View style={{ flex: 1, position: "relative", backgroundColor: t.page }}>
      <View style={{ flex: 1, position: "relative", flexDirection: mobileNavigation ? "column" : "row" }}>
        {mobileNavigation && mobileMenuOpen ? (
          <Pressable
            accessibilityLabel="Close navigation menu"
            accessibilityRole="button"
            onPress={() => setMobileMenuOpen(false)}
            style={{ position: "absolute", inset: 0, zIndex: 10, backgroundColor: "rgba(5,6,8,0.48)" }}
          />
        ) : null}
        {!mobileNavigation || mobileMenuOpen ? <View
          style={{
            width: sidebarWidth,
            height: mobileNavigation ? "100%" : undefined,
            position: mobileNavigation ? "absolute" : "relative",
            top: mobileNavigation ? 0 : undefined,
            bottom: mobileNavigation ? 0 : undefined,
            left: mobileNavigation ? 0 : undefined,
            zIndex: mobileNavigation ? 20 : undefined,
            flexShrink: 0,
            backgroundColor: t.sidebar,
            borderRightWidth: 1,
            borderRightColor: t.border,
            paddingHorizontal: sidebarPaddingHorizontal,
            paddingVertical: mobileNavigation ? 16 : 18,
            gap: mobileNavigation ? 16 : 18,
            overflow: "hidden",
          }}
        >
          <View style={{ flexDirection: collapsedRail ? "column" : "row", alignItems: "center", justifyContent: collapsedRail ? "center" : "space-between", gap: 10 }}>
            {collapsedRail ? (
              <View style={{ width: 48, height: 48, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: nova.blue }}>
                <Ionicons name="flash" size={21} color="#ffffff" />
              </View>
            ) : (
              <AdminLogo t={t} />
            )}
            {mobileNavigation ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close navigation menu"
                onPress={() => setMobileMenuOpen(false)}
                style={{ width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: t.border, backgroundColor: t.card }}
              >
                <Ionicons name="close" size={20} color={t.muted} />
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={collapsedRail ? "Expand sidebar" : "Collapse sidebar"}
                onPress={toggleSidebarCollapsed}
                style={{
                  width: collapsedRail ? 48 : 36,
                  height: collapsedRail ? 44 : 36,
                  borderRadius: 10,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: t.border,
                  backgroundColor: t.card,
                }}
              >
                <Ionicons name={sidebarCollapsed ? "chevron-forward" : "chevron-back"} size={18} color={t.muted} />
              </Pressable>
            )}
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 8, paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
            {nav.map(renderNavItem)}
          </ScrollView>
          <View style={{ gap: 10, flexShrink: 0 }}>
            {canManageAdmins ? <Pressable
              accessibilityRole="switch"
              accessibilityLabel="Daily quest limit"
              accessibilityState={{ checked: dailyQuestLimitEnabled, disabled: updatingDailyQuestLimit }}
              disabled={updatingDailyQuestLimit}
              onPress={handleDailyQuestLimitToggle}
              style={({ pressed }) => ({
                minHeight: 52,
                width: iconOnlySidebarControl ? 48 : "100%",
                alignSelf: iconOnlySidebarControl ? "center" : "stretch",
                borderRadius: 10,
                borderWidth: 1,
                borderColor: dailyQuestLimitEnabled ? nova.blue : t.border,
                backgroundColor: dailyQuestLimitEnabled ? t.active : t.card,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: iconOnlySidebarControl ? "center" : "space-between",
                gap: 10,
                paddingHorizontal: iconOnlySidebarControl ? 0 : 12,
                opacity: updatingDailyQuestLimit ? 0.6 : pressed ? 0.86 : 1,
              })}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}><Ionicons name="speedometer-outline" size={20} color={dailyQuestLimitEnabled ? nova.blue : t.muted} />{iconOnlySidebarControl ? null : <View><Text style={{ color: t.text, fontSize: 13, fontWeight: "900" }}>Daily quest limit</Text><Text style={{ color: t.muted, fontSize: 11, fontWeight: "700" }}>{dailyQuestLimitEnabled ? "On · 5 per day" : "Off · unlimited"}</Text></View>}</View>
              {iconOnlySidebarControl ? null : <View style={{ width: 34, height: 20, borderRadius: 10, padding: 2, justifyContent: "center", alignItems: dailyQuestLimitEnabled ? "flex-end" : "flex-start", backgroundColor: dailyQuestLimitEnabled ? nova.blue : t.border }}><View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: "#ffffff" }} /></View>}
            </Pressable> : null}
            {collapsedRail ? null : (
              <Text style={{ color: t.muted, fontSize: 15, fontWeight: "800" }}>{membership ? `${membership.role} access` : checkingRole ? "Checking access" : "No access"}</Text>
            )}
            {renderSidebarAction(mode === "dark" ? "Light Mode" : "Dark Mode", mode === "dark" ? "sunny-outline" : "moon-outline", () => setMode((current) => current === "dark" ? "light" : "dark"))}
            {renderSidebarAction("Logout", "log-out-outline", handleLogout)}
          </View>
        </View> : null}

        <View style={{ flex: 1 }}>
          <View style={{ minHeight: 74, borderBottomWidth: 1, borderBottomColor: t.border, backgroundColor: t.shell, paddingHorizontal: compact ? 18 : 30, flexDirection: "row", alignItems: "center", gap: 18 }}>
            {mobileNavigation ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open navigation menu"
                onPress={() => setMobileMenuOpen(true)}
                style={{ width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: t.border, backgroundColor: t.card }}
              >
                <Ionicons name="menu" size={22} color={t.muted} />
              </Pressable>
            ) : null}
            <View style={{ flex: 1, gap: 3 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <Text style={{ color: t.text, fontSize: 19, fontWeight: "900" }}>Welcome back,</Text>
                <Pressable
                  disabled={!needsAdminName || !canManageProfile}
                  onPress={() => navigateAwayFromAdminDetail("/admin/profile")}
                  style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <Text style={{ color: needsAdminName ? t.activeText : t.text, fontSize: 19, fontWeight: "900" }}>{adminName}</Text>
                  {needsAdminName ? <Ionicons name="pencil-outline" size={17} color={t.activeText} /> : null}
                </Pressable>
              </View>
              <Text style={{ color: t.muted, fontSize: 13, fontWeight: "700" }}>Build the quests people will actually remember.</Text>
            </View>
            {canViewInbox ? (
              <Pressable onPress={() => navigateAwayFromAdminDetail("/admin/inbox")} style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name={unreadCount ? "notifications" : "notifications-outline"} size={23} color={t.muted} />
                {unreadCount ? (
                  <View style={{ position: "absolute", right: 8, top: 8, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: nova.red, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 }}>
                    <Text style={{ color: "#ffffff", fontSize: 10, fontWeight: "900" }}>{unreadCount}</Text>
                  </View>
                ) : null}
              </Pressable>
            ) : null}
          </View>

          <ScrollView contentContainerStyle={{ padding: compact ? 18 : 36, paddingBottom: 60 }}>
            <MotionFrame motionKey={adminMotionKey} reducedMotion={reducedMotion} style={{ gap: 26 }}>
            <View style={{ flexDirection: compact ? "column" : "row", justifyContent: "space-between", gap: 16 }}>
              <View style={{ gap: 8, flex: 1 }}>
                <Text style={{ color: t.text, fontSize: compact ? 32 : 42, fontWeight: "900", letterSpacing: 0 }}>{currentTitle}</Text>
                <Text style={{ color: t.muted, fontSize: 17, fontWeight: "600" }}>{currentSubtitle}</Text>
              </View>
              <View style={{ alignItems: compact ? "flex-start" : "flex-end", gap: 10 }}>
                {view === "all" && canCreateDraft ? <ActionButton icon="add" label="New Draft" onPress={() => router.push("/admin/create")} t={t} /> : null}
                {view === "admins" && canManageAdmins && adminManagementMode === "list" ? (
                  <ActionButton icon="person-add-outline" label="Invite admin" onPress={() => setAdminManagementMode("invite")} t={t} />
                ) : null}
              </View>
            </View>

            {checkingRole ? <LoadingPanel label="Checking your admin access..." reducedMotion={reducedMotion} t={t} /> : null}

            {!checkingRole && !membership ? (
              <EmptyPanel icon="lock-closed-outline" title="Admin access required" body="This account is signed in but is not listed in admin_memberships." t={t} />
            ) : null}

            {membership && !checkingRole ? (
              <>
                {(view === "published" || view === "all") && !loadingContent ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 18 }}>
                  <MotionFrame motionKey={adminMotionKey} delay={0} reducedMotion={reducedMotion} style={{ flex: 1, minWidth: 210 }}><QuestStatCard icon="rocket-outline" label="Published" value={stats.published} tint={nova.blue} t={t} /></MotionFrame>
                  <MotionFrame motionKey={adminMotionKey} delay={35} reducedMotion={reducedMotion} style={{ flex: 1, minWidth: 210 }}><QuestStatCard icon="document-text-outline" label="Drafts" value={stats.draft} tint={nova.orange} t={t} /></MotionFrame>
                  <MotionFrame motionKey={adminMotionKey} delay={70} reducedMotion={reducedMotion} style={{ flex: 1, minWidth: 210 }}><QuestStatCard icon="shield-checkmark-outline" label="In Review" value={stats.inReview} tint={nova.violet} t={t} /></MotionFrame>
                  <MotionFrame motionKey={adminMotionKey} delay={105} reducedMotion={reducedMotion} style={{ flex: 1, minWidth: 210 }}><QuestStatCard icon="archive-outline" label="Archived" value={stats.archived} tint={nova.red} t={t} /></MotionFrame>
                </View>
                ) : null}

                {message ? <MotionFrame motionKey={`message:${message}`} reducedMotion={reducedMotion}><Text style={{ color: nova.green, fontWeight: "900" }}>{message}</Text></MotionFrame> : null}
                {error ? <MotionFrame motionKey={`error:${error}`} reducedMotion={reducedMotion}><Text style={{ color: nova.red, fontWeight: "900" }}>{error}</Text></MotionFrame> : null}

                {view === "published" || view === "all" ? (
                  (view === "published" ? canViewPublished : canViewAll) ? (
                  loadingContent ? <LoadingPanel label="Loading quest library..." reducedMotion={reducedMotion} t={t} /> :
                  <View style={{ gap: 14 }}>
                    <View style={{ gap: 10 }}>
                      <FilterCarousel options={["All", ...categoryOptions]} t={t} value={categoryFilter} onChange={setCategoryFilter} />
                      {view === "all" ? (
                        <FilterCarousel options={statusFilterOptions} t={t} value={statusFilter} onChange={setStatusFilter} renderLabel={(status) => status === "all" ? "All Statuses" : statusLabel(status as QuestStatus)} />
                      ) : null}
                    </View>
                    <Panel t={t} style={{ overflow: "hidden" }}>
                      <View style={{ padding: 24, gap: 18 }}>
                        <View>
                          <Text style={{ color: t.text, fontSize: 22, fontWeight: "900" }}>{view === "published" ? "Published Library" : "Quest Library"}</Text>
                          <Text style={{ color: t.muted, marginTop: 5, fontWeight: "600" }}>{visibleQuests.length} quests shown</Text>
                        </View>
                      </View>
                      {visibleQuests.length ? visibleQuests.map((quest) => (
                        <QuestRow compact={compact} key={quest.id} quest={quest} t={t} featuredDate={featuredDatesByQuest[quest.id]} onPress={() => router.push(`/admin/quest/${quest.id}`)} />
                      )) : (
                        <View style={{ padding: 24 }}>
                          <EmptyPanel icon="search-outline" title="No quests found" body="Try another category or status filter." t={t} />
                        </View>
                      )}
                    </Panel>
                  </View>
                  ) : (
                    <EmptyPanel icon="lock-closed-outline" title="Quest library permission required" body="Your admin account does not have access to this quest library." t={t} />
                  )
                ) : null}

                {view === "create" ? (
                  canCreateDraft ? (
                  <View style={{ flexDirection: compact ? "column" : "row", gap: 22, alignItems: "flex-start" }}>
                    <Panel t={t} style={{ flex: 1.4, padding: 24, gap: 22 }}>
                      <QuestForm compact={compact} form={draftForm} onChange={setDraftForm} t={t} />
                      <View style={{ flexDirection: compact ? "column" : "row", gap: 12 }}>
                        <View style={{ flex: 1 }}>
                          <ActionButton disabled={saving} icon="save-outline" label={saving ? "Saving..." : "Save Draft"} onPress={() => saveDraft(false)} secondary t={t} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <ActionButton disabled={saving || !draftForm.title.trim() || !draftForm.description.trim()} icon="paper-plane-outline" label="Submit for Review" onPress={() => saveDraft(true)} t={t} />
                        </View>
                      </View>
                    </Panel>
                    <Panel t={t} style={{ flex: 1, padding: 22 }}>
                      <QuestPreviewCard form={draftForm} t={t} />
                    </Panel>
                  </View>
                  ) : (
                    <EmptyPanel icon="lock-closed-outline" title="Draft permission required" body="Your admin account cannot create quest drafts." t={t} />
                  )
                ) : null}

                {view === "detail" ? (
                  canViewAll ? (
                  loadingContent ? <LoadingPanel label="Loading quest details..." reducedMotion={reducedMotion} t={t} /> :
                  selectedQuest && detailForm ? (
                    <View style={{ flexDirection: compact ? "column" : "row", gap: 22, alignItems: "flex-start" }}>
                      <Panel t={t} style={{ flex: 1.4, padding: 24, gap: 20 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
                          <View style={{ gap: 7, flex: 1 }}>
                            <Text style={{ color: t.text, fontSize: 24, fontWeight: "900" }}>{selectedQuest.title}</Text>
                            <Text style={{ color: t.muted, fontWeight: "700" }}>Created by {selectedQuest.createdByLabel} · Updated {formatDate(selectedQuest.updatedAt)}</Text>
                          </View>
                          <StatusPill status={selectedQuest.status} t={t} />
                        </View>
                        {selectedQuest.reviewNote ? (
                          <Panel t={t} style={{ padding: 16, borderColor: "rgba(249,115,22,0.34)", backgroundColor: t.mode === "dark" ? "#231a12" : "#fff7ed" }}>
                            <Text style={{ color: t.text, fontWeight: "900" }}>Review note</Text>
                            <Text style={{ color: t.muted, marginTop: 6, fontWeight: "700", lineHeight: 20 }}>{selectedQuest.reviewNote}</Text>
                          </Panel>
                        ) : null}
                        {selectedQuest.status === "archived" ? (
                          <Panel t={t} style={{ padding: 16, borderColor: "rgba(239,68,68,0.34)" }}>
                            <Text style={{ color: t.text, fontWeight: "900" }}>Archived quests are locked</Text>
                            <Text style={{ color: t.muted, marginTop: 6, fontWeight: "700" }}>Move this quest back to draft before editing content.</Text>
                          </Panel>
                        ) : null}
                        <QuestForm archived={selectedQuest.status === "archived"} compact={compact} form={detailForm} onChange={setDetailForm} t={t} />
                        <View style={{ gap: 12 }}>
                          <Text style={{ color: t.faint, fontSize: 12, fontWeight: "900", letterSpacing: 1.3, textTransform: "uppercase" }}>Status actions</Text>
                          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                            {selectedQuest.status === "archived" ? (
                              <ActionButton disabled={saving} icon="document-text-outline" label="Move to Draft" onPress={() => updateSelectedQuest("draft")} secondary t={t} />
                            ) : null}
                            {selectedQuest.status === "draft" && canSubmitReview ? (
                              <ActionButton disabled={saving} icon="paper-plane-outline" label="Send Review" onPress={() => updateSelectedQuest("in_review")} secondary t={t} />
                            ) : null}
                            {selectedQuest.status === "draft" ? (
                              <ActionButton disabled={saving} icon="trash-outline" label="Delete Draft" onPress={deleteSelectedDraft} secondary t={t} />
                            ) : null}
                            {selectedQuest.status === "published" ? (
                              <ActionButton disabled={saving} icon="archive-outline" label="Archive" onPress={() => updateSelectedQuest("archived")} secondary t={t} />
                            ) : null}
                          </View>
                        </View>
                        <ActionButton disabled={saving || selectedQuest.status === "archived"} icon="save-outline" label={saving ? "Saving..." : "Save Quest Changes"} onPress={() => updateSelectedQuest()} t={t} />
                      </Panel>
                      <Panel t={t} style={{ flex: 1, padding: 22 }}>
                        <QuestPreviewCard form={detailForm} t={t} />
                      </Panel>
                    </View>
                  ) : (
                    <EmptyPanel icon="search-outline" title="Quest not found" body="This quest may have been deleted or is unavailable." t={t} />
                  )
                  ) : (
                    <EmptyPanel icon="lock-closed-outline" title="Quest detail permission required" body="Your admin account cannot open internal quest detail pages." t={t} />
                  )
                ) : null}

                {view === "review" ? (
                  canReview ? (
                    loadingContent ? <LoadingPanel label="Loading review requests..." reducedMotion={reducedMotion} t={t} /> :
                    <View style={{ gap: 18 }}>
                      {reviewQuests.length && selectedReviewQuest ? (
                        <View style={{ flexDirection: compact ? "column" : "row", gap: 18, alignItems: "flex-start" }}>
                          <Panel t={t} style={{ width: compact ? "100%" : 360, overflow: "hidden" }}>
                            <View style={{ padding: 18, gap: 5 }}>
                              <Text style={{ color: t.text, fontSize: 20, fontWeight: "900" }}>Review Requests</Text>
                              <Text style={{ color: t.muted, fontWeight: "700" }}>{reviewQuests.length} quests waiting</Text>
                            </View>
                            {reviewQuests.map((quest) => {
                              const active = selectedReviewQuest.id === quest.id;

                              return (
                                <Pressable
                                  key={quest.id}
                                  onPress={() => setSelectedReviewQuestId(quest.id)}
                                  style={{
                                    borderTopColor: t.border,
                                    borderTopWidth: 1,
                                    backgroundColor: active ? t.active : "transparent",
                                    padding: 18,
                                    gap: 8,
                                  }}
                                >
                                  <Text style={{ color: active ? t.activeText : t.text, fontSize: 16, fontWeight: "900" }}>{quest.title}</Text>
                                  <Text numberOfLines={2} style={{ color: t.muted, fontWeight: "700", lineHeight: 19 }}>{quest.description}</Text>
                                  <Text style={{ color: t.faint, fontSize: 12, fontWeight: "800" }}>{quest.createdByLabel} · {quest.category} · +{quest.xp} XP</Text>
                                </Pressable>
                              );
                            })}
                          </Panel>
                          <Panel t={t} style={{ flex: 1, padding: 22, gap: 18 }}>
                            <View style={{ flexDirection: compact ? "column" : "row", gap: 22, alignItems: "flex-start" }}>
                              <View style={{ flex: 1, gap: 12 }}>
                                <StatusPill status={selectedReviewQuest.status} t={t} />
                                <Text style={{ color: t.text, fontSize: 28, fontWeight: "900" }}>{selectedReviewQuest.title}</Text>
                                <Text style={{ color: t.muted, fontWeight: "700", lineHeight: 22 }}>{selectedReviewQuest.description}</Text>
                                <Panel t={t} style={{ padding: 16, gap: 10 }}>
                                  <Text style={{ color: t.text, fontWeight: "900" }}>Quest Info</Text>
                                  <Text style={{ color: t.muted, fontWeight: "700" }}>Submitted by {selectedReviewQuest.createdByLabel}</Text>
                                  <Text style={{ color: t.muted, fontWeight: "700" }}>{selectedReviewQuest.category} · {selectedReviewQuest.difficulty} · +{selectedReviewQuest.xp} XP · {selectedReviewQuest.timeLabel}</Text>
                                  <Text style={{ color: t.faint, fontWeight: "700" }}>Updated {formatDate(selectedReviewQuest.updatedAt)}</Text>
                                </Panel>
                                <Panel t={t} style={{ padding: 16, gap: 12 }}>
                                  <Text style={{ color: t.text, fontWeight: "900" }}>Steps</Text>
                                  {selectedReviewQuest.steps.map((step, index) => (
                                    <Text key={`${step}-${index}`} style={{ color: t.muted, fontWeight: "700", lineHeight: 20 }}>{index + 1}. {step}</Text>
                                  ))}
                                </Panel>
                              </View>
                              <View style={{ width: compact ? "100%" : 360 }}>
                                <QuestPreviewCard form={asForm(selectedReviewQuest)} t={t} />
                              </View>
                            </View>
                            {denyQuest?.id === selectedReviewQuest.id ? (
                              <DenyReviewPanel note={denyNote} onChangeNote={setDenyNote} onCancel={() => setDenyQuest(null)} onDeny={denyPublication} t={t} />
                            ) : (
                              <View style={{ flexDirection: compact ? "column" : "row", gap: 12 }}>
                                <View style={{ flex: 1 }}>
                                  <ActionButton icon="close-circle-outline" label="Deny with Report" onPress={() => { setDenyQuest(selectedReviewQuest); setDenyNote(""); }} secondary t={t} />
                                </View>
                                <View style={{ flex: 1 }}>
                                  <ActionButton icon="checkmark-circle-outline" label="Approve and Publish" onPress={() => approveQuest(selectedReviewQuest)} t={t} />
                                </View>
                              </View>
                            )}
                          </Panel>
                        </View>
                      ) : <EmptyPanel icon="shield-checkmark-outline" title="No quests in review" body="Submitted drafts will appear here for publishing approval." t={t} />}
                    </View>
                  ) : (
                    <EmptyPanel icon="lock-closed-outline" title="Review permission required" body="Only admins with publishing permission can access this queue." t={t} />
                  )
                ) : null}

                {view === "adventurePacks" ? (
                  canViewPublished ? (
                    loadingContent ? <LoadingPanel label="Loading adventure packs..." reducedMotion={reducedMotion} t={t} /> :
                    <View style={{ flexDirection: adventureSplitLayout ? "row" : "column", gap: 18, alignItems: "flex-start" }}>
                      <Panel t={t} style={{ width: adventureSplitLayout ? 340 : "100%", overflow: "hidden", flexShrink: 0 }}>
                        <View style={{ padding: 18, gap: 5 }}>
                          <Text style={{ color: t.text, fontSize: 20, fontWeight: "900" }}>Pack Library</Text>
                          <Text style={{ color: t.muted, fontWeight: "700" }}>{adventurePacks.length} collections</Text>
                        </View>
                        {adventurePacks.length ? adventurePacks.map((pack) => {
                          const active = selectedPackId === pack.id;
                          return (
                            <Pressable
                              key={pack.id}
                              onPress={() => setSelectedPackId(pack.id)}
                              style={({ pressed }) => ({
                                borderTopColor: t.border,
                                borderTopWidth: 1,
                                backgroundColor: active ? t.active : pressed ? t.cardAlt : "transparent",
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 12,
                                padding: 18,
                              })}
                            >
                              <View style={{ width: 42, height: 42, borderRadius: 10, backgroundColor: pack.bgColor, alignItems: "center", justifyContent: "center" }}>
                                <Text style={{ fontSize: 22 }}>{pack.icon}</Text>
                              </View>
                              <View style={{ flex: 1, gap: 4 }}>
                                <Text numberOfLines={1} style={{ color: active ? t.activeText : t.text, fontSize: 16, fontWeight: "900" }}>{pack.title}</Text>
                                <Text style={{ color: t.muted, fontSize: 12, fontWeight: "700" }}>{pack.questCount} quests · {statusLabel(pack.status)}</Text>
                              </View>
                            </Pressable>
                          );
                        }) : (
                          <View style={{ padding: 18 }}>
                            <Text style={{ color: t.muted, fontWeight: "700" }}>No packs created yet.</Text>
                          </View>
                        )}
                        <View style={{ padding: 18, borderTopColor: t.border, borderTopWidth: 1 }}>
                          <ActionButton
                            icon="add"
                            label="New Pack"
                            onPress={() => {
                              setSelectedPackId(null);
                              setPackForm(defaultAdventurePackForm);
                            }}
                            secondary
                            t={t}
                          />
                        </View>
                      </Panel>

                      <View style={{ flex: 1, width: adventureSplitLayout ? undefined : "100%", gap: 18 }}>
                        <View style={{ flexDirection: adventurePreviewInline ? "row" : "column", gap: 18, alignItems: "flex-start" }}>
                          <Panel t={t} style={{ flex: 1, width: adventurePreviewInline ? undefined : "100%", padding: 22, gap: 20 }}>
                            <View style={{ gap: 12 }}>
                              <FormSectionLabel t={t}>Pack basics</FormSectionLabel>
                              <View style={{ flexDirection: compact ? "column" : "row", gap: 14 }}>
                                <View style={{ flex: 1, minWidth: compact ? undefined : 260 }}>
                                  <Field label="Title" t={t} value={packForm.title} onChangeText={(title) => setPackForm((current) => ({ ...current, title }))} placeholder="City Weekend Starter" />
                                </View>
                                <View style={{ flex: 1, minWidth: compact ? undefined : 260 }}>
                                  <Field label="Subtitle" t={t} value={packForm.subtitle} onChangeText={(subtitle) => setPackForm((current) => ({ ...current, subtitle }))} placeholder="A polished set of quests" />
                                </View>
                              </View>
                              <Field label="Description" multiline t={t} value={packForm.description} onChangeText={(description) => setPackForm((current) => ({ ...current, description }))} placeholder="Describe the mood, promise, and use case for this pack." />
                            </View>

                            <View style={{ gap: 12 }}>
                              <FormSectionLabel t={t}>Visual identity</FormSectionLabel>
                              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
                                <View style={{ width: compact ? "100%" : 120 }}>
                                  <Field label="Icon" t={t} value={packForm.icon} onChangeText={(icon) => setPackForm((current) => ({ ...current, icon }))} />
                                </View>
                                <View style={{ flex: 1, minWidth: compact ? undefined : 220 }}>
                                  <Field label="Accent color" t={t} value={packForm.color} onChangeText={(color) => setPackForm((current) => ({ ...current, color }))} />
                                </View>
                                <View style={{ flex: 1, minWidth: compact ? undefined : 240 }}>
                                  <Field label="Background color" t={t} value={packForm.bgColor} onChangeText={(bgColor) => setPackForm((current) => ({ ...current, bgColor }))} />
                                </View>
                              </View>
                              <Field label="Cover image URL" t={t} value={packForm.coverImageUrl ?? ""} onChangeText={(coverImageUrl) => setPackForm((current) => ({ ...current, coverImageUrl }))} placeholder="https://..." />
                            </View>

                            <View style={{ gap: 10 }}>
                              <FormSectionLabel t={t}>Status</FormSectionLabel>
                              <Segmented options={questStatuses} t={t} value={packForm.status} onChange={(status) => setPackForm((current) => ({ ...current, status }))} renderLabel={statusLabel} />
                            </View>

                            <View style={{ gap: 12 }}>
                              <View style={{ flexDirection: compact ? "column" : "row", justifyContent: "space-between", gap: 12, alignItems: compact ? "stretch" : "center" }}>
                                <View style={{ flex: 1, gap: 4 }}>
                                  <Text style={{ color: t.text, fontSize: 18, fontWeight: "900" }}>Quests</Text>
                                  <Text style={{ color: t.muted, fontWeight: "700" }}>{packForm.questIds.length} selected from published quests</Text>
                                </View>
                                <View style={{ width: compact ? "100%" : 340, maxWidth: "100%" }}>
                                  <SearchField value={packSearch} onChangeText={setPackSearch} placeholder="Search quests..." t={t} />
                                </View>
                              </View>
                              <Panel t={t} style={{ overflow: "hidden", maxHeight: 380 }}>
                                <ScrollView nestedScrollEnabled style={{ maxHeight: 380 }}>
                                  {filteredPackQuests.length ? filteredPackQuests.map((quest) => (
                                    <QuestPickRow
                                      key={quest.id}
                                      quest={quest}
                                      selected={packForm.questIds.includes(quest.id)}
                                      onPress={() => togglePackQuest(quest.id)}
                                      t={t}
                                    />
                                  )) : (
                                    <View style={{ padding: 18 }}>
                                      <Text style={{ color: t.muted, fontWeight: "700" }}>No published quests match that search.</Text>
                                    </View>
                                  )}
                                </ScrollView>
                              </Panel>
                            </View>

                            <View style={{ flexDirection: compact ? "column" : "row", gap: 12 }}>
                              <View style={{ flex: 1 }}>
                                <ActionButton disabled={saving} icon="save-outline" label={saving ? "Saving..." : "Save Changes"} onPress={() => saveAdventurePack()} secondary t={t} />
                              </View>
                              <View style={{ flex: 1 }}>
                                <ActionButton disabled={saving || !packForm.title.trim()} icon="rocket-outline" label="Publish Pack" onPress={() => saveAdventurePack("published")} t={t} />
                              </View>
                              {selectedPackId && canDeleteContent ? (
                                <View style={{ flex: 1 }}>
                                  <ActionButton danger disabled={saving} icon="trash-outline" label="Delete Pack" onPress={confirmDeleteAdventurePack} t={t} />
                                </View>
                              ) : null}
                            </View>
                          </Panel>

                          <Panel t={t} style={{ width: adventurePreviewInline ? 430 : "100%", padding: 22 }}>
                            <AdventurePackPreviewCard form={packForm} previewQuests={packPreviewQuests} t={t} />
                          </Panel>
                        </View>
                      </View>
                    </View>
                  ) : (
                    <EmptyPanel icon="lock-closed-outline" title="Published quest permission required" body="Adventure pack management is available to admins who can view published quests." t={t} />
                  )
                ) : null}

                {view === "featured" ? (
                  canViewPublished ? (
                    loadingContent || loadingFeaturedBatch ? <LoadingPanel label="Loading featured quests..." reducedMotion={reducedMotion} t={t} /> :
                    <View style={{ gap: 18 }}>
                      <Panel t={t} style={{ padding: 18, gap: 14 }}>
                        <View style={{ flexDirection: compact ? "column" : "row", justifyContent: "space-between", gap: 14, alignItems: compact ? "flex-start" : "center" }}>
                          <View style={{ gap: 5 }}>
                            <Text style={{ color: t.text, fontSize: 20, fontWeight: "900" }}>Daily Lineup</Text>
                            <Text style={{ color: t.muted, fontWeight: "700" }}>{featuredQuestIds.length}/6 quests selected for {featuredDate}</Text>
                          </View>
                          {isFeaturedPast ? (
                            <Pill t={t} tone={{ bg: "rgba(249,115,22,0.14)", text: nova.orange, border: "rgba(249,115,22,0.32)" }}>Read-only past date</Pill>
                          ) : null}
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                          {featuredDateOptions.map((date) => {
                            const active = date === featuredDate;
                            const past = date < today;
                            return (
                              <Pressable
                                key={date}
                                onPress={() => setFeaturedDate(date)}
                                style={{
                                  minWidth: 112,
                                  borderRadius: 8,
                                  borderWidth: 1,
                                  borderColor: active ? nova.blue : t.border,
                                  backgroundColor: active ? t.active : t.cardAlt,
                                  paddingHorizontal: 13,
                                  paddingVertical: 10,
                                  gap: 3,
                                }}
                              >
                                <Text style={{ color: active ? t.activeText : past ? t.faint : t.text, fontSize: 13, fontWeight: "900" }}>{date}</Text>
                                <Text style={{ color: date === today ? nova.blue : t.faint, fontSize: 10, fontWeight: "900" }}>{date === today ? "TODAY" : past ? "PAST" : "UPCOMING"}</Text>
                              </Pressable>
                            );
                          })}
                        </ScrollView>
                      </Panel>

                      <View style={{ flexDirection: compact ? "column" : "row", gap: 18, alignItems: "flex-start" }}>
                        <Panel t={t} style={{ width: compact ? "100%" : 400, overflow: "hidden" }}>
                          <View style={{ padding: 18, gap: 5 }}>
                            <Text style={{ color: t.text, fontSize: 20, fontWeight: "900" }}>Selected Order</Text>
                            <Text style={{ color: t.muted, fontWeight: "700" }}>Appears in this sequence inside Explore.</Text>
                          </View>
                          {featuredQuestIds.length ? featuredQuestIds.map((id, index) => {
                            const quest = publishedQuests.find((item) => item.id === id);
                            if (!quest) return null;
                            return (
                              <View key={id} style={{ borderTopColor: t.border, borderTopWidth: 1, flexDirection: "row", alignItems: "center", gap: 12, padding: 16 }}>
                                <Text style={{ color: nova.blue, width: 24, fontSize: 16, fontWeight: "900" }}>{index + 1}</Text>
                                <View style={{ width: 4, height: 36, borderRadius: 999, backgroundColor: quest.color }} />
                                <View style={{ flex: 1, gap: 4 }}>
                                  <Text numberOfLines={1} style={{ color: t.text, fontSize: 15, fontWeight: "900" }}>{quest.title}</Text>
                                  <Text style={{ color: t.muted, fontSize: 12, fontWeight: "700" }}>{quest.category} · +{quest.xp} XP</Text>
                                </View>
                                {!isFeaturedPast && canDeleteContent ? (
                                  <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={`Remove ${quest.title} from the featured lineup`}
                                    onPress={() => confirmRemoveFeaturedQuest(quest)}
                                    style={({ pressed }) => ({
                                      width: 44,
                                      height: 44,
                                      borderRadius: 8,
                                      alignItems: "center",
                                      justifyContent: "center",
                                      backgroundColor: pressed ? (t.mode === "dark" ? "rgba(127,29,29,0.34)" : "#fff1f2") : "transparent",
                                    })}
                                  >
                                    <Ionicons name="trash-outline" size={18} color={nova.red} />
                                  </Pressable>
                                ) : null}
                              </View>
                            );
                          }) : (
                            <View style={{ padding: 18 }}>
                              <Text style={{ color: t.muted, fontWeight: "700" }}>No quests scheduled for this date yet.</Text>
                            </View>
                          )}
                        </Panel>

                        <Panel t={t} style={{ flex: 1, overflow: "hidden" }}>
                          <View style={{ padding: 18, gap: 14 }}>
                            <View style={{ flexDirection: compact ? "column" : "row", justifyContent: "space-between", gap: 12 }}>
                              <View>
                                <Text style={{ color: t.text, fontSize: 20, fontWeight: "900" }}>Published Quests</Text>
                                <Text style={{ color: t.muted, marginTop: 4, fontWeight: "700" }}>Pick exactly 6 quests for the daily carousel.</Text>
                              </View>
                              <View style={{ width: compact ? "100%" : 320 }}>
                                <SearchField value={featuredSearch} onChangeText={setFeaturedSearch} placeholder="Search quests..." t={t} />
                              </View>
                            </View>
                          </View>
                          {isFeaturedPast ? (
                            <View style={{ padding: 18, borderTopColor: t.border, borderTopWidth: 1 }}>
                              <EmptyPanel icon="calendar-outline" title="Past date locked" body="Choose today or an upcoming date to edit the featured carousel." t={t} />
                            </View>
                          ) : (
                            <ScrollView nestedScrollEnabled style={{ maxHeight: 520 }}>
                              {filteredFeaturedQuests.length ? filteredFeaturedQuests.map((quest) => (
                                <QuestPickRow
                                  key={quest.id}
                                  quest={quest}
                                  selected={featuredQuestIds.includes(quest.id)}
                                  disabled={
                                    (!featuredQuestIds.includes(quest.id) && featuredQuestIds.length >= 6) ||
                                    (featuredQuestIds.includes(quest.id) && !canDeleteContent)
                                  }
                                  onPress={() => toggleFeaturedQuest(quest.id)}
                                  t={t}
                                />
                              )) : (
                                <View style={{ padding: 18, borderTopColor: t.border, borderTopWidth: 1 }}>
                                  <Text style={{ color: t.muted, fontWeight: "700" }}>No published quests match that search.</Text>
                                </View>
                              )}
                            </ScrollView>
                          )}
                        </Panel>
                      </View>

                      {!isFeaturedPast ? (
                        <View style={{ gap: 10 }}>
                          {hasFeaturedBatch && !canDeleteContent ? (
                            <Text style={{ color: t.muted, fontSize: 13, fontWeight: "700" }}>
                              Delete content permission is required to edit an existing featured batch.
                            </Text>
                          ) : null}
                          <View style={{ flexDirection: compact ? "column" : "row", gap: 12 }}>
                            <View style={{ flex: 1 }}>
                              <ActionButton disabled={saving || featuredQuestIds.length !== 6 || (hasFeaturedBatch && !canDeleteContent)} icon="save-outline" label={saving ? "Saving..." : "Save Featured Batch"} onPress={saveFeaturedBatch} t={t} />
                            </View>
                            {canDeleteContent ? (
                              <View style={{ flex: 1 }}>
                                <ActionButton danger disabled={saving || !featuredQuestIds.length} icon="trash-outline" label="Delete Featured Batch" onPress={confirmClearFeaturedBatch} t={t} />
                              </View>
                            ) : null}
                          </View>
                        </View>
                      ) : null}
                    </View>
                  ) : (
                    <EmptyPanel icon="lock-closed-outline" title="Published quest permission required" body="Featured scheduling is available to admins who can view published quests." t={t} />
                  )
                ) : null}

                {view === "admins" ? (
                  canManageAdmins ? (
                    loadingOperations ? <LoadingPanel label="Loading admin users..." reducedMotion={reducedMotion} t={t} /> :
                    <View style={{ gap: 18, maxWidth: 1120 }}>
                      {adminManagementMode === "list" ? (
                        <Panel t={t} style={{ overflow: "hidden" }}>
                          <View style={{ padding: 22, gap: 5 }}>
                            <Text style={{ color: t.text, fontSize: 22, fontWeight: "900" }}>Admin users</Text>
                            <Text style={{ color: t.muted, fontWeight: "700" }}>Open an admin to review identity details and manage their tool access.</Text>
                          </View>
                          {adminProfiles.map((profile) => (
                            <Pressable
                              key={profile.userId}
                              accessibilityRole="button"
                              accessibilityLabel={`Open ${profile.displayName || profile.email || "admin"}`}
                              onPress={() => openAdminDetail(profile)}
                              style={({ pressed }) => ({
                                borderTopColor: t.border,
                                borderTopWidth: 1,
                                backgroundColor: pressed ? t.cardAlt : "transparent",
                                padding: 18,
                                flexDirection: compact ? "column" : "row",
                                alignItems: compact ? "flex-start" : "center",
                                gap: 14,
                              })}
                            >
                              <View style={{ flex: 1, gap: 4 }}>
                                <Text style={{ color: t.text, fontSize: 16, fontWeight: "900" }}>{profile.displayName || profile.email || "Unnamed admin"}</Text>
                                <Text style={{ color: t.muted, fontSize: 13, fontWeight: "700" }}>{profile.email || profile.userId}</Text>
                              </View>
                              <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                                <Pill t={t} tone={profile.isActive
                                  ? { bg: "rgba(34,197,94,0.14)", text: "#15803d", border: "rgba(34,197,94,0.30)" }
                                  : { bg: "rgba(148,163,184,0.14)", text: t.muted, border: t.border }}
                                >{profile.isActive ? "Active" : "Offline"}</Pill>
                                <Text style={{ color: t.muted, fontSize: 13, fontWeight: "700" }}>Last active {formatDate(profile.lastLogin)}</Text>
                                {profile.role !== "super_admin" ? (
                                  <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={`Delete ${profile.displayName || profile.email || "admin"}`}
                                    onPress={(event) => {
                                      event.stopPropagation();
                                      handleDeleteAdmin(profile);
                                    }}
                                    style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 8, borderWidth: 1, borderColor: t.border, backgroundColor: t.cardAlt }}
                                  >
                                    <Ionicons name="trash-outline" size={18} color={nova.red} />
                                  </Pressable>
                                ) : null}
                                <Ionicons name="chevron-forward" size={18} color={t.faint} />
                              </View>
                            </Pressable>
                          ))}
                          {adminInvites.filter((invite) => invite.status === "pending").map((invite) => (
                            <View key={invite.id} style={{ borderTopColor: t.border, borderTopWidth: 1, padding: 18, flexDirection: compact ? "column" : "row", gap: 14, alignItems: compact ? "flex-start" : "center" }}>
                              <View style={{ flex: 1, gap: 4 }}>
                                <Text style={{ color: t.text, fontSize: 16, fontWeight: "900" }}>{invite.email}</Text>
                                <Text style={{ color: t.muted, fontSize: 13, fontWeight: "700" }}>Invitation expires {formatDate(invite.expiresAt)}</Text>
                              </View>
                              <Pill t={t} tone={{ bg: "rgba(37,99,235,0.12)", text: nova.blue, border: "rgba(37,99,235,0.28)" }}>Invite sent</Pill>
                            </View>
                          ))}
                          {!adminProfiles.length && !adminInvites.length ? (
                            <View style={{ padding: 22 }}><Text style={{ color: t.muted, fontWeight: "700" }}>No admin users yet. Send an invite to get started.</Text></View>
                          ) : null}
                        </Panel>
                      ) : null}

                      {adminManagementMode === "detail" && selectedAdmin ? (
                        <Panel t={t} style={{ overflow: "hidden" }}>
                          <View style={{ paddingHorizontal: 22, paddingTop: 18, paddingBottom: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                            <Pressable onPress={returnToAdminList} style={{ flexDirection: "row", alignItems: "center", gap: 7, minHeight: 40 }}>
                              <Ionicons name="arrow-back" size={18} color={t.muted} />
                              <Text style={{ color: t.muted, fontWeight: "900" }}>All admin users</Text>
                            </Pressable>
                            {selectedAdmin.role !== "super_admin" ? (
                              <Pressable onPress={() => handleDeleteAdmin(selectedAdmin)} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 8, borderWidth: 1, borderColor: t.border, backgroundColor: t.cardAlt }}>
                                <Ionicons name="trash-outline" size={18} color={nova.red} />
                              </Pressable>
                            ) : null}
                          </View>
                          <ScrollView style={{ maxHeight: compact ? 520 : 600 }} contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 20, gap: 24 }}>
                            <View style={{ gap: 8 }}>
                              <Text style={{ color: t.text, fontSize: 26, fontWeight: "900" }}>{selectedAdmin.displayName || "Unnamed admin"}</Text>
                              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                                <Pill t={t} tone={selectedAdmin.isActive
                                  ? { bg: "rgba(34,197,94,0.14)", text: "#15803d", border: "rgba(34,197,94,0.30)" }
                                  : { bg: "rgba(148,163,184,0.14)", text: t.muted, border: t.border }}
                                >{selectedAdmin.isActive ? "Active" : "Offline"}</Pill>
                                <Pill t={t}>{displayRole(selectedAdmin.role)}</Pill>
                              </View>
                            </View>

                            <View style={{ gap: 14 }}>
                              <Text style={{ color: t.faint, fontSize: 12, fontWeight: "900", letterSpacing: 1.2, textTransform: "uppercase" }}>About this admin</Text>
                              <View style={{ gap: 12 }}>
                                <View style={{ gap: 4 }}><Text style={{ color: t.faint, fontSize: 12, fontWeight: "800" }}>FULL NAME</Text><Text style={{ color: t.text, fontWeight: "800" }}>{selectedAdmin.displayName || "Not provided"}</Text></View>
                                <View style={{ gap: 4 }}><Text style={{ color: t.faint, fontSize: 12, fontWeight: "800" }}>EMAIL</Text><Text style={{ color: t.text, fontWeight: "800" }}>{selectedAdmin.email || "Not available"}</Text></View>
                                <View style={{ gap: 4 }}><Text style={{ color: t.faint, fontSize: 12, fontWeight: "800" }}>DESCRIPTION</Text><Text style={{ color: t.muted, fontWeight: "700", lineHeight: 20 }}>{selectedAdmin.bio?.trim() || "No description has been added yet."}</Text></View>
                                <View style={{ gap: 4 }}><Text style={{ color: t.faint, fontSize: 12, fontWeight: "800" }}>LAST ACTIVE</Text><Text style={{ color: t.text, fontWeight: "800" }}>{formatDate(selectedAdmin.lastLogin)}</Text></View>
                              </View>
                            </View>

                            <View style={{ gap: 10 }}>
                              <View style={{ gap: 4 }}>
                                <Text style={{ color: t.text, fontSize: 20, fontWeight: "900" }}>Permissions</Text>
                                <Text style={{ color: t.muted, fontWeight: "700" }}>{selectedAdmin.role === "super_admin" ? "Super Admin access is managed only in Supabase." : "Choose the dashboard tools this admin can use."}</Text>
                              </View>
                              <View style={{ borderTopWidth: 1, borderTopColor: t.border }}>
                                {(selectedAdmin.role === "super_admin" ? adminPermissions : grantableAdminPermissions).map((permission) => {
                                  const enabled = selectedAdmin.role === "super_admin" || draftAdminPermissions.includes(permission);
                                  return (
                                    <View key={permission} style={{ minHeight: 76, borderBottomWidth: 1, borderBottomColor: t.border, paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 16 }}>
                                      <View style={{ flex: 1, gap: 4 }}>
                                        <Text style={{ color: t.text, fontWeight: "900" }}>{permissionLabels[permission]}</Text>
                                        <Text style={{ color: t.muted, fontSize: 13, fontWeight: "600", lineHeight: 18 }}>{permissionDescriptions[permission]}</Text>
                                      </View>
                                      <Switch
                                        accessibilityLabel={`${enabled ? "Disable" : "Enable"} ${permissionLabels[permission]}`}
                                        disabled={selectedAdmin.role === "super_admin" || saving}
                                        onValueChange={() => toggleSelectedAdminPermission(permission)}
                                        trackColor={{ false: t.border, true: nova.blue }}
                                        thumbColor="#ffffff"
                                        value={enabled}
                                      />
                                    </View>
                                  );
                                })}
                              </View>
                            </View>
                          </ScrollView>
                          {selectedAdmin.role !== "super_admin" && hasUnsavedAdminPermissionChanges ? (
                            <View style={{ borderTopWidth: 1, borderTopColor: t.border, backgroundColor: t.shell, padding: 16, flexDirection: compact ? "column" : "row", alignItems: compact ? "stretch" : "center", justifyContent: "space-between", gap: 12 }}>
                              <Text style={{ color: t.text, fontWeight: "800" }}>You have unsaved permission changes.</Text>
                              <View style={{ flexDirection: "row", gap: 10 }}>
                                <View style={{ flex: compact ? 1 : undefined }}><ActionButton secondary disabled={saving} icon="close-outline" label="Discard" onPress={() => setDraftAdminPermissions(selectedAdminPermissions)} t={t} /></View>
                                <View style={{ flex: compact ? 1 : undefined }}><ActionButton disabled={saving} icon="save-outline" label={saving ? "Saving..." : "Save changes"} onPress={saveSelectedAdminAccess} t={t} /></View>
                              </View>
                            </View>
                          ) : null}
                        </Panel>
                      ) : null}

                      {adminManagementMode === "invite" ? (
                        <Panel t={t} style={{ overflow: "hidden" }}>
                          <View style={{ padding: 22, gap: 8, borderBottomWidth: 1, borderBottomColor: t.border }}>
                            <Text style={{ color: t.text, fontSize: 24, fontWeight: "900" }}>Invite an admin</Text>
                            <Text style={{ color: t.muted, fontWeight: "700" }}>They will receive a secure dashboard link to create their password.</Text>
                          </View>
                          <View style={{ padding: 22, gap: 24 }}>
                            <Field label="Email address" t={t} value={inviteEmail} onChangeText={setInviteEmail} placeholder="name@example.com" />
                            <View style={{ gap: 10 }}>
                              <View style={{ gap: 4 }}>
                                <Text style={{ color: t.text, fontSize: 20, fontWeight: "900" }}>Permissions</Text>
                                <Text style={{ color: t.muted, fontWeight: "700" }}>Grant only the tools this admin needs. You can change these later.</Text>
                              </View>
                              <View style={{ borderTopWidth: 1, borderTopColor: t.border }}>
                                {grantableAdminPermissions.map((permission) => {
                                  const enabled = invitePermissions.includes(permission);
                                  return (
                                    <View key={permission} style={{ minHeight: 76, borderBottomWidth: 1, borderBottomColor: t.border, paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 16 }}>
                                      <View style={{ flex: 1, gap: 4 }}>
                                        <Text style={{ color: t.text, fontWeight: "900" }}>{permissionLabels[permission]}</Text>
                                        <Text style={{ color: t.muted, fontSize: 13, fontWeight: "600", lineHeight: 18 }}>{permissionDescriptions[permission]}</Text>
                                      </View>
                                      <Switch accessibilityLabel={`${enabled ? "Remove" : "Grant"} ${permissionLabels[permission]}`} onValueChange={() => toggleInvitePermission(permission)} trackColor={{ false: t.border, true: nova.blue }} thumbColor="#ffffff" value={enabled} />
                                    </View>
                                  );
                                })}
                              </View>
                            </View>
                            <View style={{ flexDirection: compact ? "column-reverse" : "row", justifyContent: "space-between", gap: 12 }}>
                              <ActionButton secondary icon="arrow-back" label="Go back" onPress={() => setAdminManagementMode("list")} t={t} />
                              <ActionButton disabled={saving || !inviteEmail.trim()} icon="mail-outline" label={saving ? "Sending..." : "Send invite"} onPress={async () => { if (await handleInviteAdmin()) setAdminManagementMode("list"); }} t={t} />
                            </View>
                          </View>
                        </Panel>
                      ) : null}
                    </View>
                  ) : (
                    <EmptyPanel icon="lock-closed-outline" title="Super admin permission required" body="Only admins with admin-management permission can invite people or change access." t={t} />
                  )
                ) : null}

                {view === "profile" ? (
                  canManageProfile ? (
                    <View style={{ flexDirection: compact ? "column" : "row", gap: 18, alignItems: "flex-start" }}>
                      <Panel t={t} style={{ flex: 1, padding: 22, gap: 16 }}>
                        <Text style={{ color: t.text, fontSize: 22, fontWeight: "900" }}>Admin Profile</Text>
                        <Field label="Display name" t={t} value={profileName} onChangeText={setProfileName} placeholder="Your name" />
                        <Field label="New password" t={t} value={profilePassword} onChangeText={setProfilePassword} placeholder="Leave blank to keep current password" />
                        <ActionButton disabled={saving} icon="save-outline" label={saving ? "Saving..." : "Save Profile"} onPress={saveProfile} t={t} />
                      </Panel>
                      <Panel t={t} style={{ flex: 1, padding: 22, gap: 16 }}>
                        <Text style={{ color: t.text, fontSize: 22, fontWeight: "900" }}>Your Permissions</Text>
                        <Text style={{ color: t.muted, fontWeight: "700" }}>{membership?.role} access for {membership?.email || membership?.userId}</Text>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                          {(membership?.permissions ?? []).map((permission) => (
                            <Pill key={permission} t={t}>{permissionLabels[permission]}</Pill>
                          ))}
                        </View>
                      </Panel>
                    </View>
                  ) : (
                    <EmptyPanel icon="lock-closed-outline" title="Profile permission required" body="Your account does not have permission to manage an admin profile." t={t} />
                  )
                ) : null}

                {view === "inbox" ? (
                  canViewInbox ? (
                    loadingOperations ? <LoadingPanel label="Loading notifications..." reducedMotion={reducedMotion} t={t} /> :
                    <Panel t={t} style={{ overflow: "hidden" }}>
                      <View style={{ padding: 22, gap: 16 }}>
                        <View style={{ flexDirection: compact ? "column" : "row", justifyContent: "space-between", gap: 14, alignItems: compact ? "stretch" : "center" }}>
                          <View style={{ gap: 5 }}>
                            <Text style={{ color: t.text, fontSize: 22, fontWeight: "900" }}>Notifications</Text>
                            <Text style={{ color: t.muted, fontWeight: "700" }}>
                              {unreadCount} unread · {selectedNotifications.length} selected
                            </Text>
                          </View>
                          {notifications.length ? (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                              <Pressable
                                onPress={toggleAllNotifications}
                                style={{
                                  minHeight: 40,
                                  borderRadius: 8,
                                  borderWidth: 1,
                                  borderColor: allNotificationsSelected ? nova.blue : t.border,
                                  backgroundColor: allNotificationsSelected ? t.active : t.cardAlt,
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 8,
                                  paddingHorizontal: 12,
                                }}
                              >
                                <Ionicons name={allNotificationsSelected ? "checkbox" : "square-outline"} size={18} color={allNotificationsSelected ? nova.blue : t.muted} />
                                <Text style={{ color: allNotificationsSelected ? t.activeText : t.text, fontSize: 13, fontWeight: "900" }}>
                                  {allNotificationsSelected ? "Clear" : "Select all"}
                                </Text>
                              </Pressable>
                              <Pressable
                                disabled={saving || !unreadCount}
                                onPress={readAllNotifications}
                                style={{
                                  minHeight: 40,
                                  borderRadius: 8,
                                  borderWidth: 1,
                                  borderColor: t.border,
                                  backgroundColor: !unreadCount ? t.border : t.cardAlt,
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 8,
                                  opacity: !unreadCount ? 0.65 : 1,
                                  paddingHorizontal: 12,
                                }}
                              >
                                <Ionicons name="mail-open-outline" size={18} color={t.text} />
                                <Text style={{ color: t.text, fontSize: 13, fontWeight: "900" }}>Read all</Text>
                              </Pressable>
                              <Pressable
                                disabled={saving || !selectedNotifications.length}
                                onPress={() => markSelectedNotifications(true)}
                                style={{
                                  minHeight: 40,
                                  borderRadius: 8,
                                  borderWidth: 1,
                                  borderColor: t.border,
                                  backgroundColor: selectedNotifications.length ? t.cardAlt : t.border,
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 8,
                                  opacity: selectedNotifications.length ? 1 : 0.65,
                                  paddingHorizontal: 12,
                                }}
                              >
                                <Ionicons name="checkmark-done-outline" size={18} color={t.text} />
                                <Text style={{ color: t.text, fontSize: 13, fontWeight: "900" }}>Mark read</Text>
                              </Pressable>
                              <Pressable
                                disabled={saving || !selectedNotifications.length}
                                onPress={() => markSelectedNotifications(false)}
                                style={{
                                  minHeight: 40,
                                  borderRadius: 8,
                                  borderWidth: 1,
                                  borderColor: t.border,
                                  backgroundColor: selectedNotifications.length ? t.cardAlt : t.border,
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 8,
                                  opacity: selectedNotifications.length ? 1 : 0.65,
                                  paddingHorizontal: 12,
                                }}
                              >
                                <Ionicons name="mail-unread-outline" size={18} color={t.text} />
                                <Text style={{ color: t.text, fontSize: 13, fontWeight: "900" }}>Mark unread</Text>
                              </Pressable>
                              <Pressable
                                disabled={saving || !selectedNotifications.length}
                                onPress={() => removeNotifications(selectedNotificationIds)}
                                style={{
                                  minHeight: 40,
                                  borderRadius: 8,
                                  borderWidth: 1,
                                  borderColor: selectedNotifications.length ? "rgba(239,68,68,0.34)" : t.border,
                                  backgroundColor: selectedNotifications.length ? "rgba(239,68,68,0.12)" : t.border,
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 8,
                                  opacity: selectedNotifications.length ? 1 : 0.65,
                                  paddingHorizontal: 12,
                                }}
                              >
                                <Ionicons name="trash-outline" size={18} color={selectedNotifications.length ? nova.red : t.text} />
                                <Text style={{ color: selectedNotifications.length ? nova.red : t.text, fontSize: 13, fontWeight: "900" }}>Delete selected</Text>
                              </Pressable>
                              <Pressable
                                disabled={saving || !notifications.length}
                                onPress={() => removeNotifications()}
                                style={{
                                  minHeight: 40,
                                  borderRadius: 8,
                                  borderWidth: 1,
                                  borderColor: "rgba(239,68,68,0.34)",
                                  backgroundColor: "rgba(239,68,68,0.12)",
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 8,
                                  paddingHorizontal: 12,
                                }}
                              >
                                <Ionicons name="close-circle-outline" size={18} color={nova.red} />
                                <Text style={{ color: nova.red, fontSize: 13, fontWeight: "900" }}>Delete all</Text>
                              </Pressable>
                            </ScrollView>
                          ) : null}
                        </View>
                      </View>
                      {notifications.length ? notifications.map((notification) => (
                        <Pressable
                          key={notification.id}
                          onPress={() => openNotification(notification)}
                          style={{
                            borderTopColor: t.border,
                            borderTopWidth: 1,
                            padding: 18,
                            gap: 12,
                            backgroundColor: selectedNotificationSet.has(notification.id) ? t.cardAlt : notification.readAt ? "transparent" : t.active,
                            flexDirection: "row",
                            alignItems: "flex-start",
                          }}
                        >
                          <Pressable
                            onPress={(event) => {
                              event.stopPropagation();
                              toggleNotificationSelection(notification.id);
                            }}
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 8,
                              alignItems: "center",
                              justifyContent: "center",
                              borderWidth: 1,
                              borderColor: selectedNotificationSet.has(notification.id) ? nova.blue : t.border,
                              backgroundColor: selectedNotificationSet.has(notification.id) ? t.active : t.card,
                            }}
                          >
                            <Ionicons name={selectedNotificationSet.has(notification.id) ? "checkbox" : "square-outline"} size={20} color={selectedNotificationSet.has(notification.id) ? nova.blue : t.muted} />
                          </Pressable>
                          <View style={{ flex: 1, gap: 7 }}>
                            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                              <Text style={{ flex: 1, color: notification.readAt ? t.text : t.activeText, fontSize: 17, fontWeight: notification.readAt ? "800" : "900" }}>{notification.title}</Text>
                              {!notification.readAt ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: nova.blue, marginTop: 7 }} /> : null}
                            </View>
                            <Text style={{ color: t.muted, fontWeight: "700", lineHeight: 20 }}>{notification.body}</Text>
                            <Text style={{ color: t.faint, fontSize: 12, fontWeight: "800" }}>{formatDate(notification.createdAt)}</Text>
                          </View>
                        </Pressable>
                      )) : (
                        <View style={{ padding: 22 }}>
                          <EmptyPanel icon="notifications-outline" title="Inbox is clear" body="Quest review decisions and admin messages will appear here." t={t} />
                        </View>
                      )}
                    </Panel>
                  ) : (
                    <EmptyPanel icon="lock-closed-outline" title="Inbox permission required" body="Your account does not have permission to view admin notifications." t={t} />
                  )
                ) : null}
              </>
            ) : null}
            </MotionFrame>
          </ScrollView>
        </View>
      </View>
    </View>
  );
}
