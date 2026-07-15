import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Contacts from "expo-contacts";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Share, Text, TextInput, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card, EmptyState, haptic, Header, IconButton, Screen, SoftButton, useResponsiveScreenLayout } from "@/components/ui";
import { T } from "@/components/theme";
import { useSocial } from "@/contexts/SocialContext";
import { fetchFriendSuggestions, findProfilesByContactEmails } from "@/services/social/socialService";
import { ProfileSearchResult } from "@/types/social";

type DiscoveryTab = "suggested" | "contacts" | "qr";

function Avatar({ emoji, color, size = 48 }: { emoji: string; color: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: `${color}22`, borderWidth: 2, borderColor: `${color}66`, alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: size * 0.43 }}>{emoji}</Text></View>;
}

function DiscoveryTabButton({ tab, active, icon, label, onPress }: { tab: DiscoveryTab; active: boolean; icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={label} onPress={onPress} style={({ pressed }) => ({ flex: 1, minHeight: 72, alignItems: "center", justifyContent: "center", gap: 5, borderBottomWidth: 4, borderBottomColor: active ? T.blue : "transparent", opacity: pressed ? 0.65 : 1 })}>
    <View style={{ width: 34, height: 30, borderRadius: 11, backgroundColor: active ? `${T.blue}16` : "transparent", alignItems: "center", justifyContent: "center" }}><Ionicons name={icon} size={23} color={active ? T.blue : T.muted} /></View>
    <Text style={{ color: active ? T.dark : T.muted, fontSize: 11, fontWeight: "900", textAlign: "center" }}>{label}</Text>
  </Pressable>;
}

function FriendActionButton({ label, icon, color = T.blue, onPress, style }: { label: string; icon: keyof typeof Ionicons.glyphMap; color?: string; onPress: () => void; style?: object }) {
  const { width } = useWindowDimensions();
  const compact = width < 390;
  const lowerEdge = color === T.blue ? "#258fd8" : color === T.purple ? "#7973c7" : color === T.green ? "#20894d" : color;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => { haptic(); onPress(); }} style={({ pressed }) => [{ minHeight: compact ? 50 : 52, paddingHorizontal: compact ? 14 : 16, borderRadius: 18, backgroundColor: color, borderBottomWidth: 5, borderBottomColor: lowerEdge, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, transform: [{ translateY: pressed ? 3 : 0 }] }, style]}>
    <Ionicons name={icon} size={18} color={T.white} />
    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={{ color: T.white, fontSize: compact ? 13 : 14, fontWeight: "900", letterSpacing: 0.5, textTransform: "uppercase" }}>{label}</Text>
  </Pressable>;
}

function PersonRow({ person, onAdd }: { person: ProfileSearchResult; onAdd: (person: ProfileSearchResult) => void }) {
  const status = person.isFriend ? "Friends" : person.requestStatus ? "Pending" : null;
  return <View style={{ minHeight: 72, flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 9 }}>
    <Avatar emoji={person.emoji} color={person.avatarColor} />
    <View style={{ flex: 1, gap: 2 }}>
      <Text selectable style={{ color: T.dark, fontSize: 15, fontWeight: "900" }} numberOfLines={1}>{person.displayName}</Text>
      <Text selectable style={{ color: T.muted, fontSize: 12, fontWeight: "700" }} numberOfLines={1}>{person.username ? `@${person.username}` : "QuestLife adventurer"}</Text>
    </View>
    {status ? <View style={{ minHeight: 34, paddingHorizontal: 11, borderRadius: 13, backgroundColor: person.isFriend ? `${T.green}16` : `${T.blue}16`, alignItems: "center", justifyContent: "center" }}><Text style={{ color: person.isFriend ? T.green : T.blue, fontSize: 11, fontWeight: "900" }}>{status}</Text></View> : <Pressable accessibilityRole="button" accessibilityLabel={`Add ${person.displayName}`} onPress={() => onAdd(person)} style={({ pressed }) => ({ minHeight: 42, paddingHorizontal: 14, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: T.blue, borderBottomWidth: 4, borderBottomColor: "#258fd8", transform: [{ translateY: pressed ? 3 : 0 }] })}><Text style={{ color: T.white, fontSize: 12, fontWeight: "900", letterSpacing: 0.45 }}>ADD</Text></Pressable>}
  </View>;
}

