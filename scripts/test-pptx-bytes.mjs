import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const execFileAsync = promisify(execFile);

async function main() {
  const tempDir = path.join(rootDir, ".tmp");
  const outfile = path.join(tempDir, "pptx-bytes-check.bundle.mjs");

  await mkdir(tempDir, { recursive: true });
  await build({
    entryPoints: [path.join(rootDir, "scripts/pptx-bytes-check-entry.mjs")],
    outfile,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node17",
    sourcemap: false,
    logLevel: "silent"
  });

  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [outfile], {
      cwd: rootDir,
      env: process.env
    });

    if (stdout) {
      process.stdout.write(stdout);
    }
    if (stderr) {
      process.stderr.write(stderr);
    }
  } finally {
    await rm(outfile, { force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
