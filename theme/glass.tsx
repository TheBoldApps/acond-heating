import React from "react";
import { View, ViewStyle, StyleProp } from "react-native";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { BlurView } from "expo-blur";

/**
 * AdaptiveGlass — a Liquid Glass surface on iOS 26+, degrading to a system
 * material blur on older iOS and a translucent fill everywhere else.
 *
 * One component so the whole UI speaks the same visual language and we never
 * branch on the platform at the call site.
 */
export function AdaptiveGlass({
  children,
  style,
  interactive = false,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  interactive?: boolean;
}) {
  if (isLiquidGlassAvailable()) {
    return (
      <GlassView isInteractive={interactive} style={style}>
        {children}
      </GlassView>
    );
  }
  return (
    <BlurView
      tint="systemMaterial"
      intensity={80}
      style={[{ overflow: "hidden" }, style]}
    >
      {children}
    </BlurView>
  );
}
