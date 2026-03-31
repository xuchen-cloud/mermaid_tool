import assert from "node:assert/strict";

import { getVisiblePieSections, layoutPie } from "../src/ppt/pie/layout.js";
import { parsePieSource } from "../src/ppt/pie/parse.js";

runTest("pie sections keep line numbers and optional title/showData", () => {
  const parsed = parsePieSource(`pie showData
title Revenue Mix
"Subscriptions" : 72
Services : 18
Other : 10`);

  assert.equal(parsed.showData, true);
  assert.equal(parsed.title, "Revenue Mix");
  assert.equal(parsed.sections[0]?.label, "Subscriptions");
  assert.equal(parsed.sections[0]?.lineStart, 3);
});

runTest("visible pie sections follow Mermaid sorting and 1 percent cutoff", () => {
  const parsed = parsePieSource(`pie
A : 60
B : 30
C : 0.2
D : 9.8`);
  const diagram = layoutPie(parsed);
  const visible = getVisiblePieSections(diagram);

  assert.deepEqual(visible.map((section) => section.label), ["A", "B", "D"]);
});

console.log("Pie parsing tests passed.");

function runTest(name, callback) {
  try {
    callback();
  } catch (error) {
    error.message = `${name}: ${error.message}`;
    throw error;
  }
}
