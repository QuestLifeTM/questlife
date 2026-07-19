import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { Share } from "react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Alert, Animated, Easing, Image, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Reanimated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { PartyCategoryIcon } from "@/components/party-category-icon";
import { QuestlifeFlame } from "@/components/questlife-flame";
import { categoryColor, radius, T } from "@/components/theme";
import { Card, EmptyState, haptic, Header, IconButton, PillStat, Screen, Sheet, SoftButton, Tag, useResponsiveScreenLayout } from "@/components/ui";
import { useContent } from "@/contexts/ContentContext";
import { useSocial } from "@/contexts/SocialContext";
import { categories, sortOptions } from "@/data/questlife";
import { resolvePartyMedia, uploadPartyMedia } from "@/services/social/socialService";
import { Quest, QuestDifficulty, questDifficulties } from "@/types/content";
import { CreatePartyInput, Party, PartyLocationType, PartyMode, PartyProofMode, PartyTemplate, SocialFriend } from "@/types/social";

type Tab = "friends" | "parties";
type CreatorStep = "source" | "quests" | "details";
type PartyQuestFilters = { duration: string | null; difficulty: QuestDifficulty | null };
type PartyQuestControl = "sort" | "filters" | null;

function sortPartyQuests(list: Quest[], sortBy: string) {
  const difficultyOrder: Record<QuestDifficulty, number> = { EASY: 0, MEDIUM: 1, HARD: 2, FORMIDABLE: 3 };
  const copy = [...list];
  if (sortBy === "Most XP") return copy.sort((a, b) => b.xp - a.xp);
  if (sortBy === "Least XP") return copy.sort((a, b) => a.xp - b.xp);
  if (sortBy === "Easiest") return copy.sort((a, b) => difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty]);
  if (sortBy === "Hardest") return copy.sort((a, b) => difficultyOrder[b.difficulty] - difficultyOrder[a.difficulty]);
  if (sortBy === "Shortest") return copy.sort((a, b) => a.timeMin - b.timeMin);
  if (sortBy === "Longest") return copy.sort((a, b) => b.timeMin - a.timeMin);
  if (sortBy === "Best for today") return copy.sort((a, b) => Number(b.featured) - Number(a.featured) || a.timeMin - b.timeMin);
  return copy;
}

function Avatar({ emoji, color, size = 44 }: { emoji: string; color: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: `${color}22`, borderWidth: 2, borderColor: `${color}66`, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize: size * 0.42 }}>{emoji}</Text>
    </View>
  );
}

function SectionTitle({ title, detail }: { title: string; detail?: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
      <Text style={{ color: T.dark, fontSize: 20, fontWeight: "900" }}>{title}</Text>
      {detail ? <Text style={{ color: T.muted, fontSize: 12, fontWeight: "800" }}>{detail}</Text> : null}
    </View>
  );
}

function FriendRow({ friend, onChallenge, onShare }: { friend: SocialFriend; onChallenge: () => void; onShare: () => void }) {
  return (
    <Card style={{ borderRadius: 22, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, boxShadow: "none" }}>
      <Avatar emoji={friend.emoji} color={friend.avatarColor} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ color: T.dark, fontSize: 16, fontWeight: "900" }}>{friend.displayName}</Text>
        <Text style={{ color: T.muted, fontSize: 12, fontWeight: "700" }} numberOfLines={1}>{friend.lastQuestTitle ? `Last: ${friend.lastQuestTitle}` : `@${friend.username ?? "adventurer"}`}</Text>
        <View style={{ flexDirection: "row", gap: 6, marginTop: 2 }}>
          <PillStat text={`Lv ${Math.floor(friend.totalXp / 500) + 1}`} color={T.blue} />
          {friend.currentStreak !== null ? <PillStat iconElement={<QuestlifeFlame size={15} />} text={String(friend.currentStreak)} color={T.orange} /> : null}
        </View>
      </View>
      <View style={{ gap: 6 }}>
        <IconButton icon="paper-plane-outline" label={`Share with ${friend.displayName}`} color={T.cyan} onPress={onShare} />
        <IconButton icon="flash-outline" label={`Challenge ${friend.displayName}`} color={T.orange} onPress={onChallenge} />
      </View>
    </Card>
  );
}

function partyDateLabel(endedAt: string | null) {
  if (!endedAt) return "Party in progress";

  const date = new Date(endedAt);
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function PartyCard({ party }: { party: Party }) {
  const router = useRouter();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const isPast = party.status === "ended" || party.viewerLeftEarly;
  const statusLabel = party.status === "ended" ? "Ended" : "Still active";
  const statusColor = party.status === "ended" ? T.muted : T.blue;
  const modeLabel = party.gameMode === "everyone_together" ? "Together" : "Free play";
  const memberLabel = party.maxMembers ? `${party.memberCount}/${party.maxMembers}` : `${party.memberCount} ${party.memberCount === 1 ? "member" : "members"}`;
  const dateLabel = partyDateLabel(party.endedAt);
  const contextColor = isPast ? T.muted : T.blue;

  useEffect(() => {
    let mounted = true;
    if (!party.photoPath) { setPhotoUrl(null); return; }

    resolvePartyMedia([party.photoPath])
      .then(([url]) => { if (mounted) setPhotoUrl(url ?? null); })
      .catch(() => { if (mounted) setPhotoUrl(null); });

    return () => { mounted = false; };
  }, [party.photoPath]);

  return (
    <Card
      pressable
      onPress={() => router.push(`/party/${party.id}`)}
      style={{
        borderRadius: radius.md,
        padding: 14,
        gap: 10,
        boxShadow: "none",
        borderColor: isPast ? T.border : `${T.blue}66`,
        borderBottomWidth: isPast ? 4 : 5,
        borderBottomColor: isPast ? T.border : "#a8d8ff"
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ width: 44, height: 44, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", ...(photoUrl ? { backgroundColor: T.white, borderWidth: 2, borderColor: T.blue, padding: 2 } : { backgroundColor: isPast ? T.bg : contextColor, borderBottomWidth: isPast ? 0 : 3, borderBottomColor: "#258fd8" }) }}>
          {photoUrl ? <Image source={{ uri: photoUrl }} style={{ width: "100%", height: "100%", borderRadius: 10 }} resizeMode="cover" /> : <Ionicons name="people" size={22} color={isPast ? T.muted : T.white} />}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: T.dark, fontSize: 17, lineHeight: 21, fontWeight: "900" }} numberOfLines={1}>{party.name}</Text>
          <Text style={{ color: T.muted, fontSize: 10, fontWeight: "900", letterSpacing: 0.55, textTransform: "uppercase" }}>
            {modeLabel}
          </Text>
        </View>
        {isPast ? <Tag label={statusLabel} color={statusColor} bg={`${statusColor}16`} /> : <Ionicons name="chevron-forward" size={21} color={T.muted} />}
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ flex: 1, gap: 5 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Ionicons name={party.endedAt ? "calendar-outline" : "pulse-outline"} size={14} color={contextColor} />
            <Text style={{ flex: 1, color: T.muted, fontSize: 11, fontWeight: "700" }} numberOfLines={1}>{dateLabel}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Ionicons name="people-outline" size={15} color={contextColor} />
            <Text style={{ flex: 1, color: T.muted, fontSize: 11, fontWeight: "700" }} numberOfLines={1}>{memberLabel}</Text>
          </View>
        </View>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {party.members.slice(0, 4).map((member, index) => (
              <View key={member.userId} style={{ marginLeft: index ? -8 : 0, zIndex: 4 - index }}>
                <Avatar emoji={member.emoji} color={member.avatarColor} size={28} />
              </View>
            ))}
          </View>
        </View>
      </View>
    </Card>
  );
}

function PartyButton({ label, icon, color = T.blue, onPress, disabled = false, compact = false, style }: { label: string; icon?: keyof typeof Ionicons.glyphMap; color?: string; onPress?: () => void; disabled?: boolean; compact?: boolean; style?: object }) {
  const lowerEdge = color === T.blue ? "#258fd8" : color === T.purple ? "#7973c7" : color === T.green ? "#20894d" : color;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [{ minHeight: compact ? 42 : 58, paddingHorizontal: compact ? 14 : 18, borderRadius: compact ? 16 : 20, backgroundColor: disabled ? T.border : color, borderBottomWidth: compact ? 4 : 6, borderBottomColor: disabled ? "#d7cec2" : lowerEdge, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, opacity: disabled ? 0.6 : 1, transform: [{ translateY: pressed && !disabled ? 3 : 0 }] }, style]}>
      {icon ? <Ionicons name={icon} size={compact ? 16 : 19} color={T.white} /> : null}
      <Text style={{ color: T.white, fontSize: compact ? 12 : 15, fontWeight: "900", letterSpacing: compact ? 0.45 : 0.55, textTransform: "uppercase" }}>{label}</Text>
    </Pressable>
  );
}

