import assert from "node:assert/strict";

import { layoutErDiagram } from "../src/ppt/er/layout.js";
import { parseErSource } from "../src/ppt/er/parse.js";

runTest("entities, attributes, and relationships keep source lines", () => {
  const parsed = parseErSource(`erDiagram
direction LR
CUSTOMER {
  string id PK
  string name
}
ORDER {
  string id PK
  datetime created_at
}
CUSTOMER ||--o{ ORDER : places`);

  assert.equal(parsed.direction, "LR");
  assert.equal(parsed.nodes.find((node) => node.id === "CUSTOMER")?.attributes[0]?.name, "id");
  assert.deepEqual(parsed.nodes.find((node) => node.id === "CUSTOMER")?.attributes[0]?.keys, ["PK"]);
  assert.equal(parsed.edges[0]?.startLabel, "1");
  assert.equal(parsed.edges[0]?.endLabel, "0..*");
  assert.equal(parsed.edges[0]?.label, "places");
});

runTest("er layout exposes header and attribute rows", () => {
  const parsed = parseErSource(`erDiagram
TEAM {
  string id PK
  string name
}
TEAM ||--|{ MEMBER : includes`);
  const diagram = layoutErDiagram(parsed);

  assert.equal(diagram.nodes[0]?.kind, "er");
  assert.ok(diagram.nodes[0]?.headerHeight > 0);
  assert.equal(diagram.edges[0]?.endLabel?.text, "1..*");
});

console.log("ER parsing tests passed.");

function runTest(name, callback) {
  try {
    callback();
  } catch (error) {
    error.message = `${name}: ${error.message}`;
    throw error;
  }
}
