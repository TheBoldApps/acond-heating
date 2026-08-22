import { Platform, PlatformColor, OpaqueColorValue } from "react-native";

/**
 * Native semantic colors. On iOS these resolve to UIKit system colors via
 * PlatformColor — they adapt to light/dark mode and accessibility settings
 * on-device, so the app carries no light/dark hex tables of its own. Every
 * value has a hex fallback for non-iOS platforms.
 */
function ios(name: string, fallback: string): string | OpaqueColorValue {
  return Platform.OS === "ios" ? PlatformColor(name) : fallback;
}

export const colors = {
  label: ios("label", "#000000"),
  secondaryLabel: ios("secondaryLabel", "#3c3c43"),
  tertiaryLabel: ios("tertiaryLabel", "#3c3c4399"),
  separator: ios("separator", "#c6c6c8"),
  systemBackground: ios("systemBackground", "#ffffff"),
  secondarySystemBackground: ios("secondarySystemBackground", "#f2f2f7"),

  blue: ios("systemBlue", "#007aff"),
  red: ios("systemRed", "#ff3b30"),
  orange: ios("systemOrange", "#ff9500"),
  green: ios("systemGreen", "#34c759"),
  teal: ios("systemTeal", "#30b0c7"),
  yellow: ios("systemYellow", "#ffcc00"),
} as const;

/**
 * Plain-hex palette for SF Symbol tints. The symbol renderer wants a concrete
 * color string, not a PlatformColor object — these mirror iOS system colors.
 */
export const ink = {
  label: "#1c1c1e",
  secondary: "#8e8e93",
  blue: "#007aff",
  red: "#ff3b30",
  orange: "#ff9500",
  green: "#34c759",
  teal: "#30b0c7",
  yellow: "#ffcc00",
} as const;
