export type OmaValue = string | number;
export type OmaScope = "global" | "trace" | "fcs";

export interface OmaRecord {
  key: string;
  values: OmaValue[];
  scope: OmaScope;
  traceIndex?: number;
  rawLine: string;
  originalValues: OmaValue[];
}

export interface CanonicalTrace {
  index: number;
  side: "R" | "L" | "unspecified";
  pointCount: number | null;
  trcfmt: OmaValue[];
  radii: OmaValue[];
  angles: OmaValue[];
  sags: OmaValue[];
  za: OmaValue[];
  zfmt: OmaValue[];
  records: OmaRecord[];
}

export interface OmaIssue { severity: "error" | "warning"; code: string; message: string; record?: string; }

export interface CanonicalOmaFile {
  records: OmaRecord[];
  traces: CanonicalTrace[];
  fcsRecords: OmaRecord[];
  newline: "\n" | "\r\n";
  source: string;
  issues: OmaIssue[];
}

export interface CartesianTracePoint { x: number; y: number; radius: number; angle: number; }

/** Optical display helpers. FCRV is treated as diopters; n=1.530 is configurable. */
export function radiusFromBaseCurve(baseCurveDiopters: number, refractiveIndex = 1.530) {
  if (!Number.isFinite(baseCurveDiopters) || baseCurveDiopters <= 0 || refractiveIndex <= 1) return Infinity;
  return ((refractiveIndex - 1) * 1000) / baseCurveDiopters;
}

export function sphericalSag(distance: number, radius: number) {
  const d = Math.abs(distance);
  if (!Number.isFinite(radius) || radius <= 0 || d === 0) return 0;
  if (d > radius) return NaN;
  return radius - Math.sqrt(radius * radius - d * d);
}

export function fcrvForTrace(file: CanonicalOmaFile, trace: CanonicalTrace, refractiveIndex = 1.530) {
  const values = file.records.find((record) => record.scope === "global" && record.key === "FCRV")?.values.map(Number) ?? [];
  const baseCurve = Number(values[trace.side === "L" ? 1 : 0]);
  return { baseCurve, refractiveIndex, radius: radiusFromBaseCurve(baseCurve, refractiveIndex) };
}

const TRACE_KEYS = new Set(["TRCFMT", "R", "A", "Z", "ZA", "ZFMT"]);

function parseValues(value: string): OmaValue[] {
  return value.split(";").map((part) => {
    const trimmed = part.trim();
    if (trimmed !== "" && /^[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?$/.test(trimmed)) return Number(trimmed);
    return trimmed;
  });
}

function valuesEqual(a: OmaValue[], b: OmaValue[]) {
  return a.length === b.length && a.every((value, index) => String(value) === String(b[index]));
}

function encodeValues(values: OmaValue[]) { return values.map(String).join(";"); }

export function parseCanonicalOma(content: string): CanonicalOmaFile {
  const newline: "\n" | "\r\n" = content.includes("\r\n") ? "\r\n" : "\n";
  const records: OmaRecord[] = [];
  const fcsRecords: OmaRecord[] = [];
  const traces: CanonicalTrace[] = [];
  let scope: OmaScope = "global";
  let trace: CanonicalTrace | undefined;
  let inFcs = false;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line === "_FCS=BEGIN") {
      records.push({ key: "_FCS", values: ["BEGIN"], originalValues: ["BEGIN"], scope: "fcs", rawLine });
      inFcs = true; scope = "fcs"; continue;
    }
    if (line === "_FCS=END") {
      records.push({ key: "_FCS", values: ["END"], originalValues: ["END"], scope: "fcs", rawLine });
      inFcs = false; scope = trace ? "trace" : "global"; continue;
    }
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    const values = parseValues(line.slice(separator + 1));
    if (key === "TRCFMT") {
      trace = { index: traces.length, side: "unspecified", pointCount: null, trcfmt: values, radii: [], angles: [], sags: [], za: [], zfmt: [], records: [] };
      const side = String(values[3] ?? "").toUpperCase();
      trace.side = side === "R" || side === "L" ? side : "unspecified";
      trace.pointCount = Number.isFinite(Number(values[1])) ? Number(values[1]) : null;
      traces.push(trace);
      scope = "trace";
    }
    const record: OmaRecord = { key, values, originalValues: [...values], scope: inFcs ? "fcs" : (trace && TRACE_KEYS.has(key) ? "trace" : "global"), traceIndex: trace && TRACE_KEYS.has(key) ? trace.index : undefined, rawLine };
    records.push(record);
    if (record.scope === "fcs") fcsRecords.push(record);
    if (record.scope === "trace" && trace) {
      trace.records.push(record);
      if (key === "R") trace.radii.push(...values);
      if (key === "A") trace.angles.push(...values);
      if (key === "Z") trace.sags.push(...values);
      if (key === "ZA") trace.za.push(...values);
      if (key === "ZFMT") trace.zfmt.push(...values);
    }
  }

  const file: CanonicalOmaFile = { records, traces, fcsRecords, newline, source: content, issues: [] };
  file.issues = validateCanonicalOma(file);
  return file;
}

