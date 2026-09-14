import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { parseCanonicalOma, normalizedTraceGeometry, writeCanonicalOma, type CanonicalOmaFile, type CanonicalTrace, type OmaRecord } from "../shared/oma-engine";

export const GEOMETRY_TOLERANCE = 1e-6;
const KNOWN_RECORDS = new Set(["TRCFMT", "R", "A", "Z", "ZA", "ZFMT", "TNORM", "FCRV", "ZTILT", "PANTO", "_CDX", "_CDY"]);

export interface GeometrySummary { side: string; pointCount: number; radii: number[]; angles: number[]; sags: number[]; closure: number; width: number; height: number; }
export interface OmaValidationReport { filename: string; category: string; parseSuccess: boolean; traceCount: number; sides: string[]; unknownRecords: string[]; validationIssues: CanonicalOmaFile["issues"]; roundTripStatus: "identical" | "different" | "failed"; geometryEquivalent: boolean; informationLoss: boolean; differences: string[]; changedRecords: string[]; geometry: { original: GeometrySummary[]; regenerated: GeometrySummary[] }; confidence: "pass" | "warning" | "fail"; }

function recordSignature(record: OmaRecord) { return `${record.scope}:${record.traceIndex ?? "-"}:${record.key}`; }
function numbersClose(a: number[], b: number[]) { return a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) <= GEOMETRY_TOLERANCE); }
function geometry(trace: CanonicalTrace): GeometrySummary {
  const normalized = normalizedTraceGeometry(trace);
  const points = normalized.radii.map((radius, i) => [radius * Math.cos(normalized.angles[i] * Math.PI / 180), radius * Math.sin(normalized.angles[i] * Math.PI / 180)] as const);
  const xs = points.map(([x]) => x), ys = points.map(([, y]) => y);
  const closure = points.length > 1 ? Math.hypot(points[0][0] - points.at(-1)![0], points[0][1] - points.at(-1)![1]) : 0;
  return { side: normalized.side, pointCount: points.length, radii: normalized.radii, angles: normalized.angles, sags: normalized.sags, closure, width: xs.length ? Math.max(...xs) - Math.min(...xs) : 0, height: ys.length ? Math.max(...ys) - Math.min(...ys) : 0 };
}

function compareGeometry(original: CanonicalOmaFile, regenerated: CanonicalOmaFile) {
  const a = original.traces.map(geometry), b = regenerated.traces.map(geometry);
  const equivalent = a.length === b.length && a.every((trace, i) => {
    const other = b[i];
    return trace.side === other.side && trace.pointCount === other.pointCount && numbersClose(trace.radii, other.radii) && numbersClose(trace.angles, other.angles) && numbersClose(trace.sags, other.sags) && Math.abs(trace.closure - other.closure) <= GEOMETRY_TOLERANCE && Math.abs(trace.width - other.width) <= GEOMETRY_TOLERANCE && Math.abs(trace.height - other.height) <= GEOMETRY_TOLERANCE;
  });
  return { equivalent, original: a, regenerated: b };
}

export async function validateOmaSource(source: string, filename: string, category: string): Promise<OmaValidationReport> {
  const parsed = parseCanonicalOma(source);
  const unknownRecords = [...new Set(parsed.records.filter((record) => !KNOWN_RECORDS.has(record.key) && record.key !== "_FCS").map((record) => record.key))];
  const differences: string[] = [];
  let regenerated: CanonicalOmaFile;
  let output: string;
  try {
    output = writeCanonicalOma(parsed);
    regenerated = parseCanonicalOma(output);
  } catch (error) {
    return { filename, category, parseSuccess: false, traceCount: parsed.traces.length, sides: parsed.traces.map((t) => t.side), unknownRecords, validationIssues: parsed.issues, roundTripStatus: "failed", geometryEquivalent: false, informationLoss: true, differences: [`writer failure: ${String(error)}`], changedRecords: [], geometry: { original: [], regenerated: [] }, confidence: "fail" };
  }
  if (output === source) differences.push("identical raw record");
  else differences.push("formatting-only difference");
  const originalSignatures = parsed.records.map(recordSignature), regeneratedSignatures = regenerated.records.map(recordSignature);
  if (originalSignatures.join("|") !== regeneratedSignatures.join("|")) {
    if (originalSignatures.length > regeneratedSignatures.length) differences.push("lost record");
    if (originalSignatures.length < regeneratedSignatures.length) differences.push("added record");
    if (originalSignatures.slice().sort().join("|") === regeneratedSignatures.slice().sort().join("|")) differences.push("reordered record");
  }
  const changedRecords = parsed.records.filter((record) => String(record.rawLine) !== output.split(/\r?\n/).find((line) => line.trim().startsWith(`${record.key}=`)) && KNOWN_RECORDS.has(record.key)).map(recordSignature);
  if (unknownRecords.length) differences.push("unknown preserved record");
  const geom = compareGeometry(parsed, regenerated);
  if (!geom.equivalent) differences.push("geometry difference");
  if (parsed.issues.some((issue) => issue.severity === "warning")) differences.push("validation warning");
  if (parsed.issues.some((issue) => issue.severity === "error")) differences.push("validation error");
  const informationLoss = differences.includes("lost record") || !geom.equivalent;
  return { filename, category, parseSuccess: !parsed.issues.some((issue) => issue.severity === "error"), traceCount: parsed.traces.length, sides: parsed.traces.map((t) => t.side), unknownRecords, validationIssues: parsed.issues, roundTripStatus: output === source ? "identical" : "different", geometryEquivalent: geom.equivalent, informationLoss, differences: [...new Set(differences)], changedRecords, geometry: geom, confidence: informationLoss || parsed.issues.some((i) => i.severity === "error") ? "fail" : parsed.issues.length ? "warning" : "pass" };
}

export async function validateFixtures(root = join(process.cwd(), "tests", "fixtures", "oma")) {
  const reports: OmaValidationReport[] = [];
  for (const category of ["synthetic", "real-world", "briot", "malformed"]) {
    const directory = join(root, category);
    let entries: string[] = [];
    try { entries = await readdir(directory); } catch { continue; }
    for (const entry of entries.filter((name) => name.toLowerCase().endsWith(".oma"))) {
      const filename = join(directory, entry);
      reports.push(await validateOmaSource(await readFile(filename, "utf8"), relative(root, filename), category));
    }
  }
  return reports;
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("tests/oma-validation.ts")) {
  const reports = await validateFixtures();
  await mkdir(join(process.cwd(), "reports"), { recursive: true });
  await writeFile(join(process.cwd(), "reports", "oma-validation.json"), JSON.stringify(reports, null, 2));
  console.log(`OMA validation: ${reports.length} fixture(s)`);
  for (const report of reports) console.log(`${report.confidence.toUpperCase().padEnd(7)} ${report.filename} | traces=${report.traceCount} sides=${report.sides.join(",") || "-"} roundTrip=${report.roundTripStatus} geometry=${report.geometryEquivalent ? "yes" : "no"} loss=${report.informationLoss ? "yes" : "no"} ${report.differences.join(", ")}`);
  if (reports.some((report) => report.confidence === "fail")) process.exitCode = 1;
}
