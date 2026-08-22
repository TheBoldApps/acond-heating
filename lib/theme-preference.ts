import { Appearance } from "react-native";
import * as SecureStore from "expo-secure-store";

export type ThemePref = "auto" | "light" | "dark";

const KEY = "acond.theme.v1";

/** Load the saved appearance preference (defaults to "auto"). */
export async function loadThemePref(): Promise<ThemePref> {
  try {
    const v = await SecureStore.getItemAsync(KEY);
    if (v === "light" || v === "dark" || v === "auto") return v;
  } catch {
    // ignore
  }
  return "auto";
}

export async function saveThemePref(p: ThemePref): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, p);
  } catch {
    // ignore
  }
}

/**
 * Apply the preference. On iOS, setColorScheme sets the window's
 * overrideUserInterfaceStyle, so PlatformColor, native stack headers and the
 * native tab bar all follow — no ThemeProvider needed. "auto" (null) hands
 * control back to the system setting.
 */
export function applyThemePref(p: ThemePref): void {
  Appearance.setColorScheme(p === "auto" ? null : p);
}
