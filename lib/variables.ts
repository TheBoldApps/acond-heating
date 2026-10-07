/**
 * ACOND PLC symbols used by the app — a subset of the full map in
 * ../../com.acond.heatpump/lib/variables.js. Names are CRC hashes of the PLC
 * symbol path, stable for application PRO16X_X v160.42.
 *
 * ⚠️ These are correct for THIS firmware/config. A public release must discover
 * them at runtime from the controller's XSL stylesheets — see NEXT-STEPS.md.
 */
export const PAGE = {
  MAIN: "/PAGE115.XML", // live dashboard
  DHW: "/PAGE118.XML", // hot water target + blocking
} as const;

export const V = {
  // temperatures (read)
  roomTemp: "__T46AA2571_REAL_.1f",
  roomRequested: "__T05D9E707_REAL_.1f",
  outdoorTemp: "__T033A2538_REAL_.1f",
  outdoorAvg: "__TDE3BFC02_REAL_.1f",
  flowTemp: "__T9E13248E_REAL_.1f",
  returnTemp: "__T50A32455_REAL_.1f",
  dhwTemp: "__T881A25AA_REAL_.1f",

  // setpoints (read + WRITE — round-trip verified, safe)
  roomTarget: "__TBEC2C30E_REAL_.1f", // heating circuit 1 setpoint
  dhwTarget: "__T3B27E86E_REAL_.1f", // hot-water setpoint

  // states (read)
  compressor: "__T61E4AC91_BOOL_i",
  dhwActive: "__T80F610D7_BOOL_i",
  defrost: "__TE1D81C79_BOOL_i",
  // 1 = summer, 0 = winter. READ ONLY — this is the season *state*, not a
  // command. Change the season with lib/controls.ts setSeason().
  summerMode: "__TE4A78682_BOOL_i",
  // "Konec topné sezóny" (SY03): above this long-term outdoor average the
  // controller switches to summer by itself. A manual season switch overwrites
  // it with the current average ± 3 °C (parameter SY04).
  seasonEnd: "__TB48CC351_REAL_.1f",

  // Operating mode — five mutually exclusive buttons on the panel. Each has a
  // read-back state bit (here) and a momentary command bit (see CMD).
  modeAuto: "__T33F5FB04_BOOL_i", // AUT — automatic, the owner's normal mode
  modeOff: "__T6357E365_BOOL_i", // VYP — "TOPNÝ SYSTÉM VYPNUT" (heating system off)
  modeHeatPump: "__TB239D0B9_BOOL_i", // TČ — heat pump only
  modeBivalence: "__T3E1036AA_BOOL_i", // BIV — bivalence only
  modeCooling: "__TB63969A1_BOOL_i", // CHL — cooling

  // Regulation type under "R E G U L A C E" on the panel (not the model):
  // ACONDTHERM = by room temperature, EKVITERM = by outdoor temperature,
  // STANDARD = manual return-water setpoint (room target does not drive heating).
  regulationType: "__TA9A7CFD0_STRING[10]_s",
  heatOutputKw: "__TD50B2FF2_REAL_.2f",
  heatOutputInvalid: "__T880DC46F_BOOL_i",

  // health (read)
  faultActive: "__T3A291FEE_BOOL_i",
} as const;

/**
 * Command bits on PAGE115 — write-only buttons, taken from the controller's own
 * page script (PAGE115.JS) and round-trip tested 2026-10-07.
 */
export const CMD = {
  // Season is a two-step dialog on the panel: seasonDialog=1 opens
  // "OPRAVDU ZMĚNIT REŽIM LÉTO/ZIMA?", seasonConfirm=1 is the ANO button that
  // actually flips it. seasonConfirm is hidden (not in the page XML), so it is
  // always written as "1", never read or toggled. seasonDialog=0 closes it.
  seasonDialog: "__T753A1C66_BOOL_i",
  seasonConfirm: "__T05158395_BOOL_i",
  // Mode buttons: write "1", the PLC selects the mode and self-clears the bit.
  modeAuto: "__T3143FF53_BOOL_i", // AUT
  modeOff: "__T61E182F2_BOOL_i", // VYP
} as const;

/** Setpoint safety envelopes — the UI clamps to these, foolproof by design. */
export const LIMITS = {
  room: { min: 16, max: 26, step: 0.5 },
  dhw: { min: 35, max: 55, step: 1 },
} as const;
