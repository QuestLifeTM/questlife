import { StyleSheet } from "react-native";
import Svg, { Circle, Line, Path, Polygon, Text as SvgText } from "react-native-svg";

const INK = "#9CB8C2";

/** Decorative route marker for the onboarding setup handoff. */
export function OnboardingCompassRoute() {
  return (
    <Svg
      accessibilityElementsHidden
      height={228}
      preserveAspectRatio="xMidYMin meet"
      style={styles.canvas}
      viewBox="0 0 320 228"
      width="100%"
    >
      <Path d="M 12 184 C 58 171, 104 187, 143 142 C 172 108, 182 87, 216 77" fill="none" stroke={INK} strokeDasharray="10 14" strokeLinecap="round" strokeWidth={2.15} />

      <Circle cx={260} cy={58} fill="none" r={43} stroke={INK} strokeWidth={2.15} />
      <Circle cx={260} cy={58} fill="none" r={38.5} stroke={INK} strokeWidth={1.5} />
      <Line stroke={INK} strokeWidth={2.15} x1={260} x2={260} y1={10} y2={21} />
      <Line stroke={INK} strokeWidth={2.15} x1={308} x2={297} y1={58} y2={58} />
      <Line stroke={INK} strokeWidth={2.15} x1={260} x2={260} y1={106} y2={95} />
      <Line stroke={INK} strokeWidth={2.15} x1={212} x2={223} y1={58} y2={58} />

      <Polygon fill="none" points="260,18 268,47 290,58 268,66 260,98 252,66 230,58 252,47" stroke={INK} strokeLinejoin="round" strokeWidth={1.9} />
      <Polygon fill="none" points="260,28 265,51 281,58 265,63 260,87 255,63 239,58 255,51" stroke={INK} strokeLinejoin="round" strokeWidth={1.45} />
      <Line stroke={INK} strokeWidth={1.3} x1={260} x2={260} y1={28} y2={87} />
      <Line stroke={INK} strokeWidth={1.3} x1={239} x2={281} y1={58} y2={58} />
      <Circle cx={260} cy={58} fill={INK} r={2.5} />

      <SvgText fill={INK} fontFamily="Rubik" fontSize={17} fontStyle="italic" fontWeight="700" textAnchor="middle" x={260} y={8}>N</SvgText>
      <SvgText fill={INK} fontFamily="Rubik" fontSize={17} fontStyle="italic" fontWeight="700" textAnchor="middle" x={314} y={64}>E</SvgText>
      <SvgText fill={INK} fontFamily="Rubik" fontSize={17} fontStyle="italic" fontWeight="700" textAnchor="middle" x={260} y={124}>S</SvgText>
      <SvgText fill={INK} fontFamily="Rubik" fontSize={17} fontStyle="italic" fontWeight="700" textAnchor="middle" x={206} y={64}>W</SvgText>
    </Svg>
  );
}

const styles = StyleSheet.create({
  canvas: { alignSelf: "center", opacity: 0.92 },
});
