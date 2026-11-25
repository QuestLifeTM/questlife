import Svg, { Path } from "react-native-svg";
import { normalizeQuestCategory, questCategoryColors, QuestCategory } from "@/types/content";

type PartyCategoryIconProps = {
  category: QuestCategory;
  size?: number;
  color?: string;
  strokeWidth?: number;
};

export function PartyCategoryIcon({ category, size = 22, color: colorOverride, strokeWidth = 1.9 }: PartyCategoryIconProps) {
  category = normalizeQuestCategory(category);
  const color = colorOverride ?? questCategoryColors[category].text;
  const stroke = { stroke: color, strokeWidth, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {category === "ADVENTURE" ? <>
        <Path d="M3 20H21" {...stroke} />
        <Path d="M3 20L9 7L13 14L15.5 10L21 20" {...stroke} />
        <Path d="M13 3V9" {...stroke} />
        <Path d="M13 3L16 4.2L13 5.6" fill={color} {...stroke} />
      </> : null}
      {category === "CREATIVITY" ? <>
        <Path d="M12 3C9.61305 3 7.32387 3.94821 5.63604 5.63604C3.94821 7.32387 3 9.61305 3 12C3 14.3869 3.94821 16.6761 5.63604 18.364C7.32387 20.0518 9.61305 21 12 21C13.1 21 13.7 20 13.3 19C12.9 18 13.5 17 14.5 17H17C18.0609 17 19.0783 16.5786 19.8284 15.8284C20.5786 15.0783 21 14.0609 21 13C21 8.5 17 5 12 5V3Z" {...stroke} />
        <Path d="M8 11C8.55228 11 9 10.5523 9 10C9 9.44772 8.55228 9 8 9C7.44772 9 7 9.44772 7 10C7 10.5523 7.44772 11 8 11Z" fill={color} />
        <Path d="M12 8.5C12.5523 8.5 13 8.05228 13 7.5C13 6.94772 12.5523 6.5 12 6.5C11.4477 6.5 11 6.94772 11 7.5C11 8.05228 11.4477 8.5 12 8.5Z" fill={color} />
        <Path d="M16 11C16.5523 11 17 10.5523 17 10C17 9.44772 16.5523 9 16 9C15.4477 9 15 9.44772 15 10C15 10.5523 15.4477 11 16 11Z" fill={color} />
      </> : null}
      {category === "FITNESS" ? <>
        <Path d="M4 9V15M7 7V17M17 7V17M20 9V15" {...stroke} />
        <Path d="M7 12H17" {...stroke} />
      </> : null}
      {category === "FOOD AND DRINKS" ? <>
        <Path d="M6 9H18L17 20C17 20.2652 16.8946 20.5196 16.7071 20.7071C16.5196 20.8946 16.2652 21 16 21H8C7.73478 21 7.48043 20.8946 7.29289 20.7071C7.10536 20.5196 7 20.2652 7 20L6 9Z" {...stroke} />
        <Path d="M5 9H19" {...stroke} />
        <Path d="M9 5C9 4 10 4 10 3M13 5C13 4 14 4 14 3" {...stroke} />
      </> : null}
      {category === "SOCIAL" ? <>
        <Path d="M9 11C10.6569 11 12 9.65685 12 8C12 6.34315 10.6569 5 9 5C7.34315 5 6 6.34315 6 8C6 9.65685 7.34315 11 9 11Z" {...stroke} />
        <Path d="M3.5 20C3.5 17 6 15 9 15C12 15 14.5 17 14.5 20" {...stroke} />
        <Path d="M16 5.5C16.6398 5.66947 17.2056 6.04577 17.6093 6.57029C18.013 7.09482 18.2319 7.73812 18.2319 8.4C18.2319 9.06188 18.013 9.70518 17.6093 10.2297C17.2056 10.7542 16.6398 11.1305 16 11.3" {...stroke} />
        <Path d="M17 15C19.3 15.5 21 17.4 21 20" {...stroke} />
      </> : null}
    </Svg>
  );
}
