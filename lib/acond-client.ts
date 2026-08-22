import * as Crypto from "expo-crypto";
import CookieManager from "@react-native-cookies/cookies";

/**
 * AcondClient (React Native / Expo) — talks to an ACOND THERM controller either
 * directly on the LAN or, for control-from-anywhere, through Teco's own
 * TecoRoute relay. Same page protocol either way (see ../../API.md):
 *
 *   read : GET  /PAGE<n>.XML   header `x-tecomat: data`  → windows-1250 XML
 *   write: POST /PAGE<n>.XML   body `fullVarName=value`  (urlencoded)
 *
 * Auth is a SHA1 challenge-response: PASS = sha1(nonceCookie + password).
 *   - LAN     : nonce cookie `SoftPLC`  on http://<host>
 *   - TecoRoute: nonce cookie `RoutePLC` on https://route.tecomat.com, and the
 *                login form additionally carries the registered PLC name.
 *
 * The pump's own HTTP-Basic (acond/acond) rides on every request; inside the
 * TecoRoute tunnel it is forwarded to the controller unchanged.
 */

const TECOROUTE = "https://route.tecomat.com";

export type RemoteConfig = {
  mode: "remote";
  /** TecoRoute account e-mail/login */
  username: string;
  /** TecoRoute account password */
  password: string;
  /** Registered PLC name (from the commissioning protocol) */
  plc: string;
  /** Controller HTTP-Basic — fixed on ACOND units */
  deviceUser?: string;
  devicePassword?: string;
};

export type LocalConfig = {
  mode: "local";
  host: string; // e.g. "10.0.1.24"
  deviceUser?: string;
  devicePassword?: string;
};

export type Config = RemoteConfig | LocalConfig;

export type VarMap = Record<string, string>;

export class AcondError extends Error {}
export class AuthError extends AcondError {}

export class AcondClient {
  private cfg: Config;
  private base: string;
  private nonceCookie: string;

  constructor(cfg: Config) {
    this.cfg = { deviceUser: "acond", devicePassword: "acond", ...cfg };
    this.base = cfg.mode === "remote" ? TECOROUTE : `http://${cfg.host}`;
    this.nonceCookie = cfg.mode === "remote" ? "RoutePLC" : "SoftPLC";
  }

  private basic(): string {
    const u = this.cfg.deviceUser ?? "acond";
    const p = this.cfg.devicePassword ?? "acond";
    return "Basic " + btoa(`${u}:${p}`);
  }

  private async readCookie(name: string): Promise<string | null> {
    const jar = await CookieManager.get(this.base);
    return jar?.[name]?.value ?? null;
  }

  /** SHA1 challenge-response handshake. Establishes the session cookie. */
  async login(): Promise<void> {
    await CookieManager.clearAll();

    // 1) prime a fresh nonce cookie
    const primePath = this.cfg.mode === "remote" ? "/" : "/SYSWWW/LOGIN.XML";
    await fetch(this.base + primePath, {
      headers: { Authorization: this.basic() },
    });
    const nonce = await this.readCookie(this.nonceCookie);
    if (!nonce) throw new AcondError("No nonce cookie from server");

    // 2) PASS = sha1(nonce + password)
    const password =
      this.cfg.mode === "remote" ? this.cfg.password : this.cfg.devicePassword ?? "acond";
    const user =
      this.cfg.mode === "remote" ? this.cfg.username : this.cfg.deviceUser ?? "acond";
    const pass = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA1,
      nonce + password,
      { encoding: Crypto.CryptoEncoding.HEX }
    );

    // 3) post the login form
    const loginPath = this.cfg.mode === "remote" ? "/TR_LOGIN.XML" : "/SYSWWW/LOGIN.XML";
    const body =
      this.cfg.mode === "remote"
        ? form({ USER: user, PASS: pass, PLC: this.cfg.plc })
        : form({ USER: user, PASS: pass });

