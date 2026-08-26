import { Ionicons } from "@expo/vector-icons";
import * as Contacts from "expo-contacts";
import * as FileSystem from "expo-file-system/legacy";
import * as Linking from "expo-linking";
import * as Sharing from "expo-sharing";
import { useRouter } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, Share, Text, TextInput, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card, EmptyState, haptic, Header, IconButton, Screen, SoftButton, useResponsiveScreenLayout } from "@/components/ui";
import { ProfileAvatar } from "@/components/profile-avatar";
import { T } from "@/components/theme";
import { useSocial } from "@/contexts/SocialContext";
import { MotionPulse } from "@/motion/primitives";
import { fetchFriendSuggestions, findProfilesByContactEmails } from "@/services/social/socialService";
import { ProfileSearchResult } from "@/types/social";

type DiscoveryTab = "suggested" | "contacts" | "qr";

function DiscoveryTabButton({ tab, active, icon, label, onPress }: { tab: DiscoveryTab; active: boolean; icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={label} onPress={onPress} style={({ pressed }) => ({ flex: 1, minHeight: 72, alignItems: "center", justifyContent: "center", gap: 5, borderBottomWidth: 4, borderBottomColor: active ? T.blue : "transparent", opacity: pressed ? 0.65 : 1 })}>
    <View style={{ width: 34, height: 30, borderRadius: 11, backgroundColor: active ? `${T.blue}16` : "transparent", alignItems: "center", justifyContent: "center" }}><Ionicons name={icon} size={23} color={active ? T.blue : T.muted} /></View>
    <Text style={{ color: active ? T.dark : T.muted, fontSize: 11, fontWeight: "900", textAlign: "center" }}>{label}</Text>
  </Pressable>;
}

function LoadingBlock({ width, height, radius = 8 }: { width: number | `${number}%`; height: number; radius?: number }) {
  return <MotionPulse accessibilityRole="progressbar" maximumOpacity={0.8} style={{ width, height, borderRadius: radius, backgroundColor: "#dfe7ed" }} />;
}

function PeopleLoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return <View accessibilityLabel="Loading people">
    <Card style={{ borderRadius: 22, paddingHorizontal: 14, paddingVertical: 4, boxShadow: "none" }}>
    {Array.from({ length: rows }, (_, index) => <View key={index} style={{ minHeight: 72, flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 9, borderBottomWidth: index === rows - 1 ? 0 : 1, borderBottomColor: T.border }}>
      <LoadingBlock width={48} height={48} radius={24} />
      <View style={{ flex: 1, gap: 7 }}><LoadingBlock width={index === 1 ? "48%" : "62%"} height={15} /><LoadingBlock width={index === 2 ? "34%" : "43%"} height={11} /></View>
      <LoadingBlock width={76} height={38} radius={14} />
    </View>)}
    </Card>
  </View>;
}