function ActionTile({ icon, title, color, onPress, badge }: { icon: keyof typeof Ionicons.glyphMap; title: string; color: string; onPress: () => void; badge?: number }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({ pressed }) => [{ flex: 1, minHeight: 90, borderRadius: 19, borderWidth: 2, borderColor: `${color}36`, borderBottomWidth: 5, borderBottomColor: `${color}75`, backgroundColor: `${color}12`, padding: 12, justifyContent: "space-between", transform: [{ translateY: pressed ? 3 : 0 }] }]}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ width: 32, height: 32, borderRadius: 12, backgroundColor: T.white, alignItems: "center", justifyContent: "center" }}><Ionicons name={icon} size={18} color={color} /></View>
        {badge ? <View style={{ minWidth: 19, height: 19, borderRadius: 10, backgroundColor: color, alignItems: "center", justifyContent: "center" }}><Text style={{ color: T.white, fontSize: 10, fontWeight: "900" }}>{badge}</Text></View> : null}
      </View>
      <Text style={{ color: T.dark, fontSize: 13, fontWeight: "900", letterSpacing: 0.2 }}>{title}</Text>
    </Pressable>
  );
}

function Choice({ selected, title, body, icon, color, onPress }: { selected: boolean; title: string; body: string; icon: keyof typeof Ionicons.glyphMap; color: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ borderWidth: 2, borderColor: selected ? color : T.border, borderBottomWidth: selected ? 5 : 2, borderBottomColor: selected ? `${color}85` : T.border, backgroundColor: selected ? `${color}12` : T.white, borderRadius: 18, padding: 15, flexDirection: "row", gap: 12, alignItems: "center", transform: [{ translateY: pressed ? 2 : 0 }] }]}>
      <View style={{ width: 42, height: 42, borderRadius: 15, backgroundColor: `${color}18`, alignItems: "center", justifyContent: "center" }}><Ionicons name={icon} size={20} color={color} /></View>
      <View style={{ flex: 1, gap: 3 }}><Text style={{ color: T.dark, fontSize: 16, fontWeight: "900" }}>{title}</Text><Text style={{ color: T.muted, fontSize: 12, lineHeight: 17, fontWeight: "700" }}>{body}</Text></View>
      <Ionicons name={selected ? "radio-button-on" : "radio-button-off"} size={21} color={selected ? color : T.muted} />
    </Pressable>
  );
}

function Field({ label, value, onChangeText, placeholder, multiline = false }: { label: string; value: string; onChangeText: (text: string) => void; placeholder: string; multiline?: boolean }) {
  return (
    <View style={{ gap: 7 }}>
      <Text style={{ color: T.muted, fontWeight: "900", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.7 }}>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={T.muted} multiline={multiline} style={{ minHeight: multiline ? 96 : 50, textAlignVertical: multiline ? "top" : "center", borderWidth: 2, borderColor: T.border, borderRadius: 16, paddingHorizontal: 14, paddingVertical: multiline ? 12 : 0, color: T.dark, fontSize: 15, fontWeight: "700", backgroundColor: T.white }} />
    </View>
  );
}

const PARTY_NAME_IDEAS = ["Weekend Wanderers", "Sunset Seekers", "The Quest Crew", "Sidequest Society", "Roam Together"];

const PARTY_NAME_TEXT = {
  fontFamily: "RubikBold" as const,
  fontSize: 18,
  lineHeight: 24,
  letterSpacing: 0
};

function PartyNameField({ value, onChangeText }: { value: string; onChangeText: (text: string) => void }) {
  const [focused, setFocused] = useState(false);
  const [ideaIndex, setIdeaIndex] = useState(0);
  const [characterCount, setCharacterCount] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const cursorOpacity = useSharedValue(1);
  const displaySuggestion = !focused && !value;
  const idea = PARTY_NAME_IDEAS[ideaIndex];
  const displayedText = reduceMotion ? PARTY_NAME_IDEAS[0] : idea.slice(0, characterCount);
  const cursorStyle = useAnimatedStyle(() => ({ opacity: cursorOpacity.value }));

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => { if (active) setReduceMotion(enabled); });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => { active = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    cursorOpacity.value = reduceMotion ? 1 : withRepeat(withTiming(0.18, { duration: 560 }), -1, true);
  }, [cursorOpacity, reduceMotion]);

  useEffect(() => {
    if (!displaySuggestion || reduceMotion) return;
    const atEnd = characterCount === idea.length;
    const atStart = characterCount === 0;
    // Let each suggestion read like a useful example, then remove it quickly
    // enough that the loop never holds up someone who is ready to type.
    const delay = deleting ? (atStart ? 320 : 34) : (atEnd ? 1200 : 58);
    const timeout = setTimeout(() => {
      if (deleting) {
        if (atStart) {
          setDeleting(false);
          setIdeaIndex((index) => (index + 1) % PARTY_NAME_IDEAS.length);
        } else {
          setCharacterCount((count) => count - 1);
        }
      } else if (atEnd) {
        setDeleting(true);
      } else {
        setCharacterCount((count) => count + 1);
      }
    }, delay);
    return () => clearTimeout(timeout);
  }, [characterCount, deleting, displaySuggestion, idea.length, reduceMotion]);

  function handleFocus() {
    setFocused(true);
    setIdeaIndex(0);
    setCharacterCount(0);
    setDeleting(false);
  }

  return (
    <View style={{ gap: 7 }}>
      <Text style={{ color: T.muted, fontWeight: "900", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.7 }}>Party name</Text>
      <View style={{ minHeight: 56, position: "relative", justifyContent: "center" }}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          onBlur={() => setFocused(false)}
          placeholder=""
          accessibilityLabel="Party name"
          accessibilityHint="Enter a name for your Party"
          maxLength={50}
          selectionColor={T.blue}
          style={{ minHeight: 56, borderWidth: 2, borderColor: T.border, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 0, color: T.dark, backgroundColor: T.white, ...PARTY_NAME_TEXT }}
        />
        {displaySuggestion ? (
          <View pointerEvents="none" style={{ position: "absolute", left: 20, right: 20, flexDirection: "row", alignItems: "center" }}>
            <Text numberOfLines={1} style={{ ...PARTY_NAME_TEXT, color: T.muted }}>{displayedText}</Text>
            {reduceMotion ? null : <Reanimated.Text style={[{ ...PARTY_NAME_TEXT, color: T.blue }, cursorStyle]}>|</Reanimated.Text>}
          </View>
        ) : null}
      </View>
    </View>
  );
}

