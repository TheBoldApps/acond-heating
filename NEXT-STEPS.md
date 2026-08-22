# Next steps — acond-app

Ordered by what unblocks the most.

## 1. Confirm the TecoRoute tunnel (needs the PLC name)

Verified live: `route.tecomat.com` is up, login is `PASS = sha1(RoutePLC-cookie +
password)` — the same scheme the pump uses. **Unverified:** the login was rejected
(`ACER=1`) with an empty PLC field, and how page GETs route once logged in.

Get the **registered PLC name** (commissioning protocol, or log into
`route.tecomat.com` once in a browser) and run one round-trip:
`login → GET /PAGE115.XML through the tunnel → confirm room temperature`. If the
tunnel prefixes or rewrites the page path, adjust `AcondClient.base`/`readPage`.

## 2. Runtime symbol discovery (the real blocker for a public app)

`lib/variables.ts` is hard-coded for application `PRO16X_X v160.42`, config
`OSAZEN TROJEST TUV`. Other houses differ (no DHW, cooling fitted, 2 circuits,
cascade). Port `recon/map_page.py`'s logic: read each page's XSL, match the
bilingual `title=` to the symbol, build the map on device, and degrade gracefully
when a symbol is absent. Until then the app only works on units like this one.

## 3. RN fetch redirect handling

`redirect: "manual"` isn't fully honored on React Native. TecoRoute auth is
detected via the `ACER` body flag (works), but LAN 302-expiry detection may not
fire. Verify against a real session; if needed, detect expiry by re-reading the
login page body instead of the `Location` header.

## 4. Polish before store submission

- App icon + splash, real product name (not "ACOND" — trademark).
- Offline / unreachable states, retry backoff.
- Alarm detail screen (the controller exposes a 47-entry register on PAGE167).
- Accessibility pass (Dynamic Type, VoiceOver labels on the SF Symbols).
- Privacy policy + Keychain-only credential storage note (GDPR).
