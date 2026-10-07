import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, Switch, Text, View } from "react-native";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { router, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import { colors, ink } from "@/theme/colors";
import { loadConfig, clearConfig } from "@/lib/store";
import { AcondClient, AcondError, type Config } from "@/lib/acond-client";
import { setHeatingOn, setSeason } from "@/lib/controls";
import { REGULATION_LABEL } from "@/lib/snapshot";
import { PAGE, V } from "@/lib/variables";
import { loadThemePref, saveThemePref, applyThemePref, type ThemePref } from "@/lib/theme-preference";

// Small uppercase group header, like iOS Settings section titles.
function SectionHeader({ title }: { title: string }) {
  return (
    <Text
      style={{
        color: colors.secondaryLabel,
        fontSize: 13,
        fontWeight: "600",
        textTransform: "uppercase",
        letterSpacing: 0.5,
        marginBottom: 8,
        marginLeft: 16,
      }}
    >
      {title}
    </Text>
  );
}

// Rounded grouped card wrapping a set of rows.
function Card({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: colors.secondarySystemBackground,
        borderRadius: 12,
        borderCurve: "continuous",
        overflow: "hidden",
      }}
    >
      {children}
    </View>
  );
}

// A single settings row: optional icon, a label, and a right-aligned value.
function Row({
  icon,
  label,
  value,
  first,
}: {
  icon?: SymbolViewProps["name"];
  label: string;
  value: string;
  first?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 12,
        borderTopWidth: first ? 0 : 0.5,
        borderTopColor: colors.separator,
      }}
    >
      {icon ? (
        <SymbolView name={icon} tintColor={colors.secondaryLabel} size={20} weight="regular" />
      ) : null}
      <Text style={{ color: colors.secondaryLabel, fontSize: 16 }}>{label}</Text>
      <Text
        selectable
        style={{
          flex: 1,
          textAlign: "right",
          color: colors.label,
          fontSize: 16,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

// A row that carries a subtitle paragraph instead of a right-aligned value.
function InfoRow({
  icon,
  label,
  subtitle,
  first,
}: {
  icon?: SymbolViewProps["name"];
  label: string;
  subtitle: string;
  first?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 12,
        borderTopWidth: first ? 0 : 0.5,
        borderTopColor: colors.separator,
      }}
    >
      {icon ? (
        <SymbolView
          name={icon}
          tintColor={colors.secondaryLabel}
          size={20}
          weight="regular"
          style={{ marginTop: 2 }}
        />
      ) : null}
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: colors.label, fontSize: 16 }}>{label}</Text>
        <Text style={{ color: colors.secondaryLabel, fontSize: 13, lineHeight: 18 }}>
          {subtitle}
        </Text>
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const [config, setConfig] = useState<Config | null>(null);
  const [client, setClient] = useState<AcondClient | null>(null);
  const [summer, setSummer] = useState<boolean | null>(null);
  const [heatingOn, setHeatingOnState] = useState<boolean | null>(null);
  const [regulation, setRegulation] = useState<string | null>(null);
  const [seasonEnd, setSeasonEnd] = useState<number | null>(null);
  const [outdoorAvg, setOutdoorAvg] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [theme, setTheme] = useState<ThemePref>("auto");

  useEffect(() => {
    loadConfig().then((cfg) => {
      setConfig(cfg);
      if (cfg) setClient(new AcondClient(cfg));
    });
    loadThemePref().then(setTheme);
  }, []);

  function onSelectTheme(p: ThemePref) {
    if (p === theme) return;
    if (process.env.EXPO_OS === "ios") Haptics.selectionAsync();
    setTheme(p);
    saveThemePref(p);
    applyThemePref(p);
  }

  const loadSeason = useCallback(
    async (silent = false) => {
      if (!client) return;
      if (!silent) setRefreshing(true);
      try {
        const map = await client.readPage(PAGE.MAIN);
        setSummer(AcondClient.bool(map, V.summerMode));
        setHeatingOnState(!AcondClient.bool(map, V.modeOff));
        setRegulation((map[V.regulationType] ?? "").trim().toUpperCase() || null);
        setSeasonEnd(AcondClient.num(map, V.seasonEnd));
        setOutdoorAvg(AcondClient.num(map, V.outdoorAvg));
      } catch {
        // leave the last known value; pull-to-refresh can retry
      } finally {
        if (!silent) setRefreshing(false);
      }
    },
    [client]
  );

  useFocusEffect(
    useCallback(() => {
      loadSeason(true);
    }, [loadSeason])
  );

  function haptic(ok: boolean) {
    if (process.env.EXPO_OS !== "ios") return;
    Haptics.notificationAsync(
      ok ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error
    );
  }

  /** Run a confirmed control, then re-read the real state from the controller. */
  async function runControl(action: () => Promise<void>, failText: string) {
    setBusy(true);
    try {
      await action();
      haptic(true);
    } catch (e) {
      haptic(false);
      const detail = e instanceof AcondError && e.message.startsWith("Regulátor") ? `${e.message} ` : "";
      Alert.alert("Nepovedlo se", `${detail}${failText}`);
    } finally {
      setBusy(false);
      loadSeason(true);
    }
  }

  // Season controls whole-house heating, so confirm before writing.
  function onToggleSeason() {
    if (!client || busy || summer == null) return;
    const toSummer = !summer;
    const avg = outdoorAvg != null ? `${outdoorAvg.toFixed(1)} °C` : "aktuální průměr";
    const newEnd =
      outdoorAvg != null ? `${(outdoorAvg + (toSummer ? -3 : 3)).toFixed(1)} °C` : "průměr ± 3 °C";
    Alert.alert(
      toSummer ? "Přepnout na letní provoz?" : "Přepnout na zimní provoz?",
      (toSummer
        ? "Vytápění domu se vypne. Ohřev teplé vody běží dál."
        : "Vytápění domu se zapne. Ohřev teplé vody běží dál.") +
        `\n\nRegulátor jinak přepíná sám podle průměrné venkovní teploty (${avg}). ` +
        `Ruční přepnutí nastaví „Konec topné sezóny“ ` +
        (seasonEnd != null ? `z ${seasonEnd.toFixed(1)} °C ` : "") +
        `na ${newEnd}.`,
      [
        { text: "Zrušit", style: "cancel" },
        {
          text: "Přepnout",
          style: toSummer ? "destructive" : "default",
          onPress: () =>
            runControl(
              () => setSeason(client, toSummer),
              "Provoz se nepodařilo přepnout. Zkuste to prosím znovu."
            ),
        },
      ]
    );
  }

  // On = AUT (automatika), off = VYP (topný systém vypnut).
  function onToggleHeating() {
    if (!client || busy || heatingOn == null) return;
    const turnOn = !heatingOn;
    Alert.alert(
      turnOn ? "Zapnout topný systém?" : "Vypnout topný systém?",
      turnOn
        ? "Tepelné čerpadlo přejde do režimu Automatika (AUT) – topí podle potřeby, v případě potřeby i s bivalencí."
        : "Tepelné čerpadlo přejde do režimu VYP – topný systém se vypne a dům se přestane vytápět. Zda pokračuje ohřev teplé vody, zatím není ověřeno.",
      [
        { text: "Zrušit", style: "cancel" },
        {
          text: turnOn ? "Zapnout" : "Vypnout",
          style: turnOn ? "default" : "destructive",
          onPress: () =>
            runControl(
              () => setHeatingOn(client, turnOn),
              turnOn
                ? "Topný systém se nepodařilo zapnout. Zkuste to prosím znovu."
                : "Topný systém se nepodařilo vypnout. Zkuste to prosím znovu."
            ),
        },
      ]
    );
  }

  function onSignOut() {
    Alert.alert("Odhlásit se?", "Budete se muset příště znovu přihlásit.", [
      { text: "Zrušit", style: "cancel" },
      {
        text: "Odhlásit",
        style: "destructive",
        onPress: async () => {
          await clearConfig();
          router.replace("/");
        },
      },
    ]);
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.systemBackground }}
      contentContainerStyle={{ padding: 20, gap: 24, paddingBottom: 48 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadSeason(false)} />}
    >
      {/* Operation / season */}
      <View>
        <SectionHeader title="Provoz" />
        <Card>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 16,
              paddingVertical: 12,
              gap: 12,
            }}
          >
            <SymbolView
              name="power"
              tintColor={heatingOn === false ? ink.red : ink.green}
              size={22}
              weight="semibold"
            />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.label, fontSize: 16 }}>Topný systém</Text>
              <Text style={{ color: colors.secondaryLabel, fontSize: 13, marginTop: 2 }}>
                {heatingOn == null
                  ? "Načítání…"
                  : heatingOn
                    ? "Zapnuto – režim Automatika (AUT)"
                    : "Vypnuto – režim VYP"}
              </Text>
            </View>
            <Switch
              value={heatingOn ?? false}
              onValueChange={onToggleHeating}
              disabled={busy || heatingOn == null || client == null}
            />
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 16,
              paddingVertical: 12,
              gap: 12,
            }}
          >
            <SymbolView
              name={summer ? "sun.max.fill" : "snowflake"}
              tintColor={summer ? ink.yellow : ink.teal}
              size={22}
              weight="semibold"
            />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.label, fontSize: 16 }}>Letní provoz</Text>
              <Text style={{ color: colors.secondaryLabel, fontSize: 13, marginTop: 2 }}>
                {summer == null
                  ? "Načítání…"
                  : summer
                    ? "Léto – vytápění vypnuto, teplá voda běží"
                    : "Zima – vytápění zapnuto"}
              </Text>
            </View>
            <Switch
              value={summer ?? false}
              onValueChange={onToggleSeason}
              disabled={busy || summer == null || client == null}
            />
          </View>
          <Row
            icon="thermometer.sun"
            label="Konec topné sezóny"
            value={seasonEnd != null ? `${seasonEnd.toFixed(1)} °C` : "—"}
          />
          <InfoRow
            icon="slider.horizontal.3"
            label={`Typ regulace: ${regulation ?? "—"}`}
            subtitle={
              regulation === "STANDARD"
                ? "Ruční teplota zpátečky – vytápění řídí teplota zpátečky, cílová teplota v místnosti se na topení neprojeví."
                : regulation && regulation in REGULATION_LABEL
                  ? `Regulace ${REGULATION_LABEL[regulation as keyof typeof REGULATION_LABEL]}.`
                  : "Načítání…"
            }
          />
        </Card>
        <Text style={{ color: colors.secondaryLabel, fontSize: 13, lineHeight: 18, marginTop: 8, marginHorizontal: 16 }}>
          Léto / zima přepíná regulátor sám: když dlouhodobý průměr venkovní teploty
          překročí „Konec topné sezóny“, přejde do léta, a když pod něj klesne, vrátí se
          do zimy.
        </Text>
      </View>

      {/* Appearance */}
      <View>
        <SectionHeader title="Vzhled" />
        <View
          style={{
            flexDirection: "row",
            backgroundColor: colors.secondarySystemBackground,
            borderRadius: 12,
            borderCurve: "continuous",
            padding: 4,
            gap: 4,
          }}
        >
          {(
            [
              { key: "auto", label: "Automaticky" },
              { key: "light", label: "Světlý" },
              { key: "dark", label: "Tmavý" },
            ] as { key: ThemePref; label: string }[]
          ).map((opt) => {
            const active = theme === opt.key;
            return (
              <Pressable
                key={opt.key}
                onPress={() => onSelectTheme(opt.key)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 9,
                  borderCurve: "continuous",
                  alignItems: "center",
                  backgroundColor: active ? colors.systemBackground : "transparent",
                }}
              >
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: active ? "600" : "400",
                    color: active ? colors.label : colors.secondaryLabel,
                  }}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Connection section */}
      <View>
        <SectionHeader title="Připojení" />
        <Card>
          {config == null ? (
            <Row first label="Stav" value="Načítání…" />
          ) : config.mode === "remote" ? (
            <>
              <Row first icon="wifi" label="Režim" value="Na dálku" />
              <Row icon="person" label="Uživatel" value={config.username} />
              <Row icon="cpu" label="Jednotka" value={config.plc} />
            </>
          ) : (
            <>
              <Row first icon="wifi" label="Režim" value="Doma v síti" />
              <Row icon="cpu" label="Adresa" value={config.host} />
            </>
          )}
        </Card>
      </View>

      {/* App section */}
      <View>
        <SectionHeader title="Aplikace" />
        <Card>
          <Row first icon="info.circle" label="Verze" value="0.1.0" />
          <InfoRow
            icon="internaldrive"
            label="Data"
            subtitle="Historie měření se ukládá pouze na tomto zařízení."
          />
        </Card>
      </View>

      {/* Sign out */}
      <Card>
        <Pressable
          onPress={onSignOut}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            paddingVertical: 14,
            opacity: pressed ? 0.5 : 1,
          })}
        >
          <SymbolView
            name="rectangle.portrait.and.arrow.right"
            tintColor={ink.red}
            size={20}
            weight="semibold"
          />
          <Text style={{ color: colors.red, fontSize: 16, fontWeight: "600" }}>
            Odhlásit se
          </Text>
        </Pressable>
      </Card>
    </ScrollView>
  );
}
