import Svg, { Path } from "react-native-svg";

/** Matches the supplied AddFriendIcon.svg. */
export function AddFriendIcon({ size = 24 }: { size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M7.71422 10.2856C9.60776 10.2856 11.1428 8.75059 11.1428 6.85704C11.1428 4.96349 9.60776 3.42847 7.71422 3.42847C5.82067 3.42847 4.28564 4.96349 4.28564 6.85704C4.28564 8.75059 5.82067 10.2856 7.71422 10.2856Z" fill="#4DA8FF" />
    <Path d="M1.28564 20.1429C1.28564 16.5926 4.16393 13.7144 7.71422 13.7144C11.2645 13.7144 14.1428 16.5926 14.1428 20.1429" stroke="#4DA8FF" strokeWidth={1.88571} strokeLinecap="round" />
    <Path d="M18.8572 9.42847V16.2856" stroke="#4DA8FF" strokeWidth={1.88571} strokeLinecap="round" />
    <Path d="M15.4285 12.8572H22.2856" stroke="#4DA8FF" strokeWidth={1.88571} strokeLinecap="round" />
  </Svg>;
}
