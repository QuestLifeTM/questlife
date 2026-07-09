import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";

import { LogLoreFlow } from "@/components/log-lore-flow";
import { QuestStartBlockModal } from "@/components/quest-start-block";
import { categoryColor, difficultyColor, T } from "@/components/theme";
import { Card, EmptyState, GradientBand, IconButton, PillStat, Screen, Sheet, SoftButton, Tag } from "@/components/ui";
import { useContent } from "@/contexts/ContentContext";
import { useQuestEngine } from "@/contexts/QuestEngineContext";
import { useSocial } from "@/contexts/SocialContext";
import { useQuestStart } from "@/hooks/useQuestStart";
import { fetchQuestReviews } from "@/services/engine/questEngineService";
import { QuestReviewData } from "@/types/engine";

export function QuestDetailScreen({ id, onBack }: { id?: string; onBack: () => void }) {
  const router = useRouter();
  const { getQuest, loading, quests, toggleSave } = useContent();
  const { engine, refresh, saveActiveForLater } = useQuestEngine();
  const { overview, shareQuestWith, challengeFriend } = useSocial();
  const quest = getQuest(id);
  const { tryStart, block, clearBlock, starting } = useQuestStart(getQuest);

  const [reviews, setReviews] = useState<QuestReviewData | null>(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [logVisible, setLogVisible] = useState(false);
  const [saveVisible, setSaveVisible] = useState(false);
  const [shareVisible, setShareVisible] = useState(false);
  const [shareFriendId, setShareFriendId] = useState<string | null>(null);

  const isActive = engine?.activeSession?.questId === quest?.id;
  const hasOtherActive = Boolean(engine?.activeSession && !isActive);

  useEffect(() => {
    if (!quest?.id) return;
    setReviewsLoading(true);
    fetchQuestReviews(quest.id)
      .then(setReviews)
      .catch(() => setReviews({ summary: { averageRating: null, ratingCount: 0 }, reviews: [] }))
      .finally(() => setReviewsLoading(false));
  }, [quest?.id]);

  const related = useMemo(() => {
    if (!quest) return [];
    return quests
      .filter((item) => item.id !== quest.id && (item.category === quest.category || item.difficulty === quest.difficulty))
      .slice(0, 3);
  }, [quest, quests]);

  if (!quest) {
    return (
      <Screen>
        <IconButton icon="chevron-back" onPress={onBack} />
        <Card>
          <EmptyState
            emoji={loading ? "⏳" : "🔍"}
            title={loading ? "Loading quest" : "Quest unavailable"}
            body={loading ? "Finding the latest quest details." : "This quest may be unpublished, archived, or unavailable."}
          />
        </Card>
      </Screen>
    );
  }

  const cat = categoryColor[quest.category] ?? { text: quest.color, bg: `${quest.color}18` };
  const diff = difficultyColor[quest.difficulty];
  const friends = overview?.friends ?? [];

  async function handleStart() {
    const ok = await tryStart({ questId: quest!.id, source: "explore" });
    if (ok) await refresh();
  }

  async function handleSave() {
    await toggleSave(quest!.id);
    setSaveVisible(true);
  }

  async function handleShare() {
    if (shareFriendId) {
      await shareQuestWith(shareFriendId, quest!.id);
      setShareVisible(false);
      setShareFriendId(null);
    }
  }

  async function handleChallenge() {
    if (shareFriendId) {
      await challengeFriend(shareFriendId, quest!.id);
      setShareVisible(false);
      setShareFriendId(null);
    }
  }

  return (
    <Screen contentStyle={{ paddingHorizontal: 0, gap: 0 }}>
      <GradientBand color={quest.color}>
        <View style={{ paddingHorizontal: 24, gap: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <IconButton icon="chevron-back" onPress={onBack} />
            <View style={{ flexDirection: "row", gap: 9 }}>
              <IconButton icon="share-outline" onPress={() => setShareVisible(true)} />
              <IconButton icon={quest.saved ? "bookmark" : "bookmark-outline"} color={quest.saved ? T.blue : T.muted} onPress={handleSave} />
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <Tag label={quest.category} color={cat.text} bg={cat.bg} />
            <Tag label={quest.difficulty} color={diff.text} bg={diff.bg} />
            {isActive ? <Tag label="ACTIVE" color={T.white} bg={T.blue} /> : null}
          </View>
          <Text style={{ color: T.dark, fontSize: 30, lineHeight: 35, fontWeight: "900" }}>{quest.title}</Text>
          <Text style={{ color: T.muted, fontWeight: "700", lineHeight: 21 }}>{quest.description}</Text>
        </View>
      </GradientBand>

      <View style={{ padding: 24, gap: 18 }}>
        <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
          <PillStat icon="flash" text={`+${quest.xp} XP`} />
          <PillStat icon="time" text={quest.timeLabel} color={T.dark} />
          <PillStat text={quest.difficulty} color={diff.text} />
          {reviews?.summary.ratingCount ? (
            <PillStat icon="star" text={`${reviews.summary.averageRating?.toFixed(1)} (${reviews.summary.ratingCount})`} color={T.orange} />
          ) : null}
        </View>

        {isActive ? (
          <Card style={{ gap: 12, backgroundColor: `${quest.color}0f`, borderColor: `${quest.color}35` }}>
            <Text style={{ color: T.dark, fontSize: 18, fontWeight: "900" }}>You're doing this quest</Text>
            <Text style={{ color: T.muted, fontWeight: "700", fontSize: 13 }}>Complete it when you're done to earn XP and log your lore.</Text>
            <SoftButton label="Complete Quest" icon="checkmark" onPress={() => setLogVisible(true)} />
            <SoftButton label="Save for later" icon="bookmark-outline" inverse color={T.muted} onPress={async () => { await saveActiveForLater(); await refresh(); onBack(); }} />
          </Card>
        ) : null}

        <Card>
          <Text style={{ color: T.dark, fontSize: 18, fontWeight: "900", marginBottom: 10 }}>About this quest</Text>
          <Text style={{ color: T.dark, fontWeight: "600", lineHeight: 23 }}>{quest.description}</Text>
        </Card>

        <Card style={{ backgroundColor: `${quest.color}08`, borderColor: `${quest.color}25` }}>
          <Text style={{ color: T.dark, fontSize: 18, fontWeight: "900", marginBottom: 12 }}>How it works</Text>
          {(quest.steps.length ? quest.steps : [
            "Head out at your own pace. No timer starts until you choose.",
            "Complete the core challenge described above.",
            "Log the moment for yourself after finishing.",
          ]).map((step, index) => (
            <View key={step} style={{ flexDirection: "row", gap: 12, alignItems: "flex-start", marginTop: index ? 12 : 0 }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: quest.color, alignItems: "center", justifyContent: "center", marginTop: 1 }}>
                <Text style={{ color: T.white, fontWeight: "900", fontSize: 11 }}>{index + 1}</Text>
              </View>
              <Text style={{ color: T.muted, fontWeight: "700", flex: 1, lineHeight: 19 }}>{step}</Text>
            </View>
          ))}
        </Card>

        <View style={{ gap: 10 }}>
          {!isActive ? (
            <SoftButton
              label={starting ? "Starting..." : hasOtherActive ? "Another quest active" : "Start Quest"}
              icon="play"
              onPress={hasOtherActive ? () => tryStart({ questId: quest.id, source: "explore" }) : handleStart}
            />
          ) : null}
          <SoftButton label={quest.saved ? "Saved to My Stuff" : "Save for Later"} icon={quest.saved ? "bookmark" : "bookmark-outline"} inverse color={quest.saved ? T.blue : T.muted} onPress={handleSave} />
          {friends.length ? (
            <SoftButton label="Share with friend" icon="paper-plane-outline" inverse color={T.cyan} onPress={() => setShareVisible(true)} />
          ) : null}
        </View>

        <View style={{ gap: 12 }}>
          <Text style={{ color: T.dark, fontSize: 18, fontWeight: "900" }}>Community reviews</Text>
          {reviewsLoading ? (
            <Card><EmptyState emoji="⏳" title="Loading reviews" body="Fetching what others thought..." /></Card>
          ) : reviews?.reviews.length ? (
            reviews.reviews.slice(0, 5).map((review, index) => (
              <Card key={`${review.createdAt}-${index}`} style={{ gap: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ fontSize: 22 }}>{review.reviewerEmoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: T.dark, fontWeight: "900" }}>{review.reviewerName}</Text>
                    <View style={{ flexDirection: "row", gap: 2 }}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Ionicons key={star} name={star <= review.rating ? "star" : "star-outline"} size={12} color={T.orange} />
                      ))}
                    </View>
                  </View>
                </View>
                {review.reviewText ? <Text style={{ color: T.muted, fontWeight: "700", lineHeight: 19 }}>{review.reviewText}</Text> : null}
                {review.photoUrls.length ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {review.photoUrls.map((url) => (
                      <Image key={url} source={{ uri: url }} style={{ width: 72, height: 72, borderRadius: 12 }} />
                    ))}
                  </ScrollView>
                ) : null}
              </Card>
            ))
          ) : (
            <Card><EmptyState emoji="💬" title="No reviews yet" body="Be the first to log your lore after completing this quest." /></Card>
          )}
        </View>

        {related.length ? (
          <View style={{ gap: 12 }}>
            <Text style={{ color: T.dark, fontSize: 18, fontWeight: "900" }}>More like this</Text>
            {related.map((item) => {
              const itemCat = categoryColor[item.category] ?? { text: item.color, bg: `${item.color}18` };
              return (
                <Link key={item.id} href={`/quest/${item.id}`} asChild>
                  <Pressable>
                    <Card style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14 }}>
                      <View style={{ width: 5, alignSelf: "stretch", borderRadius: 99, backgroundColor: item.color }} />
                      <View style={{ flex: 1 }}>
                        <Tag label={item.category} color={itemCat.text} bg={itemCat.bg} />
                        <Text style={{ color: T.dark, fontWeight: "900", marginTop: 7 }}>{item.title}</Text>
                        <Text style={{ color: T.muted, fontWeight: "700", fontSize: 12, marginTop: 2 }}>{item.timeLabel} · +{item.xp} XP</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={T.muted} />
                    </Card>
                  </Pressable>
                </Link>
              );
            })}
          </View>
        ) : null}
      </View>

      <LogLoreFlow
        visible={logVisible}
        quest={quest}
        onClose={() => setLogVisible(false)}
        onFinished={async () => {
          setLogVisible(false);
          await refresh();
          onBack();
        }}
      />

      <QuestStartBlockModal
        block={block}
        visible={Boolean(block)}
        onClose={clearBlock}
        onGoActive={() => {
          clearBlock();
          if (engine?.activeSession) router.push(`/quest/${engine.activeSession.questId}`);
        }}
        onSaveActive={async () => {
          await saveActiveForLater();
          clearBlock();
          await refresh();
        }}
      />

      <Sheet visible={saveVisible} onClose={() => setSaveVisible(false)}>
        <View style={{ padding: 24, alignItems: "center", gap: 14 }}>
          <Text style={{ fontSize: 44 }}>{quest.saved ? "🔖" : "📭"}</Text>
          <Text style={{ color: T.dark, fontSize: 21, fontWeight: "900" }}>{quest.saved ? "Saved Quest" : "Removed from Saved"}</Text>
          <Text style={{ color: T.muted, fontWeight: "700", textAlign: "center", lineHeight: 20 }}>{quest.saved ? "This quest is waiting in My Stuff for later." : "You can save it again any time from Explore."}</Text>
          <SoftButton label="Done" inverse color={T.muted} onPress={() => setSaveVisible(false)} style={{ alignSelf: "stretch" }} />
        </View>
      </Sheet>

      <Sheet visible={shareVisible} onClose={() => { setShareVisible(false); setShareFriendId(null); }}>
        <View style={{ padding: 24, gap: 14 }}>
          <Text style={{ color: T.dark, fontSize: 21, fontWeight: "900" }}>Share "{quest.title}"</Text>
          {friends.length ? friends.map((friend) => (
            <Pressable key={friend.userId} onPress={() => setShareFriendId(friend.userId)} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 }}>
              <Text style={{ fontSize: 22 }}>{friend.emoji}</Text>
              <Text style={{ flex: 1, color: T.dark, fontWeight: "800" }}>{friend.displayName}</Text>
              <Ionicons name={shareFriendId === friend.userId ? "radio-button-on" : "radio-button-off"} size={18} color={T.blue} />
            </Pressable>
          )) : (
            <EmptyState emoji="👋" title="No friends yet" body="Add friends from the Social tab to share quests." />
          )}
          <SoftButton label="Share quest" icon="paper-plane" onPress={shareFriendId ? handleShare : undefined} />
          <SoftButton label="Challenge friend" icon="flash" inverse color={T.orange} onPress={shareFriendId ? handleChallenge : undefined} />
        </View>
      </Sheet>
    </Screen>
  );
}
