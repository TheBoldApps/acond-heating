import * as SecureStore from "expo-secure-store";
import type { Config } from "./acond-client";

const KEY = "acond.credentials.v1";

/** Credentials live only in the device Keychain — never on any server. */
export async function saveConfig(cfg: Config): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(cfg), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED,
  });
}

export async function loadConfig(): Promise<Config | null> {
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Config;
  } catch {
    return null;
  }
}

export async function clearConfig(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
