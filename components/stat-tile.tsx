import React from "react";
import { View, Text } from "react-native";
import { SymbolView } from "expo-symbols";
import { AdaptiveGlass } from "@/theme/glass";
import { colors } from "@/theme/colors";

/** A single glass readout tile: SF Symbol, big value, small caption. */
export function StatTile({
  icon,
  tint,
  value,
  caption,
}: {
  icon: string;
  tint: string;
  value: string;
  caption: string;
}) {
  return (
    <AdaptiveGlass style={{ flex: 1, borderRadius: 22, borderCurve: "continuous", minWidth: 150 }}>
      {/* Quiet tile: colored glyph sits above, the number is the star, caption recedes. */}
      <View style={{ padding: 18, gap: 14 }}>
        <SymbolView name={icon} tintColor={tint} size={20} weight="semibold" />
        <View style={{ gap: 3 }}>
          <Text
            selectable
            style={{
              fontSize: 27,
              fontWeight: "600",
              color: colors.label,
              fontVariant: ["tabular-nums"],
              letterSpacing: -0.4,
            }}
          >
            {value}
          </Text>
          <Text style={{ fontSize: 13, color: colors.secondaryLabel, letterSpacing: 0.1 }}>
            {caption}
          </Text>
        </View>
      </View>
    </AdaptiveGlass>
  );
}
