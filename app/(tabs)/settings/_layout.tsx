import { Stack } from "expo-router/stack";

// Native stack for the Settings tab, matching the iOS large-title look.
export default function SettingsLayout() {
  return (
    <Stack screenOptions={{ headerLargeTitle: true, headerShadowVisible: false }}>
      <Stack.Screen name="index" options={{ title: "Nastavení" }} />
    </Stack>
  );
}
