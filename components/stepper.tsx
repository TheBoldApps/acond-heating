import React from "react";
import { View, Text, Pressable } from "react-native";
import { SymbolView } from "expo-symbols";
import * as Haptics from "expo-haptics";
import { AdaptiveGlass } from "@/theme/glass";
import { colors } from "@/theme/colors";

/**
 * Big, unmissable −/+ control. Foolproof by design: two huge glass targets,
 * a large tabular-nums readout, hard-clamped to a safe range. No sliders, no
 * keyboards — nothing a 60-year-old can get wrong.
 */
export function Stepper({
  value,
  unit,
  min,
  max,
  step,
  busy,
  onChange,
}: {
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  busy?: boolean;
  onChange: (next: number) => void;
}) {
  const bump = (dir: -1 | 1) => {
    const next = Math.min(max, Math.max(min, round(value + dir * step, step)));
    if (next === value) return;
    if (process.env.EXPO_OS === "ios") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onChange(next);
  };

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
      }}
    >
      <Button icon="minus" disabled={value <= min} onPress={() => bump(-1)} />
      {/* The setpoint number is the single focal point — large and light. */}
      <View style={{ flex: 1, alignItems: "center" }}>
        <Text
          selectable
          style={{
            fontSize: 72,
            lineHeight: 76,
            fontWeight: "300",
            color: busy ? colors.secondaryLabel : colors.label,
            fontVariant: ["tabular-nums"],
            letterSpacing: -1.5,
          }}
        >
          {value.toFixed(step < 1 ? 1 : 0)}
        </Text>
        <Text
          style={{
            fontSize: 14,
            color: colors.secondaryLabel,
            marginTop: 2,
            letterSpacing: 0.2,
          }}
        >
          {unit}
        </Text>
      </View>
      <Button icon="plus" disabled={value >= max} onPress={() => bump(1)} />
    </View>
  );
}

function Button({
  icon,
  disabled,
  onPress,
}: {
  icon: "plus" | "minus";
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <AdaptiveGlass
      interactive
      style={{ borderRadius: 36, borderCurve: "continuous", opacity: disabled ? 0.35 : 1 }}
    >
      <Pressable
        onPress={onPress}
        disabled={disabled}
        hitSlop={12}
        // Subtle tactile press feedback; hit area stays a generous 72pt.
        style={({ pressed }) => ({
          width: 72,
          height: 72,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.55 : 1,
        })}
      >
        <SymbolView
          name={icon === "plus" ? "plus" : "minus"}
          // Monochrome "ink" glyph — use the dark-adaptive PlatformColor.
          tintColor={colors.label}
          size={28}
          weight="medium"
        />
      </Pressable>
    </AdaptiveGlass>
  );
}

function round(n: number, step: number): number {
  const inv = 1 / step;
  return Math.round(n * inv) / inv;
}
