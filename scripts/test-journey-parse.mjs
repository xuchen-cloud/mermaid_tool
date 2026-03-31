import assert from "node:assert/strict";

import { parseJourneySource } from "../src/ppt/journey/parse.js";

runTest("journey sections and tasks keep source line numbers", () => {
  const parsed = parseJourneySource(`journey
title Signup Experience
section Landing
Visit page: 3: Alice
Read FAQ: 4
section Checkout
Pay invoice: 2: Bob, Carol`);

  assert.equal(parsed.title, "Signup Experience");
  assert.equal(parsed.sections[0]?.text, "Landing");
  assert.deepEqual(parsed.sections[0]?.sourceLines, [3]);
  assert.equal(parsed.tasks[0]?.sectionId, parsed.sections[0]?.id);
  assert.equal(parsed.tasks[0]?.lineStart, 4);
  assert.deepEqual(parsed.tasks[1]?.people, []);
  assert.deepEqual(parsed.tasks[2]?.people, ["Bob", "Carol"]);
});

console.log("Journey parsing tests passed.");

function runTest(name, callback) {
  try {
    callback();
  } catch (error) {
    error.message = `${name}: ${error.message}`;
    throw error;
  }
}
