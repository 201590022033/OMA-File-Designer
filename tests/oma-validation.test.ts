import assert from "node:assert/strict";
import test from "node:test";
import { validateOmaSource, GEOMETRY_TOLERANCE } from "./oma-validation";

test("harness reports an unchanged synthetic fixture as lossless", async () => {
  const report = await validateOmaSource("TRCFMT=1;4;E;R;F\nR=2500;2500;2500;2500\n", "inline.oma", "synthetic");
  assert.equal(report.roundTripStatus, "identical");
  assert.equal(report.geometryEquivalent, true);
  assert.equal(report.informationLoss, false);
  assert.equal(report.confidence, "pass");
});

test("harness exposes validation warnings without treating them as loss", async () => {
  const report = await validateOmaSource("TRCFMT=1;3;E;R;F\nR=2500;2500\n", "mismatch.oma", "synthetic");
  assert.equal(report.geometryEquivalent, true);
  assert.ok(report.validationIssues.some((issue) => issue.code === "RADIUS_COUNT"));
  assert.equal(report.confidence, "warning");
  assert.equal(GEOMETRY_TOLERANCE, 1e-6);
});
