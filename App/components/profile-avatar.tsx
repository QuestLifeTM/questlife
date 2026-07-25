import { Image, View } from "react-native";
import { T } from "@/components/theme";
import { CachedImage } from "@/components/cached-image";

const defaultProfileAvatar = require("../assets/profile/default-profile-avatar.png");

export function ProfileAvatar({ uri, emoji: _emoji, color = T.blue, size = 44, label }: { uri?: string | null; emoji?: string; color?: string; size?: number; label: string }) {
  return <View accessible accessibilityLabel={label} style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", backgroundColor: uri ? T.white : `${color}18`, borderWidth: 2, borderColor: uri ? T.white : `${color}66`, alignItems: "center", justifyContent: "center" }}>
    {uri ? <CachedImage uri={uri} style={{ width: "100%", height: "100%" }} accessibilityLabel={label} /> : <Image source={defaultProfileAvatar} resizeMode="cover" style={{ width: "100%", height: "100%" }} />}
  </View>;
}
