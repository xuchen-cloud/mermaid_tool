import assert from "node:assert/strict";

import { layoutClassDiagram } from "../src/ppt/class/layout.js";
import { parseClassSource } from "../src/ppt/class/parse.js";

runTest("class declarations, members, and relations keep source lines", () => {
  const parsed = parseClassSource(`classDiagram
direction LR
class Animal {
  +String name
  +eat()
}
<<interface>> Pet
Animal "1" *-- "many" Leg : has
Pet <|.. Dog`);

  assert.equal(parsed.direction, "LR");
  assert.equal(parsed.nodes.find((node) => node.id === "Animal")?.members[0], "+String name");
  assert.equal(parsed.nodes.find((node) => node.id === "Animal")?.methods[0], "+eat()");
  assert.deepEqual(parsed.nodes.find((node) => node.id === "Pet")?.annotations, ["interface"]);
  assert.equal(parsed.edges[0]?.startLabel, "1");
  assert.equal(parsed.edges[0]?.endLabel, "many");
  assert.equal(parsed.edges[0]?.label, "has");
  assert.equal(parsed.edges[1]?.style.dashType, "dash");
});

runTest("class layout exposes section boxes and terminal labels", () => {
  const parsed = parseClassSource(`classDiagram
class Order {
  +id: string
  +submit()
}
Order "1" --> "many" LineItem : contains`);
  const diagram = layoutClassDiagram(parsed);

  assert.equal(diagram.nodes[0]?.kind, "class");
  assert.ok(diagram.nodes[0]?.sections.length >= 2);
  assert.equal(diagram.edges[0]?.startLabel?.text, "1");
  assert.equal(diagram.edges[0]?.endLabel?.text, "many");
});

console.log("Class parsing tests passed.");

function runTest(name, callback) {
  try {
    callback();
  } catch (error) {
    error.message = `${name}: ${error.message}`;
    throw error;
  }
}
