import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { T } from "@/components/theme";
import { Card, EmptyState, Header, PillStat, Screen, Sheet, SoftButton, Tag } from "@/components/ui";
import { useContent } from "@/contexts/ContentContext";
import { useSocial } from "@/contexts/SocialContext";
import { SocialFriend, Party } from "@/types/social";

type Tab = "friends" | "parties";

function Avatar({ emoji, color, size = 44 }: { emoji: string; color: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: `${color}22`, borderWidth: 2, borderColor: `${color}66`, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize: size * 0.42 }}>{emoji}</Text>
    </View>
  );
}

function FriendRow({ friend, onChallenge, onShare }: { friend: SocialFriend; onChallenge: () => void; onShare: () => void }) {
  return (
    <Card style={{ borderRadius: 22, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, boxShadow: "none" }}>
      <Avatar emoji={friend.emoji} color={friend.avatarColor} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ color: T.dark, fontSize: 16, fontWeight: "900" }}>{friend.displayName}</Text>
        <Text style={{ color: T.muted, fontSize: 12, fontWeight: "700" }} numberOfLines={1}>
          {friend.lastQuestTitle ? `Last: ${friend.lastQuestTitle}` : `@${friend.username ?? "adventurer"}`}
        </Text>
        <View style={{ flexDirection: "row", gap: 6, marginTop: 2 }}>
          <PillStat text={`Lv ${Math.floor(friend.totalXp / 500) + 1}`} color={T.blue} />
          {friend.currentStreak !== null ? <PillStat icon="flame" text={String(friend.currentStreak)} color={T.orange} /> : null}
        </View>
      </View>
      <View style={{ gap: 6 }}>
        <Pressable onPress={onShare} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: `${T.cyan}14`, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="paper-plane-outline" size={16} color={T.cyan} />
        </Pressable>
        <Pressable onPress={onChallenge} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: `${T.orange}14`, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="flash-outline" size={16} color={T.orange} />
        </Pressable>
      </View>
    </Card>
  );
}

