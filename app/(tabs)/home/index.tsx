import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, View, Text, RefreshControl, Alert } from "react-native";
import { router, Stack, useFocusEffect } from "expo-router";
import { SymbolView } from "expo-symbols";
import * as Haptics from "expo-haptics";
import { AcondClient, type Config } from "@/lib/acond-client";
import { readSnapshot, type Snapshot } from "@/lib/snapshot";
import { PAGE, V, LIMITS } from "@/lib/variables";
import { loadConfig } from "@/lib/store";
import { initHistory, recordSample } from "@/lib/history";
import { Stepper } from "@/components/stepper";
import { StatTile } from "@/components/stat-tile";
import { AdaptiveGlass } from "@/theme/glass";
import { colors, ink } from "@/theme/colors";

const POLL_MS = 12000;

export default function Home() {
  const [client, setClient] = useState<AcondClient | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // Pending setpoints show instantly (optimistic) until a fresh read confirms.
  const [roomPending, setRoomPending] = useState<number | null>(null);
  const [dhwPending, setDhwPending] = useState<number | null>(null);
  // Connection health for the live indicator.
  const [lastOk, setLastOk] = useState<number | null>(null);
  const [errorSince, setErrorSince] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // Per-setpoint write queue: the latest requested value always wins, and no tap
  // is dropped even if a previous write is still in flight.
  const latestWrite = useRef<{ room: number | null; dhw: number | null }>({ room: null, dhw: null });
  const draining = useRef<{ room: boolean; dhw: boolean }>({ room: false, dhw: false });

  useEffect(() => {
    initHistory();
    loadConfig().then((cfg: Config | null) => {
      if (!cfg) return router.replace("/");
      setClient(new AcondClient(cfg));
    });
  }, []);

  const refresh = useCallback(
    async (silent = false) => {
      if (!client) return;
      if (!silent) setRefreshing(true);
      try {
        const s = await readSnapshot(client);
        setSnap(s);
        setError(null);
        setLastOk(Date.now());
        setErrorSince(null);
        recordSample(s); // log to on-device history (self-throttled)
        // clear optimistic values once the controller agrees
        if (roomPending != null && s.roomTarget === roomPending) setRoomPending(null);
        if (dhwPending != null && s.dhwTarget === dhwPending) setDhwPending(null);
      } catch {
        setError("Připojení se ztratilo. Zkouším znovu…");
        setErrorSince((prev) => prev ?? Date.now());
      } finally {
        if (!silent) setRefreshing(false);
      }
    },
    [client, roomPending, dhwPending]
  );

  // poll while the screen is focused
  useFocusEffect(
    useCallback(() => {
      if (!client) return;
      refresh(true);
      const id = setInterval(() => refresh(true), POLL_MS);
      return () => clearInterval(id);
    }, [client, refresh])
  );

  // keep the "connected / offline for X" label live between polls
  useFocusEffect(
    useCallback(() => {
      const id = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(id);
    }, [])
  );

  const connected = errorSince == null && lastOk != null;

  async function writeSetpoint(
    kind: "room" | "dhw",
    value: number,
    varName: string,
    page: string
  ) {
    if (!client) return;
    const setPending = kind === "room" ? setRoomPending : setDhwPending;
    setPending(value);
    latestWrite.current[kind] = value; // newest request wins
    if (draining.current[kind]) return; // an in-flight drain will pick it up
    draining.current[kind] = true;
    try {
      while (latestWrite.current[kind] != null) {
        const v = latestWrite.current[kind]!;
        latestWrite.current[kind] = null;
        await client.writeVar(varName, v.toFixed(1), page);
      }
      setTimeout(() => refresh(true), 600); // confirm from the device
    } catch {
      if (process.env.EXPO_OS === "ios") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      latestWrite.current[kind] = null;
      setPending(null);
      Alert.alert("Nepovedlo se", "Změnu se nepodařilo uložit. Zkuste to prosím znovu.");
    } finally {
      draining.current[kind] = false;
    }
  }

  const roomTarget = roomPending ?? snap?.roomTarget ?? null;
  const dhwTarget = dhwPending ?? snap?.dhwTarget ?? null;

  const activity = useMemo(() => describeActivity(snap), [snap]);

  return (
    <>
      <Stack.Screen options={{ title: "Domů" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 16 }}
        style={{ backgroundColor: colors.systemBackground }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => refresh(false)} />}
      >
        <ConnectionPill connected={connected} lastOk={lastOk} errorSince={errorSince} now={now} />

        {snap?.fault && <Banner text="Čerpadlo hlásí poruchu. Zkontroluj jednotku." />}

        {/* activity hero line */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 4, paddingTop: 4 }}>
          <SymbolView name={activity.icon} tintColor={activity.tint} size={20} weight="semibold" />
          <Text style={{ fontSize: 17, color: colors.label, fontWeight: "500", letterSpacing: -0.2 }}>
            {activity.text}
          </Text>
        </View>

        {/* ROOM — the hero control */}
        <AdaptiveGlass
          style={{
            borderRadius: 28,
            borderCurve: "continuous",
            // Near-invisible lift for depth — no hard border.
            boxShadow: "0px 8px 24px rgba(0,0,0,0.06)",
          }}
        >
          <View style={{ padding: 24, gap: 24 }}>
            <CardHeader
              icon="house.fill"
              tint={ink.orange}
              title="Teplota v domě"
              detail={fmt(snap?.roomTemp, "°C teď")}
            />
            {snap?.summer ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 }}>
                <SymbolView name="sun.max.fill" tintColor={ink.yellow} size={22} weight="semibold" />
                <Text style={{ flex: 1, fontSize: 15, color: colors.secondaryLabel }}>
                  V letním režimu je topení vypnuté. Přepni na zimní režim v Nastavení.
                </Text>
              </View>
            ) : roomTarget != null ? (
              <Stepper
                value={roomTarget}
                unit="cílová teplota"
                {...LIMITS.room}
                busy={roomPending != null}
                onChange={(v) => writeSetpoint("room", v, V.roomTarget, PAGE.MAIN)}
              />
            ) : (
              <Skeleton />
            )}
          </View>
        </AdaptiveGlass>

        {/* HOT WATER */}
        <AdaptiveGlass
          style={{
            borderRadius: 28,
            borderCurve: "continuous",
            boxShadow: "0px 8px 24px rgba(0,0,0,0.06)",
          }}
        >
          <View style={{ padding: 24, gap: 24 }}>
            <CardHeader
              icon="drop.fill"
              tint={ink.blue}
              title="Teplá voda"
              detail={fmt(snap?.dhwTemp, "°C teď")}
            />
            {dhwTarget != null ? (
              <Stepper
                value={dhwTarget}
                unit="cílová teplota"
                {...LIMITS.dhw}
                busy={dhwPending != null}
                onChange={(v) => writeSetpoint("dhw", v, V.dhwTarget, PAGE.DHW)}
              />
            ) : (
              <Skeleton />
            )}
          </View>
        </AdaptiveGlass>

        {/* READINGS */}
        <View style={{ flexDirection: "row", gap: 12 }}>
          <StatTile
            icon="thermometer.medium"
            tint={ink.teal}
            value={fmt(snap?.outdoorTemp, "°C")}
            caption="Venku"
          />
          <StatTile
            icon="bolt.fill"
            tint={ink.yellow}
            value={snap?.heatOutputKw != null ? `${snap.heatOutputKw.toFixed(1)} kW` : "—"}
            caption={powerCaption(snap)}
          />
        </View>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <StatTile
            icon="arrow.up.right"
            tint={ink.red}
            value={fmt(snap?.flowTemp, "°C")}
            caption="Výstup do topení"
          />
          <StatTile
            icon="calendar"
            tint={ink.green}
            value={fmt(snap?.outdoorAvg, "°C")}
            caption="Venku (průměr)"
          />
        </View>
      </ScrollView>
    </>
  );
}

