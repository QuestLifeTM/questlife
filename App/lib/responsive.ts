import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Shared responsive measurements for QuestLife's phone-first layouts.
 *
 * Values that convey the visual identity (icon sizes, radii, button heights)
 * stay in their components. This module only describes available space and
 * the few layout constraints that need to respond to a device.
 */
export const responsiveLayout = {
  compactWidth: 390,
  shortHeight: 720,
  minScreenGutter: 16,
  maxScreenGutter: 24,
  defaultContentMaxWidth: 520,
  tabBarContentHeight: 58,
  tabBarMinimumBottomPadding: 12,
  screenBottomSpacing: 24,
  sheetTopClearance: 12,
} as const;

export function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function responsiveScreenGutter(width: number) {
  return Math.round(clamp(width * 0.05, responsiveLayout.minScreenGutter, responsiveLayout.maxScreenGutter));
}

export function tabBarHeight(bottomInset: number) {
  return responsiveLayout.tabBarContentHeight + Math.max(bottomInset, responsiveLayout.tabBarMinimumBottomPadding);
}

export function screenBottomPadding(bottomInset: number, overlay: "none" | "tab" = "none") {
  const safeBottomPadding = bottomInset + responsiveLayout.screenBottomSpacing;
  return overlay === "tab"
    ? Math.max(safeBottomPadding, tabBarHeight(bottomInset) + responsiveLayout.screenBottomSpacing)
    : safeBottomPadding;
}

export function twoColumnWidth(contentInnerWidth: number, gap = 12) {
  return Math.max(0, (contentInnerWidth - gap) / 2);
}

export function useResponsiveScreenLayout(maxContentWidth = responsiveLayout.defaultContentMaxWidth) {
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const safeWidth = Math.max(0, width - insets.left - insets.right);
  const contentWidth = Math.min(safeWidth, maxContentWidth);
  const horizontalPadding = responsiveScreenGutter(contentWidth);
  const availableHeight = Math.max(0, height - insets.top - insets.bottom);

  return {
    width,
    height,
    availableHeight,
    contentWidth,
    contentInnerWidth: Math.max(0, contentWidth - horizontalPadding * 2),
    horizontalPadding,
    isCompact: safeWidth < responsiveLayout.compactWidth,
    isShort: availableHeight < responsiveLayout.shortHeight,
    safeAreaOffset: (insets.left - insets.right) / 2,
    insets,
  };
}

/** Resolves percentage sheet heights against the visible safe-area space. */
export function resolveSheetMaxHeight(
  maxHeight: number | `${number}%`,
  windowHeight: number,
  topInset: number,
) {
  const requestedHeight = typeof maxHeight === "number"
    ? maxHeight
    : (windowHeight * Number.parseFloat(maxHeight)) / 100;
  const availableHeight = Math.max(0, windowHeight - topInset - responsiveLayout.sheetTopClearance);

  return Math.min(requestedHeight, availableHeight);
}
