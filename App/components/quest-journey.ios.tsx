import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Svg, { Circle, Line, Polyline } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";
import { T } from "./theme";
import { MoodForm } from "./journal-mood-check-in.ios";
import { QuestNotification, QuestSectionPlaceholder, QuestVideoMoment } from "./quest-activity-ui.ios";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveQuest } from "@/contexts/ActiveQuestContext";
import { useActiveQuestElapsedDuration } from "@/hooks/useElapsedTime";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { availablePrompts, activeElapsedMs, emptyJourney, type QuestJourney, type JourneyEvent, type QuestPrompt } from "@/services/active-quest/journey-model";
import { dismissJourneyPrompt } from "@/services/active-quest/local-store.ios";
import { saveJourneyEvent, syncQuestJourney, fetchCompletedQuestJourney } from "@/services/active-quest/journey.ios";
import { toLocalDateKey } from "@/services/journal/journalService";

const labels = { sad: "Low", neutral: "Okay", happy: "Good" };
const ranks = { sad: 0, neutral: 1, happy: 2 };
const card = { padding: 18, borderRadius: 24, borderWidth: 1.5, borderColor: T.border, backgroundColor: T.white, gap: 12 } as const;

export function QuestMoodGraph({ events }: { events: JourneyEvent[] }) {
  const moods = events.filter(e => e.kind === "mood" && e.mood).sort((a, b) => a.activeElapsedMs - b.activeElapsedMs);
  const [selected, setSelected] = useState<string | null>(null);
  if (!moods.length) return null;
  const maximum = Math.max(600_000, moods.at(-1)!.activeElapsedMs);
  const x = (e: JourneyEvent) => 56 + e.activeElapsedMs / maximum * 244;
  const y = (e: JourneyEvent) => 110 - ranks[e.mood!] * 44;
  const focused = moods.find(e => e.id === selected) ?? moods.at(-1)!;
  return <View style={card}>
    <Text style={{ color: T.dark, fontFamily: "RubikBold", fontSize: 18 }}>Your mood journey</Text>
    <View style={{ width: "100%", aspectRatio: 320 / 145 }}>
      <Svg width="100%" height="100%" viewBox="0 0 320 145" accessible={false}>
        {[22, 66, 110].map(row => <Line key={row} x1={56} x2={305} y1={row} y2={row} stroke={T.border} strokeDasharray="3 5" />)}
        <Polyline points={moods.map(e => `${x(e)},${y(e)}`).join(" ")} fill="none" stroke="#8B79B6" strokeWidth={2.5} />
        {moods.map(e => <Circle key={e.id} cx={x(e)} cy={y(e)} r={e.id === focused.id ? 7 : 5} fill={e.mood === "sad" ? "#FF856F" : e.mood === "neutral" ? "#F7CA55" : "#C9E47B"} stroke="#302358" strokeWidth={1.5} />)}
      </Svg>
      <View pointerEvents="none" style={{ position: "absolute", top: "8%", bottom: "22%", left: 0, justifyContent: "space-between" }}>{["Good", "Okay", "Low"].map(label => <Text key={label} style={{ color: T.muted, fontFamily: "Rubik", fontSize: 11 }}>{label}</Text>)}</View>
    </View>
    <Text accessibilityLiveRegion="polite" style={{ color: T.dark, fontFamily: "Rubik" }}>{labels[focused.mood!]} · {focused.activeElapsedMs === 0 ? "At the start" : `${Math.floor(focused.activeElapsedMs / 60000)} active minutes`}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {moods.map(e => <Pressable key={e.id} accessibilityRole="button" accessibilityLabel={`${labels[e.mood!]} at ${Math.floor(e.activeElapsedMs / 60000)} active minutes`} accessibilityState={{ selected: focused.id === e.id }} onPress={() => setSelected(e.id)} style={{ minHeight: 44, paddingHorizontal: 12, borderRadius: 16, justifyContent: "center", backgroundColor: focused.id === e.id ? "#E5DEFF" : T.raised }}><Text style={{ color: "#302358", fontFamily: "RubikBold", fontSize: 12 }}>{Math.floor(e.activeElapsedMs / 60000)}m · {labels[e.mood!]}</Text></Pressable>)}
    </ScrollView>
  </View>;
}

