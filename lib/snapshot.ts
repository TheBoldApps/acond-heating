import { AcondClient } from "./acond-client";
import { PAGE, V } from "./variables";

/** Everything the home screen shows, in one typed object. */
export type Snapshot = {
  roomTemp: number | null;
  roomTarget: number | null;
  outdoorTemp: number | null;
  outdoorAvg: number | null;
  flowTemp: number | null;
  dhwTemp: number | null;
  dhwTarget: number | null;
  heatOutputKw: number | null; // null when the controller marks it invalid
  compressor: boolean;
  dhwActive: boolean;
  defrost: boolean;
  summer: boolean;
  fault: boolean;
  /** Heating system on (any mode but VYP). */
  heatingOn: boolean;
  mode: Mode;
  regulation: Regulation;
  /** "Konec topné sezóny" (SY03), °C. */
  seasonEnd: number | null;
};

export type Mode = "auto" | "off" | "heatpump" | "bivalence" | "cooling" | null;
export type Regulation = "ACONDTHERM" | "EKVITERM" | "STANDARD" | null;

/** Czech label for each operating mode, matching the panel's legend. */
export const MODE_LABEL: Record<Exclude<Mode, null>, string> = {
  auto: "Automatika",
  off: "Vypnuto",
  heatpump: "Pouze tepelné čerpadlo",
  bivalence: "Pouze bivalence",
  cooling: "Chlazení",
};

/** Czech explanation of each regulation type (panel legend, PAGE69). */
export const REGULATION_LABEL: Record<Exclude<Regulation, null>, string> = {
  ACONDTHERM: "podle teploty v místnosti",
  EKVITERM: "podle venkovní teploty",
  STANDARD: "ruční teplota zpátečky",
};

function readMode(m: Record<string, string>): Mode {
  if (AcondClient.bool(m, V.modeOff)) return "off";
  if (AcondClient.bool(m, V.modeAuto)) return "auto";
  if (AcondClient.bool(m, V.modeCooling)) return "cooling";
  if (AcondClient.bool(m, V.modeBivalence)) return "bivalence";
  if (AcondClient.bool(m, V.modeHeatPump)) return "heatpump";
  return null;
}

function readRegulation(m: Record<string, string>): Regulation {
  const r = (m[V.regulationType] ?? "").trim().toUpperCase();
  return r === "ACONDTHERM" || r === "EKVITERM" || r === "STANDARD" ? r : null;
}

/** Read the two pages the app needs and fold them into a Snapshot. */
export async function readSnapshot(client: AcondClient): Promise<Snapshot> {
  const main = await client.readPage(PAGE.MAIN);
  const dhw = await client.readPage(PAGE.DHW);

  const outputInvalid = AcondClient.bool(main, V.heatOutputInvalid);

  return {
    roomTemp: AcondClient.num(main, V.roomTemp),
    roomTarget: AcondClient.num(main, V.roomTarget),
    outdoorTemp: AcondClient.num(main, V.outdoorTemp),
    outdoorAvg: AcondClient.num(main, V.outdoorAvg),
    flowTemp: AcondClient.num(main, V.flowTemp),
    dhwTemp: AcondClient.num(main, V.dhwTemp),
    dhwTarget: AcondClient.num(dhw, V.dhwTarget) ?? AcondClient.num(main, V.dhwTarget),
    heatOutputKw: outputInvalid ? null : AcondClient.num(main, V.heatOutputKw),
    compressor: AcondClient.bool(main, V.compressor),
    dhwActive: AcondClient.bool(main, V.dhwActive),
    defrost: AcondClient.bool(main, V.defrost),
    summer: AcondClient.bool(main, V.summerMode),
    fault: AcondClient.bool(main, V.faultActive),
    heatingOn: !AcondClient.bool(main, V.modeOff),
    mode: readMode(main),
    regulation: readRegulation(main),
    seasonEnd: AcondClient.num(main, V.seasonEnd),
  };
}
