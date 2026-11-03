import { useEffect } from "react";
import { AppState, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";

export function QuestVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, instance => { instance.loop = false; });
  useEffect(() => {
    const sub = AppState.addEventListener("change", state => { if (state !== "active") player.pause(); });
    return () => sub.remove();
  }, [player]);
  return <View style={{ width: "100%", aspectRatio: 3 / 4, borderRadius: 24, overflow: "hidden", backgroundColor: "#191D28" }}>
    <VideoView player={player} nativeControls contentFit="contain" style={{ flex: 1 }} />
  </View>;
}