type SetupGlyphKind = "mode" | "limit" | "location" | "invite" | "proof" | "rules";

function SetupGlyph({ kind, color }: { kind: SetupGlyphKind; color: string }) {
  const icon: Record<SetupGlyphKind, keyof typeof Ionicons.glyphMap> = {
    mode: "people",
    limit: "people-circle",
    location: "map",
    invite: "person-add",
    proof: "camera",
    rules: "shield-checkmark"
  };
  return <View style={{ width: 38, height: 38, borderRadius: 14, backgroundColor: `${color}18`, borderWidth: 2, borderColor: `${color}34`, alignItems: "center", justifyContent: "center" }}><Ionicons name={icon[kind]} size={18} color={color} /><View style={{ position: "absolute", width: 7, height: 7, borderRadius: 4, right: -2, top: -2, backgroundColor: color, borderWidth: 2, borderColor: T.bg }} /></View>;
}

function DetailsReveal({ delay, children }: { delay: number; children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => { if (active) setReduceMotion(enabled); });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => { active = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    if (reduceMotion) { opacity.setValue(1); translateY.setValue(0); return; }
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, delay, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 220, delay, easing: Easing.out(Easing.quad), useNativeDriver: true })
    ]).start();
  }, [delay, opacity, reduceMotion, translateY]);

  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
}

function SetupSection({ title, detail, kind, color, delay, children }: { title: string; detail?: string; kind: SetupGlyphKind; color: string; delay: number; children: React.ReactNode }) {
  return <DetailsReveal delay={delay}><View style={{ gap: 10 }}><View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><SetupGlyph kind={kind} color={color} /><View style={{ flex: 1 }}><Text style={{ color: T.dark, fontSize: 17, fontWeight: "900" }}>{title}</Text>{detail ? <Text style={{ color: T.muted, fontSize: 12, fontWeight: "700", marginTop: 1 }}>{detail}</Text> : null}</View></View>{children}</View></DetailsReveal>;
}

