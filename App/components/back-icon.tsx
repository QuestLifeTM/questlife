import Svg, { Path } from "react-native-svg";

/** Matches the supplied BackIcon.svg while allowing the shared controls to size it. */
export function BackIcon({ size = 24, color = "#4DA8FF" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M19 12H5" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
      <Path d="M11 6L5 12L11 18" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
