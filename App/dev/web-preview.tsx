import { Link, useLocalSearchParams } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { WebAppShell } from "@/components/web-app-shell";
import { ResponsiveSurfaceContext } from "@/lib/responsive";
import { T } from "@/components/theme";
import { ExploreScreen } from "@/screens/explore-screen";
import { JournalScreen } from "@/screens/journal-screen";
import { LobbyScreen } from "@/screens/lobby-screen";
import { QuestDetailScreen } from "@/screens/quest-detail-screen";
import { ActiveQuestScreen } from "@/screens/active-quest-screen";
import { SavedScreen } from "@/screens/saved-screen";
import { QuestCollectionsScreen } from "@/screens/quest-collections-screen";
import { ProfileScreen } from "@/screens/profile-screen";
import { SocialScreen } from "@/screens/social-screen";
import { SettingsHomeScreen, NotificationPreferencesScreen, PrivacySettingsScreen, AppPreferencesScreen, HelpSupportScreen, AboutQuestLifeScreen } from "@/screens/settings-screen";
import { FriendsScreen } from "@/screens/friends-screen";
import { NotificationsScreen } from "@/screens/notifications-screen";
import { StreakScreen } from "@/screens/streak-screen";
import { MemoryDetailScreen } from "@/screens/memory-detail-screen";
import { AddFriendsScreen } from "@/screens/add-friends-screen";
import { ShareAdventureScreen } from "@/screens/share-adventure-screen";
import { ManageSavedQuestsScreen } from "@/screens/manage-saved-quests-screen";
import { InProgressQuestScreen } from "@/screens/in-progress-quest-screen";
import { UserCollectionDetailScreen } from "@/screens/user-collection-detail-screen";
import { Quest } from "@/types/content";
import { StorageCheck } from "@/dev/storage-check";

const quest: Quest = { id: "local-preview", title: "Find a new view and take the scenic route home", category: "ADVENTURE", description: "Take a different route and pause somewhere with a view. Make a little room for the unexpected, and keep a note of what you discover along the way. ".repeat(4), steps: ["Choose a familiar destination.", "Follow a different path and take time to notice the details.", "Save a photo or write a reflection when you arrive."], timeMin: 45, timeLabel: "45 min", difficulty: "EASY", xp: 180, status: "published", featured: false, color: "#4da8ff", saved: false, completed: false };
const quests = Array.from({ length: 9 }, (_, index) => ({ ...quest, id: `${quest.id}-${index}`, title: index === 0 ? quest.title : ["Try a local treat", "Make a tiny masterpiece", "Call someone who matters"][index % 3], description: index === 0 ? quest.description : "Take time for something new today." }));
const surfaces = ["home", "explore", "journal", "quest", "active-quest", "saved", "quest-collections", "profile", "social", "settings", "friends", "notifications", "streak", "memory", "add-friends", "share-adventure", "manage-saved", "in-progress-quest", "collection", "settings-notifications", "settings-privacy", "settings-preferences", "settings-help", "settings-about"];
const back = () => undefined;
export function WebPreview() {
  const { surface: screen = "explore", empty } = useLocalSearchParams<{ surface?: string; empty?: string }>();
  const today = new Date().toLocaleDateString("en-CA");
  const pages: Record<string, React.ReactNode> = {
    "settings-notifications": <NotificationPreferencesScreen />, "settings-privacy": <PrivacySettingsScreen />, "settings-preferences": <AppPreferencesScreen />, "settings-help": <HelpSupportScreen />, "settings-about": <AboutQuestLifeScreen />,
    storage: <StorageCheck />,
    home: <LobbyScreen />, explore: <ExploreScreen previewQuests={empty ? [] : quests} />,
    journal: <JournalScreen preview={{ todayKey: today, data: { joinedAt: new Date().toISOString(), activeQuest: null, entriesByDate: {}, memoriesByDate: {} } }} />,
    quest: <QuestDetailScreen previewQuest={quest} onBack={back} />, "active-quest": <ActiveQuestScreen preview previewQuest={quest} previewElapsedMs={4200000} previewRoute={[]} />,
    saved: <SavedScreen onBack={back} />, "quest-collections": <QuestCollectionsScreen onBack={back} />, profile: <ProfileScreen />, social: <SocialScreen />, settings: <SettingsHomeScreen />, friends: <FriendsScreen />, notifications: <NotificationsScreen onBack={back} />, streak: <StreakScreen onBack={back} />, memory: <MemoryDetailScreen onBack={back} />, "add-friends": <AddFriendsScreen />, "share-adventure": <ShareAdventureScreen />, "manage-saved": <ManageSavedQuestsScreen onBack={back} />, "in-progress-quest": <InProgressQuestScreen />, collection: <UserCollectionDetailScreen id="missing-local-preview" onBack={back} />,
  };
  return <ResponsiveSurfaceContext.Provider value={`/${screen}`}><View style={{ flex: 1 }}>
    <ScrollView horizontal style={{ flexGrow: 0, flexShrink: 0, backgroundColor: T.white }} contentContainerStyle={{ padding: 8, gap: 12 }}><Text style={{ color: T.muted, fontSize: 12, padding: 8 }}>Local QA · fixtures / signed-out states</Text>{surfaces.map((name) => <Link key={name} href={{ pathname: "/web-preview", params: { surface: name } }} style={{ color: screen === name ? T.blue : T.dark, padding: 8 }}>{name}</Link>)}</ScrollView>
    <WebAppShell authenticated><View key={screen} style={{ flex: 1 }}>{pages[screen] ?? pages.explore}</View></WebAppShell>
  </View></ResponsiveSurfaceContext.Provider>;
}
