import { Image, type ImageStyle, type StyleProp } from "react-native";

const flameArtwork = require("@/assets/icons/questlife-flame.png");

/**
 * The single source of truth for QuestLife's streak flame artwork.
 *
 * The supplied artwork is deliberately rendered as-is: its glow, colour, and
 * small floating details stay part of the original mark at every size.
 */
export function QuestlifeFlame({ size = 24, style }: { size?: number; style?: StyleProp<ImageStyle> }) {
  return <Image source={flameArtwork} resizeMode="cover" style={[{ width: size, height: size, borderRadius: size / 2 }, style]} />;
}