function QrLoadingSkeleton() {
  return <View accessibilityLabel="Loading your QR code" style={{ gap: 14, alignItems: "center", paddingTop: 10 }}>
    <LoadingBlock width={184} height={22} radius={9} />
    <Card style={{ borderRadius: 26, padding: 18, alignItems: "center", gap: 13, borderColor: `${T.blue}30`, borderBottomWidth: 5, borderBottomColor: "#d8eafa" }}>
      <LoadingBlock width={220} height={220} radius={20} />
      <LoadingBlock width={246} height={12} /><LoadingBlock width={194} height={12} />
    </Card>
    <View style={{ flexDirection: "row", gap: 10, width: "100%" }}><LoadingBlock width="50%" height={52} radius={18} /><LoadingBlock width="50%" height={52} radius={18} /></View>
  </View>;
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

function PersonRow({ person, onAdd, onOpenProfile }: { person: ProfileSearchResult; onAdd: (person: ProfileSearchResult) => void; onOpenProfile: () => void }) {
  const status = person.isFriend ? "Friends" : person.isFollowing ? "Following" : null;
  return <View style={{ minHeight: 72, flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 9 }}>
    <Pressable accessibilityRole="button" accessibilityLabel={`View ${person.displayName}'s profile`} onPress={onOpenProfile}><ProfileAvatar uri={person.avatarUrl} color={person.avatarColor} size={48} label={`${person.displayName}'s profile photo`} /></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={`View ${person.displayName}'s profile`} onPress={onOpenProfile} style={{ flex: 1, gap: 2 }}>
      <Text selectable style={{ color: T.dark, fontSize: 15, fontWeight: "900" }} numberOfLines={1}>{person.displayName}</Text>
      <Text selectable style={{ color: T.muted, fontSize: 12, fontWeight: "700" }} numberOfLines={1}>{person.username ? `@${person.username}` : "QuestLife adventurer"}</Text>
    </Pressable>
    {status ? <View style={{ minHeight: 34, paddingHorizontal: 11, borderRadius: 13, backgroundColor: person.isFriend ? `${T.green}16` : `${T.blue}16`, alignItems: "center", justifyContent: "center" }}><Text style={{ color: person.isFriend ? T.green : T.blue, fontSize: 11, fontWeight: "900" }}>{status}</Text></View> : <Pressable accessibilityRole="button" accessibilityLabel={`Follow ${person.displayName}`} onPress={() => onAdd(person)} style={({ pressed }) => ({ minHeight: 42, paddingHorizontal: 14, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: T.blue, borderBottomWidth: 4, borderBottomColor: "#258fd8", transform: [{ translateY: pressed ? 3 : 0 }] })}><Text style={{ color: T.white, fontSize: 12, fontWeight: "900", letterSpacing: 0.45 }}>FOLLOW</Text></Pressable>}
  </View>;
}

export function AddFriendsScreen() {
  const router = useRouter();
  const { contentWidth, horizontalPadding, safeAreaOffset } = useResponsiveScreenLayout();
  const insets = useSafeAreaInsets();
  const { overview, loading: socialLoading, searchUsers, follow } = useSocial();
  const [activeTab, setActiveTab] = useState<DiscoveryTab>("suggested");
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<ProfileSearchResult[]>([]);
  const [searchResults, setSearchResults] = useState<ProfileSearchResult[]>([]);
  const [contacts, setContacts] = useState<ProfileSearchResult[]>([]);
  const [contactsLoaded, setContactsLoaded] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [sharingQr, setSharingQr] = useState(false);
  const qrCodeRef = useRef<{ toDataURL: (callback: (data: string) => void) => void } | null>(null);

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
    if (trimmed.length < 2) { setSearchResults([]); setLoadingSearch(false); return; }
    let current = true;
    const timeout = setTimeout(() => {
      setLoadingSearch(true);
      searchUsers(trimmed).then((people) => { if (current) setSearchResults(people); }).catch(() => { if (current) setSearchResults([]); }).finally(() => { if (current) setLoadingSearch(false); });
    }, 220);
    return () => { current = false; clearTimeout(timeout); };
  }, [query, searchUsers]);

  async function addPerson(person: ProfileSearchResult) {
    try {
      await follow(person.userId);
      const following = { ...person, isFollowing: true, isFriend: person.followsYou };
      setSuggestions((items) => items.map((item) => item.userId === person.userId ? following : item));
      setSearchResults((items) => items.map((item) => item.userId === person.userId ? following : item));
      setContacts((items) => items.map((item) => item.userId === person.userId ? following : item));
    } catch {
      Alert.alert("Couldn’t follow", "Please try again in a moment.");
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

  async function openSystemCamera() {
    const cameraUrl = Platform.OS === "android"
      ? "intent:#Intent;action=android.media.action.IMAGE_CAPTURE;end"
      : "camera://";

    try {
      await Linking.openURL(cameraUrl);
    } catch {
      Alert.alert("Open your Camera", "Open your phone’s Camera app and point it at the QuestLife QR code. The code will bring you back to the right profile automatically.");
    }
  }

  async function inviteFriends() {
    try {
      await Share.share({ message: `Add me on QuestLife so we can take on quests together: ${profileUrl}`, url: profileUrl });
    } catch {
      // Dismissing the native share sheet is not an error the user needs to see.
    }
  }

  async function shareQrCode() {
    if (sharingQr || !qrCodeRef.current) return;
    setSharingQr(true);
    try {
      if (!await Sharing.isAvailableAsync()) throw new Error("Sharing is unavailable on this device.");
      const pngData = await new Promise<string>((resolve) => qrCodeRef.current?.toDataURL(resolve));
      const cacheDirectory = FileSystem.cacheDirectory;
      if (!cacheDirectory) throw new Error("Temporary storage is unavailable.");
      const fileUri = `${cacheDirectory}questlife-qr-code.png`;
      await FileSystem.writeAsStringAsync(fileUri, pngData, { encoding: FileSystem.EncodingType.Base64 });
      await Sharing.shareAsync(fileUri, { mimeType: "image/png", UTI: "public.png", dialogTitle: "Share your QuestLife QR code" });
    } catch {
      Alert.alert("Couldn’t share QR code", "Please try again in a moment.");
    } finally {
      setSharingQr(false);
    }
  }

  return <Screen scroll={false} padded={false} contentStyle={{ flex: 1 }}>
    <View style={{ width: contentWidth, alignSelf: "center", paddingHorizontal: horizontalPadding, gap: 15, transform: [{ translateX: safeAreaOffset }] }}>
      <Header title="Add Friends" subtitle="Build your quest crew" animated={false} right={<IconButton icon="arrow-back" label="Back to Social Friends" onPress={() => router.replace({ pathname: "/(tabs)/social", params: { tab: "friends" } })} color={T.dark} />} />
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
        {loadingSearch || (loadingSuggestions && activeTab === "suggested") || loadingContacts ? <PeopleLoadingSkeleton /> : null}
        {!loadingSearch && !loadingSuggestions && !loadingContacts && displayedPeople.length ? <Card style={{ borderRadius: 22, paddingHorizontal: 14, paddingVertical: 4, boxShadow: "none" }}>{displayedPeople.map((person, index) => <View key={person.userId} style={{ borderBottomWidth: index === displayedPeople.length - 1 ? 0 : 1, borderBottomColor: T.border }}><PersonRow person={person} onAdd={addPerson} onOpenProfile={() => router.push(`/add-friend/${person.userId}`)} /></View>)}</Card> : null}
        {!loadingSearch && !loadingSuggestions && !loadingContacts && query.trim().length >= 2 && !displayedPeople.length ? <EmptyState emoji="🔎" title="No adventurers found" body="Try a different username." /> : null}
      </View> : null}
      {activeTab === "qr" && !query.trim() ? socialLoading || !overview ? <QrLoadingSkeleton /> : <View style={{ gap: 14, alignItems: "center", paddingTop: 10 }}>
        <Text style={{ color: T.dark, fontSize: 19, fontWeight: "900", textAlign: "center" }}>Your QuestLife QR code</Text>
        <Card style={{ borderRadius: 26, padding: 18, alignItems: "center", gap: 13, borderColor: `${T.blue}55`, borderBottomWidth: 5, borderBottomColor: "#a8d8ff" }}>
          <View style={{ padding: 12, borderRadius: 20, backgroundColor: T.white }}><QRCode getRef={(ref) => { qrCodeRef.current = ref; }} value={profileUrl} size={196} color={T.dark} backgroundColor={T.white} /></View>
          <Text selectable style={{ color: T.muted, fontSize: 12, textAlign: "center", lineHeight: 18, fontWeight: "700" }}>Friends can scan this with their phone camera to open your profile and add you.</Text>
        </Card>
        <View style={{ flexDirection: "row", gap: 10, width: "100%" }}><FriendActionButton label={sharingQr ? "Preparing…" : "Share QR"} icon="share-social-outline" color={T.blue} onPress={() => void shareQrCode()} style={{ flex: 1 }} /><FriendActionButton label="Scan a code" icon="camera-outline" color={T.blue} onPress={() => void openSystemCamera()} style={{ flex: 1 }} /></View>
      </View> : null}
      </View>
    </ScrollView>
    <View style={{ alignItems: "center", borderTopWidth: 2, borderTopColor: T.border, backgroundColor: T.bg, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 12), paddingHorizontal: horizontalPadding }}>
      <View style={{ width: "100%", maxWidth: contentWidth, transform: [{ translateX: safeAreaOffset }] }}><FriendActionButton label="Invite friends" icon="share-social-outline" color={T.blue} onPress={inviteFriends} /></View>
    </View>
  </Screen>;
}