export function normalizedTraceGeometry(trace: CanonicalTrace) {
  const count = trace.pointCount ?? trace.radii.length;
  const angles = trace.trcfmt[2] === "E"
    ? Array.from({ length: count }, (_, index) => index * 360 / count)
    : trace.angles.map(Number).map((value) => value / 100);
  return { side: trace.side, radii: trace.radii.map(Number).map((value) => value / 100), angles, sags: trace.sags.map(Number).map((value) => value / 100) };
}

/** OMA display convention used by the application: zero degrees is +X and angles increase counter-clockwise. */
export function traceToCartesian(trace: CanonicalTrace): CartesianTracePoint[] {
  const geometry = normalizedTraceGeometry(trace);
  return geometry.radii.map((radius, index) => {
    const angle = geometry.angles[index] ?? 0;
    const radians = angle * Math.PI / 180;
    return { x: radius * Math.cos(radians), y: radius * Math.sin(radians), radius, angle };
  });
}

export function binocularPlacement(file: CanonicalOmaFile) {
  const hbox = file.records.find((record) => record.scope === "global" && record.key === "HBOX")?.values.map(Number) ?? [];
  const dbl = Number(file.records.find((record) => record.scope === "global" && record.key === "DBL")?.values[0]);
  const rightWidth = Number.isFinite(hbox[0]) ? hbox[0] : null;
  const leftWidth = Number.isFinite(hbox[1]) ? hbox[1] : null;
  const bridge = Number.isFinite(dbl) ? dbl : 0;
  const centerDistance = rightWidth !== null && leftWidth !== null ? rightWidth / 2 + bridge + leftWidth / 2 : null;
  const distance = centerDistance ?? 0;
  return { rightX: distance / 2, leftX: -distance / 2, centerDistance, rightWidth, leftWidth, dbl: Number.isFinite(dbl) ? dbl : null };
}

export function validateCanonicalOma(file: Pick<CanonicalOmaFile, "traces">): OmaIssue[] {
  const issues: OmaIssue[] = [];
  if (file.traces.length === 0) issues.push({ severity: "error", code: "NO_TRACES", message: "No TRCFMT trace records were found." });
  const sides = new Set<string>();
  for (const trace of file.traces) {
    if (trace.side !== "unspecified") {
      if (sides.has(trace.side)) issues.push({ severity: "warning", code: "DUPLICATE_SIDE", message: `More than one ${trace.side} trace was found.`, record: "TRCFMT" });
      sides.add(trace.side);
    }
    if (trace.trcfmt.length < 4) issues.push({ severity: "error", code: "INVALID_TRCFMT", message: "TRCFMT must contain at least format, point count, angle mode, and side.", record: "TRCFMT" });
    if (trace.pointCount !== null && trace.radii.length !== trace.pointCount) issues.push({ severity: "warning", code: "RADIUS_COUNT", message: `TRCFMT declares ${trace.pointCount} points but ${trace.radii.length} radii were found.`, record: "R" });
    if (trace.trcfmt[2] !== "E" && trace.angles.length !== trace.radii.length) issues.push({ severity: "warning", code: "ANGLE_COUNT", message: "Explicit angle and radius counts differ.", record: "A" });
    if (trace.radii.some((value) => !Number.isFinite(Number(value)))) issues.push({ severity: "error", code: "NON_NUMERIC_RADIUS", message: "A trace contains a non-numeric radius.", record: "R" });
  }
  return issues;
}

export function writeCanonicalOma(file: CanonicalOmaFile): string {
  const lines = file.records.map((record) => valuesEqual(record.values, record.originalValues) ? record.rawLine : `${record.key}=${encodeValues(record.values)}`);
  return lines.join(file.newline) + (file.source.endsWith("\n") || file.source.endsWith("\r") ? file.newline : "");
}