function CardHeader({
  icon,
  tint,
  title,
  detail,
}: {
  icon: string;
  tint: string;
  title: string;
  detail: string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <SymbolView name={icon} tintColor={tint} size={22} weight="semibold" />
        <Text style={{ fontSize: 19, fontWeight: "600", color: colors.label, letterSpacing: -0.3 }}>
          {title}
        </Text>
      </View>
      <Text style={{ fontSize: 15, color: colors.secondaryLabel, fontVariant: ["tabular-nums"] }}>
        {detail}
      </Text>
    </View>
  );
}

function ConnectionPill({
  connected,
  lastOk,
  errorSince,
  now,
}: {
  connected: boolean;
  lastOk: number | null;
  errorSince: number | null;
  now: number;
}) {
  const dot = connected ? colors.green : colors.red;
  const label = connected
    ? lastOk && now - lastOk < 6000
      ? "Připojeno · živě"
      : `Připojeno · aktualizováno před ${formatDuration(now - (lastOk ?? now))}`
    : errorSince
      ? `Bez připojení · ${formatDuration(now - errorSince)}`
      : "Připojování…";
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        alignSelf: "flex-start",
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 999,
        backgroundColor: colors.secondarySystemBackground,
      }}
    >
      <View style={{ width: 9, height: 9, borderRadius: 999, backgroundColor: dot }} />
      <Text style={{ fontSize: 13, color: colors.secondaryLabel, fontVariant: ["tabular-nums"] }}>
        {label}
      </Text>
    </View>
  );
}

