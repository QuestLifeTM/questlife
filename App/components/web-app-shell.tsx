import { Ionicons } from "@expo/vector-icons";
import { Link, usePathname } from "expo-router";
import { PropsWithChildren, useEffect } from "react";
import { Platform, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { T } from "@/components/theme";
import { ViewportContext, webNavigationWidth } from "@/lib/responsive";

const destinations = [
  { href: "/home", label: "Lobby", icon: "home-outline" },
  { href: "/explore", label: "Explore", icon: "compass-outline" },
  { href: "/social", label: "Social", icon: "people-outline" },
  { href: "/journal", label: "Journal", icon: "book-outline" },
  { href: "/profile", label: "Profile", icon: "person-outline" },
  { href: "/saved", label: "Saved", icon: "bookmarks-outline" },
  { href: "/friends", label: "Friends", icon: "person-add-outline" },
  { href: "/notifications", label: "Notifications", icon: "notifications-outline" },
  { href: "/settings", label: "Settings", icon: "settings-outline" },
] as const;

export function WebAppShell({ children, authenticated }: PropsWithChildren<{ authenticated: boolean }>) {
  const { width, height } = useWindowDimensions();
  const pathname = usePathname();
  const navigationWidth = authenticated ? webNavigationWidth(width) : 0;
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const page = destinations.find(({ href }) => pathname === href || pathname.startsWith(`${href}/`));
    document.title = `${page?.label ?? pathname.split("/").filter(Boolean).pop()?.replaceAll("-", " ") ?? "Welcome"} · QuestLife`;
  }, [pathname]);
  if (Platform.OS !== "web") return <>{children}</>;
  return <ViewportContext.Provider value={{ width: width - navigationWidth, height }}>
    <View style={{ flex: 1, flexDirection: "row", backgroundColor: T.bg }}>
      {navigationWidth > 0 ? <View role="navigation" aria-label="Main navigation" style={{ width: navigationWidth, backgroundColor: T.white, borderRightWidth: 1, borderColor: T.border }}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 6 }}>
          <Link href="/home" accessibilityLabel="QuestLife home" style={{ paddingVertical: 18, marginBottom: 20 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><Ionicons name="compass" size={32} color={T.blue} />{navigationWidth > 100 ? <Text style={{ fontFamily: "RubikBlack", fontSize: 22, color: T.dark }}>QuestLife</Text> : null}</View>
          </Link>
          {destinations.map(({ href, label, icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return <Link key={href} href={href} accessibilityLabel={label} aria-current={active ? "page" : undefined} style={{ borderRadius: 12, backgroundColor: active ? T.pill : "transparent", padding: 13, color: active ? T.blue : T.dark }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}><Ionicons name={icon} size={22} color={active ? T.blue : T.muted} />{navigationWidth > 100 ? <Text style={{ fontFamily: "RubikBold", color: active ? T.blue : T.dark, fontSize: 14 }}>{label}</Text> : null}</View>
            </Link>;
          })}
        </ScrollView>
      </View> : null}
      <View nativeID="main-content" role="main" style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>{children}</View>
    </View>
  </ViewportContext.Provider>;
}
