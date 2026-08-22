import * as SQLite from "expo-sqlite";
import type { Snapshot } from "@/lib/snapshot";

/**
 * Local, on-device time-series log. Weeks of samples live in a small SQLite
 * table so the Insights screen can draw history without any server. Writes are
 * throttled to one row per ~5 minutes; reads downsample by averaging so a chart
 * never has to plot thousands of points.
 */

export type Field = "roomTemp" | "dhwTemp" | "outdoor" | "heatKw";
export type Point = { t: number; v: number }; // t = epoch ms, v = value

/** Column each logical field maps to. Fixed set — never interpolate user input. */
const COLUMN: Record<Field, string> = {
  roomTemp: "roomTemp",
  dhwTemp: "dhwTemp",
  outdoor: "outdoor",
  heatKw: "heatKw",
};

const BUCKET_MS = 5 * 60 * 1000; // one stored row per five minutes

// Single shared handle, memoized so concurrent callers await the same open.
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function db(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const handle = await SQLite.openDatabaseAsync("acond-history.db");
      await handle.execAsync(
        `PRAGMA journal_mode = WAL;
         CREATE TABLE IF NOT EXISTS samples (
           ts INTEGER PRIMARY KEY,
           roomTemp REAL,
           dhwTemp REAL,
           outdoor REAL,
           heatKw REAL,
           roomTarget REAL,
           dhwTarget REAL
         );`
      );
      return handle;
    })().catch((e) => {
      // Reset so a later call can retry a failed open.
      dbPromise = null;
      throw e;
    });
  }
  return dbPromise;
}

export async function initHistory(): Promise<void> {
  try {
    await db();
  } catch {
    // Swallow — history is best-effort and must never break the app.
  }
}

/**
 * Records one sample. Safe to call on every poll: rows are keyed to a 5-minute
 * time bucket. On a repeated bucket we COALESCE — a later poll fills in any
 * field that was null on the first poll (e.g. heat output flagged invalid at
 * first), without overwriting an already-captured value with a null. Never throws.
 */
export async function recordSample(s: Snapshot): Promise<void> {
  try {
    const handle = await db();
    const bucket = Math.floor(Date.now() / BUCKET_MS) * BUCKET_MS;
    await handle.runAsync(
      `INSERT INTO samples
         (ts, roomTemp, dhwTemp, outdoor, heatKw, roomTarget, dhwTarget)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(ts) DO UPDATE SET
         roomTemp   = COALESCE(samples.roomTemp,   excluded.roomTemp),
         dhwTemp    = COALESCE(samples.dhwTemp,    excluded.dhwTemp),
         outdoor    = COALESCE(samples.outdoor,    excluded.outdoor),
         heatKw     = COALESCE(samples.heatKw,     excluded.heatKw),
         roomTarget = COALESCE(samples.roomTarget, excluded.roomTarget),
         dhwTarget  = COALESCE(samples.dhwTarget,  excluded.dhwTarget);`,
      bucket,
      s.roomTemp,
      s.dhwTemp,
      s.outdoorTemp,
      s.heatOutputKw,
      s.roomTarget,
      s.dhwTarget
    );
  } catch {
    // Swallow — a missed sample is harmless.
  }
}

/**
 * Ascending-by-time points for one field over the last `windowMs`, averaged
 * down to at most `maxPoints` buckets. Rows with a NULL value are excluded.
 */
export async function getSeries(
  field: Field,
  windowMs: number,
  maxPoints = 120
): Promise<Point[]> {
  try {
    const handle = await db();
    const col = COLUMN[field];
    const since = Date.now() - windowMs;
    const rows = await handle.getAllAsync<{ ts: number; v: number }>(
      `SELECT ts, ${col} AS v FROM samples
       WHERE ts >= ? AND ${col} IS NOT NULL
       ORDER BY ts ASC;`,
      since
    );
    if (rows.length <= maxPoints) {
      return rows.map((r) => ({ t: r.ts, v: r.v }));
    }
    // Downsample: split the window into `maxPoints` equal buckets, average each.
    const step = windowMs / maxPoints;
    const acc = new Map<number, { tSum: number; vSum: number; n: number }>();
    for (const r of rows) {
      const b = Math.floor((r.ts - since) / step);
      const cur = acc.get(b);
      if (cur) {
        cur.tSum += r.ts;
        cur.vSum += r.v;
        cur.n += 1;
      } else {
        acc.set(b, { tSum: r.ts, vSum: r.v, n: 1 });
      }
    }
    return [...acc.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, g]) => ({ t: Math.round(g.tSum / g.n), v: g.vSum / g.n }));
  } catch {
    return [];
  }
}

/** min / max / avg over the window, or null when there is no data. */
export async function getStats(
  field: Field,
  windowMs: number
): Promise<{ min: number; max: number; avg: number } | null> {
  try {
    const handle = await db();
    const col = COLUMN[field];
    const since = Date.now() - windowMs;
    const row = await handle.getFirstAsync<{
      n: number;
      min: number | null;
      max: number | null;
      avg: number | null;
    }>(
      `SELECT COUNT(${col}) AS n, MIN(${col}) AS min, MAX(${col}) AS max, AVG(${col}) AS avg
       FROM samples
       WHERE ts >= ? AND ${col} IS NOT NULL;`,
      since
    );
    if (!row || row.n === 0 || row.min == null || row.max == null || row.avg == null) {
      return null;
    }
    return { min: row.min, max: row.max, avg: row.avg };
  } catch {
    return null;
  }
}
