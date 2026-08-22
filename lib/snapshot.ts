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
};

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
  };
}
