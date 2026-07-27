import Svg, { Path } from "react-native-svg";

/** Matches the supplied empty and filled heart SVGs. */
export function HeartIcon({ filled = false, size = 24 }: { filled?: boolean; size?: number }) {
  const color = "#FF6B81";
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M12 20.5C12 20.5 3 14.5 3 8.5C3 7.45059 3.33019 6.42778 3.94379 5.57645C4.55739 4.72512 5.4233 4.08844 6.41886 3.75658C7.41442 3.42473 8.48916 3.41453 9.49084 3.72743C10.4925 4.04033 11.3704 4.66047 12 5.5C12.6296 4.66047 13.5075 4.04033 14.5092 3.72743C15.5108 3.41453 16.5856 3.42473 17.5811 3.75658C18.5767 4.08844 19.4426 4.72512 20.0562 5.57645C20.6698 6.42778 21 7.45059 21 8.5C21 14.5 12 20.5 12 20.5Z" fill={filled ? color : "none"} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
