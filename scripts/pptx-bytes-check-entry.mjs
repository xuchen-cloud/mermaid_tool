import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildPptThemeFromMermaidConfig, createDefaultMermaidConfig } from "../src/mermaid-config.js";
import { layoutClassDiagram } from "../src/ppt/class/layout.js";
import { parseClassSource } from "../src/ppt/class/parse.js";
import { layoutErDiagram } from "../src/ppt/er/layout.js";
import { parseErSource } from "../src/ppt/er/parse.js";
import { layoutFlowchart } from "../src/ppt/flowchart/layout.js";
import { parseFlowchartSource } from "../src/ppt/flowchart/parse.js";
import { buildDiagramPptxBytes } from "../src/ppt/export-pptx.js";
import { layoutJourney } from "../src/ppt/journey/layout.js";
import { parseJourneySource } from "../src/ppt/journey/parse.js";
import { layoutPie } from "../src/ppt/pie/layout.js";
import { parsePieSource } from "../src/ppt/pie/parse.js";
import { layoutSequence } from "../src/ppt/sequence/layout.js";
import { parseSequenceSource } from "../src/ppt/sequence/parse.js";
import { layoutStateDiagram } from "../src/ppt/state/layout.js";
import { parseStateSource } from "../src/ppt/state/parse.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

async function main() {
  const defaultConfig = createDefaultMermaidConfig();
  const theme = buildPptThemeFromMermaidConfig(defaultConfig);

  const flowchartSource = await readFile(
    path.join(rootDir, "samples/flowchart/tb-basic.mmd"),
    "utf8"
  );
  const flowchartDiagram = layoutFlowchart(
    {
      ...parseFlowchartSource(flowchartSource),
      source: flowchartSource
    },
    theme.flowchart
  );

  const flowchartBytes = await buildDiagramPptxBytes(flowchartDiagram);
  if (!(flowchartBytes instanceof Uint8Array) || flowchartBytes.byteLength < 1024) {
    throw new Error("Flowchart PPTX bytes generation returned an invalid payload.");
  }

  const sequenceSource = await readFile(
    path.join(rootDir, "samples/sequence/basic-sequence.mmd"),
    "utf8"
  );
  const sequenceDiagram = layoutSequence(
    {
      ...parseSequenceSource(sequenceSource),
      source: sequenceSource
    },
    theme.sequence
  );

  const sequenceBytes = await buildDiagramPptxBytes(sequenceDiagram);
  if (!(sequenceBytes instanceof Uint8Array) || sequenceBytes.byteLength < 1024) {
    throw new Error("Sequence PPTX bytes generation returned an invalid payload.");
  }

  const pieSource = `pie showData
title Revenue Mix
Subscriptions : 72
Services : 18
Other : 10`;
  const pieDiagram = layoutPie(parsePieSource(pieSource), theme);
  const pieBytes = await buildDiagramPptxBytes(pieDiagram);
  if (!(pieBytes instanceof Uint8Array) || pieBytes.byteLength < 1024) {
    throw new Error("Pie PPTX bytes generation returned an invalid payload.");
  }

  const journeySource = `journey
title Customer Onboarding
section Discover
Visit landing page: 4: Alice
section Convert
Submit order: 3: Bob, Carol`;
  const journeyDiagram = layoutJourney(parseJourneySource(journeySource), theme);
  const journeyBytes = await buildDiagramPptxBytes(journeyDiagram);
  if (!(journeyBytes instanceof Uint8Array) || journeyBytes.byteLength < 1024) {
    throw new Error("Journey PPTX bytes generation returned an invalid payload.");
  }

  const classSource = `classDiagram
class Order {
  +id: string
  +submit()
}
Order "1" --> "many" LineItem : contains`;
  const classDiagram = layoutClassDiagram(parseClassSource(classSource), theme.flowchart);
  const classBytes = await buildDiagramPptxBytes(classDiagram);
  if (!(classBytes instanceof Uint8Array) || classBytes.byteLength < 1024) {
    throw new Error("Class diagram PPTX bytes generation returned an invalid payload.");
  }

  const erSource = `erDiagram
CUSTOMER {
  string id PK
  string name
}
ORDER {
  string id PK
}
CUSTOMER ||--o{ ORDER : places`;
  const erDiagram = layoutErDiagram(parseErSource(erSource), theme.flowchart);
  const erBytes = await buildDiagramPptxBytes(erDiagram);
  if (!(erBytes instanceof Uint8Array) || erBytes.byteLength < 1024) {
    throw new Error("ER diagram PPTX bytes generation returned an invalid payload.");
  }

  const stateSource = `stateDiagram-v2
[*] --> Idle
Idle --> Working
state Choice <<choice>>
Working --> Choice
Choice --> [*] : done
note right of Working: Processing`;
  const stateDiagram = layoutStateDiagram(parseStateSource(stateSource), theme);
  const stateBytes = await buildDiagramPptxBytes(stateDiagram);
  if (!(stateBytes instanceof Uint8Array) || stateBytes.byteLength < 1024) {
    throw new Error("State diagram PPTX bytes generation returned an invalid payload.");
  }

  console.log("flowchart bytes:", flowchartBytes.byteLength);
  console.log("sequence bytes:", sequenceBytes.byteLength);
  console.log("pie bytes:", pieBytes.byteLength);
  console.log("journey bytes:", journeyBytes.byteLength);
  console.log("class bytes:", classBytes.byteLength);
  console.log("er bytes:", erBytes.byteLength);
  console.log("state bytes:", stateBytes.byteLength);
  console.log("pptx-bytes: PASS");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
