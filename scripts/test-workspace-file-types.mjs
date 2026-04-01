import assert from "node:assert/strict";

import {
  ensureWorkspaceFileName,
  getDocumentKindForWorkspaceFileType,
  getWorkspaceFileExtension,
  resolveDocumentKindFromPath,
  resolveWorkspaceFileTypeFromName,
  resolveWorkspaceFileTypeFromPath,
  stripSupportedWorkspaceExtension
} from "../src/workspace-file-types.js";
import { buildDrawioEditorUrl } from "../src/drawio/drawio-host.js";

globalThis.window = {
  location: {
    href: "file:///Users/example/mermaid-tool/index.html"
  }
};

assert.equal(resolveWorkspaceFileTypeFromName("diagram.mmd"), "mermaid");
assert.equal(resolveWorkspaceFileTypeFromName("diagram.DRAWIO"), "drawio");
assert.equal(resolveWorkspaceFileTypeFromPath("/tmp/diagram.drawio"), "drawio");
assert.equal(resolveDocumentKindFromPath("/tmp/diagram.drawio"), "drawio-file");
assert.equal(getDocumentKindForWorkspaceFileType("mermaid"), "mermaid-file");
assert.equal(getWorkspaceFileExtension("drawio"), ".drawio");
assert.equal(stripSupportedWorkspaceExtension("board.drawio"), "board");
assert.equal(stripSupportedWorkspaceExtension("flow.mmd"), "flow");
assert.equal(ensureWorkspaceFileName("board", "drawio"), "board.drawio");
assert.equal(ensureWorkspaceFileName("flow.mmd", "mermaid"), "flow.mmd");

const drawioUrl = new URL(
  buildDrawioEditorUrl("./vendor/drawio/index.html", {
    ui: "min"
  })
);

assert.equal(drawioUrl.pathname.endsWith("/vendor/drawio/index.html"), true);
assert.equal(drawioUrl.searchParams.get("offline"), "1");
assert.equal(drawioUrl.searchParams.get("embed"), "1");
assert.equal(drawioUrl.searchParams.get("proto"), "json");
assert.equal(drawioUrl.searchParams.get("ui"), "min");
assert.equal(drawioUrl.searchParams.get("dark"), "0");

console.log("workspace file type tests passed");
