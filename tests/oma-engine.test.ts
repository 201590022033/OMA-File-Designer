import assert from "node:assert/strict";
import test from "node:test";
import { parseCanonicalOma, validateCanonicalOma, writeCanonicalOma } from "../shared/oma-engine";

const synthetic = [
  "VERS=3.10",
  "JOBID=SYNTHETIC-001",
  "UNKNOWN_VENDOR=preserve;42",
  "TRCFMT=1;4;E;R;F",
  "R=2500;2500;2500;2500",
  "Z=10;20;30;40",
  "ZFMT=1;1",
  "TRCFMT=1;4;A;L;F",
  "R=2500;2600;2700;2800",
  "A=0;9000;18000;27000",
  "_FCS=BEGIN",
  "CUSTOM=abc;def",
  "_FCS=END",
].join("\n") + "\n";

test("parses right and left traces with typed geometry fields", () => {
  const file = parseCanonicalOma(synthetic);
  assert.equal(file.traces.length, 2);
  assert.equal(file.traces[0].side, "R");
  assert.equal(file.traces[1].side, "L");
  assert.deepEqual(file.traces[0].radii, [2500, 2500, 2500, 2500]);
  assert.deepEqual(file.traces[1].angles, [0, 9000, 18000, 27000]);
  assert.equal(file.fcsRecords[0].key, "CUSTOM");
});

test("unchanged parse/write preserves source text and unknown records", () => {
  const file = parseCanonicalOma(synthetic);
  assert.equal(writeCanonicalOma(file), synthetic);
});

test("edited known values regenerate deterministically while unknowns remain", () => {
  const file = parseCanonicalOma(synthetic);
  const radius = file.traces[0].records.find((record) => record.key === "R");
  assert.ok(radius);
  radius.values[0] = 2550;
  const output = writeCanonicalOma(file);
  assert.match(output, /R=2550;2500;2500;2500/);
  assert.match(output, /UNKNOWN_VENDOR=preserve;42/);
  assert.match(output, /CUSTOM=abc;def/);
});

test("equal-angle and explicit-angle traces use the same canonical model", () => {
  const file = parseCanonicalOma(synthetic);
  assert.deepEqual(file.traces[0].trcfmt.slice(0, 4), [1, 4, "E", "R"]);
  assert.deepEqual(file.traces[1].trcfmt.slice(0, 4), [1, 4, "A", "L"]);
});

test("validation reports mismatched declared point counts", () => {
  const file = parseCanonicalOma("TRCFMT=1;3;E;R;F\nR=100;200\n");
  assert.ok(validateCanonicalOma(file).some((issue) => issue.code === "RADIUS_COUNT"));
});

test("validation distinguishes a file with no traces as fatal", () => {
  const file = parseCanonicalOma("VERS=3.10\n");
  assert.ok(file.issues.some((issue) => issue.severity === "error" && issue.code === "NO_TRACES"));
});
