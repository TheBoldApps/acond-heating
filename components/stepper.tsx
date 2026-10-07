import React, { useEffect, useRef, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { SymbolView } from "expo-symbols";
import * as Haptics from "expo-haptics";
import { AdaptiveGlass } from "@/theme/glass";
import { colors } from "@/theme/colors";

/**
 * Big, unmissable −/+ control. Foolproof by design: two huge glass targets,
 * a large tabular-nums readout, hard-clamped to a safe range.
 *
 * Every tap advances a LOCAL value instantly (so quick repeated taps never feel
 * dropped, even while a previous network write is in flight), and the network
 * write is debounced — only the final value is sent once the user stops tapping.
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
  const [local, setLocal] = useState(value);
  const dirty = useRef(false); // user is mid-adjust; ignore prop echoes
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Follow the device value, but not while the user is actively adjusting.
  useEffect(() => {
    if (!dirty.current) setLocal(value);
  }, [value]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const bump = (dir: -1 | 1) => {
    const next = Math.min(max, Math.max(min, round(local + dir * step, step)));
    if (next === local) return;
    if (process.env.EXPO_OS === "ios") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    dirty.current = true;
    setLocal(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      dirty.current = false;
      onChange(next);
    }, 500);
  };

  const shown = local.toFixed(step < 1 ? 1 : 0);

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
      }}
    >
      <Button icon="minus" disabled={local <= min} onPress={() => bump(-1)} />
      {/* The setpoint number is the single focal point — large and light. */}
      <View style={{ flex: 1, alignItems: "center" }}>
        <Text
          // "22.5" must never wrap to "22." / "5": at 72 pt four characters are
          // wider than the space between the buttons on a 402 pt phone, and
          // adjustsFontSizeToFit does not shrink it reliably. Size by length.
          numberOfLines={1}
          style={{
            fontSize: shown.length > 3 ? 60 : 72,
            lineHeight: 76,
            fontWeight: "300",
            color: busy ? colors.secondaryLabel : colors.label,
            fontVariant: ["tabular-nums"],
            letterSpacing: -1.5,
          }}
        >
          {shown}
        </Text>
        <Text style={{ fontSize: 14, color: colors.secondaryLabel, marginTop: 2, letterSpacing: 0.2 }}>
          {unit}
        </Text>
      </View>
      <Button icon="plus" disabled={local >= max} onPress={() => bump(1)} />
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
