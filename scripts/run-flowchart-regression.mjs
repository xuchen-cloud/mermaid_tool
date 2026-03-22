import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { getFlowchartSlideMetrics, writeFlowchartPptx } from "../src/ppt/export-pptx.js";
import { layoutFlowchart } from "../src/ppt/flowchart/layout.js";
import { parseFlowchartSource } from "../src/ppt/flowchart/parse.js";

const NODE_FONT_MIN_PT = 11;
const NODE_FONT_MAX_PT = 24;
const EDGE_LABEL_FONT_MIN_PT = 8.5;
const EDGE_LABEL_FONT_MAX_PT = 18;
const MIN_SCALE = 0.009;

async function main() {
  const rootDir = process.cwd();
  const sampleDir = path.resolve(rootDir, "samples", "flowchart");
  const outDir = resolveOutDir(rootDir, process.argv.slice(2));

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const sampleFiles = (await readdir(sampleDir))
    .filter((file) => file.endsWith(".mmd"))
    .sort();

  if (sampleFiles.length === 0) {
    throw new Error(`No flowchart regression samples found in ${sampleDir}`);
  }

  const summary = [];
  let issueCount = 0;

  for (const sampleFile of sampleFiles) {
    const source = await readFile(path.join(sampleDir, sampleFile), "utf8");
    const parsed = parseFlowchartSource(source);
    parsed.source = source;
    const diagram = layoutFlowchart(parsed);
    const sampleName = path.basename(sampleFile, ".mmd");
    const pptxPath = path.join(outDir, `${sampleName}.pptx`);

    await writeFlowchartPptx(diagram, pptxPath);

    const metrics = collectMetrics(sampleFile, diagram, pptxPath);
    summary.push(metrics);
    issueCount += metrics.issues.length;
    console.log(
      `${sampleFile}: status=${metrics.status}, nodes=${metrics.nodeCount}, edges=${metrics.edgeCount}, scale=${metrics.scale.toFixed(4)}, pptx=${path.basename(pptxPath)}`
    );
  }

  const summaryPath = path.join(outDir, "summary.json");
  const markdownPath = path.join(outDir, "summary.md");

  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, renderMarkdown(summary), "utf8");

  console.log(`\nArtifacts written to ${outDir}`);
  console.log(`Summary: ${summaryPath}`);

  if (issueCount > 0) {
    console.error(`Regression thresholds exceeded: ${issueCount} issue(s) detected.`);
    process.exitCode = 1;
  }
}

function resolveOutDir(rootDir, args) {
  const outDirFlag = args.find((arg) => arg.startsWith("--out-dir="));

  if (outDirFlag) {
    return path.resolve(rootDir, outDirFlag.slice("--out-dir=".length));
  }

  return path.resolve(rootDir, "artifacts", "flowchart-regression");
}

function collectMetrics(sampleFile, diagram, pptxPath) {
  const viewport = getFlowchartSlideMetrics(diagram);
  const { scale } = viewport;
  const nodeLineCounts = diagram.nodes.map((node) => node.text.split(/\n+/).filter(Boolean).length);
  const multiLineNodeCount = nodeLineCounts.filter((count) => count > 1).length;
  const nodeWidths = diagram.nodes.map((node) => node.width);
  const nodeHeights = diagram.nodes.map((node) => node.height);
  const labeledEdges = diagram.edges.filter((edge) => edge.label?.text);
  const notes = [];
  const issues = [];
  const nodeFontPt = round(nodeFontPxToPt(diagram.nodes[0]?.style.fontSize ?? 0, scale), 2);
  const edgeLabelFontPt = labeledEdges[0]
    ? round(edgeFontPxToPt(labeledEdges[0].label.style.fontSize, scale), 2)
    : null;

  if (scale < 0.009) {
    notes.push("very-wide-layout");
  }

  if (multiLineNodeCount > 0) {
    notes.push("contains-multiline-nodes");
  }

  if (labeledEdges.length > 0) {
    notes.push("contains-edge-labels");
  }

  if (scale <= MIN_SCALE) {
    issues.push("scale-too-small");
  }

  if (nodeFontPt < NODE_FONT_MIN_PT) {
    issues.push("node-font-too-small");
  }

  if (nodeFontPt > NODE_FONT_MAX_PT) {
    issues.push("node-font-too-large");
  }

  if (edgeLabelFontPt !== null && edgeLabelFontPt < EDGE_LABEL_FONT_MIN_PT) {
    issues.push("edge-label-font-too-small");
  }

  if (edgeLabelFontPt !== null && edgeLabelFontPt > EDGE_LABEL_FONT_MAX_PT) {
    issues.push("edge-label-font-too-large");
  }

  if (viewport.offsetX > 0.01) {
    notes.push("centered-horizontally");
  }

  return {
    sample: sampleFile,
    status: issues.length === 0 ? "PASS" : "FAIL",
    direction: diagram.direction,
    nodeCount: diagram.nodes.length,
    edgeCount: diagram.edges.length,
    labeledEdgeCount: labeledEdges.length,
    multiLineNodeCount,
    canvas: {
      width: round(diagram.canvas.width),
      height: round(diagram.canvas.height)
    },
    scale: round(scale, 6),
    slideHeight: round(viewport.slideHeight, 3),
    offsetX: round(viewport.offsetX, 3),
    nodeFontPt,
    edgeLabelFontPt,
    nodeSizeRange: {
      minWidth: round(Math.min(...nodeWidths)),
      maxWidth: round(Math.max(...nodeWidths)),
      minHeight: round(Math.min(...nodeHeights)),
      maxHeight: round(Math.max(...nodeHeights))
    },
    pptxPath,
    notes,
    issues
  };
}

function renderMarkdown(summary) {
  const lines = [
    "# Flowchart Regression Summary",
    "",
    "| Sample | Status | Dir | Nodes | Edges | Scale | Node Font (pt) | Edge Label Font (pt) | Notes | Issues |",
    "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |"
  ];

  for (const item of summary) {
    lines.push(
      `| ${item.sample} | ${item.status} | ${item.direction} | ${item.nodeCount} | ${item.edgeCount} | ${item.scale.toFixed(4)} | ${item.nodeFontPt?.toFixed?.(2) ?? item.nodeFontPt} | ${item.edgeLabelFontPt === null ? "-" : item.edgeLabelFontPt.toFixed(2)} | ${item.notes.join(", ") || "-"} | ${item.issues.join(", ") || "-"} |`
    );
  }

  lines.push("");
  return `${lines.join("\n")}\n`;
}

function nodeFontPxToPt(value, scale) {
  return Math.max(8.5, value * scale * 72);
}

function edgeFontPxToPt(value, scale) {
  return Math.max(7.5, value * scale * 72);
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
