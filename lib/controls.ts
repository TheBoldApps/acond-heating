import { AcondClient, AcondError } from "./acond-client";
import { CMD, PAGE, V } from "./variables";

/**
 * The three main controls, each written the way the controller's own panel
 * does it and confirmed by reading the result back. A POST that returns 200
 * only means the web server took the form — it says nothing about the PLC.
 * Error messages are Czech because the screens show them as-is.
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Re-read PAGE115 until `ok(map)` holds; up to 4 tries, 500 ms apart. */
async function waitFor(
  client: AcondClient,
  ok: (m: Record<string, string>) => boolean
): Promise<Record<string, string> | null> {
  for (let i = 0; i < 4; i++) {
    await sleep(500);
    const m = await client.readPage(PAGE.MAIN);
    if (ok(m)) return m;
  }
  return null;
}

/**
 * Write a setpoint and confirm the controller holds it. Retries the write once
 * on a mismatch. Returns the value the controller reports.
 */
export async function writeSetpoint(
  client: AcondClient,
  name: string,
  value: number,
  page: string
): Promise<number> {
  let readback: number | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    await client.writeVar(name, value.toFixed(1), page);
    readback = AcondClient.num(await client.readPage(page), name);
    if (readback != null && Math.abs(readback - value) <= 0.01) return readback;
  }
  throw new AcondError(`Regulátor hodnotu ${value.toFixed(1)} nepřijal (čte ${readback ?? "—"}).`);
}

/**
 * Switch summer / winter. The panel's season button only opens the
 * "OPRAVDU ZMĚNIT REŽIM LÉTO/ZIMA?" dialog; ANO (seasonConfirm) is the real
 * command. Decides from the live state, so a stale screen can never flip the
 * house into the wrong season.
 */
export async function setSeason(client: AcondClient, summer: boolean): Promise<void> {
  const before = await client.readPage(PAGE.MAIN);
  if (AcondClient.bool(before, V.summerMode) === summer) return;

  await client.writeVar(CMD.seasonDialog, "1", PAGE.MAIN);
  await client.writeVar(CMD.seasonConfirm, "1", PAGE.MAIN);
  const after = await waitFor(client, (m) => AcondClient.bool(m, V.summerMode) === summer);

  // Never leave the confirm dialog open on the panel in the house.
  const last = after ?? (await client.readPage(PAGE.MAIN));
  if (AcondClient.bool(last, CMD.seasonDialog)) {
    await client.writeVar(CMD.seasonDialog, "0", PAGE.MAIN);
  }
  if (!after) throw new AcondError("Regulátor změnu letního / zimního provozu nepřijal.");
}

/**
 * Heating system on / off. On = AUT (the owner's normal mode), off = VYP
 * ("TOPNÝ SYSTÉM VYPNUT"). Turning on when another mode (TČ / BIV) is already
 * active leaves it alone.
 */
export async function setHeatingOn(client: AcondClient, on: boolean): Promise<void> {
  const before = await client.readPage(PAGE.MAIN);
  const isOff = AcondClient.bool(before, V.modeOff);
  if (on !== isOff) return; // already in the requested state

  await client.writeVar(on ? CMD.modeAuto : CMD.modeOff, "1", PAGE.MAIN);
  const after = await waitFor(client, (m) => AcondClient.bool(m, V.modeOff) === !on);
  if (!after) {
    throw new AcondError(
      on ? "Regulátor zapnutí topného systému nepřijal." : "Regulátor vypnutí topného systému nepřijal."
    );
  }
}