export function AddFriendsScreen() {
  const router = useRouter();
  const { contentWidth, horizontalPadding, safeAreaOffset } = useResponsiveScreenLayout();
  const insets = useSafeAreaInsets();
  const { overview, searchUsers, addFriend } = useSocial();
  const [activeTab, setActiveTab] = useState<DiscoveryTab>("suggested");
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<ProfileSearchResult[]>([]);
  const [searchResults, setSearchResults] = useState<ProfileSearchResult[]>([]);
  const [contacts, setContacts] = useState<ProfileSearchResult[]>([]);
  const [contactsLoaded, setContactsLoaded] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const ownUserId = overview?.me?.userId;
  const profileUrl = useMemo(() => ownUserId ? Linking.createURL("/add-friend", { queryParams: { userId: ownUserId } }) : "questlife://add-friend", [ownUserId]);
  const displayedPeople = query.trim().length >= 2 ? searchResults : activeTab === "contacts" ? contacts : suggestions;

  useEffect(() => {
    let current = true;
    fetchFriendSuggestions().then((people) => { if (current) setSuggestions(people); }).catch(() => { if (current) setSuggestions([]); }).finally(() => { if (current) setLoadingSuggestions(false); });
    return () => { current = false; };
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) { setSearchResults([]); return; }
    let current = true;
    const timeout = setTimeout(() => {
      searchUsers(trimmed).then((people) => { if (current) setSearchResults(people); }).catch(() => { if (current) setSearchResults([]); });
    }, 220);
    return () => { current = false; clearTimeout(timeout); };
  }, [query, searchUsers]);

  async function addPerson(person: ProfileSearchResult) {
    try {
      await addFriend(person.userId);
      const pending = { ...person, requestStatus: "pending:outgoing" };
      setSuggestions((items) => items.map((item) => item.userId === person.userId ? pending : item));
      setSearchResults((items) => items.map((item) => item.userId === person.userId ? pending : item));
      setContacts((items) => items.map((item) => item.userId === person.userId ? pending : item));
    } catch {
      Alert.alert("Couldn’t send request", "Please try again in a moment.");
    }
  }

  async function connectContacts() {
    setLoadingContacts(true);
    try {
      const permission = await Contacts.requestPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Contacts permission needed", "Allow contact access to discover friends already using QuestLife.");
        return;
      }
      const response = await Contacts.getContactsAsync({ fields: [Contacts.Fields.Emails] });
      const emails = [...new Set(response.data.flatMap((contact) => (contact.emails ?? []).map((email) => email.email?.trim().toLowerCase() ?? "")).filter(Boolean))].slice(0, 500);
      setContacts(await findProfilesByContactEmails(emails));
      setContactsLoaded(true);
    } catch {
      Alert.alert("Contacts unavailable", "We couldn’t read your contacts. You can still search by username or use a QR code.");
    } finally {
      setLoadingContacts(false);
    }
  }

  async function openScanner() {
    if (!cameraPermission?.granted) {
      const permission = await requestCameraPermission();
      if (!permission.granted) return;
    }
    setCameraOpen(true);
  }

  function scanned(data: string) {
    const parsed = Linking.parse(data);
    const userId = typeof parsed.queryParams?.userId === "string" ? parsed.queryParams.userId : null;
    if (!userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
      Alert.alert("That isn’t a QuestLife profile QR code", "Try scanning a friend’s QuestLife code.");
      return;
    }
    setCameraOpen(false);
    router.push({ pathname: "/add-friend/[userId]", params: { userId } });
  }

  async function inviteFriends() {
    try {
      await Share.share({ message: `Add me on QuestLife so we can take on quests together: ${profileUrl}`, url: profileUrl });
    } catch {
      // Dismissing the native share sheet is not an error the user needs to see.
    }
  }

  return <Screen scroll={false} padded={false} contentStyle={{ flex: 1 }}>
    <View style={{ width: contentWidth, alignSelf: "center", paddingHorizontal: horizontalPadding, gap: 15, transform: [{ translateX: safeAreaOffset }] }}>
      <Header title="Add Friends" subtitle="Build your quest crew" animated={false} right={<IconButton icon="arrow-back" label="Back to Social" onPress={() => router.back()} color={T.dark} />} />
      <View style={{ height: 52, borderRadius: 18, borderWidth: 2, borderColor: T.border, backgroundColor: T.white, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, gap: 9 }}>
        <Ionicons name="search" size={19} color={T.muted} />
        <TextInput autoFocus value={query} onChangeText={setQuery} placeholder="Search by username" placeholderTextColor={T.muted} autoCapitalize="none" autoCorrect={false} style={{ flex: 1, color: T.dark, fontSize: 15, fontWeight: "700", paddingVertical: 0 }} />
        {query ? <Pressable accessibilityLabel="Clear search" onPress={() => setQuery("")}><Ionicons name="close-circle" size={19} color={T.muted} /></Pressable> : null}
      </View>
      <View style={{ flexDirection: "row", borderBottomWidth: 2, borderBottomColor: T.border }}>
        <DiscoveryTabButton tab="suggested" active={activeTab === "suggested"} icon="people-outline" label="People you might know" onPress={() => { setQuery(""); setActiveTab("suggested"); }} />
        <DiscoveryTabButton tab="contacts" active={activeTab === "contacts"} icon="book-outline" label="Contacts" onPress={() => { setQuery(""); setActiveTab("contacts"); }} />
        <DiscoveryTabButton tab="qr" active={activeTab === "qr"} icon="qr-code-outline" label="QR Code" onPress={() => { setQuery(""); setActiveTab("qr"); }} />
      </View>
    </View>
    <ScrollView contentInsetAdjustmentBehavior="never" showsVerticalScrollIndicator={false} contentContainerStyle={{ alignItems: "center", paddingTop: 15, paddingBottom: 14, gap: 14 }}>
      <View style={{ width: contentWidth, paddingHorizontal: horizontalPadding, gap: 14, transform: [{ translateX: safeAreaOffset }] }}>
      {query.trim().length >= 2 || activeTab === "suggested" || activeTab === "contacts" ? <View style={{ gap: 8 }}>
        <Text style={{ color: T.dark, fontSize: 13, fontWeight: "900", letterSpacing: 0.5, textTransform: "uppercase" }}>{query.trim().length >= 2 ? "Search results" : activeTab === "contacts" ? "Friends from your contacts" : "People you might know"}</Text>
        {activeTab === "contacts" && !contacts.length && !loadingContacts && !query.trim() ? <Card style={{ borderRadius: 22, alignItems: "center", gap: 12, paddingVertical: 28 }}><View style={{ width: 54, height: 54, borderRadius: 19, backgroundColor: `${T.purple}16`, alignItems: "center", justifyContent: "center" }}><Ionicons name="book-outline" size={26} color={T.purple} /></View><Text style={{ color: T.dark, fontSize: 18, fontWeight: "900" }}>{contactsLoaded ? "No contacts on QuestLife yet" : "Connect your contacts"}</Text><Text style={{ color: T.muted, textAlign: "center", fontSize: 13, lineHeight: 19, fontWeight: "700" }}>{contactsLoaded ? "Invite them below, or search by username instead." : "We’ll only look for people already using QuestLife."}</Text><FriendActionButton label={contactsLoaded ? "Check again" : "Connect securely"} icon={contactsLoaded ? "refresh" : "link-outline"} color={T.purple} onPress={connectContacts} /></Card> : null}
        {loadingSuggestions && activeTab === "suggested" ? <EmptyState emoji="⏳" title="Finding your people" body="Looking for adventurers to meet." /> : null}
        {loadingContacts ? <EmptyState emoji="⏳" title="Checking contacts" body="Looking for your people on QuestLife." /> : null}
        {!loadingSuggestions && !loadingContacts && displayedPeople.length ? <Card style={{ borderRadius: 22, paddingHorizontal: 14, paddingVertical: 4, boxShadow: "none" }}>{displayedPeople.map((person, index) => <View key={person.userId} style={{ borderBottomWidth: index === displayedPeople.length - 1 ? 0 : 1, borderBottomColor: T.border }}><PersonRow person={person} onAdd={addPerson} /></View>)}</Card> : null}
        {!loadingSuggestions && !loadingContacts && query.trim().length >= 2 && !displayedPeople.length ? <EmptyState emoji="🔎" title="No adventurers found" body="Try a different username." /> : null}
      </View> : null}
      {activeTab === "qr" && !query.trim() ? <View style={{ gap: 14, alignItems: "center", paddingTop: 10 }}>
        <Text style={{ color: T.dark, fontSize: 19, fontWeight: "900", textAlign: "center" }}>Your QuestLife QR code</Text>
        <Card style={{ borderRadius: 26, padding: 18, alignItems: "center", gap: 13, borderColor: `${T.blue}55`, borderBottomWidth: 5, borderBottomColor: "#a8d8ff" }}>
          <View style={{ padding: 12, borderRadius: 20, backgroundColor: T.white }}><QRCode value={profileUrl} size={196} color={T.dark} backgroundColor={T.white} /></View>
          <Text selectable style={{ color: T.muted, fontSize: 12, textAlign: "center", lineHeight: 18, fontWeight: "700" }}>Friends can scan this with their phone camera to open your profile and add you.</Text>
        </Card>
        <View style={{ flexDirection: "row", gap: 10, width: "100%" }}><SoftButton label="Copy link" icon="copy-outline" inverse color={T.blue} onPress={() => Clipboard.setStringAsync(profileUrl)} style={{ flex: 1, minHeight: 52, borderRadius: 18 }} /><FriendActionButton label="Scan a code" icon="scan-outline" color={T.blue} onPress={openScanner} style={{ flex: 1 }} /></View>
      </View> : null}
      {cameraOpen ? <View style={{ overflow: "hidden", height: 330, borderRadius: 26, borderWidth: 2, borderColor: T.blue, backgroundColor: T.dark }}><CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={({ data }) => scanned(data)} /><Pressable accessibilityLabel="Close QR scanner" onPress={() => setCameraOpen(false)} style={{ position: "absolute", top: 12, right: 12, width: 40, height: 40, borderRadius: 20, backgroundColor: T.white, alignItems: "center", justifyContent: "center" }}><Ionicons name="close" size={22} color={T.dark} /></Pressable></View> : null}
      </View>
    </ScrollView>
    <View style={{ alignItems: "center", borderTopWidth: 2, borderTopColor: T.border, backgroundColor: T.bg, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 12), paddingHorizontal: horizontalPadding }}>
      <View style={{ width: "100%", maxWidth: contentWidth, transform: [{ translateX: safeAreaOffset }] }}><FriendActionButton label="Invite friends" icon="share-social-outline" color={T.blue} onPress={inviteFriends} /></View>
    </View>
  </Screen>;
}
