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
  // 1 = summer, 0 = winter. BOOL momentary toggle (client.toggleVar).
  // ⚠️ Flipping this starts/stops whole-house heating — confirm before writing.
  summerMode: "__TE4A78682_BOOL_i",
  heatOutputKw: "__TD50B2FF2_REAL_.2f",
  heatOutputInvalid: "__T880DC46F_BOOL_i",

  // health (read)
  faultActive: "__T3A291FEE_BOOL_i",
} as const;

/** Setpoint safety envelopes — the UI clamps to these, foolproof by design. */
export const LIMITS = {
  room: { min: 16, max: 26, step: 0.5 },
  dhw: { min: 35, max: 55, step: 1 },
} as const;