export function QuestJourneyVideos({ events, accent = T.blue, recent = false, loading = false }: { events: JourneyEvent[]; accent?: string; recent?: boolean; loading?: boolean }) {
  const videos = events.filter(e => e.kind === "video").sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
  if (!recent && !videos.length) return null;
  const visible = recent ? videos.slice(0, 6) : videos;
  return <View style={{ gap: 11 }}>
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}><Text style={{ color: T.dark, fontFamily: "RubikBlack", fontSize: 20 }}>{recent ? "Recent videos" : "Video moments"}</Text><Text style={{ color: T.muted, fontFamily: "RubikBold", fontSize: 12 }}>{loading ? "Loading…" : videos.length ? `${videos.length} captured` : "No videos yet"}</Text></View>
    {loading || !videos.length ? <QuestSectionPlaceholder accent={accent} icon="videocam-outline" title="No videos yet" detail="Capture a short clip to bring your quest to life." loading={loading} /> : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 4 }}>{visible.map(video => <QuestVideoMoment key={video.id} event={video} accent={accent} tile />)}</ScrollView>}
  </View>;
}

export function QuestTimelineXpPill({ event, accent }: { event?: JourneyEvent; accent: string }) {
  const pending = Boolean(event?.prompt && event.syncState !== "synced" && !event.xp);
  if (!event || (!event.xp && !pending)) return null;
  return <View style={{ flexShrink: 0, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: `${accent}14`, borderWidth: 1, borderColor: `${accent}30` }}><Text style={{ color: accent, fontFamily: "RubikBold", fontSize: 10 }}>{pending ? "XP pending" : `+${event.xp} XP`}</Text></View>;
}

