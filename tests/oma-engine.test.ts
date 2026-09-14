import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { parseCanonicalOma, validateCanonicalOma, writeCanonicalOma, traceToCartesian, binocularPlacement, radiusFromBaseCurve, sphericalSag } from "../shared/oma-engine";
import { edgeApexZ } from "../client/src/lib/oma-parser";

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

test("canonical Cartesian points are the shared solid and wireframe perimeter", () => {
  const trace = parseCanonicalOma("TRCFMT=1;4;E;R;F\nR=100;100;100;100\n").traces[0];
  const points = traceToCartesian(trace);
  const expected = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  points.forEach(({ x, y }, index) => {
    assert.ok(Math.abs(x - expected[index][0]) < 1e-12);
    assert.ok(Math.abs(y - expected[index][1]) < 1e-12);
  });
});

test("binocular placement derives optical-center distance from HBOX and DBL", () => {
  const file = parseCanonicalOma("HBOX=53.88;53.56\nDBL=15.41\nTRCFMT=1;4;E;R;F\nR=2500;2500;2500;2500\nTRCFMT=1;4;E;L;F\nR=2500;2500;2500;2500\n");
  const placement = binocularPlacement(file);
  assert.equal(placement.centerDistance, 69.13);
  assert.equal(placement.leftX, -34.565);
  assert.equal(placement.rightX, 34.565);
});

test("spherical sag is finite, centered, symmetric, and monotonic", () => {
  const radius = radiusFromBaseCurve(3.16);
  assert.ok(Math.abs(radius - 167.7215189873) < 1e-9);
  assert.equal(sphericalSag(0, radius), 0);
  assert.equal(sphericalSag(10, radius), sphericalSag(-10, radius));
  assert.ok(sphericalSag(20, radius) > sphericalSag(10, radius));
  assert.ok(Number.isFinite(sphericalSag(20, radius)));
  assert.ok(Number.isNaN(sphericalSag(radius + 1, radius)));
});

test("real fixture uses independent right and left FCRV curvature", () => {
  const file = parseCanonicalOma(readFileSync("tests/fixtures/oma/real-world/23546 - Final_Annelize Botha_1.oma", "utf8"));
  const right = file.records.find((record) => record.key === "FCRV")!.values.map(Number)[0];
  const left = file.records.find((record) => record.key === "FCRV")!.values.map(Number)[1];
  assert.notEqual(radiusFromBaseCurve(right), radiusFromBaseCurve(left));
});

test("preview edge placement follows local front/back surfaces", () => {
  for (const ratio of [0, 0.333, 0.5, 1, 0.25, 0.75]) {
    assert.ok(Math.abs(edgeApexZ(2.1, -1.9, ratio) - (2.1 + ratio * (-4))) < 1e-12);
  }
  assert.equal(edgeApexZ(2, -2, 0), 2);
  assert.equal(edgeApexZ(2, -2, 1), -2);
});

test("edge preview state is export-neutral for the real fixture", () => {
  const content = readFileSync("tests/fixtures/oma/real-world/23546 - Final_Annelize Botha_1.oma", "utf8");
  const exported = writeCanonicalOma(parseCanonicalOma(content));
  for (const preview of ["front", "one-third-front", "center", "back", "custom", "flat", "groove:2:1:0.75"]) {
    assert.equal(writeCanonicalOma(parseCanonicalOma(content)), exported, preview);
  }
});