function PartyToggle({ value, color, label, onPress }: { value: boolean; color: string; label: string; onPress: () => void }) {
  const translateX = useRef(new Animated.Value(value ? 24 : 0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => { if (active) setReduceMotion(enabled); });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => { active = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    if (reduceMotion) { translateX.setValue(value ? 24 : 0); return; }
    Animated.timing(translateX, { toValue: value ? 24 : 0, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [reduceMotion, translateX, value]);
  return <Pressable accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: value }} onPress={onPress} style={({ pressed }) => [{ width: 58, height: 34, borderRadius: 17, padding: 3, justifyContent: "center", backgroundColor: value ? `${color}20` : T.bg, borderWidth: 2, borderColor: value ? color : T.border, borderBottomWidth: 4, borderBottomColor: value ? `${color}aa` : T.border, transform: [{ translateY: pressed ? 2 : 0 }] }]}><Animated.View style={{ width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: value ? color : T.white, borderWidth: value ? 0 : 1, borderColor: T.border, transform: [{ translateX }] }}>{value ? <Ionicons name="checkmark" size={14} color={T.white} /> : null}</Animated.View></Pressable>;
}

const celebrationBits = [
  { color: T.pink, x: -122, y: -108, rotation: "-38deg", width: 12, height: 22 },
  { color: T.orange, x: -70, y: -152, rotation: "26deg", width: 11, height: 18 },
  { color: T.blue, x: 76, y: -146, rotation: "35deg", width: 12, height: 22 },
  { color: T.purple, x: 128, y: -82, rotation: "-24deg", width: 10, height: 20 },
  { color: T.green, x: -143, y: -34, rotation: "42deg", width: 13, height: 18 },
  { color: T.yellow, x: 145, y: -20, rotation: "-34deg", width: 12, height: 18 },
  { color: T.red, x: -92, y: 48, rotation: "18deg", width: 10, height: 20 },
  { color: T.teal, x: 87, y: 55, rotation: "-44deg", width: 12, height: 19 }
];

function PartyCreatedCelebration({ party, onShare, onContinue, onClose }: { party: { id: string; code: string; name: string } | null; onShare: () => void; onContinue: () => void; onClose: () => void }) {
  const reveal = useRef(new Animated.Value(0)).current;
  const burst = useRef(celebrationBits.map(() => new Animated.Value(0))).current;
  const [reduceMotion, setReduceMotion] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => { if (active) setReduceMotion(enabled); });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => { active = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    if (!party) { setShowConfetti(false); return; }
    if (reduceMotion) { reveal.setValue(1); burst.forEach((value) => value.setValue(0)); setShowConfetti(false); return; }
    let active = true;
    reveal.setValue(0);
    burst.forEach((value) => value.setValue(0));
    setShowConfetti(true);
    haptic();
    const celebration = Animated.parallel([
      Animated.spring(reveal, { toValue: 1, damping: 15, stiffness: 180, mass: 0.78, useNativeDriver: true }),
      Animated.stagger(34, burst.map((value) => Animated.timing(value, { toValue: 1, duration: 460, easing: Easing.out(Easing.cubic), useNativeDriver: true })))
    ]);
    celebration.start(({ finished }) => { if (active && finished) setShowConfetti(false); });
    return () => { active = false; celebration.stop(); };
  }, [burst, party, reduceMotion, reveal]);

  return <Modal visible={party !== null} transparent animationType={reduceMotion ? "none" : "fade"} onRequestClose={onClose}><View style={{ flex: 1, backgroundColor: "rgba(61,52,56,0.54)", justifyContent: "flex-end" }}><View accessibilityViewIsModal style={{ minHeight: "77%", backgroundColor: T.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden", paddingHorizontal: 24, paddingTop: 18, paddingBottom: 34 }}><View style={{ alignItems: "center", paddingBottom: 8 }}><View style={{ width: 38, height: 4, borderRadius: 99, backgroundColor: T.border }} /></View><Pressable accessibilityRole="button" accessibilityLabel="Close Party created" onPress={onClose} style={{ alignSelf: "flex-end", width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: T.white, borderWidth: 2, borderColor: T.border }}><Ionicons name="close" size={21} color={T.muted} /></Pressable><View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: 14 }}>{showConfetti ? <View pointerEvents="none" style={{ position: "absolute", width: 1, height: 1, top: "39%" }}>{celebrationBits.map((bit, index) => { const value = burst[index]; return <Animated.View key={index} style={{ position: "absolute", width: bit.width, height: bit.height, borderRadius: 4, backgroundColor: bit.color, opacity: value.interpolate({ inputRange: [0, 0.16, 0.72, 1], outputRange: [0, 1, 1, 0] }), transform: [{ translateX: value.interpolate({ inputRange: [0, 1], outputRange: [0, bit.x] }) }, { translateY: value.interpolate({ inputRange: [0, 1], outputRange: [0, bit.y] }) }, { rotate: value.interpolate({ inputRange: [0, 1], outputRange: ["0deg", bit.rotation] }) }, { scale: value.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0.25, 1.08, 1] }) }] }} />; })}</View> : null}<Animated.View style={{ alignItems: "center", opacity: reveal, transform: [{ scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }) }, { translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }}><View style={{ width: 104, height: 104, borderRadius: 32, backgroundColor: `${T.blue}18`, borderWidth: 3, borderColor: T.blue, borderBottomWidth: 7, borderBottomColor: "#258fd8", alignItems: "center", justifyContent: "center" }}><Ionicons name="people" size={45} color={T.blue} /><View style={{ position: "absolute", right: -8, top: -8, width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: T.yellow, borderWidth: 2, borderColor: T.bg }}><Ionicons name="sparkles" size={17} color={T.dark} /></View></View><Text style={{ color: T.dark, marginTop: 24, fontSize: 29, lineHeight: 34, fontWeight: "900", textAlign: "center" }}>Your Party is live!</Text><Text style={{ color: T.muted, marginTop: 8, fontSize: 15, lineHeight: 22, fontWeight: "700", textAlign: "center" }}>{party?.name ?? "Your Party"} is ready for the crew.</Text><View style={{ width: "100%", marginTop: 24, padding: 15, borderRadius: 18, backgroundColor: T.white, borderWidth: 2, borderColor: T.border, borderBottomWidth: 5, borderBottomColor: T.border, alignItems: "center" }}><Text style={{ color: T.muted, fontSize: 11, fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase" }}>Party code</Text><Text selectable style={{ color: T.blue, marginTop: 4, fontSize: 27, fontWeight: "900", letterSpacing: 4 }}>{party?.code}</Text></View></Animated.View></View><View style={{ gap: 10 }}><SoftButton label="Share invite" icon="share-outline" inverse color={T.blue} onPress={onShare} /><PartyButton label="Continue to Party" icon="arrow-forward" color={T.blue} onPress={onContinue} /></View></View></View></Modal>;
}

function CreatePartySheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const { quests } = useContent();
  const { partyHub, startParty, saveParty } = useSocial();
  const [step, setStep] = useState<CreatorStep>("source");
  const [source, setSource] = useState<"template" | "custom" | null>(null);
  const [template, setTemplate] = useState<PartyTemplate | null>(null);
  const [selectedQuestIds, setSelectedQuestIds] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [rules, setRules] = useState<string[]>(["Be kind, cheer each other on."]);
  const [gameMode, setGameMode] = useState<PartyMode>("free_for_all");
  const [locationType, setLocationType] = useState<PartyLocationType>("flexible");
  const [locationLabel, setLocationLabel] = useState("");
  const [maxMembers, setMaxMembers] = useState<number | null>(6);
  const [memberInvites, setMemberInvites] = useState(false);
  const [photoProofMode, setPhotoProofMode] = useState<PartyProofMode>("disabled");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [sortBy, setSortBy] = useState("Best Match");
  const [filters, setFilters] = useState<PartyQuestFilters>({ duration: null, difficulty: null });
  const [questControl, setQuestControl] = useState<PartyQuestControl>(null);
  const [saving, setSaving] = useState(false);
  const [createdParty, setCreatedParty] = useState<{ id: string; code: string; name: string } | null>(null);

  const stage = step === "source"
    ? { number: 1, label: "Choose a path", color: T.purple, icon: "sparkles" as const }
    : step === "quests"
      ? { number: 2, label: "Pick your quests", color: T.blue, icon: "flag" as const }
      : { number: 3, label: "Make it yours", color: T.orange, icon: "people" as const };

  const activeFilterCount = [filters.duration, filters.difficulty].filter(Boolean).length;
  const visibleQuests = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const matching = quests.filter((quest) => {
      if (normalizedQuery && !`${quest.title} ${quest.description} ${quest.category}`.toLowerCase().includes(normalizedQuery)) return false;
      if (category !== "All" && quest.category !== category) return false;
      if (filters.difficulty && quest.difficulty !== filters.difficulty) return false;
      if (filters.duration === "Under 30min" && quest.timeMin >= 30) return false;
      if (filters.duration === "30-60min" && (quest.timeMin < 30 || quest.timeMin > 60)) return false;
      if (filters.duration === "1-2h" && (quest.timeMin < 60 || quest.timeMin > 120)) return false;
      if (filters.duration === "2h+" && quest.timeMin <= 120) return false;
      return true;
    });
    return sortPartyQuests(matching, sortBy).slice(0, 36);
  }, [category, filters, query, quests, sortBy]);
  const cleanUp = () => { setCreatedParty(null); setStep("source"); setSource(null); setTemplate(null); setSelectedQuestIds([]); setName(""); setGoal(""); setRules(["Be kind, cheer each other on."]); setPhotoUri(null); setQuery(""); setCategory("All"); setSortBy("Best Match"); setFilters({ duration: null, difficulty: null }); setQuestControl(null); onClose(); };
  const chooseSource = (next: "template" | "custom") => { setSource(next); setTemplate(null); setSelectedQuestIds([]); setQuery(""); setCategory("All"); setSortBy("Best Match"); setFilters({ duration: null, difficulty: null }); setQuestControl(null); setStep("quests"); };
  const choosePhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.78 });
    if (!result.canceled) setPhotoUri(result.assets[0]?.uri ?? null);
  };
  const create = async () => {
    const questIds = source === "template" ? template?.questIds ?? [] : selectedQuestIds;
    if (!name.trim() || !questIds.length) return;
    setSaving(true);
    try {
      const input: CreatePartyInput = { name: name.trim(), goal, maxMembers, memberInvitesEnabled: memberInvites, photoProofMode, gameMode, locationType, locationLabel, rules, questIds };
      const created = await startParty(input);
      if (photoUri) {
        const photoPath = await uploadPartyMedia(created.id, photoUri);
        await saveParty(created.id, { ...input, photoPath });
      }
      setCreatedParty({ id: created.id, code: created.code, name: name.trim() });
    } catch (error) {
      Alert.alert("Couldn’t create party", error instanceof Error ? error.message : "Please try again.");
    } finally { setSaving(false); }
  };
  const activeModeColor = T.blue;
  const decreaseMemberLimit = () => setMaxMembers((limit) => limit === null ? 20 : Math.max(2, limit - 1));
  const increaseMemberLimit = () => setMaxMembers((limit) => limit === null ? null : Math.min(20, limit + 1));
  const shareCreatedParty = () => { if (createdParty) Share.share({ message: `Join my QuestLife party “${createdParty.name}” with code ${createdParty.code}.` }); };
  const continueToCreatedParty = () => { const partyId = createdParty?.id; cleanUp(); if (partyId) router.push(`/party/${partyId}`); };

  return (
    <>
    <Sheet visible={visible && createdParty === null} onClose={cleanUp} maxHeight="92%" fillHeight>
      <View style={{ flex: 1, minHeight: 0 }}>
      <ScrollView style={{ flex: 1 }} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, paddingBottom: step === "quests" ? 28 : 24, gap: 18 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}><View style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: `${stage.color}18`, alignItems: "center", justifyContent: "center" }}><Ionicons name={stage.icon} size={21} color={stage.color} /></View><View><Text style={{ color: T.dark, fontSize: 23, fontWeight: "900" }}>Create a Party</Text><Text style={{ color: stage.color, fontSize: 11, fontWeight: "900", marginTop: 3, letterSpacing: 0.5, textTransform: "uppercase" }}>Step {stage.number} of 3 · {stage.label}</Text></View></View>
          <IconButton icon="close" label="Close create party" onPress={cleanUp} color={T.muted} />
        </View>
        <View style={{ height: 10, borderRadius: 99, backgroundColor: `${stage.color}20`, padding: 2 }}><View style={{ width: step === "source" ? "33%" : step === "quests" ? "66%" : "100%", height: 6, borderRadius: 99, backgroundColor: stage.color }} /></View>

        {step === "source" ? <>
          <Text style={{ color: T.dark, fontSize: 18, fontWeight: "900" }}>How do you want to begin?</Text>
          <Choice selected={source === "template"} title="Start with a template" body="Ready-made quest set." icon="sparkles" color={T.purple} onPress={() => chooseSource("template")} />
          <Choice selected={source === "custom"} title="Choose your own quests" body="Build your own set." icon="checkmark-circle" color={T.blue} onPress={() => chooseSource("custom")} />
        </> : null}

        {step === "quests" && source === "template" ? <>
          <Text style={{ color: T.dark, fontSize: 18, fontWeight: "900" }}>Pick a Party template</Text>
          {(partyHub?.templates ?? []).map((item) => <Choice key={item.id} selected={template?.id === item.id} title={item.title} body={item.subtitle} icon="sparkles" color={item.accentColor} onPress={() => setTemplate(item)} />)}
          {!partyHub?.templates.length ? <EmptyState emoji="✨" title="Templates are loading" body="Try again in a moment, or choose your own quests." /> : null}
        </> : null}

        {step === "quests" && source === "custom" ? <>
          <View style={{ gap: 3 }}><Text style={{ color: T.dark, fontSize: 19, fontWeight: "900" }}>Choose party quests</Text><Text style={{ color: T.muted, fontSize: 12, fontWeight: "700" }}>Tap quests to build your Party list.</Text></View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ flex: 1, height: 52, borderRadius: 26, borderWidth: 2, borderColor: T.border, backgroundColor: T.white, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", gap: 9, boxShadow: `3px 3px 0px ${T.border}` }}>
              <Ionicons name="search" size={17} color={T.muted} />
              <TextInput value={query} onChangeText={setQuery} placeholder="Search Quests" placeholderTextColor={T.muted} style={{ flex: 1, color: T.dark, fontFamily: "Rubik", fontSize: 15, lineHeight: 20, paddingVertical: 0, includeFontPadding: false, textAlignVertical: "center" }} />
            </View>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: questControl === "sort" }} accessibilityLabel="Sort quests" onPress={() => setQuestControl((current) => current === "sort" ? null : "sort")} style={({ pressed }) => [{ width: 48, height: 48, borderRadius: 24, backgroundColor: T.white, borderWidth: 2, borderColor: questControl === "sort" || sortBy !== "Best Match" ? T.blue : T.border, borderBottomWidth: questControl === "sort" || sortBy !== "Best Match" ? 4 : 2, borderBottomColor: questControl === "sort" || sortBy !== "Best Match" ? "#258fd8" : T.border, alignItems: "center", justifyContent: "center", boxShadow: `3px 3px 0px ${T.border}`, transform: [{ translateY: pressed ? 2 : 0 }] }]}><Ionicons name="swap-vertical" size={17} color={questControl === "sort" || sortBy !== "Best Match" ? T.blue : T.muted} /></Pressable>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: questControl === "filters" }} accessibilityLabel="Filter quests" onPress={() => setQuestControl((current) => current === "filters" ? null : "filters")} style={({ pressed }) => [{ width: 48, height: 48, borderRadius: 24, backgroundColor: T.white, borderWidth: 2, borderColor: questControl === "filters" || activeFilterCount ? T.cyan : T.border, borderBottomWidth: questControl === "filters" || activeFilterCount ? 4 : 2, borderBottomColor: questControl === "filters" || activeFilterCount ? "#0097c8" : T.border, alignItems: "center", justifyContent: "center", boxShadow: `3px 3px 0px ${T.border}`, transform: [{ translateY: pressed ? 2 : 0 }] }]}><Ionicons name="options-outline" size={18} color={questControl === "filters" || activeFilterCount ? T.cyan : T.muted} />{activeFilterCount ? <View style={{ position: "absolute", top: -5, right: -5, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: T.cyan, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 }}><Text style={{ color: T.white, fontSize: 10, fontWeight: "900" }}>{activeFilterCount}</Text></View> : null}</Pressable>
          </View>
          {questControl === "sort" ? <View style={{ gap: 9, padding: 12, borderRadius: 16, borderWidth: 2, borderColor: T.blue, borderBottomWidth: 5, borderBottomColor: "#258fd8", backgroundColor: T.white }}><Text style={{ color: T.blue, fontSize: 11, fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase" }}>Sort by</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{sortOptions.map((option) => { const selected = sortBy === option; return <Pressable key={option} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => { setSortBy(option); setQuestControl(null); }} style={{ borderRadius: 99, paddingHorizontal: 13, paddingVertical: 9, borderWidth: 2, borderColor: selected ? T.blue : T.border, borderBottomWidth: selected ? 4 : 2, borderBottomColor: selected ? "#258fd8" : T.border, backgroundColor: T.white }}><Text style={{ color: selected ? T.blue : T.muted, fontSize: 12, fontWeight: "900" }}>{option}</Text></Pressable>; })}</ScrollView></View> : null}
          {questControl === "filters" ? <View style={{ gap: 12, padding: 12, borderRadius: 16, borderWidth: 2, borderColor: T.cyan, borderBottomWidth: 5, borderBottomColor: "#0097c8", backgroundColor: T.white }}><View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Text style={{ color: T.cyan, fontSize: 11, fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase" }}>Filter quests</Text>{activeFilterCount ? <Pressable accessibilityRole="button" accessibilityLabel="Clear quest filters" onPress={() => setFilters({ duration: null, difficulty: null })}><Text style={{ color: T.cyan, fontSize: 11, fontWeight: "900" }}>Clear</Text></Pressable> : null}</View><View style={{ gap: 7 }}><Text style={{ color: T.muted, fontSize: 11, fontWeight: "900" }}>Duration</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{["Under 30min", "30-60min", "1-2h", "2h+"].map((duration) => { const selected = filters.duration === duration; return <Pressable key={duration} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={() => setFilters((current) => ({ ...current, duration: current.duration === duration ? null : duration }))} style={{ borderRadius: 99, paddingHorizontal: 13, paddingVertical: 8, borderWidth: 2, borderColor: selected ? T.cyan : T.border, borderBottomWidth: selected ? 4 : 2, borderBottomColor: selected ? "#0097c8" : T.border, backgroundColor: T.white }}><Text style={{ color: selected ? T.cyan : T.muted, fontSize: 11, fontWeight: "900" }}>{duration}</Text></Pressable>; })}</ScrollView></View><View style={{ gap: 7 }}><Text style={{ color: T.muted, fontSize: 11, fontWeight: "900" }}>Difficulty</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{questDifficulties.map((difficulty) => { const selected = filters.difficulty === difficulty; return <Pressable key={difficulty} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={() => setFilters((current) => ({ ...current, difficulty: current.difficulty === difficulty ? null : difficulty }))} style={{ borderRadius: 99, paddingHorizontal: 13, paddingVertical: 8, borderWidth: 2, borderColor: selected ? T.blue : T.border, borderBottomWidth: selected ? 4 : 2, borderBottomColor: selected ? "#258fd8" : T.border, backgroundColor: T.white }}><Text style={{ color: selected ? T.blue : T.muted, fontSize: 11, fontWeight: "900" }}>{difficulty}</Text></Pressable>; })}</ScrollView></View></View> : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
            {categories.map((item) => {
              const active = category === item;
              const tone = item === "All" ? undefined : categoryColor[item];
              return <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => setCategory(item)} style={({ pressed }) => [{ borderRadius: 99, paddingVertical: 9, paddingHorizontal: 15, backgroundColor: active ? tone?.text ?? T.dark : tone?.bg ?? T.white, borderWidth: 2, borderColor: active ? tone?.text ?? T.dark : tone?.bg ?? T.border, boxShadow: active ? "none" : `2px 2px 0px ${T.border}`, transform: [{ translateY: pressed ? 1 : 0 }] }]}><View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>{item === "All" ? <Ionicons name="apps" size={15} color={active ? T.white : T.muted} /> : <PartyCategoryIcon category={item} size={16} color={active ? T.white : tone?.text} />}<Text style={{ color: active ? T.white : tone?.text ?? T.muted, fontSize: 12, fontWeight: "900" }}>{item}</Text></View></Pressable>;
            })}
          </ScrollView>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: -4 }}><Text style={{ color: T.dark, fontSize: 15, fontWeight: "900" }}>{category === "All" ? "All quests" : category}</Text><Text style={{ color: T.muted, fontSize: 12, fontWeight: "800" }}>{visibleQuests.length} quests</Text></View>
          {visibleQuests.map((quest) => {
            const selected = selectedQuestIds.includes(quest.id);
            const colors = categoryColor[quest.category];
            return <Pressable key={quest.id} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} accessibilityLabel={`Add ${quest.title} to Party`} onPress={() => setSelectedQuestIds((prev) => selected ? prev.filter((id) => id !== quest.id) : [...prev, quest.id])} style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 11, padding: 13, borderRadius: 18, backgroundColor: selected ? `${T.blue}12` : T.white, borderWidth: 2, borderColor: selected ? T.blue : T.border, borderBottomWidth: 5, borderBottomColor: selected ? "#258fd8" : T.border, transform: [{ translateY: pressed ? 2 : 0 }] }]}><View style={{ width: 6, alignSelf: "stretch", borderRadius: 99, backgroundColor: colors.text }} /><View style={{ flex: 1, gap: 4 }}><Text style={{ color: T.dark, fontWeight: "900", fontSize: 16 }} numberOfLines={1}>{quest.title}</Text><View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}><Text style={{ color: colors.text, fontSize: 10, fontWeight: "900", letterSpacing: 0.35, textTransform: "uppercase" }}>{quest.category}</Text><Text style={{ color: T.muted, fontSize: 11, fontWeight: "800" }}>+{quest.xp} XP · {quest.timeMin} min</Text></View></View><Ionicons name={selected ? "checkmark-circle" : "add-circle-outline"} size={21} color={selected ? T.blue : T.muted} /></Pressable>;
          })}
          {!visibleQuests.length ? <EmptyState emoji="🔎" title="No quests found" body="Try another search, category, or filter." /> : null}
        </> : null}

        {step === "details" ? <>
          <DetailsReveal delay={0}><View style={{ flexDirection: "row", gap: 14, alignItems: "center", padding: 14, borderRadius: 20, backgroundColor: `${T.blue}0d`, borderWidth: 2, borderColor: `${T.blue}26` }}><Pressable accessibilityRole="button" accessibilityLabel="Choose Party photo" onPress={choosePhoto} style={({ pressed }) => [{ width: 70, height: 70, borderRadius: 22, borderWidth: 2, borderColor: `${T.blue}55`, backgroundColor: T.white, alignItems: "center", justifyContent: "center", overflow: "hidden", transform: [{ scale: pressed ? 0.94 : 1 }] }]}>{photoUri ? <Image source={{ uri: photoUri }} style={{ width: "100%", height: "100%" }} /> : <><Ionicons name="camera" size={23} color={T.blue} /><View style={{ position: "absolute", width: 21, height: 21, right: -2, bottom: -2, borderRadius: 11, backgroundColor: T.blue, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: T.bg }}><Ionicons name="add" size={13} color={T.white} /></View></>}</Pressable><View style={{ flex: 1, gap: 3 }}><Text style={{ color: T.dark, fontSize: 17, fontWeight: "900" }}>Make it feel like yours</Text><Text style={{ color: T.muted, fontSize: 12, lineHeight: 17, fontWeight: "700" }}>Add a photo, name your crew, then set the way you play.</Text></View></View></DetailsReveal>
          <DetailsReveal delay={35}><View style={{ gap: 12 }}><PartyNameField value={name} onChangeText={setName} /><Field label="Party goal" value={goal} onChangeText={setGoal} placeholder="What are you doing together?" multiline /></View></DetailsReveal>

          <SetupSection title="Choose your mode" kind="mode" color={T.green} delay={70}>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {([{ id: "free_for_all", title: "Free for All", detail: "Any quest · base XP", icon: "rocket", color: T.pink }, { id: "everyone_together", title: "Everyone Together", detail: "Host starts · speed bonus", icon: "people", color: T.purple }] as const).map((mode) => {
                const selected = gameMode === mode.id;
                return <Pressable key={mode.id} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => setGameMode(mode.id)} style={({ pressed }) => [{ flex: 1, minHeight: 116, borderRadius: 18, padding: 12, justifyContent: "space-between", backgroundColor: selected ? `${mode.color}14` : T.white, borderWidth: 2, borderColor: selected ? mode.color : T.border, borderBottomWidth: selected ? 5 : 3, borderBottomColor: selected ? `${mode.color}aa` : T.border, transform: [{ translateY: pressed ? 2 : 0 }] }]}><View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><View style={{ width: 31, height: 31, borderRadius: 11, backgroundColor: `${mode.color}1c`, alignItems: "center", justifyContent: "center" }}><Ionicons name={mode.icon} size={16} color={mode.color} /></View><Ionicons name={selected ? "radio-button-on" : "radio-button-off"} size={18} color={selected ? mode.color : T.muted} /></View><View><Text style={{ color: T.dark, fontSize: 13, fontWeight: "900" }}>{mode.title}</Text><Text style={{ color: selected ? mode.color : T.muted, fontSize: 10, fontWeight: "800", marginTop: 3 }}>{mode.detail}</Text></View></Pressable>;
              })}
            </View>
          </SetupSection>

          <SetupSection title="Set the crew size" detail="Choose a cap or leave it open." kind="limit" color={T.orange} delay={105}>
            <View style={{ minHeight: 78, borderRadius: 18, borderWidth: 2, borderColor: T.border, backgroundColor: T.white, flexDirection: "row", alignItems: "center", padding: 10, gap: 12 }}>
              <Pressable accessibilityRole="button" accessibilityLabel="Decrease member limit" accessibilityState={{ disabled: maxMembers === 2 }} disabled={maxMembers === 2} onPress={decreaseMemberLimit} style={({ pressed }) => [{ width: 48, height: 48, borderRadius: 16, borderWidth: 2, borderColor: maxMembers === 2 ? T.border : activeModeColor, backgroundColor: maxMembers === 2 ? T.bg : `${activeModeColor}14`, alignItems: "center", justifyContent: "center", opacity: maxMembers === 2 ? 0.55 : 1, transform: [{ translateY: pressed && maxMembers !== 2 ? 2 : 0 }] }]}><Ionicons name="remove" size={22} color={maxMembers === 2 ? T.muted : activeModeColor} /></Pressable>
              <View style={{ flex: 1, alignItems: "center" }}><Text style={{ color: T.dark, fontSize: 28, lineHeight: 31, fontWeight: "900" }}>{maxMembers ?? "∞"}</Text><Text style={{ color: T.muted, fontSize: 10, fontWeight: "900", letterSpacing: 0.5, textTransform: "uppercase" }}>{maxMembers === 1 ? "member" : "members"}</Text></View>
              <Pressable accessibilityRole="button" accessibilityLabel="Increase member limit" accessibilityState={{ disabled: maxMembers === null || maxMembers === 20 }} disabled={maxMembers === null || maxMembers === 20} onPress={increaseMemberLimit} style={({ pressed }) => [{ width: 48, height: 48, borderRadius: 16, borderWidth: 2, borderColor: maxMembers === null || maxMembers === 20 ? T.border : activeModeColor, backgroundColor: maxMembers === null || maxMembers === 20 ? T.bg : activeModeColor, alignItems: "center", justifyContent: "center", opacity: maxMembers === null || maxMembers === 20 ? 0.55 : 1, transform: [{ translateY: pressed && maxMembers !== null && maxMembers !== 20 ? 2 : 0 }] }]}><Ionicons name="add" size={22} color={maxMembers === null || maxMembers === 20 ? T.muted : T.white} /></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={maxMembers === null ? "Use a member limit" : "Set no member limit"} onPress={() => setMaxMembers((limit) => limit === null ? 6 : null)} style={({ pressed }) => [{ minHeight: 48, paddingHorizontal: 12, borderRadius: 16, borderWidth: 2, borderColor: maxMembers === null ? activeModeColor : T.border, backgroundColor: maxMembers === null ? `${activeModeColor}14` : T.white, alignItems: "center", justifyContent: "center", transform: [{ translateY: pressed ? 2 : 0 }] }]}><Text style={{ color: maxMembers === null ? activeModeColor : T.muted, fontSize: 11, fontWeight: "900" }}>{maxMembers === null ? "Limited" : "No limit"}</Text></Pressable>
            </View>
          </SetupSection>

          <DetailsReveal delay={140}><View style={{ gap: 8 }}><View style={{ minHeight: 58, borderRadius: 18, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", backgroundColor: memberInvites ? `${activeModeColor}10` : T.white, borderWidth: 2, borderColor: memberInvites ? activeModeColor : T.border }}><Text style={{ color: T.dark, flex: 1, fontSize: 15, fontWeight: "900" }}>Members can invite friends</Text><PartyToggle value={memberInvites} color={activeModeColor} label="Members can invite friends" onPress={() => setMemberInvites((enabled) => !enabled)} /></View><View style={{ gap: 9, padding: 14, borderRadius: 18, backgroundColor: T.white, borderWidth: 2, borderColor: photoProofMode === "required" ? T.orange : T.border }}><View><Text style={{ color: T.dark, fontSize: 15, fontWeight: "900" }}>Photo proof</Text><Text style={{ color: T.muted, marginTop: 2, fontSize: 12, fontWeight: "700" }}>Required proof is shared to the Party Feed.</Text></View><View style={{ flexDirection: "row", gap: 7 }}>{(["disabled", "optional", "required"] as PartyProofMode[]).map((mode) => { const selected = photoProofMode === mode; return <Pressable key={mode} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => setPhotoProofMode(mode)} style={({ pressed }) => [{ flex: 1, minHeight: 38, borderRadius: 13, borderWidth: 2, borderColor: selected ? T.orange : T.border, borderBottomWidth: selected ? 4 : 2, borderBottomColor: selected ? "#cf7500" : T.border, alignItems: "center", justifyContent: "center", backgroundColor: T.white, transform: [{ translateY: pressed ? 2 : 0 }] }]}><Text style={{ color: selected ? T.orange : T.muted, fontSize: 10, fontWeight: "900", textTransform: "capitalize" }}>{mode}</Text></Pressable>; })}</View></View></View></DetailsReveal>

          <SetupSection title="Choose your Party rules" kind="rules" color={T.red} delay={175}>
            {rules.map((rule, index) => <View key={index} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><View style={{ flex: 1, minHeight: 52, borderWidth: 2, borderColor: T.border, borderRadius: 16, backgroundColor: T.white, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 }}><Ionicons name="checkmark-circle" size={16} color={T.red} /><TextInput value={rule} onChangeText={(text) => setRules((previous) => previous.map((item, itemIndex) => itemIndex === index ? text : item))} placeholder="Add a rule" placeholderTextColor={T.muted} style={{ flex: 1, color: T.dark, fontWeight: "800" }} /></View><IconButton icon="close" label="Remove rule" color={T.muted} onPress={() => setRules((previous) => previous.filter((_, itemIndex) => itemIndex !== index))} /></View>)}
            <SoftButton label="Add rule" icon="add" inverse color={T.muted} onPress={() => setRules((previous) => [...previous, ""])} />
          </SetupSection>

          <DetailsReveal delay={210}><View style={{ gap: 10, paddingTop: 4 }}><PartyButton label={saving ? "Creating…" : "Create Party"} icon="sparkles" color={activeModeColor} onPress={saving ? undefined : create} disabled={!name.trim() || saving} /><SoftButton label="Back" inverse color={T.muted} onPress={() => setStep("quests")} /></View></DetailsReveal>
        </> : null}
      </ScrollView>
      {step === "quests" ? <View style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 18, gap: 9, borderTopWidth: 2, borderTopColor: T.border, backgroundColor: T.white, boxShadow: "0px -5px 10px rgba(61,52,56,0.06)" }}>
        <PartyButton label={source === "custom" ? `Continue${selectedQuestIds.length ? ` (${selectedQuestIds.length})` : ""}` : "Continue"} icon="arrow-forward" onPress={() => source === "template" ? template && setStep("details") : selectedQuestIds.length && setStep("details")} disabled={source === "template" ? !template : !selectedQuestIds.length} />
        <SoftButton label="Back" inverse color={T.muted} onPress={() => setStep("source")} />
      </View> : null}
      </View>
    </Sheet>
    <PartyCreatedCelebration party={createdParty} onShare={shareCreatedParty} onContinue={continueToCreatedParty} onClose={cleanUp} />
    </>
  );
}

