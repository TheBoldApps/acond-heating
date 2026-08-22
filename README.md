# Heat — native ACOND app (Expo)

An MVP of a phone app that controls an **ACOND PRO R / ACOND THERM** heat pump —
from home on the LAN, or **from anywhere** through Teco's own **TecoRoute** relay.
No cloud of ours, no box at home, no Homey. Just download, log in, control.

Built to feel like a first-party iOS app: native large-title navigation,
**Liquid Glass** surfaces (iOS 26), SF Symbols, haptics, semantic system colors,
and a deliberately foolproof control model — big −/+ targets, hard-clamped
setpoints, no sliders or keyboards to fumble.

## Screens

- **Přihlášení** (`app/index.tsx`) — TecoRoute (login / password / PLC name) or
  local IP. Credentials are validated before saving and kept only in the device
  Keychain (`expo-secure-store`).
- **Domů** (`app/home.tsx`) — activity line, a hero **room-temperature** control,
  a **hot-water** control, and a live readings grid. Pull to refresh; polls every
  12 s; optimistic setpoints confirmed by a read-back.

## Architecture

```
lib/acond-client.ts   protocol port (SHA1 login, cp1250 XML, LAN + TecoRoute)
lib/variables.ts      PLC symbols used by the MVP  (subset of the Homey app map)
lib/snapshot.ts       reads PAGE115 + PAGE118 → one typed Snapshot
lib/store.ts          Keychain persistence of credentials
theme/colors.ts       native semantic colors (auto light/dark)
theme/glass.tsx       AdaptiveGlass: Liquid Glass → BlurView fallback
components/stepper.tsx big foolproof −/+ setpoint control
components/stat-tile.tsx glass readout tile
```

Only two writes are wired — `roomTarget` and `dhwTarget` — the two setpoints
round-trip tested against the real controller. Nothing that can leave a house
cold is exposed. Matches the safety rules in the repo's `CLAUDE.md`.

## Run it

Liquid Glass needs **iOS 26 / Xcode 26**, so this needs a dev build (not Expo Go):

```bash
cd acond-app
npx expo install --fix     # pin every dependency to the installed SDK
npx expo run:ios           # build + launch on an iOS 26 simulator or device
```

On older iOS the UI degrades automatically to a system-material blur.

## Status — honest

- ✅ Full app written: protocol, screens, state, persistence, native styling.
- ⚠️ **Not yet compiled/run on an iOS 26 device from here** — needs the Xcode 26
  toolchain. Treat as a review-ready draft.
- ⚠️ **TecoRoute tunnel path is best-effort.** The login handshake is verified
  live (`route.tecomat.com`, `PASS = sha1(RoutePLC + password)`), but the exact
  page-routing through the tunnel needs one confirmation run with a real **PLC
  name** — see `NEXT-STEPS.md`.
- ⚠️ **Symbol map is for this firmware.** A public release must discover symbols
  at runtime from the controller's XSL — the single biggest remaining task.
