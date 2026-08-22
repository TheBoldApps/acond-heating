import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";

/**
 * Native iOS tab bar (UITabBarController) — Liquid Glass on iOS 26. Icon and
 * Label are standalone elements placed inside each Trigger (they are NOT static
 * members of Trigger).
 */
export default function TabsLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="home">
        <Icon sf="house.fill" />
        <Label>Domů</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="insights">
        <Icon sf="chart.xyaxis.line" />
        <Label>Přehledy</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <Icon sf="gearshape.fill" />
        <Label>Nastavení</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