export function SocialScreen() {
  const router = useRouter();
  const { contentWidth, horizontalPadding, safeAreaOffset } = useResponsiveScreenLayout();
  const { quests } = useContent();
  const { overview, partyHub, loading, error, refresh, respondRequest, challengeFriend, shareQuestWith, respondToPartyInvite, joinPartyWithCode } = useSocial();
  const [tab, setTab] = useState<Tab>("friends");
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState("");
  const [actionFriend, setActionFriend] = useState<SocialFriend | null>(null);
  const [actionQuest, setActionQuest] = useState<string>("");

  const join = async () => { try { const partyId = await joinPartyWithCode(code); setCodeOpen(false); setCode(""); router.push(`/party/${partyId}`); } catch (nextError) { Alert.alert("Couldn’t join Party", nextError instanceof Error ? nextError.message : "Check the code and try again."); } };

  return (
    <Screen padded={false} contentStyle={{ alignItems: "center" }}>
      <View style={{ width: contentWidth, paddingHorizontal: horizontalPadding, gap: 16, transform: [{ translateX: safeAreaOffset }] }}>
        <Header title="Social" subtitle={tab === "parties" ? "Party up" : "Your quest crew"} animated={false} right={tab === "parties" ? <IconButton icon="information-circle-outline" label="How Parties work" onPress={() => setInfoOpen(true)} color={T.blue} /> : <IconButton icon="search" label="Search and add friends" onPress={() => router.push("/add-friends")} color={T.blue} />} />
        <View style={{ flexDirection: "row", padding: 4, borderRadius: 24, backgroundColor: T.white, borderWidth: 2, borderColor: T.border }}>
          {(["friends", "parties"] as Tab[]).map((item) => <Pressable key={item} onPress={() => setTab(item)} style={{ flex: 1, minHeight: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: tab === item ? T.dark : "transparent" }}><Text style={{ color: tab === item ? T.white : T.muted, fontSize: 13, fontWeight: "900", textTransform: "capitalize" }}>{item}</Text></Pressable>)}
        </View>
        {error ? <Card style={{ borderRadius: 20, gap: 8 }}><Text style={{ color: T.red, fontWeight: "800" }}>{error}</Text><SoftButton label="Retry" icon="refresh" inverse color={T.blue} onPress={refresh} /></Card> : null}

        {tab === "friends" ? <View style={{ gap: 14 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Find and add friends" onPress={() => router.push("/add-friends")} style={({ pressed }) => ({ minHeight: 94, borderRadius: 22, borderWidth: 2, borderColor: `${T.blue}55`, borderBottomWidth: 5, borderBottomColor: "#a8d8ff", backgroundColor: `${T.blue}12`, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, transform: [{ translateY: pressed ? 3 : 0 }] })}>
            <View style={{ width: 48, height: 48, borderRadius: 17, backgroundColor: T.blue, alignItems: "center", justifyContent: "center" }}><Ionicons name="person-add" size={23} color={T.white} /></View>
            <View style={{ flex: 1, gap: 3 }}><Text style={{ color: T.dark, fontSize: 16, fontWeight: "900" }}>Grow your crew</Text><Text style={{ color: T.muted, fontSize: 12, lineHeight: 17, fontWeight: "700" }}>Find people, connect contacts, or scan a QR code.</Text></View>
            <Ionicons name="chevron-forward" size={21} color={T.blue} />
          </Pressable>
          {overview?.incomingRequests.length ? <View style={{ gap: 10 }}><SectionTitle title="Friend requests" />{overview.incomingRequests.map((request) => <Card key={request.id} style={{ borderRadius: 20, flexDirection: "row", alignItems: "center", gap: 10, padding: 12, boxShadow: "none" }}><Avatar emoji={request.emoji} color={request.avatarColor} size={36} /><Text style={{ flex: 1, color: T.dark, fontWeight: "900" }}>{request.displayName}</Text><PartyButton label="Accept" onPress={() => respondRequest(request.id, true)} color={T.green} compact /></Card>)}</View> : null}
          <SectionTitle title={`Friends (${overview?.friends.length ?? 0})`} />
          {loading && !overview ? <EmptyState emoji="⏳" title="Loading friends" body="Finding your crew…" /> : overview?.friends.length ? overview.friends.map((friend) => <FriendRow key={friend.userId} friend={friend} onShare={() => setActionFriend(friend)} onChallenge={() => setActionFriend(friend)} />) : <EmptyState emoji="🤝" title="No friends yet" body="Use the add button to find your first adventure buddy." />}
        </View> : <View style={{ gap: 18 }}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <ActionTile icon="mail-unread-outline" title="Party Invites" color={T.purple} badge={overview?.partyInvites.length} onPress={() => setInviteOpen(true)} />
            <ActionTile icon="key-outline" title="Join with a Code" color={T.blue} onPress={() => setCodeOpen(true)} />
          </View>
          <PartyButton label="Create a Party" icon="add" onPress={() => setCreatorOpen(true)} />
          <View style={{ gap: 10 }}><SectionTitle title="Active Parties" detail={`${partyHub?.active.length ?? 0}`} />
            {loading && !partyHub ? <EmptyState emoji="⏳" title="Loading Parties" body="Finding your people…" /> : partyHub?.active.length ? partyHub.active.map((party) => <PartyCard key={party.id} party={party} />) : <EmptyState emoji="🎉" title="Start your first Party" body="Pick quests. Invite your people." />}
          </View>
          <View style={{ gap: 10 }}><SectionTitle title="Past Parties" />
            {partyHub?.past.length ? partyHub.past.map((party) => <PartyCard key={party.id} party={party} />) : <Text style={{ color: T.muted, fontSize: 13, lineHeight: 19, fontWeight: "700" }}>Finished Parties appear here.</Text>}
          </View>
        </View>}
      </View>

      <CreatePartySheet visible={creatorOpen} onClose={() => setCreatorOpen(false)} />
      <Sheet visible={infoOpen} onClose={() => setInfoOpen(false)}><View style={{ padding: 24, gap: 14 }}><View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><Text style={{ color: T.dark, fontSize: 22, fontWeight: "900" }}>How Parties work</Text><IconButton icon="close" label="Close Party information" onPress={() => setInfoOpen(false)} color={T.muted} /></View><Text style={{ color: T.muted, fontSize: 14, lineHeight: 21, fontWeight: "700" }}>Pick quests. Bring your people. Earn XP together.</Text><Choice selected title="Free for All" body="Any Party quest · base XP ranks." icon="walk" color={T.blue} onPress={() => undefined} /><Choice selected title="Everyone Together" body="Host starts · fastest earns more." icon="people" color={T.purple} onPress={() => undefined} /></View></Sheet>
      <Sheet visible={inviteOpen} onClose={() => setInviteOpen(false)}><ScrollView contentContainerStyle={{ padding: 24, gap: 14 }}><View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Text style={{ color: T.dark, fontSize: 22, fontWeight: "900" }}>Party Invites</Text><IconButton icon="close" label="Close Party Invites" onPress={() => setInviteOpen(false)} color={T.muted} /></View>{overview?.partyInvites.length ? overview.partyInvites.map((invite) => <Card key={invite.id} style={{ borderRadius: 20, gap: 12, boxShadow: "none", borderBottomWidth: 5, borderBottomColor: T.border }}><Text style={{ color: T.dark, fontSize: 16, fontWeight: "900" }}>{invite.senderName} invited you to {invite.partyName}</Text><View style={{ flexDirection: "row", gap: 10 }}><PartyButton label="Accept" onPress={() => respondToPartyInvite(invite.id, true).then(() => setInviteOpen(false))} color={T.green} compact style={{ flex: 1 }} /><SoftButton label="Decline" inverse color={T.muted} onPress={() => respondToPartyInvite(invite.id, false)} style={{ flex: 1, minHeight: 42 }} /></View></Card>) : <EmptyState emoji="✉️" title="No pending invites" body="Invites land here." />}</ScrollView></Sheet>
      <Sheet visible={codeOpen} onClose={() => setCodeOpen(false)}><View style={{ padding: 24, gap: 16 }}><View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Text style={{ color: T.dark, fontSize: 22, fontWeight: "900" }}>Enter Party code</Text><IconButton icon="close" label="Close join Party" onPress={() => setCodeOpen(false)} color={T.muted} /></View><TextInput autoCapitalize="characters" value={code} onChangeText={setCode} placeholder="ABC123" placeholderTextColor={T.muted} maxLength={6} style={{ height: 64, borderRadius: 18, borderWidth: 2, borderColor: T.border, color: T.dark, backgroundColor: T.white, textAlign: "center", fontSize: 25, letterSpacing: 4, fontWeight: "900" }} /><PartyButton label="Find Party" icon="search" onPress={join} disabled={code.trim().length !== 6} /></View></Sheet>
      <Sheet visible={actionFriend !== null} onClose={() => { setActionFriend(null); setActionQuest(""); }}><View style={{ padding: 24, gap: 12 }}><Text style={{ color: T.dark, fontSize: 20, fontWeight: "900" }}>Send to {actionFriend?.displayName}</Text>{quests.slice(0, 6).map((quest) => <Pressable key={quest.id} onPress={() => setActionQuest(quest.id)} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 }}><Ionicons name={actionQuest === quest.id ? "radio-button-on" : "radio-button-off"} size={18} color={T.blue} /><Text style={{ color: T.dark, fontWeight: "800" }}>{quest.title}</Text></Pressable>)}<SoftButton label="Share quest" icon="paper-plane" onPress={() => { if (actionFriend && actionQuest) shareQuestWith(actionFriend.userId, actionQuest); setActionFriend(null); }} /><SoftButton label="Challenge friend" icon="flash" inverse color={T.orange} onPress={() => { if (actionFriend && actionQuest) challengeFriend(actionFriend.userId, actionQuest); setActionFriend(null); }} /></View></Sheet>
    </Screen>
  );
}