function PartyCard({ party }: { party: Party }) {
  const done = party.quests.filter((q) => q.completedBy.length >= party.members.length).length;
  return (
    <Card style={{ borderRadius: 24, padding: 16, gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Text style={{ fontSize: 32 }}>{party.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ color: T.dark, fontSize: 18, fontWeight: "900" }}>{party.name}</Text>
          <Text style={{ color: T.muted, fontSize: 12, fontWeight: "700" }}>
            {party.gameMode === "together" ? "Co-op checklist" : "Relay mode"} · {party.members.length} members
          </Text>
        </View>
        <Tag label={`${done}/${party.quests.length}`} color={party.accentColor} bg={`${party.accentColor}18`} />
      </View>
      <View style={{ flexDirection: "row", gap: -8 }}>
        {party.members.slice(0, 5).map((m) => (
          <Avatar key={m.userId} emoji={m.emoji} color={m.avatarColor} size={32} />
        ))}
      </View>
    </Card>
  );
}

export function SocialScreen() {
  const router = useRouter();
  const { quests } = useContent();
  const { overview, loading, error, refresh, searchUsers, addFriend, respondRequest, challengeFriend, shareQuestWith, startParty, respondToPartyInvite } = useSocial();

  const [tab, setTab] = useState<Tab>("friends");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Awaited<ReturnType<typeof searchUsers>>>([]);
  const [partySheet, setPartySheet] = useState(false);
  const [partyName, setPartyName] = useState("");
  const [partyMode, setPartyMode] = useState<"together" | "relay">("together");
  const [selectedQuests, setSelectedQuests] = useState<string[]>([]);
  const [actionFriend, setActionFriend] = useState<SocialFriend | null>(null);
  const [actionQuest, setActionQuest] = useState<string>("");

  async function runSearch(text: string) {
    setQuery(text);
    if (text.trim().length < 2) { setResults([]); return; }
    setResults(await searchUsers(text));
  }

  async function createPartyFlow() {
    if (!partyName.trim() || !selectedQuests.length) return;
    await startParty({ name: partyName.trim(), emoji: "🎉", accentColor: T.blue, gameMode: partyMode, questIds: selectedQuests });
    setPartySheet(false);
    setPartyName("");
    setSelectedQuests([]);
  }

  return (
    <Screen padded={false} contentStyle={{ alignItems: "center" }}>
      <View style={{ width: "100%", maxWidth: 430, paddingHorizontal: 24, gap: 16 }}>
        <Header title="Social" subtitle="Friends & parties" animated={false} />

        <View style={{ flexDirection: "row", padding: 4, borderRadius: 24, backgroundColor: T.white, borderWidth: 2, borderColor: T.border }}>
          {(["friends", "parties"] as Tab[]).map((t) => (
            <Pressable key={t} onPress={() => setTab(t)} style={{ flex: 1, minHeight: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: tab === t ? T.dark : "transparent" }}>
              <Text style={{ color: tab === t ? T.white : T.muted, fontSize: 13, fontWeight: "900", textTransform: "capitalize" }}>{t}</Text>
            </Pressable>
          ))}
        </View>

        {error ? (
          <Card style={{ borderRadius: 20, gap: 8 }}>
            <Text style={{ color: T.red, fontWeight: "800" }}>{error}</Text>
            <SoftButton label="Retry" icon="refresh" inverse color={T.blue} onPress={refresh} />
          </Card>
        ) : null}

        {tab === "friends" ? (
          <View style={{ gap: 14 }}>
            <View style={{ height: 48, borderRadius: 24, borderWidth: 2, borderColor: T.border, backgroundColor: T.white, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, gap: 8 }}>
              <Ionicons name="search" size={16} color={T.muted} />
              <TextInput value={query} onChangeText={runSearch} placeholder="Search friends by username..." placeholderTextColor={T.muted} style={{ flex: 1, color: T.dark, fontWeight: "700" }} />
            </View>

            {overview?.incomingRequests.length ? (
              <View style={{ gap: 10 }}>
                <Text style={{ color: T.dark, fontSize: 17, fontWeight: "900" }}>Friend requests</Text>
                {overview.incomingRequests.map((req) => (
                  <Card key={req.id} style={{ borderRadius: 20, flexDirection: "row", alignItems: "center", gap: 12, boxShadow: "none" }}>
                    <Avatar emoji={req.emoji} color={req.avatarColor} />
                    <Text style={{ flex: 1, color: T.dark, fontWeight: "900" }}>{req.displayName}</Text>
                    <SoftButton label="Accept" onPress={() => respondRequest(req.id, true)} color={T.green} style={{ minHeight: 36, paddingHorizontal: 12 }} />
                    <SoftButton label="Decline" inverse color={T.muted} onPress={() => respondRequest(req.id, false)} style={{ minHeight: 36, paddingHorizontal: 12 }} />
                  </Card>
                ))}
              </View>
            ) : null}

            {results.length ? (
              <View style={{ gap: 8 }}>
                <Text style={{ color: T.muted, fontWeight: "900", fontSize: 12, textTransform: "uppercase" }}>Search results</Text>
                {results.map((r) => (
                  <Card key={r.userId} style={{ borderRadius: 20, flexDirection: "row", alignItems: "center", gap: 12, boxShadow: "none" }}>
                    <Avatar emoji={r.emoji} color={r.avatarColor} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: T.dark, fontWeight: "900" }}>{r.displayName}</Text>
                      <Text style={{ color: T.muted, fontSize: 12, fontWeight: "700" }}>@{r.username}</Text>
                    </View>
                    {r.isFriend ? (
                      <Tag label="Friends" color={T.green} bg={`${T.green}18`} />
                    ) : r.requestStatus ? (
                      <Tag label="Pending" color={T.blue} bg={`${T.blue}18`} />
                    ) : (
                      <SoftButton label="Add" onPress={() => addFriend(r.userId)} color={T.blue} style={{ minHeight: 36, paddingHorizontal: 14 }} />
                    )}
                  </Card>
                ))}
              </View>
            ) : null}

            <Card style={{ borderRadius: 22, gap: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Ionicons name="qr-code-outline" size={22} color={T.blue} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: T.dark, fontWeight: "900" }}>Your QR code</Text>
                  <Text style={{ color: T.muted, fontSize: 12, fontWeight: "700" }}>questlife://profile/{overview?.me.userId?.slice(0, 8)}…</Text>
                </View>
              </View>
            </Card>

            <Text style={{ color: T.dark, fontSize: 17, fontWeight: "900" }}>Friends ({overview?.friends.length ?? 0})</Text>
            {loading && !overview ? (
              <EmptyState emoji="⏳" title="Loading friends" body="Finding your crew..." />
            ) : overview?.friends.length ? (
              overview.friends.map((f) => (
                <FriendRow key={f.userId} friend={f} onShare={() => setActionFriend(f)} onChallenge={() => setActionFriend(f)} />
              ))
            ) : (
              <EmptyState emoji="🤝" title="No friends yet" body="Search above to add your first adventure buddy." />
            )}
          </View>
        ) : (
          <View style={{ gap: 14 }}>
            <SoftButton label="Start a party" icon="add" onPress={() => setPartySheet(true)} />

            {overview?.partyInvites.length ? (
              <View style={{ gap: 10 }}>
                <Text style={{ color: T.dark, fontSize: 17, fontWeight: "900" }}>Party invites</Text>
                {overview.partyInvites.map((inv) => (
                  <Card key={inv.id} style={{ borderRadius: 20, gap: 10, boxShadow: "none" }}>
                    <Text style={{ color: T.dark, fontWeight: "900" }}>{inv.senderName} invited you to {inv.partyName}</Text>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <SoftButton label="Join" onPress={() => respondToPartyInvite(inv.id, true)} color={T.green} style={{ flex: 1 }} />
                      <SoftButton label="Pass" inverse color={T.muted} onPress={() => respondToPartyInvite(inv.id, false)} style={{ flex: 1 }} />
                    </View>
                  </Card>
                ))}
              </View>
            ) : null}

            <Text style={{ color: T.dark, fontSize: 17, fontWeight: "900" }}>Active parties</Text>
            {overview?.parties.length ? overview.parties.map((p) => <PartyCard key={p.id} party={p} />) : (
              <EmptyState emoji="🎊" title="No parties yet" body="Start one with friends for a co-op quest session." />
            )}
          </View>
        )}
      </View>

      <Sheet visible={partySheet} onClose={() => setPartySheet(false)} maxHeight="90%">
        <ScrollView contentContainerStyle={{ padding: 24, gap: 14 }}>
          <Text style={{ color: T.dark, fontSize: 22, fontWeight: "900" }}>Create a party</Text>
          <TextInput value={partyName} onChangeText={setPartyName} placeholder="Party name" placeholderTextColor={T.muted} style={{ borderWidth: 2, borderColor: T.border, borderRadius: 16, padding: 14, color: T.dark, fontWeight: "700" }} />
          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["together", "relay"] as const).map((mode) => (
              <Pressable key={mode} onPress={() => setPartyMode(mode)} style={{ flex: 1, padding: 12, borderRadius: 16, borderWidth: 2, borderColor: partyMode === mode ? T.blue : T.border, backgroundColor: partyMode === mode ? `${T.blue}12` : T.white, alignItems: "center" }}>
                <Text style={{ color: partyMode === mode ? T.blue : T.muted, fontWeight: "900", fontSize: 12 }}>{mode === "together" ? "Co-op" : "Relay"}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={{ color: T.muted, fontWeight: "900", fontSize: 11, textTransform: "uppercase" }}>Pick quests</Text>
          {quests.slice(0, 8).map((q) => {
            const on = selectedQuests.includes(q.id);
            return (
              <Pressable key={q.id} onPress={() => setSelectedQuests((prev) => on ? prev.filter((id) => id !== q.id) : [...prev, q.id])} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 }}>
                <Ionicons name={on ? "checkbox" : "square-outline"} size={20} color={on ? T.blue : T.muted} />
                <Text style={{ flex: 1, color: T.dark, fontWeight: "800" }} numberOfLines={1}>{q.title}</Text>
              </Pressable>
            );
          })}
          <SoftButton label="Create party" icon="sparkles" onPress={createPartyFlow} />
        </ScrollView>
      </Sheet>

      <Sheet visible={actionFriend !== null} onClose={() => { setActionFriend(null); setActionQuest(""); }}>
        {actionFriend ? (
          <View style={{ padding: 24, gap: 12 }}>
            <Text style={{ color: T.dark, fontSize: 20, fontWeight: "900" }}>Send to {actionFriend.displayName}</Text>
            <Text style={{ color: T.muted, fontWeight: "800", fontSize: 12, textTransform: "uppercase" }}>Pick a quest</Text>
            {quests.slice(0, 6).map((q) => (
              <Pressable key={q.id} onPress={() => setActionQuest(q.id)} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 }}>
                <Ionicons name={actionQuest === q.id ? "radio-button-on" : "radio-button-off"} size={18} color={T.blue} />
                <Text style={{ color: T.dark, fontWeight: "800" }} numberOfLines={1}>{q.title}</Text>
              </Pressable>
            ))}
            <SoftButton label="Share quest" icon="paper-plane" onPress={() => { if (actionQuest) shareQuestWith(actionFriend.userId, actionQuest); setActionFriend(null); }} />
            <SoftButton label="Challenge friend" icon="flash" inverse color={T.orange} onPress={() => { if (actionQuest) challengeFriend(actionFriend.userId, actionQuest); setActionFriend(null); }} />
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}
