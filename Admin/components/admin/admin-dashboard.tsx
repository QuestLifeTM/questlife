import { Ionicons } from "@expo/vector-icons";
import { Redirect, useRouter } from "expo-router";
import { PropsWithChildren, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";

import { useAuth } from "@/contexts/AuthContext";
import { useContent } from "@/contexts/ContentContext";
import { signOut } from "@/services/auth/authService";
import {
  upsertAdventurePack,
  deleteQuest,
  fetchAdminNotifications,
  fetchContentLibrary,
  getAdminMembership,
  inviteAdmin,
  listAdminInvites,
  listAdminProfiles,
  markAdminNotificationRead,
  notifyQuestReviewResult,
  updateAdminAccess,
  updateInviteAccess,
  updateOwnAdminProfile,
  upsertQuest,
  deleteAdmin,
  disableAdmin,
  reactivateAdmin,
  resetAdminPassword,
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
  "admins.manage": "Manage admins",
  "inbox.view": "Inbox",
  "profile.manage": "Profile",
  "quests.create_draft": "Create drafts",
  "quests.review_publish": "Review and publish",
  "quests.submit_review": "Submit for review",
  "quests.view_all": "View all quests",
  "quests.view_published": "View published",
};

const defaultQuest: QuestFormInput = {
  category: "ADVENTURE",
  color: nova.blue,
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
    color: quest.color,
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

function ActionButton({
  disabled,
  icon,
  label,
  onPress,
  secondary,
  t,
}: {
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
      style={{
        minHeight: 48,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: secondary ? t.border : nova.blue,
        backgroundColor: disabled ? t.border : secondary ? t.card : nova.blue,
        paddingHorizontal: 18,
      }}
    >
      <Ionicons name={icon} size={18} color={secondary ? t.text : "#ffffff"} />
      <Text style={{ color: secondary ? t.text : "#ffffff", fontSize: 15, fontWeight: "900" }}>{label}</Text>
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
  onPress,
  quest,
  t,
  featuredDate,
}: {
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
        gap: 18,
        minHeight: 86,
        paddingHorizontal: 24,
        backgroundColor: pressed ? t.cardAlt : "transparent",
      })}
    >
      <View style={{ width: 4, height: 44, borderRadius: 999, backgroundColor: quest.color }} />
      <View style={{ flex: 1, minWidth: 220, gap: 5 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Text style={{ color: t.text, fontSize: 16, fontWeight: "900" }}>{quest.title}</Text>
          {featuredDate ? (
            <View style={{ borderRadius: 999, backgroundColor: "rgba(168,85,247,0.14)", paddingHorizontal: 8, paddingVertical: 3 }}>
              <Text style={{ color: nova.violet, fontSize: 10, fontWeight: "900" }}>Featured {featuredDate}</Text>
            </View>
          ) : null}
        </View>
        <Text numberOfLines={1} style={{ color: t.muted, fontSize: 13, fontWeight: "600" }}>{quest.description}</Text>
      </View>
      <View style={{ width: 160 }}>
        <Text style={{ color: t.muted, fontSize: 13, fontWeight: "800" }}>{quest.category}</Text>
      </View>
      <View style={{ width: 130 }}>
        <Text style={{ color: t.text, fontSize: 14, fontWeight: "900" }}>+{quest.xp} XP</Text>
        <Text style={{ color: t.faint, fontSize: 12, fontWeight: "700" }}>{quest.timeLabel}</Text>
      </View>
      <View style={{ width: 130 }}>
        <Text style={{ color: t.text, fontSize: 13, fontWeight: "900" }}>{quest.difficulty}</Text>
        <Text style={{ color: t.faint, fontSize: 12, fontWeight: "700" }}>{quest.createdByLabel}</Text>
      </View>
      <View style={{ width: 108 }}>
        <StatusPill status={quest.status} t={t} />
      </View>
      <Ionicons name="chevron-forward" size={18} color={t.faint} />
    </Pressable>
  );
}

function QuestPreviewCard({ form, t }: { form: QuestFormInput; t: Theme }) {
  const steps = form.steps.map((step) => step.trim()).filter(Boolean);
  return (
    <View style={{ gap: 16 }}>
      <Text style={{ color: t.text, fontSize: 18, fontWeight: "900" }}>Mobile Preview</Text>
      <View style={{ borderRadius: 26, backgroundColor: "#f7f0df", borderWidth: 1, borderColor: "#eadfcb", padding: 14, gap: 14 }}>
        <View style={{ borderRadius: 22, backgroundColor: "#fffaf0", borderWidth: 2, borderColor: "#f0dfbe", boxShadow: "0 14px 24px rgba(40,50,80,0.14)", overflow: "hidden" }}>
          <View style={{ flexDirection: "row" }}>
            <View style={{ width: 8, backgroundColor: form.color || nova.blue }} />
            <View style={{ flex: 1, padding: 16, gap: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7, flex: 1 }}>
                  <View style={{ borderRadius: 999, backgroundColor: "#e8efff", paddingHorizontal: 10, paddingVertical: 5 }}>
                    <Text style={{ color: "#2563eb", fontSize: 11, fontWeight: "900" }}>{form.category}</Text>
                  </View>
                  <View style={{ borderRadius: 999, backgroundColor: "#fff0db", paddingHorizontal: 10, paddingVertical: 5 }}>
                    <Text style={{ color: "#c05621", fontSize: 11, fontWeight: "900" }}>{form.difficulty}</Text>
                  </View>
                </View>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "#eef4ff", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="bookmark-outline" size={17} color="#2563eb" />
                </View>
              </View>
              <Text style={{ color: "#152033", fontSize: 21, fontWeight: "900", lineHeight: 26 }}>{form.title || "Untitled quest"}</Text>
              <Text numberOfLines={3} style={{ color: "#607087", fontSize: 13, fontWeight: "700", lineHeight: 19 }}>{form.description || "Quest description preview will appear here."}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, flex: 1 }}>
                  <View style={{ borderRadius: 999, backgroundColor: "#edf7ed", paddingHorizontal: 10, paddingVertical: 6 }}>
                    <Text style={{ color: "#198754", fontWeight: "900", fontSize: 12 }}>+{form.xp} XP</Text>
                  </View>
                  <View style={{ borderRadius: 999, backgroundColor: "#eef4ff", paddingHorizontal: 10, paddingVertical: 6 }}>
                    <Text style={{ color: "#2563eb", fontWeight: "900", fontSize: 12 }}>{form.timeMin} min</Text>
                  </View>
                </View>
                <View style={{ borderRadius: 999, backgroundColor: "#2563eb", paddingHorizontal: 16, paddingVertical: 9 }}>
                  <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "900" }}>Start</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        <View style={{ borderRadius: 22, backgroundColor: "#fffaf0", borderWidth: 1, borderColor: "#eddfc7", padding: 16, gap: 14 }}>
          <View style={{ borderRadius: 18, backgroundColor: "#dbeafe", height: 92, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="sparkles-outline" size={30} color={form.color || nova.blue} />
          </View>
          <View style={{ gap: 5 }}>
            <Text style={{ color: "#152033", fontSize: 22, fontWeight: "900" }}>{form.title || "Untitled quest"}</Text>
            <Text style={{ color: "#607087", fontWeight: "700", lineHeight: 20 }}>{form.description || "The full quest details will appear here."}</Text>
          </View>
          <View style={{ borderRadius: 18, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#efe2cc", padding: 14, gap: 12 }}>
            <Text style={{ color: "#152033", fontSize: 16, fontWeight: "900" }}>How it works</Text>
            {(steps.length ? steps : ["Add the first step for this quest."]).slice(0, 4).map((step, index) => (
              <View key={`${step}-${index}`} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
                <View style={{ width: 25, height: 25, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: form.color || nova.blue }}>
                  <Text style={{ color: "#ffffff", fontWeight: "900", fontSize: 11 }}>{index + 1}</Text>
                </View>
                <Text style={{ color: "#607087", flex: 1, fontWeight: "700", lineHeight: 19 }}>{step}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

function QuestForm({
  archived,
  form,
  onChange,
  t,
}: {
  archived?: boolean;
  form: QuestFormInput;
  onChange: (form: QuestFormInput) => void;
  t: Theme;
}) {
  const editable = !archived;
  const updateStep = (index: number, value: string) => {
    const next = [...form.steps];
    next[index] = value;
    onChange({ ...form, steps: next });
  };

  return (
    <View style={{ gap: 18 }}>
      <Field editable={editable} label="Quest title" t={t} value={form.title} onChangeText={(title) => onChange({ ...form, title })} placeholder="e.g. Sunrise Photo Walk" />
      <View style={{ gap: 8 }}>
        <Text style={{ color: t.faint, fontSize: 12, fontWeight: "900", letterSpacing: 1.3, textTransform: "uppercase" }}>Category</Text>
        <Segmented options={categoryOptions} t={t} value={form.category} onChange={(category) => onChange({ ...form, category })} />
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
        <View style={{ flex: 1, minWidth: 180 }}>
          <View style={{ gap: 8 }}>
            <Text style={{ color: t.faint, fontSize: 12, fontWeight: "900", letterSpacing: 1.3, textTransform: "uppercase" }}>Difficulty</Text>
            <Segmented options={questDifficulties} t={t} value={form.difficulty} onChange={(difficulty: QuestDifficulty) => onChange({ ...form, difficulty })} />
          </View>
        </View>
        <View style={{ flex: 1, minWidth: 160 }}>
          <NumberField editable={editable} label="Time in minutes" t={t} value={form.timeMin} onChange={(timeMin) => onChange({ ...form, timeMin })} />
        </View>
        <View style={{ flex: 1, minWidth: 160 }}>
          <NumberField editable={editable} label="Experience points" t={t} value={form.xp} onChange={(xp) => onChange({ ...form, xp })} />
        </View>
      </View>
      <Field editable={editable} label="Description" multiline t={t} value={form.description} onChangeText={(description) => onChange({ ...form, description })} placeholder="Describe what the user should do and what completion means." />
      <View style={{ gap: 10 }}>
        <Text style={{ color: t.faint, fontSize: 12, fontWeight: "900", letterSpacing: 1.3, textTransform: "uppercase" }}>Quest steps</Text>
        {form.steps.map((step, index) => (
          <View key={index} style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: form.color || nova.blue, alignItems: "center", justifyContent: "center" }}>
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
      <Field editable={editable} label="Accent color" t={t} value={form.color} onChangeText={(color) => onChange({ ...form, color })} />
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
  const [mode, setMode] = useState<Mode>("dark");
  const t = themes[mode];
  const [membership, setMembership] = useState<AdminMembership | null>(null);
  const [adminProfiles, setAdminProfiles] = useState<AdminProfile[]>([]);
  const [adminInvites, setAdminInvites] = useState<AdminInvite[]>([]);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [checkingRole, setCheckingRole] = useState(true);
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
  const [featuredSearch, setFeaturedSearch] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePermissions, setInvitePermissions] = useState<AdminPermission[]>(defaultAdminPermissions);
  const [profileName, setProfileName] = useState("");
  const [profilePassword, setProfilePassword] = useState("");
  const [selectedAdminUserId, setSelectedAdminUserId] = useState<string | null>(null);
  const [selectedReviewQuestId, setSelectedReviewQuestId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [denyQuest, setDenyQuest] = useState<Quest | null>(null);
  const [denyNote, setDenyNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [featuredDatesByQuest, setFeaturedDatesByQuest] = useState<Record<string, string>>({});

  const compact = width < 980;
  const canViewPublished = hasPermission(membership, "quests.view_published");
  const canViewAll = hasPermission(membership, "quests.view_all");
  const canCreateDraft = hasPermission(membership, "quests.create_draft");
  const canSubmitReview = hasPermission(membership, "quests.submit_review");
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
    : adminProfiles[0] ?? null;
  const unreadCount = notifications.filter((notification) => !notification.readAt).length;
  const cleanAdminName = cleanDisplayName(membership?.displayName, membership?.email);
  const adminName = cleanAdminName || "Enter your name";
  const needsAdminName = !cleanAdminName;
  const today = featuredDateKey(new Date());
  const featuredDateOptions = [-2, -1, 0, 1, 2, 3, 4, 5, 6].map((offset) => addDays(today, offset));
  const isFeaturedPast = featuredDate < today;

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

  async function loadAdminContent() {
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
  }

  async function loadAdminOperations() {
    const nextNotifications = canViewInbox ? await fetchAdminNotifications() : [];
    setNotifications(nextNotifications);

    if (canManageAdmins) {
      const [profiles, invites] = await Promise.all([
        listAdminProfiles(),
        listAdminInvites(),
      ]);
      setAdminProfiles(profiles);
      setAdminInvites(invites);
    }
  }

  async function loadFeaturedBatch(date: string) {
    setError(null);
    try {
      const batches = await fetchFeaturedBatches(date, date);
      setFeaturedQuestIds(batches[0]?.questIds ?? []);
    } catch (nextError) {
      setFeaturedQuestIds([]);
      setError(nextError instanceof Error ? nextError.message : "Unable to load featured batch.");
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

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await upsertFeaturedBatch(featuredDate, featuredQuestIds);
      await loadAdminContent();
      await refreshMobileContent();
      setMessage(`Featured batch saved for ${featuredDate}.`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to save featured batch.");
    } finally {
      setSaving(false);
    }
  }

  async function clearFeaturedBatch() {
    if (!canViewPublished) {
      setError("You do not have permission to manage featured quests.");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await deleteFeaturedBatch(featuredDate);
      setFeaturedQuestIds([]);
      await loadAdminContent();
      await refreshMobileContent();
      setMessage(`Featured batch cleared for ${featuredDate}.`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to clear featured batch.");
    } finally {
      setSaving(false);
    }
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

  async function handleInviteAdmin() {
    if (!inviteEmail.trim()) return;
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
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to invite admin.");
    } finally {
      setSaving(false);
    }
  }

  async function saveSelectedAdminAccess(nextRole: AdminRole, nextPermissions: AdminPermission[]) {
    if (!selectedAdmin) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await updateAdminAccess({
        permissions: nextRole === "super_admin" ? [...adminPermissions] : nextPermissions,
        role: nextRole,
        userId: selectedAdmin.userId,
      });
      await loadAdminOperations();
      setMessage("Admin permissions updated.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to update admin.");
    } finally {
      setSaving(false);
    }
  }

  async function handleResetSelectedAdminPassword() {
    if (!selectedAdmin || selectedAdmin.role === "super_admin") return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await resetAdminPassword(selectedAdmin.userId);
      setMessage("Password reset email sent.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to send password reset.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleSelectedAdminActive() {
    if (!selectedAdmin || selectedAdmin.role === "super_admin") return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      if (selectedAdmin.isActive) {
        await disableAdmin(selectedAdmin.userId);
        setMessage("Admin disabled.");
      } else {
        await reactivateAdmin(selectedAdmin.userId);
        setMessage("Admin reactivated.");
      }
      await loadAdminOperations();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to update admin status.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSelectedAdmin() {
    if (!selectedAdmin || selectedAdmin.role === "super_admin") return;

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
              await deleteAdmin(selectedAdmin.userId);
              setSelectedAdminUserId(null);
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

  async function revokeInvite(invite: AdminInvite) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await updateInviteAccess({
        id: invite.id,
        permissions: invite.permissions,
        role: invite.role,
        status: "revoked",
      });
      await loadAdminOperations();
      setMessage("Invite revoked.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to revoke invite.");
    } finally {
      setSaving(false);
    }
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

  async function openNotification(notification: AdminNotification) {
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
    view === "admins" ? "Invite admins, approve access, and decide exactly which tools each admin can use." :
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

  const collapsedRail = sidebarCollapsed && !compact;
  const sidebarWidth = compact ? "100%" : collapsedRail ? 72 : 260;
  const sidebarPaddingHorizontal = compact ? 18 : collapsedRail ? 12 : 24;

  function renderNavItem(item: (typeof nav)[number]) {
    return (
      <Pressable
        key={item.route}
        accessibilityRole="button"
        accessibilityLabel={item.label}
        accessibilityState={{ selected: item.active }}
        onPress={() => router.push(item.route)}
        style={{
          minHeight: 48,
          width: collapsedRail ? 48 : "100%",
          alignSelf: collapsedRail ? "center" : "stretch",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: collapsedRail ? "center" : "flex-start",
          gap: collapsedRail ? 0 : 12,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: item.active ? nova.blue : "transparent",
          backgroundColor: item.active ? t.active : "transparent",
          paddingHorizontal: collapsedRail ? 0 : 14,
        }}
      >
        <Ionicons name={item.icon} size={22} color={item.active ? nova.blue : t.muted} />
        {collapsedRail ? null : (
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
          width: collapsedRail ? 48 : "100%",
          alignSelf: collapsedRail ? "center" : "stretch",
          borderRadius: 10,
          borderWidth: 1,
          borderColor: t.border,
          backgroundColor: t.card,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: collapsedRail ? "center" : "flex-start",
          gap: collapsedRail ? 0 : 10,
          paddingHorizontal: collapsedRail ? 0 : 14,
        }}
      >
        <Ionicons name={icon} size={20} color={t.muted} />
        {collapsedRail ? null : <Text style={{ color: t.muted, fontSize: 15, fontWeight: "900" }}>{label}</Text>}
      </Pressable>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.page }}>
      <View style={{ flex: 1, flexDirection: compact ? "column" : "row" }}>
        <View
          style={{
            width: sidebarWidth,
            flexShrink: 0,
            backgroundColor: t.sidebar,
            borderRightWidth: compact ? 0 : 1,
            borderRightColor: t.border,
            paddingHorizontal: sidebarPaddingHorizontal,
            paddingVertical: compact ? 16 : 18,
            gap: compact ? 16 : 18,
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
            {!compact ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={collapsedRail ? "Expand sidebar" : "Collapse sidebar"}
                onPress={() => setSidebarCollapsed((current) => !current)}
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
            ) : null}
          </View>
          {compact ? (
            <View style={{ gap: 8 }}>
              {nav.map(renderNavItem)}
            </View>
          ) : (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 8, paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
              {nav.map(renderNavItem)}
            </ScrollView>
          )}
          {!compact ? (
            <View style={{ gap: 10, flexShrink: 0 }}>
              {collapsedRail ? null : (
                <Text style={{ color: t.muted, fontSize: 15, fontWeight: "800" }}>{membership ? `${membership.role} access` : checkingRole ? "Checking access" : "No access"}</Text>
              )}
              {renderSidebarAction(mode === "dark" ? "Light Mode" : "Dark Mode", mode === "dark" ? "sunny-outline" : "moon-outline", () => setMode((current) => current === "dark" ? "light" : "dark"))}
              {renderSidebarAction("Logout", "log-out-outline", handleLogout)}
            </View>
          ) : null}
        </View>

        <View style={{ flex: 1 }}>
          <View style={{ minHeight: 74, borderBottomWidth: 1, borderBottomColor: t.border, backgroundColor: t.shell, paddingHorizontal: compact ? 18 : 30, flexDirection: "row", alignItems: "center", gap: 18 }}>
            <View style={{ flex: 1, gap: 3 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <Text style={{ color: t.text, fontSize: 19, fontWeight: "900" }}>Welcome back,</Text>
                <Pressable
                  disabled={!needsAdminName || !canManageProfile}
                  onPress={() => router.push("/admin/profile")}
                  style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <Text style={{ color: needsAdminName ? t.activeText : t.text, fontSize: 19, fontWeight: "900" }}>{adminName}</Text>
                  {needsAdminName ? <Ionicons name="pencil-outline" size={17} color={t.activeText} /> : null}
                </Pressable>
              </View>
              <Text style={{ color: t.muted, fontSize: 13, fontWeight: "700" }}>Build the quests people will actually remember.</Text>
            </View>
            {canViewInbox ? (
              <Pressable onPress={() => router.push("/admin/inbox")} style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name={unreadCount ? "notifications" : "notifications-outline"} size={23} color={t.muted} />
                {unreadCount ? (
                  <View style={{ position: "absolute", right: 8, top: 8, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: nova.red, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 }}>
                    <Text style={{ color: "#ffffff", fontSize: 10, fontWeight: "900" }}>{unreadCount}</Text>
                  </View>
                ) : null}
              </Pressable>
            ) : null}
          </View>

          <ScrollView contentContainerStyle={{ padding: compact ? 18 : 36, gap: 26, paddingBottom: 60 }}>
            <View style={{ flexDirection: compact ? "column" : "row", justifyContent: "space-between", gap: 16 }}>
              <View style={{ gap: 8, flex: 1 }}>
                <Text style={{ color: t.text, fontSize: compact ? 32 : 42, fontWeight: "900", letterSpacing: 0 }}>{currentTitle}</Text>
                <Text style={{ color: t.muted, fontSize: 17, fontWeight: "600" }}>{currentSubtitle}</Text>
              </View>
              <View style={{ alignItems: compact ? "flex-start" : "flex-end", gap: 10 }}>
                {view === "all" && canCreateDraft ? <ActionButton icon="add" label="New Draft" onPress={() => router.push("/admin/create")} t={t} /> : null}
              </View>
            </View>

            {!checkingRole && !membership ? (
              <EmptyPanel icon="lock-closed-outline" title="Admin access required" body="This account is signed in but is not listed in admin_memberships." t={t} />
            ) : null}

            {membership ? (
              <>
                {view === "published" || view === "all" ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 18 }}>
                  <QuestStatCard icon="rocket-outline" label="Published" value={stats.published} tint={nova.blue} t={t} />
                  <QuestStatCard icon="document-text-outline" label="Drafts" value={stats.draft} tint={nova.orange} t={t} />
                  <QuestStatCard icon="shield-checkmark-outline" label="In Review" value={stats.inReview} tint={nova.violet} t={t} />
                  <QuestStatCard icon="archive-outline" label="Archived" value={stats.archived} tint={nova.red} t={t} />
                </View>
                ) : null}

                {message ? <Text style={{ color: nova.green, fontWeight: "900" }}>{message}</Text> : null}
                {error ? <Text style={{ color: nova.red, fontWeight: "900" }}>{error}</Text> : null}

                {view === "published" || view === "all" ? (
                  (view === "published" ? canViewPublished : canViewAll) ? (
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
                        <QuestRow key={quest.id} quest={quest} t={t} featuredDate={featuredDatesByQuest[quest.id]} onPress={() => router.push(`/admin/quest/${quest.id}`)} />
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
                      <QuestForm form={draftForm} onChange={setDraftForm} t={t} />
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
                        <QuestForm archived={selectedQuest.status === "archived"} form={detailForm} onChange={setDetailForm} t={t} />
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
                    <View style={{ flexDirection: compact ? "column" : "row", gap: 18, alignItems: "flex-start" }}>
                      <Panel t={t} style={{ width: compact ? "100%" : 330, overflow: "hidden" }}>
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

                      <Panel t={t} style={{ flex: 1.25, padding: 22, gap: 16 }}>
                        <View style={{ flexDirection: compact ? "column" : "row", gap: 14 }}>
                          <View style={{ flex: 1 }}>
                            <Field label="Title" t={t} value={packForm.title} onChangeText={(title) => setPackForm((current) => ({ ...current, title }))} placeholder="City Weekend Starter" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Field label="Subtitle" t={t} value={packForm.subtitle} onChangeText={(subtitle) => setPackForm((current) => ({ ...current, subtitle }))} placeholder="A polished set of quests" />
                          </View>
                        </View>
                        <Field label="Description" multiline t={t} value={packForm.description} onChangeText={(description) => setPackForm((current) => ({ ...current, description }))} placeholder="Describe the mood, promise, and use case for this pack." />
                        <View style={{ flexDirection: compact ? "column" : "row", gap: 14 }}>
                          <View style={{ flex: 1 }}>
                            <Field label="Icon" t={t} value={packForm.icon} onChangeText={(icon) => setPackForm((current) => ({ ...current, icon }))} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Field label="Accent color" t={t} value={packForm.color} onChangeText={(color) => setPackForm((current) => ({ ...current, color }))} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Field label="Background color" t={t} value={packForm.bgColor} onChangeText={(bgColor) => setPackForm((current) => ({ ...current, bgColor }))} />
                          </View>
                        </View>
                        <Field label="Cover image URL" t={t} value={packForm.coverImageUrl ?? ""} onChangeText={(coverImageUrl) => setPackForm((current) => ({ ...current, coverImageUrl }))} placeholder="https://..." />
                        <View style={{ gap: 8 }}>
                          <Text style={{ color: t.faint, fontSize: 12, fontWeight: "900", letterSpacing: 1.3, textTransform: "uppercase" }}>Status</Text>
                          <Segmented options={questStatuses} t={t} value={packForm.status} onChange={(status) => setPackForm((current) => ({ ...current, status }))} renderLabel={statusLabel} />
                        </View>
                        <View style={{ gap: 10 }}>
                          <View style={{ flexDirection: compact ? "column" : "row", justifyContent: "space-between", gap: 12 }}>
                            <View>
                              <Text style={{ color: t.text, fontSize: 18, fontWeight: "900" }}>Quests</Text>
                              <Text style={{ color: t.muted, marginTop: 4, fontWeight: "700" }}>{packForm.questIds.length} selected from published quests</Text>
                            </View>
                            <View style={{ width: compact ? "100%" : 320 }}>
                              <SearchField value={packSearch} onChangeText={setPackSearch} placeholder="Search quests..." t={t} />
                            </View>
                          </View>
                          <Panel t={t} style={{ overflow: "hidden", maxHeight: 320 }}>
                            <ScrollView nestedScrollEnabled>
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
                        </View>
                      </Panel>

                      <Panel t={t} style={{ width: compact ? "100%" : 390, padding: 22 }}>
                        <AdventurePackPreviewCard form={packForm} previewQuests={packPreviewQuests} t={t} />
                      </Panel>
                    </View>
                  ) : (
                    <EmptyPanel icon="lock-closed-outline" title="Published quest permission required" body="Adventure pack management is available to admins who can view published quests." t={t} />
                  )
                ) : null}

                {view === "featured" ? (
                  canViewPublished ? (
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
                                {!isFeaturedPast ? (
                                  <Pressable onPress={() => toggleFeaturedQuest(id)} style={{ width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center" }}>
                                    <Ionicons name="close-circle" size={20} color={t.faint} />
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
                                  disabled={!featuredQuestIds.includes(quest.id) && featuredQuestIds.length >= 6}
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
                        <View style={{ flexDirection: compact ? "column" : "row", gap: 12 }}>
                          <View style={{ flex: 1 }}>
                            <ActionButton disabled={saving || featuredQuestIds.length !== 6} icon="save-outline" label={saving ? "Saving..." : "Save Featured Batch"} onPress={saveFeaturedBatch} t={t} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <ActionButton disabled={saving} icon="trash-outline" label="Clear Batch" onPress={clearFeaturedBatch} secondary t={t} />
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
                    <View style={{ flexDirection: compact ? "column" : "row", gap: 18, alignItems: "flex-start" }}>
                      <View style={{ flex: 1, gap: 18 }}>
                        <Panel t={t} style={{ padding: 22, gap: 16 }}>
                          <Text style={{ color: t.text, fontSize: 22, fontWeight: "900" }}>Invite Admin</Text>
                          <Field label="Admin email" t={t} value={inviteEmail} onChangeText={setInviteEmail} placeholder="name@example.com" />
                          <Panel t={t} style={{ padding: 14, backgroundColor: t.cardAlt }}>
                            <Text style={{ color: t.text, fontWeight: "900" }}>Role: Admin</Text>
                            <Text style={{ color: t.muted, marginTop: 5, fontWeight: "700", lineHeight: 20 }}>Super Admin is the owner account seeded in Supabase. Invited users receive specific admin permissions only.</Text>
                          </Panel>
                          <View style={{ gap: 10 }}>
                            <Text style={{ color: t.faint, fontSize: 12, fontWeight: "900", letterSpacing: 1.3, textTransform: "uppercase" }}>Permissions</Text>
                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                              {grantableAdminPermissions.map((permission) => {
                                const active = invitePermissions.includes(permission);
                                return (
                                  <Pressable
                                    key={permission}
                                    onPress={() => toggleInvitePermission(permission)}
                                    style={{
                                      borderRadius: 999,
                                      borderWidth: 1,
                                      borderColor: active ? nova.blue : t.border,
                                      backgroundColor: active ? t.active : t.cardAlt,
                                      paddingHorizontal: 12,
                                      paddingVertical: 8,
                                    }}
                                  >
                                    <Text style={{ color: active ? t.activeText : t.muted, fontSize: 12, fontWeight: "900" }}>{permissionLabels[permission]}</Text>
                                  </Pressable>
                                );
                              })}
                            </View>
                          </View>
                          <ActionButton disabled={saving || !inviteEmail.trim()} icon="mail-outline" label="Save Invite" onPress={handleInviteAdmin} t={t} />
                        </Panel>

                        <Panel t={t} style={{ overflow: "hidden" }}>
                          <View style={{ padding: 18 }}>
                            <Text style={{ color: t.text, fontSize: 20, fontWeight: "900" }}>Current Admins</Text>
                          </View>
                          {adminProfiles.map((profile) => {
                            const active = selectedAdmin?.userId === profile.userId;
                            return (
                              <Pressable
                                key={profile.userId}
                                onPress={() => setSelectedAdminUserId(profile.userId)}
                                style={{ borderTopColor: t.border, borderTopWidth: 1, backgroundColor: active ? t.active : "transparent", padding: 18, gap: 6 }}
                              >
                                <Text style={{ color: active ? t.activeText : t.text, fontSize: 16, fontWeight: "900" }}>{profile.displayName || profile.email || profile.userId}</Text>
                                <Text style={{ color: t.muted, fontWeight: "700" }}>
                                  {displayRole(profile.role)} · {profile.isActive ? "Active" : "Disabled"} · Last login {formatDate(profile.lastLogin)}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </Panel>
                      </View>

                      <View style={{ flex: 1, gap: 18 }}>
                        {selectedAdmin ? (
                          <Panel t={t} style={{ padding: 22, gap: 16 }}>
                            <Text style={{ color: t.text, fontSize: 22, fontWeight: "900" }}>{selectedAdmin.displayName || selectedAdmin.email || "Admin"}</Text>
                            <Text style={{ color: t.muted, fontWeight: "700" }}>{selectedAdmin.email || selectedAdmin.userId}</Text>
                            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                              <Pill
                                t={t}
                                tone={selectedAdmin.isActive
                                  ? { bg: "rgba(34,197,94,0.16)", text: "#16a34a", border: "rgba(34,197,94,0.24)" }
                                  : { bg: "rgba(239,68,68,0.14)", text: "#ef4444", border: "rgba(239,68,68,0.28)" }}
                              >
                                {selectedAdmin.isActive ? "Active" : "Disabled"}
                              </Pill>
                              <Pill t={t}>Last login {formatDate(selectedAdmin.lastLogin)}</Pill>
                            </View>
                            <View style={{ gap: 8 }}>
                              <Text style={{ color: t.faint, fontSize: 12, fontWeight: "900", letterSpacing: 1.3, textTransform: "uppercase" }}>Role</Text>
                              <Panel t={t} style={{ padding: 14, backgroundColor: t.cardAlt }}>
                                <Text style={{ color: t.text, fontWeight: "900" }}>{displayRole(selectedAdmin.role)}</Text>
                                <Text style={{ color: t.muted, marginTop: 5, fontWeight: "700", lineHeight: 20 }}>
                                  {selectedAdmin.role === "super_admin" ? "Owner account with every permission." : "Admin account. Adjust its allowed dashboard tools below."}
                                </Text>
                              </Panel>
                            </View>
                            <View style={{ gap: 10 }}>
                              <Text style={{ color: t.faint, fontSize: 12, fontWeight: "900", letterSpacing: 1.3, textTransform: "uppercase" }}>Permissions</Text>
                              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                                {(selectedAdmin.role === "super_admin" ? adminPermissions : grantableAdminPermissions).map((permission) => {
                                  const active = selectedAdmin.role === "super_admin" || selectedAdmin.permissions.includes(permission);
                                  return (
                                    <Pressable
                                      key={permission}
                                      disabled={selectedAdmin.role === "super_admin"}
                                      onPress={() => {
                                        const nextPermissions = active
                                          ? selectedAdmin.permissions.filter((item) => item !== permission)
                                          : [...selectedAdmin.permissions, permission];
                                        saveSelectedAdminAccess(selectedAdmin.role, nextPermissions);
                                      }}
                                      style={{
                                        borderRadius: 999,
                                        borderWidth: 1,
                                        borderColor: active ? nova.blue : t.border,
                                        backgroundColor: active ? t.active : t.cardAlt,
                                        paddingHorizontal: 12,
                                        paddingVertical: 8,
                                        opacity: selectedAdmin.role === "super_admin" ? 0.72 : 1,
                                      }}
                                    >
                                      <Text style={{ color: active ? t.activeText : t.muted, fontSize: 12, fontWeight: "900" }}>{permissionLabels[permission]}</Text>
                                    </Pressable>
                                  );
                                })}
                              </View>
                            </View>
                            {selectedAdmin.role !== "super_admin" ? (
                              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                                <ActionButton disabled={saving} icon="key-outline" label="Reset Password" onPress={handleResetSelectedAdminPassword} secondary t={t} />
                                <ActionButton
                                  disabled={saving}
                                  icon={selectedAdmin.isActive ? "pause-circle-outline" : "play-circle-outline"}
                                  label={selectedAdmin.isActive ? "Disable" : "Reactivate"}
                                  onPress={handleToggleSelectedAdminActive}
                                  secondary
                                  t={t}
                                />
                                <ActionButton disabled={saving} icon="trash-outline" label="Delete" onPress={handleDeleteSelectedAdmin} secondary t={t} />
                              </View>
                            ) : null}
                          </Panel>
                        ) : <EmptyPanel icon="people-outline" title="No admins yet" body="Invited admins will appear here after they create an account." t={t} />}

                        <Panel t={t} style={{ overflow: "hidden" }}>
                          <View style={{ padding: 18 }}>
                            <Text style={{ color: t.text, fontSize: 20, fontWeight: "900" }}>Pending Invites</Text>
                          </View>
                          {adminInvites.length ? adminInvites.map((invite) => (
                            <View key={invite.id} style={{ borderTopColor: t.border, borderTopWidth: 1, padding: 18, gap: 8 }}>
                              <Text style={{ color: t.text, fontSize: 16, fontWeight: "900" }}>{invite.email}</Text>
                              <Text style={{ color: t.muted, fontWeight: "700" }}>
                                {invite.role} · {invite.status} · {invite.permissions.length} permissions · Expires {formatDate(invite.expiresAt)}
                              </Text>
                              {invite.status === "pending" ? <ActionButton disabled={saving} icon="close-circle-outline" label="Revoke Invite" onPress={() => revokeInvite(invite)} secondary t={t} /> : null}
                            </View>
                          )) : (
                            <View style={{ padding: 18 }}>
                              <Text style={{ color: t.muted, fontWeight: "700" }}>No invites yet.</Text>
                            </View>
                          )}
                        </Panel>
                      </View>
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
                    <Panel t={t} style={{ overflow: "hidden" }}>
                      <View style={{ padding: 22, gap: 5 }}>
                        <Text style={{ color: t.text, fontSize: 22, fontWeight: "900" }}>Notifications</Text>
                        <Text style={{ color: t.muted, fontWeight: "700" }}>{unreadCount} unread</Text>
                      </View>
                      {notifications.length ? notifications.map((notification) => (
                        <Pressable
                          key={notification.id}
                          onPress={() => openNotification(notification)}
                          style={{ borderTopColor: t.border, borderTopWidth: 1, padding: 20, gap: 7, backgroundColor: notification.readAt ? "transparent" : t.active }}
                        >
                          <Text style={{ color: notification.readAt ? t.text : t.activeText, fontSize: 17, fontWeight: "900" }}>{notification.title}</Text>
                          <Text style={{ color: t.muted, fontWeight: "700", lineHeight: 20 }}>{notification.body}</Text>
                          <Text style={{ color: t.faint, fontSize: 12, fontWeight: "800" }}>{formatDate(notification.createdAt)}</Text>
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
          </ScrollView>
        </View>
      </View>
    </View>
  );
}
