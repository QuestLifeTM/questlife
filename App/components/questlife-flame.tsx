import { Image, type ImageStyle, type StyleProp } from "react-native";

const flameArtwork = require("@/assets/icons/questlife-streak-flame.png");

/**
 * The single source of truth for QuestLife's streak flame artwork.
 *
 * The supplied artwork is deliberately rendered as-is at every size.
 */
export function QuestlifeFlame({ size = 24, style }: { size?: number; style?: StyleProp<ImageStyle> }) {
  return <Image source={flameArtwork} resizeMode="contain" style={[{ width: size, height: size }, style]} />;
}
