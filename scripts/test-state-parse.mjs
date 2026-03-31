import assert from "node:assert/strict";

import { layoutStateDiagram } from "../src/ppt/state/layout.js";
import { parseStateSource } from "../src/ppt/state/parse.js";

runTest("state diagram parses states, pseudo states, notes, and groups", () => {
  const parsed = parseStateSource(`stateDiagram-v2
direction LR
[*] --> Idle
state "In Review" as Review
Review --> Done: approve
note right of Review: waits for reviewer
state Parent {
  Child
}`);

  assert.equal(parsed.direction, "LR");
  assert.equal(parsed.states.find((node) => node.id === "Review")?.label, "In Review");
  assert.equal(parsed.edges[1]?.label, "approve");
  assert.equal(parsed.notes[0]?.targetId, "Review");
  assert.equal(parsed.states.find((node) => node.id === "Parent")?.type, "group");
  assert.equal(parsed.states.find((node) => node.id === "Child")?.parentId, "Parent");
  assert.equal(parsed.states.find((node) => node.type === "start")?.sourceLines[0], 3);
});

runTest("state layout positions notes and groups", () => {
  const parsed = parseStateSource(`stateDiagram
[*] --> Idle
Idle --> Working
note left of Working
Multi line
end note
state Flow {
  Working
}`);
  const diagram = layoutStateDiagram(parsed, {
    flowchart: {
      node: {
        fill: "ECECFF",
        stroke: "9370DB",
        textColor: "333333",
        fontSize: 18,
        fontFamily: "Trebuchet MS"
      },
      edge: {
        stroke: "333333",
        strokeWidth: 1.6
      },
      edgeLabel: {
        fill: "E8E8E8",
        textColor: "333333",
        fontSize: 13,
        fontFamily: "Trebuchet MS"
      },
      layout: {
        nodeSpacing: 40,
        rankSpacing: 64,
        padding: 12
      }
    },
    sequence: {
      note: {
        fill: "FFF8C4",
        stroke: "C3B260",
        textColor: "333333",
        fontSize: 14,
        fontFamily: "Trebuchet MS"
      }
    },
    canvas: {
      background: "FFFFFF"
    }
  });

  assert.ok(diagram.notes[0]?.x < diagram.nodes.find((node) => node.id === "Working")?.x);
  assert.ok(diagram.groups[0]?.width > 0);
  assert.ok(diagram.edges.length >= 3);
});

console.log("State parsing tests passed.");

function runTest(name, callback) {
  try {
    callback();
  } catch (error) {
    error.message = `${name}: ${error.message}`;
    throw error;
  }
}
