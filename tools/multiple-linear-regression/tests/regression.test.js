import test from "node:test";
import assert from "node:assert/strict";
import { fitOLS, inverseNormal, studentTCdf } from "../stats.js";
import { parseCsv, parseNumeric } from "../csv.js";

const closeTo = (actual, expected, tolerance = 1e-8) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} should be within ${tolerance} of ${expected}`);
};

test("CSV parser handles quoted values, missing fields, and semicolon detection", () => {
  const parsed = parseCsv('name;value;note\n"A;1";12.5;"quoted ""text"""\nB;;ok\n');
  assert.equal(parsed.delimiter, ";");
  assert.deepEqual(parsed.headers, ["name", "value", "note"]);
  assert.equal(parsed.records[0].values[0], "A;1");
  assert.equal(parsed.records[0].values[2], 'quoted "text"');
  assert.equal(parsed.columns[1].type, "numeric");
  assert.equal(parsed.columns[1].missingCount, 1);
});

test("CSV parser rejects duplicate headers", () => {
  assert.throws(() => parseCsv("x,X\n1,2"), /重复字段名/);
});

test("numeric parser is strict about units and percent signs", () => {
  assert.deepEqual(parseNumeric(" -1.25e2 "), { kind: "number", value: -125 });
  assert.equal(parseNumeric("12%").kind, "invalid");
  assert.equal(parseNumeric("1,200").kind, "invalid");
  assert.equal(parseNumeric("NA").kind, "missing");
});

test("OLS matches a trusted reference result", () => {
  const x1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const x2 = [2, 1, 3, 2, 5, 4, 6, 5, 8, 7];
  const y = [5.1, 7.9, 8.8, 11.2, 10.9, 14.1, 14.8, 17.2, 16.7, 20.3];
  const result = fitOLS({
    y,
    X: x1.map((value, index) => [value, x2[index]]),
    xNames: ["x1", "x2"],
    yName: "y",
    rowIds: x1.map((_, index) => index + 2),
  });

  closeTo(result.coefficients[0].estimate, 4.59537764350452);
  closeTo(result.coefficients[1].estimate, 2.10244712990936);
  closeTo(result.coefficients[2].estimate, -0.80438066465257);
  closeTo(result.metrics.sse, 0.5688157099697934);
  closeTo(result.metrics.rSquared, 0.9971824068259868);
  closeTo(result.metrics.adjustedRSquared, 0.9963773802048401);
  closeTo(result.coefficients[0].standardError, 0.20031581, 1e-7);
  closeTo(result.rows[8].leverage, 0.44652568, 1e-7);
  closeTo(result.rows[8].cooksDistance, 0.874165448, 1e-7);
});

test("distribution helpers are numerically plausible", () => {
  closeTo(inverseNormal(0.975), 1.95996398454005, 1e-7);
  closeTo(studentTCdf(0, 8), 0.5, 1e-12);
  closeTo(studentTCdf(2.306004135, 8), 0.975, 1e-8);
});

test("OLS rejects a rank-deficient design", () => {
  assert.throws(() => fitOLS({
    y: [1, 2, 3, 4, 5, 6],
    X: [[1, 2], [2, 4], [3, 6], [4, 8], [5, 10], [6, 12]],
    xNames: ["x", "twice_x"],
  }), /秩不足/);
});
