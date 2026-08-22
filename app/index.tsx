import React, { useEffect, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  LayoutAnimation,
} from "react-native";
import { router, Stack } from "expo-router";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { AcondClient, AuthError, type Config } from "@/lib/acond-client";
import { loadConfig, saveConfig } from "@/lib/store";
import { AdaptiveGlass } from "@/theme/glass";
import { colors, ink } from "@/theme/colors";

type Mode = "remote" | "local";
type Step = "intro" | "choose" | "form";

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const [checking, setChecking] = useState(true);
  const [step, setStep] = useState<Step>("intro");
  const [mode, setMode] = useState<Mode>("remote");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [plc, setPlc] = useState("");
  const [host, setHost] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already set up? Go straight to Home. Otherwise start onboarding.
  useEffect(() => {
    loadConfig().then((cfg) => {
      if (cfg) router.replace("/home");
      else setChecking(false);
    });
  }, []);

  const canSubmit =
    mode === "remote" ? !!(username.trim() && password && plc.trim()) : !!host.trim();

  async function connect() {
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(null);
    const cfg: Config =
      mode === "remote"
        ? { mode: "remote", username: username.trim(), password, plc: plc.trim() }
        : { mode: "local", host: host.trim() };
    try {
      const client = new AcondClient(cfg);
      await client.login(); // prove the credentials before saving them
      await saveConfig(cfg);
      if (process.env.EXPO_OS === "ios") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      router.replace("/home");
    } catch (e) {
      if (process.env.EXPO_OS === "ios") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      setError(
        e instanceof AuthError
          ? "Údaje nesedí. Zkontrolujte je prosím a zkuste to znovu."
          : "Nepodařilo se spojit. Zkontrolujte připojení k internetu a zkuste to znovu."
      );
    } finally {
      setBusy(false);
    }
  }

  if (checking) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.systemBackground,
        }}
      >
        <ActivityIndicator />
      </View>
    );
  }

  // Native cross-fade/slide between steps for a fluid, first-party feel.
  function go(next: Step) {
    if (process.env.EXPO_OS === "ios") {
      Haptics.selectionAsync();
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setStep(next);
  }

  function goBack() {
    setError(null);
    if (process.env.EXPO_OS === "ios") Haptics.selectionAsync();
    go(step === "form" ? "choose" : "intro");
  }

  const showFooter = step !== "choose";

  return (
    <View style={{ flex: 1, backgroundColor: colors.systemBackground }}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          automaticallyAdjustKeyboardInsets
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={{ padding: 24, paddingTop: 80, paddingBottom: 24, gap: 24, flexGrow: 1 }}
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
        >
          {step === "intro" && <Intro />}
          {step === "choose" && (
            <Choose
              onPick={(m) => {
                setMode(m);
                setError(null);
                go("form");
              }}
            />
          )}
          {step === "form" && (
            <Form
              mode={mode}
              username={username}
              password={password}
              plc={plc}
              host={host}
              setUsername={setUsername}
              setPassword={setPassword}
              setPlc={setPlc}
              setHost={setHost}
            />
          )}
        </ScrollView>

        {/* Pinned CTA — always visible, and rises above the keyboard. */}
        {showFooter && (
          <View
            style={{
              paddingHorizontal: 24,
              paddingTop: 12,
              paddingBottom: insets.bottom > 0 ? insets.bottom + 6 : 20,
              gap: 12,
              backgroundColor: colors.systemBackground,
            }}
          >
            {step === "form" && error && (
              <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
                <SymbolView name="exclamationmark.circle.fill" tintColor={ink.red} size={20} weight="semibold" style={{ marginTop: 1 }} />
                <Text style={{ flex: 1, color: colors.red, fontSize: 15, lineHeight: 21 }} selectable>
                  {error}
                </Text>
              </View>
            )}
            {step === "intro" ? (
              <PrimaryButton label="Začít" onPress={() => go("choose")} />
            ) : (
              <PrimaryButton label="Připojit" busy={busy} disabled={!canSubmit} onPress={connect} />
            )}
            <Text style={{ fontSize: 14, color: colors.tertiaryLabel, textAlign: "center" }}>
              Vaše údaje zůstávají jen v tomto telefonu.
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Liquid Glass back control, natively anchored to the top-left safe area. */}
      {step !== "intro" && (
        <View style={{ position: "absolute", top: insets.top + 8, left: 20 }}>
          <AdaptiveGlass interactive style={{ borderRadius: 22, borderCurve: "continuous" }}>
            <Pressable
              onPress={goBack}
              hitSlop={12}
              accessibilityLabel="Zpět"
              accessibilityRole="button"
              style={({ pressed }) => ({
                width: 44,
                height: 44,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.55 : 1,
              })}
            >
              <SymbolView name="chevron.left" tintColor={colors.label} size={18} weight="semibold" />
            </Pressable>
          </AdaptiveGlass>
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — a warm welcome and what to expect
// ---------------------------------------------------------------------------
function Intro() {
  return (
    <>
      <View style={{ alignItems: "center", gap: 16, marginTop: 24 }}>
        <SymbolView name="thermometer.sun.fill" tintColor={ink.orange} size={64} weight="semibold" />
        <Text style={{ fontSize: 34, fontWeight: "700", color: colors.label, textAlign: "center", letterSpacing: -0.5 }}>
          Vítejte
        </Text>
        <Text style={{ fontSize: 18, lineHeight: 26, color: colors.secondaryLabel, textAlign: "center" }}>
          Tato aplikace ovládá vaše tepelné čerpadlo — teplotu v domě i teplou vodu.
          Z gauče i odkudkoli na světě.
        </Text>
      </View>

      <AdaptiveGlass style={{ borderRadius: 24, borderCurve: "continuous" }}>
        <View style={{ padding: 20, gap: 18 }}>
          <Text style={{ fontSize: 15, fontWeight: "600", color: colors.secondaryLabel, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Co budete potřebovat
          </Text>
          <Bullet icon="doc.text" tint={ink.blue} title="Pár údajů od montážní firmy" text="Najdete je v předávacím protokolu k čerpadlu." />
          <Bullet icon="wifi" tint={ink.teal} title="Nebo jen domácí wifi" text="Když jste doma na stejné síti jako čerpadlo." />
          <Bullet icon="clock" tint={ink.green} title="Minutu času" text="Provedeme vás krok za krokem. Nic nezkazíte." />
        </View>
      </AdaptiveGlass>

      <View style={{ flex: 1 }} />
    </>
  );
}

function Bullet({
  icon,
  tint,
  title,
  text,
}: {
  icon: SymbolViewProps["name"];
  tint: string;
  title: string;
  text: string;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 14, alignItems: "flex-start" }}>
      <SymbolView name={icon} tintColor={tint} size={24} weight="semibold" style={{ marginTop: 2 }} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ fontSize: 17, fontWeight: "600", color: colors.label }}>{title}</Text>
        <Text style={{ fontSize: 15, lineHeight: 21, color: colors.secondaryLabel }}>{text}</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — choose how to connect, in plain language
// ---------------------------------------------------------------------------
function Choose({ onPick }: { onPick: (m: Mode) => void }) {
  return (
    <>
      <Text style={{ fontSize: 30, fontWeight: "700", color: colors.label, letterSpacing: -0.5, marginTop: 8 }}>
        Jak se chcete připojit?
      </Text>
      <Text style={{ fontSize: 17, lineHeight: 24, color: colors.secondaryLabel, marginTop: -8 }}>
        Nevíte si rady? Vyberte „Odkudkoli" — funguje doma i venku.
      </Text>

      <ChoiceCard
        icon="globe.europe.africa.fill"
        tint={ink.blue}
        title="Odkudkoli"
        text="Ovládejte čerpadlo i mimo domov. Přihlásíte se účtem, který vám založila montážní firma."
        onPress={() => onPick("remote")}
      />
      <ChoiceCard
        icon="house.fill"
        tint={ink.orange}
        title="Jen doma"
        text="Jednodušší. Funguje, jen když jste doma na stejné wifi jako čerpadlo."
        onPress={() => onPick("local")}
      />
    </>
  );
}

function ChoiceCard({
  icon,
  tint,
  title,
  text,
  onPress,
}: {
  icon: SymbolViewProps["name"];
  tint: string;
  title: string;
  text: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      <AdaptiveGlass style={{ borderRadius: 22, borderCurve: "continuous" }}>
        <View style={{ padding: 20, flexDirection: "row", alignItems: "center", gap: 16 }}>
          <SymbolView name={icon} tintColor={tint} size={34} weight="semibold" />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ fontSize: 20, fontWeight: "600", color: colors.label }}>{title}</Text>
            <Text style={{ fontSize: 15, lineHeight: 21, color: colors.secondaryLabel }}>{text}</Text>
          </View>
          <SymbolView name="chevron.right" tintColor={colors.secondaryLabel} size={16} weight="semibold" />
        </View>
      </AdaptiveGlass>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — the form, with a helper hint under every field
// ---------------------------------------------------------------------------
function Form(props: {
  mode: Mode;
  username: string;
  password: string;
  plc: string;
  host: string;
  setUsername: (t: string) => void;
  setPassword: (t: string) => void;
  setPlc: (t: string) => void;
  setHost: (t: string) => void;
}) {
  const remote = props.mode === "remote";
  return (
    <>
      <Text style={{ fontSize: 30, fontWeight: "700", color: colors.label, letterSpacing: -0.5, marginTop: 8 }}>
        {remote ? "Přihlášení odkudkoli" : "Připojení doma"}
      </Text>
      <Text style={{ fontSize: 16, lineHeight: 23, color: colors.secondaryLabel, marginTop: -8 }}>
        {remote
          ? "Zadejte údaje z účtu od montážní firmy. Vše najdete v předávacím protokolu."
          : "Musíte být doma na stejné wifi jako čerpadlo."}
      </Text>

      <AdaptiveGlass style={{ borderRadius: 24, borderCurve: "continuous" }}>
        <View style={{ padding: 20, gap: 20 }}>
          {remote ? (
            <>
              <Field
                label="Přihlašovací jméno"
                hint="Účet TecoRoute od montážní firmy."
                value={props.username}
                onChangeText={props.setUsername}
                autoCap="none"
              />
              <Field
                label="Heslo"
                hint="Heslo k tomuto účtu."
                value={props.password}
                onChangeText={props.setPassword}
                secure
              />
              <Field
                label="Název jednotky"
                hint="Krátký název vašeho čerpadla z protokolu."
                value={props.plc}
                onChangeText={props.setPlc}
                autoCap="none"
              />
            </>
          ) : (
            <Field
              label="Adresa čerpadla"
              hint="Číslo jako 10.0.1.24. Řekne vám ho montážník nebo router."
              value={props.host}
              onChangeText={props.setHost}
              autoCap="none"
              placeholder="10.0.1.24"
              keyboard="numbers-and-punctuation"
            />
          )}
        </View>
      </AdaptiveGlass>

      <View style={{ flex: 1 }} />
    </>
  );
}

function Field({
  label,
  hint,
  value,
  onChangeText,
  secure,
  autoCap = "sentences",
  placeholder,
  keyboard,
}: {
  label: string;
  hint?: string;
  value: string;
  onChangeText: (t: string) => void;
  secure?: boolean;
  autoCap?: "none" | "sentences";
  placeholder?: string;
  keyboard?: "default" | "numbers-and-punctuation";
}) {
  return (
    <View style={{ gap: 7 }}>
      <Text style={{ fontSize: 15, fontWeight: "600", color: colors.label }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secure}
        autoCapitalize={autoCap}
        autoCorrect={false}
        keyboardType={keyboard ?? "default"}
        placeholder={placeholder}
        placeholderTextColor={colors.tertiaryLabel as string}
        style={{
          fontSize: 19,
          color: colors.label,
          paddingVertical: 14,
          paddingHorizontal: 14,
          borderRadius: 12,
          borderCurve: "continuous",
          backgroundColor: colors.systemBackground,
        }}
      />
      {hint && <Text style={{ fontSize: 13, lineHeight: 18, color: colors.secondaryLabel }}>{hint}</Text>}
    </View>
  );
}

function PrimaryButton({
  label,
  busy,
  disabled,
  onPress,
}: {
  label: string;
  busy?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        if (process.env.EXPO_OS === "ios") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        onPress();
      }}
      disabled={disabled || busy}
      style={({ pressed }) => ({
        backgroundColor: colors.blue,
        opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        paddingVertical: 18,
        borderRadius: 16,
        alignItems: "center",
        borderCurve: "continuous",
      })}
    >
      {busy ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={{ color: "#fff", fontSize: 18, fontWeight: "600" }}>{label}</Text>
      )}
    </Pressable>
  );
}
