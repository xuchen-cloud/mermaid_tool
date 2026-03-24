import assert from "node:assert/strict";

import { parseSequenceSource } from "../src/ppt/sequence/parse.js";

runTest("participants and events keep source line ranges", () => {
  const parsed = parseSequenceSource(`sequenceDiagram
participant Alice
participant Bob
Alice->>Bob: Hello
note right of Bob: First line
Second line
activate Bob
deactivate Bob`);

  assert.deepEqual(parsed.participants.find((participant) => participant.id === "Alice")?.sourceLines, [2]);
  assert.deepEqual(parsed.participants.find((participant) => participant.id === "Bob")?.sourceLines, [3]);
  assert.equal(parsed.events[0]?.lineStart, 4);
  assert.equal(parsed.events[1]?.lineStart, 5);
  assert.equal(parsed.events[1]?.lineEnd, 6);
  assert.equal(parsed.events[2]?.lineStart, 7);
  assert.equal(parsed.events[3]?.lineStart, 8);
});

console.log("Sequence parsing tests passed.");

function runTest(name, callback) {
  try {
    callback();
  } catch (error) {
    error.message = `${name}: ${error.message}`;
    throw error;
  }
}
