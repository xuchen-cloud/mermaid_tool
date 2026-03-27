import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildPptThemeFromMermaidConfig, createDefaultMermaidConfig } from "../src/mermaid-config.js";
import { layoutFlowchart } from "../src/ppt/flowchart/layout.js";
import { parseFlowchartSource } from "../src/ppt/flowchart/parse.js";
import { buildDiagramPptxBytes } from "../src/ppt/export-pptx.js";
import { layoutSequence } from "../src/ppt/sequence/layout.js";
import { parseSequenceSource } from "../src/ppt/sequence/parse.js";

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

  console.log("flowchart bytes:", flowchartBytes.byteLength);
  console.log("sequence bytes:", sequenceBytes.byteLength);
  console.log("pptx-bytes: PASS");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
