import React, { useCallback, useState } from "react";
import { ScrollView, View, Text, Pressable, RefreshControl } from "react-native";
import { useFocusEffect } from "expo-router";
import { SymbolView, type SFSymbol } from "expo-symbols";
import * as Haptics from "expo-haptics";
import { AdaptiveGlass } from "@/theme/glass";
import { colors, ink } from "@/theme/colors";
import { LineChart } from "@/components/line-chart";
import { getSeries, getStats, type Field, type Point } from "@/lib/history";

const RANGES: { label: string; ms: number }[] = [
  { label: "24 h", ms: 24 * 3600e3 },
  { label: "7 dní", ms: 7 * 864e5 },
  { label: "30 dní", ms: 30 * 864e5 },
];

type Metric = {
  field: Field;
  title: string;
  color: string;
  unit: string;
  icon: SFSymbol;
  digits: number; // decimals for the summary line
};

const METRICS: Metric[] = [
  { field: "roomTemp", title: "Teplota v domě", color: ink.orange, unit: "°C", icon: "house.fill", digits: 0 },
  { field: "dhwTemp", title: "Teplá voda", color: ink.blue, unit: "°C", icon: "drop.fill", digits: 0 },
  { field: "outdoor", title: "Venkovní teplota", color: ink.teal, unit: "°C", icon: "thermometer.medium", digits: 0 },
  { field: "heatKw", title: "Výkon", color: ink.yellow, unit: "kW", icon: "bolt.fill", digits: 1 },
];

type Series = { points: Point[]; stats: { min: number; max: number; avg: number } | null };

export default function Insights() {
  const [rangeIdx, setRangeIdx] = useState(0);
  const [data, setData] = useState<Partial<Record<Field, Series>>>({});
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const ms = RANGES[rangeIdx].ms;
    const entries = await Promise.all(
      METRICS.map(async (m): Promise<[Field, Series]> => {
        const [points, stats] = await Promise.all([
          getSeries(m.field, ms),
          getStats(m.field, ms),
        ]);
        return [m.field, { points, stats }];
      })
    );
    const next: Partial<Record<Field, Series>> = {};
    for (const [field, series] of entries) next[field] = series;
    setData(next);
  }, [rangeIdx]);

  // Reload whenever the tab regains focus or the range changes, so freshly
  // recorded samples appear.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 48 }}
      style={{ backgroundColor: colors.systemBackground }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <RangePicker index={rangeIdx} onChange={setRangeIdx} />

      {METRICS.map((m) => {
        const series = data[m.field];
        return (
          <AdaptiveGlass key={m.field} style={{ borderRadius: 24 }}>
            <View style={{ padding: 16, gap: 16 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <SymbolView name={m.icon} tintColor={m.color} size={15} weight="semibold" />
                  <Text style={{ fontSize: 17, fontWeight: "600", color: colors.label }}>
                    {m.title}
                  </Text>
                </View>
                <Text
                  style={{
                    fontSize: 13,
                    color: colors.secondaryLabel,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {summary(series?.stats, m)}
                </Text>
              </View>
              <LineChart
                points={series?.points ?? []}
                color={m.color}
                unit={m.unit}
                height={180}
              />
            </View>
          </AdaptiveGlass>
        );
      })}
    </ScrollView>
  );
}

function summary(
  stats: { min: number; max: number; avg: number } | null | undefined,
  m: Metric
): string {
  if (!stats) return "—";
  const f = (n: number) => n.toFixed(m.digits);
  return `${f(stats.min)}–${f(stats.max)} ${m.unit} · ø ${f(stats.avg)}`;
}

function RangePicker({
  index,
  onChange,
}: {
  index: number;
  onChange: (i: number) => void;
}) {
  return (
    <AdaptiveGlass style={{ borderRadius: 12 }}>
      <View style={{ flexDirection: "row", padding: 3 }}>
        {RANGES.map((r, i) => {
          const active = i === index;
          return (
            <Pressable
              key={r.label}
              onPress={() => {
                if (i === index) return;
                if (process.env.EXPO_OS === "ios") {
                  Haptics.selectionAsync();
                }
                onChange(i);
              }}
              style={{
                flex: 1,
                paddingVertical: 7,
                borderRadius: 9,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: active ? colors.secondarySystemBackground : "transparent",
                // Subtle lift on the selected pill, matching the native iOS
                // segmented control. Shadow color is not a text/surface color.
                shadowColor: "#000",
                shadowOpacity: active ? 0.12 : 0,
                shadowRadius: active ? 3 : 0,
                shadowOffset: { width: 0, height: 1 },
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: active ? "600" : "500",
                  color: active ? colors.label : colors.secondaryLabel,
                }}
              >
                {r.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </AdaptiveGlass>
  );
}