/** Caption under the power tile — explains a 0 kW reading in plain Czech. */
function powerCaption(s: Snapshot | null): string {
  if (!s) return "Výkon";
  if (s.heatOutputKw != null && s.heatOutputKw > 0) return "Aktuální výkon";
  if (s.defrost) return "Odmrazování";
  if (s.dhwActive) return "Ohřívá vodu";
  if (s.summer) return "Klid — letní režim";
  if (!s.compressor) return "Čerpadlo neběží";
  return "V klidu";
}

/** "5 s" / "3 min" / "2 h" — coarse, for the connection label. */
function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  return `${Math.round(m / 60)} h`;
}

function Banner({ text, tone = "error" }: { text: string; tone?: "error" | "warn" }) {
  const bg = tone === "error" ? colors.red : colors.orange;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        backgroundColor: bg,
        padding: 14,
        borderRadius: 16,
        borderCurve: "continuous",
      }}
    >
      <SymbolView name="exclamationmark.triangle.fill" tintColor="#ffffff" size={20} weight="semibold" />
      <Text style={{ color: "#fff", fontSize: 15, fontWeight: "500", flex: 1 }} selectable>
        {text}
      </Text>
    </View>
  );
}

function Skeleton() {
  return (
    <View
      style={{
        height: 96,
        borderRadius: 20,
        borderCurve: "continuous",
        backgroundColor: colors.secondarySystemBackground,
      }}
    />
  );
}

function fmt(n: number | null | undefined, suffix: string): string {
  return n == null ? "—" : `${n.toFixed(1)} ${suffix}`;
}

function describeActivity(s: Snapshot | null): { icon: string; tint: string; text: string } {
  if (!s) return { icon: "ellipsis", tint: ink.secondary, text: "Načítám…" };
  if (s.defrost) return { icon: "snowflake", tint: ink.teal, text: "Odmrazování" };
  if (s.dhwActive) return { icon: "drop.fill", tint: ink.blue, text: "Ohřívá teplou vodu" };
  if (s.compressor) return { icon: "flame.fill", tint: ink.orange, text: "Topí" };
  return {
    icon: s.summer ? "sun.max.fill" : "leaf.fill",
    tint: s.summer ? (ink.yellow) : (ink.green),
    text: s.summer ? "Letní režim — v klidu" : "Připraveno",
  };
}
