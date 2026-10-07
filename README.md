# Acond Heating

**A free, open-source iOS app to control your ACOND heat pump — no cloud account, no subscription, no vendor lock-in.**

Acond Heating talks to an **ACOND PRO R / ACOND THERM** heat pump directly, the
same way the manufacturer's own web panel does. It runs on your phone, keeps your
credentials on your phone, and costs nothing. It's an independent project for
ACOND owners who wanted an app that's actually pleasant to use every day.

> ⚠️ **Unofficial.** Not affiliated with, endorsed by, or supported by ACOND s.r.o.
> or Teco a.s. "ACOND" and "TecoRoute" are trademarks of their respective owners.
> Use at your own risk (see [Safety](#safety)).

---

## What it does

- 🏠 **Room temperature** — see the current temperature and set your target with two big, foolproof buttons.
- 💧 **Hot water** — read the tank temperature and set the target.
- 📊 **Live dashboard** — outdoor temperature (current + 24 h average), flow temperature, live thermal output in kW, and what the pump is doing right now (heating, heating water, defrosting, or resting).
- 📈 **History & trends** — the app quietly logs readings **on your device** and draws clean 24 h / 7 day / 30 day charts you can drag your finger across to read any point.
- ☀️❄️ **Season switch** — flip between summer and winter mode the way the panel does it (its own confirm dialog), with a clear confirmation that also tells you how the controller's "end of heating season" threshold will change.
- ⏻ **Heating on / off** — switch between automatic mode (AUT) and off (VYP), behind a confirmation.
- 🌗 **Light / dark / automatic** appearance, native iOS design, Liquid Glass, haptics.
- 🔌 **Connection indicator** — always know whether you're really talking to the pump.

## Two ways to connect

| | **At home** | **From anywhere** |
|---|---|---|
| How | Same Wi‑Fi as the pump | Through Teco's **TecoRoute** relay |
| Needs | The pump's local IP address | Your TecoRoute login + PLC name (from the installer's handover protocol) |
| Setup | Type one number | A guided step‑by‑step screen |

Nothing to install at the house — no bridge, no Raspberry Pi, no Home Assistant.
A friendly onboarding walks first‑time users (yes, including a 60‑year‑old parent)
through exactly what to enter and where to find it.

## Why it exists

ACOND heat pumps are great, but the stock control experience isn't. This app was
built by an owner after installing a pump in a new house — the protocol was
reverse‑engineered from the controller's own web interface (a Tecomat Foxtrot PLC
running TECO Web Server) purely for **interoperability**, so owners can control
hardware they bought. No firmware is modified; the app only uses the same HTTP
endpoints the official web panel already exposes on your network.

## Privacy

- Your credentials are stored **only in the iOS Keychain on your device**.
- History is stored **only on your device** (local SQLite).
- There is **no backend of ours** — the app talks to your pump (directly or through
  Teco's relay) and to nobody else.

## Safety

This app controls real heating equipment in a real home. By design it only writes
settings that have been round‑trip tested against a live controller, and it reads
every change back to confirm the controller accepted it:

- **Room target temperature**
- **Hot‑water target temperature**
- **Summer/Winter season** (behind an explicit confirmation). A manual switch makes
  the controller reset its "end of heating season" threshold to the current outdoor
  average ± 3 °C — the confirmation shows the old and new value.
- **Heating on / off** — AUT (automatic) or VYP ("heating system off"), behind an
  explicit confirmation. Whether hot water keeps heating in VYP is not yet verified.

It deliberately does **not** expose the enable bits, service pages, or network
configuration that could leave a house cold or misconfigured.

## Tech

- [Expo](https://expo.dev) SDK 54 · React Native 0.81 · TypeScript · Expo Router
- Native iOS UI: `expo-glass-effect` (Liquid Glass), SF Symbols, native tabs, `PlatformColor` semantic colors
- Charts drawn with `react-native-svg`; history in `expo-sqlite`
- Zero servers, zero analytics

## Run it locally

Liquid Glass needs **iOS 26 / Xcode 26**, so this needs a dev build (not Expo Go):

```bash
npm install
npx expo run:ios      # build + launch on an iOS 26 simulator or device
```

On older iOS the UI degrades gracefully to a system‑material blur.

## Status

Working and used daily against a live pump. Known next steps:

- **TecoRoute remote path** — the login handshake is verified; the tunnel's page
  routing needs one confirmation run against a real PLC name.
- **Runtime symbol discovery** — the PLC symbol map is currently tuned to one
  firmware/configuration; a public release should discover symbols from the
  controller's stylesheets so it works across every ACOND configuration.

Contributions and testing on other ACOND units are very welcome.

## License

MIT — see [`LICENSE`](LICENSE).