    const res = await fetch(this.base + loginPath, {
      method: "POST",
      headers: {
        Authorization: this.basic(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      redirect: "manual",
    });

    // TecoRoute answers 200 with <ACER VALUE="1"/> on a bad login; the PLC
    // redirects back to LOGIN.XML. Detect both.
    if (this.cfg.mode === "remote") {
      const text = await res.text();
      if (/ACER\s+VALUE="1"/.test(text)) {
        throw new AuthError("Wrong TecoRoute login, password, or PLC name");
      }
    } else {
      const loc = res.headers.get("location") ?? "";
      if (/LOGIN\.XML/i.test(loc)) throw new AuthError("Wrong device password");
    }
  }

  /** GET a page → parsed { NAME: VALUE } map, re-logging in once on expiry. */
  async readPage(page: string, retry = true): Promise<VarMap> {
    const res = await fetch(this.base + page, {
      headers: { Authorization: this.basic(), "x-tecomat": "data" },
      redirect: "manual",
    });
    if (res.status === 301 || res.status === 302 || res.status === 401) {
      if (!retry) throw new AuthError("Session expired");
      await this.login();
      return this.readPage(page, false);
    }
    if (!res.ok) throw new AcondError(`GET ${page} → HTTP ${res.status}`);
    const buf = new Uint8Array(await res.arrayBuffer());
    return parseXml(buf);
  }

  /** Write one setpoint (absolute REAL value). */
  async writeVar(name: string, value: string | number, page: string, retry = true): Promise<void> {
    const res = await fetch(this.base + page, {
      method: "POST",
      headers: {
        Authorization: this.basic(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form({ [name]: String(value) }),
      redirect: "manual",
    });
    if (res.status === 301 || res.status === 302 || res.status === 401) {
      if (!retry) throw new AuthError("Session expired during write");
      await this.login();
      return this.writeVar(name, value, page, false);
    }
    if (!res.ok) throw new AcondError(`POST ${page} (${name}) → HTTP ${res.status}`);
  }

  /**
   * Toggle a boolean PLC command. The controller's own UI implements every
   * boolean button this way: read the current value, then POST its inverse.
   * Returns the value that was written (true = 1).
   */
  async toggleVar(name: string, page: string): Promise<boolean> {
    const map = await this.readPage(page);
    if (map[name] === undefined) throw new AcondError(`Symbol ${name} not on ${page}`);
    const next = AcondClient.bool(map, name) ? "0" : "1";
    await this.writeVar(name, next, page);
    return next === "1";
  }

  // ---- typed accessors --------------------------------------------------
  static num(m: VarMap, name: string): number | null {
    const v = m[name];
    if (v == null || v === "") return null;
    const n = parseFloat(v.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  static bool(m: VarMap, name: string): boolean {
    const v = m[name];
    return v != null && v.trim() !== "0" && v.trim() !== "" && v.trim().toLowerCase() !== "false";
  }
}

// --------------------------------------------------------------------------
// helpers
// --------------------------------------------------------------------------

function form(obj: Record<string, string>): string {
  return Object.entries(obj)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}

/** Parse a TECO page (windows-1250 bytes) into { NAME: VALUE }. */
export function parseXml(bytes: Uint8Array): VarMap {
  const text = decodeCp1250(bytes);
  const out: VarMap = {};
  const re = /NAME="([^"]*)"\s+VALUE="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out[m[1]] = decodeEntities(m[2]);
  return out;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

// windows-1250 high range (0x80–0xFF) — the pages carry Czech labels.
const CP1250_HIGH =
  "€�‚�„…†‡�‰Š‹ŚŤŽŹ" +
  "�‘’“”•–—�™š›śťžź" +
  " ˇ˘Ł¤Ą¦§¨©Ş«¬­®Ż" +
  "°±˛ł´µ¶·¸ąş»Ľ˝ľż" +
  "ŔÁÂĂÄĹĆÇČÉĘËĚÍÎĎ" +
  "ĐŃŇÓÔŐÖ×ŘŮÚŰÜÝŢß" +
  "ŕáâăäĺćçčéęëěíîď" +
  "đńňóôőö÷řůúűüýţ˙";

function decodeCp1250(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    out += b < 0x80 ? String.fromCharCode(b) : CP1250_HIGH[b - 0x80];
  }
  return out;
}
