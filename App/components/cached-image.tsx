import { Image as ExpoImage } from "expo-image";
import { ImageStyle, StyleProp } from "react-native";

/** Shared low-overhead remote image renderer for feeds, albums, and avatars. */
export function CachedImage({ uri, style, contentFit = "cover", accessibilityLabel }: { uri: string; style: StyleProp<ImageStyle>; contentFit?: "cover" | "contain"; accessibilityLabel?: string }) {
  return <ExpoImage
    source={{ uri }}
    style={style}
    contentFit={contentFit}
    cachePolicy="memory-disk"
    transition={120}
    recyclingKey={uri}
    allowDownscaling
    accessibilityLabel={accessibilityLabel}
  />;
}
