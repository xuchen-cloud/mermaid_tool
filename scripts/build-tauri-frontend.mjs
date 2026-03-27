import { mkdir, readFile, rm, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const distRoot = path.join(repoRoot, "dist-tauri");
const distSrc = path.join(distRoot, "src");

async function ensureDir(targetPath) {
  await mkdir(targetPath, { recursive: true });
}

async function buildFrontend() {
  await rm(distRoot, { recursive: true, force: true });
  await ensureDir(distSrc);

  const indexPath = path.join(repoRoot, "index.html");
  const stylesPath = path.join(repoRoot, "styles.css");
  const rendererEntry = path.join(repoRoot, "src", "renderer.js");
  const rendererOutput = path.join(distSrc, "renderer.js");

  await Promise.all([
    copyFile(indexPath, path.join(distRoot, "index.html")),
    copyFile(stylesPath, path.join(distRoot, "styles.css"))
  ]);

  await esbuild.build({
    entryPoints: [rendererEntry],
    outfile: rendererOutput,
    bundle: true,
    format: "esm",
    platform: "browser",
    target: ["chrome120", "safari16"],
    sourcemap: false,
    minify: true,
    legalComments: "none",
    logLevel: "info"
  });

  const packageJsonPath = path.join(distRoot, "package.json");
  const packageJson = {
    name: "mermaid-tool-tauri-frontend",
    private: true
  };
  await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));

  const indexContent = await readFile(path.join(distRoot, "index.html"), "utf8");
  if (!indexContent.includes("./src/renderer.js")) {
    throw new Error("Unexpected index.html script path while building dist-tauri.");
  }
}

buildFrontend().catch((error) => {
  console.error("[build:tauri-frontend]", error);
  process.exitCode = 1;
});
