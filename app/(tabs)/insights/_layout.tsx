import { Stack } from "expo-router/stack";

export default function InsightsLayout() {
  return (
    <Stack screenOptions={{ headerLargeTitle: true, headerShadowVisible: false }}>
      <Stack.Screen name="index" options={{ title: "Přehledy" }} />
    </Stack>
  );
}
