import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { colors } from "@/theme/colors";
import { loadThemePref, applyThemePref } from "@/lib/theme-preference";

export default function RootLayout() {
  // Apply the saved appearance preference (auto/light/dark) as early as possible.
  useEffect(() => {
    loadThemePref().then(applyThemePref);
  }, []);

  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.systemBackground },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}