export function QuestJourneyTimelineRow({ event, accent, last = false }: { event: JourneyEvent; accent: string; last?: boolean }) {
  const label = event.kind === "video" ? "Quest video" : "Mood check-in";
  const icon = event.kind === "video" ? "videocam" : "happy-outline";
  return <View style={{ flexDirection: "row", alignItems: "stretch", gap: 10, marginHorizontal: 16 }}>
    <View style={{ width: 56, alignItems: "flex-end", paddingTop: 12 }}><Text style={{ color: T.muted, fontSize: 11, lineHeight: 15, fontWeight: "900" }}>{new Date(event.capturedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</Text></View>
    <View style={{ width: 18, alignItems: "center" }}>{!last && <View style={{ position: "absolute", top: 25, bottom: -28, width: 2, backgroundColor: `${accent}26` }} />}<View style={{ width: 18, height: 18, marginTop: 10, borderRadius: 9, backgroundColor: accent, borderWidth: 3, borderColor: T.bg }} /></View>
    <View style={{ flex: 1, overflow: "hidden", borderRadius: 20, padding: 15, gap: 10, backgroundColor: T.white, borderWidth: 1, borderColor: T.border, boxShadow: "0px 3px 10px rgba(61,52,56,0.08)" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}><View style={{ width: 26, height: 26, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: `${accent}16` }}><Ionicons name={icon} size={14} color={accent} /></View><Text style={{ flex: 1, color: T.muted, fontFamily: "RubikBold", fontSize: 11, lineHeight: 15, letterSpacing: 0.35, textTransform: "uppercase" }}>{label}</Text><QuestTimelineXpPill event={event} accent={accent} /></View>
      {event.kind === "video" ? <>{event.body ? <Text style={{ color: T.dark, fontFamily: "Rubik", fontSize: 16, lineHeight: 23 }}>{event.body}</Text> : null}<QuestVideoMoment event={event} accent={accent} /></> : <Text style={{ color: T.dark, fontFamily: "Rubik", fontSize: 16 }}>Feeling {event.mood ? labels[event.mood].toLowerCase() : "checked in"}</Text>}
    </View>
  </View>;
}

export function QuestJourneyPanel({ accent, suppressed, onCapture, onNote }: { accent: string; suppressed: boolean; onCapture: (prompt: QuestPrompt) => void; onNote: (prompt: QuestPrompt) => void }) {
  const { user } = useAuth();
  const { snapshot } = useActiveQuest();
  const elapsed = useActiveQuestElapsedDuration(snapshot?.session);
  const reduced = useReducedMotionPreference();
  const [moodOpen, setMoodOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  if (!snapshot || !user) return null;
  const journey = snapshot.session.journey ?? emptyJourney();
  const prompts = availablePrompts(elapsed, journey);
  const moodBonusAvailable = prompts.some(prompt => prompt.kind === "mood");
  const moodNotificationId = prompts.find(prompt => prompt.kind === "mood")?.id ?? "mood:anytime";
  const pending = journey.events.some(e => e.syncState !== "synced");
  const xp = journey.events.reduce((sum, e) => sum + e.xp, 0);
  async function retry() {
    if (!snapshot || retrying) return;
    setRetrying(true); setError(null);
    try { await syncQuestJourney(snapshot.session.sessionId); }
    catch { setError("Your moments are safe on this device. Sync couldn’t finish; try again when connected."); }
    finally { setRetrying(false); }
  }
  async function dismiss(id: string) {
    try { await dismissJourneyPrompt(snapshot!.session.sessionId, id); }
    catch { setError("Couldn’t dismiss this suggestion. Try again."); }
  }
  const showMood = !journey.dismissed.includes(moodNotificationId);
  const creativePrompts = snapshot.session.recordingState === "recording" ? prompts.filter(prompt => prompt.kind !== "mood") : [];
  if (suppressed || (!showMood && !creativePrompts.length && !xp && !pending && !error && !moodOpen)) return null;
  return <View style={{ gap: 12 }}>
    {showMood && <QuestNotification title="Mood check-in" detail={moodBonusAvailable ? "How are you feeling? · +5 XP" : "How are you feeling? · Check in anytime"} icon="happy-outline" accent={accent} onOpen={() => setMoodOpen(true)} onDismiss={() => dismiss(moodNotificationId)} />}
    {creativePrompts.map(prompt => <Animated.View key={prompt.id} entering={FadeIn.duration(reduced ? 120 : 180)} layout={reduced ? undefined : LinearTransition.duration(180)}>
      <QuestNotification title={prompt.kind === "capture" ? "Capture a little moment" : "Write a quick note"} detail={`${prompt.kind === "capture" ? "Photo or video" : "A sentence is enough"} · +10 XP`} icon={prompt.kind === "capture" ? "camera-outline" : "create-outline"} accent={accent} onOpen={() => prompt.kind === "capture" ? onCapture(prompt) : onNote(prompt)} onDismiss={() => dismiss(prompt.id)} />
    </Animated.View>)}
    {xp > 0 || pending ? <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Text accessibilityLiveRegion="polite" style={{ flex: 1, color: T.muted, fontFamily: "Rubik", fontSize: 12 }}>{xp > 0 ? `+${xp} bonus XP earned` : "Moments saved"}{pending ? " · Sync / XP pending" : ""}</Text>{pending ? <Pressable accessibilityRole="button" disabled={retrying} onPress={() => void retry()} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: T.dark, fontFamily: "RubikBold" }}>{retrying ? "Syncing…" : "Retry"}</Text></Pressable> : null}</View> : null}
    {error ? <Text accessibilityRole="alert" style={{ color: T.red }}>{error}</Text> : null}
    {moodOpen ? <MoodForm ownerId={user.id} entryDate={toLocalDateKey(new Date())} mood={null} editable saving={false} checkInOnly onClose={() => setMoodOpen(false)} onSave={async mood => {
      const elapsedNow = activeElapsedMs(snapshot.session);
      const prompt = availablePrompts(elapsedNow, journey).find(p => p.kind === "mood");
      await saveJourneyEvent(snapshot.session.sessionId, { kind: "mood", mood, activeElapsedMs: elapsedNow, prompt });
      return true;
    }} /> : null}
  </View>;
}

export function CompletedQuestJourney({ completionId }: { completionId: string }) {
  const [journey, setJourney] = useState<QuestJourney>(emptyJourney);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let current = true; setError(false);
    void fetchCompletedQuestJourney(completionId).then(data => { if (current) setJourney(data); }).catch(() => { if (current) setError(true); });
    return () => { current = false; };
  }, [completionId, retry]);
  if (error) return <Pressable accessibilityRole="button" onPress={() => setRetry(n => n + 1)} style={{ minHeight: 44 }}><Text style={{ color: T.muted }}>Mood journey couldn’t load. Tap to retry.</Text></Pressable>;
  if (!journey.events.length) return null;
  return <View style={{ gap: 16 }}><QuestMoodGraph events={journey.events} /><QuestJourneyVideos events={journey.events} />{journey.events.some(e => e.xp > 0) ? <Text style={{ color: T.muted, fontFamily: "Rubik" }}>+{journey.events.reduce((sum, e) => sum + e.xp, 0)} activity bonus XP earned during this quest</Text> : null}</View>;
}
