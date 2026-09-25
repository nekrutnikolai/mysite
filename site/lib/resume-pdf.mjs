import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { loadResume, renderResumeLatex } from "./resume.mjs";

const exec = promisify(execFile);
const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const CACHE = path.join(ROOT, "site/cache/latex");
const VERSION = "0.15.0";

async function compiler() {
  if (process.env.TECTONIC) return process.env.TECTONIC;
  const targets = {
    "linux-x64": "x86_64-unknown-linux-musl",
    "linux-arm64": "aarch64-unknown-linux-musl",
    "darwin-x64": "x86_64-apple-darwin",
    "darwin-arm64": "aarch64-apple-darwin",
  };
  const target = targets[`${process.platform}-${process.arch}`];
  if (!target) {
    throw new Error("Set TECTONIC to an installed Tectonic executable on this platform.");
  }
  const directory = path.join(CACHE, `tectonic-${VERSION}-${target}`);
  const binary = path.join(directory, "tectonic");
  try {
    await fs.access(binary);
    return binary;
  } catch { /* Install the pinned compiler on the first build. */ }

  await fs.mkdir(CACHE, { recursive: true });
  const temporary = await fs.mkdtemp(path.join(CACHE, "install-"));
  try {
    const archive = path.join(temporary, "tectonic.tar.gz");
    const url = `https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%40${VERSION}/tectonic-${VERSION}-${target}.tar.gz`;
    console.log(`[resume] Downloading Tectonic ${VERSION}`);
    await exec("curl", ["--fail", "--location", "--silent", "--show-error", "--retry", "2", "--max-time", "120", url, "--output", archive]);
    await exec("tar", ["-xzf", archive, "-C", temporary, "tectonic"]);
    await fs.mkdir(directory, { recursive: true });
    await fs.rename(path.join(temporary, "tectonic"), binary);
    return binary;
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
}

// Compile into a temporary directory so a failed build never publishes an old PDF.
export async function buildResumePdf(destination = path.join(ROOT, "dist/Resume.pdf"), data) {
  const latex = await renderResumeLatex(data ?? await loadResume());
  const binary = await compiler();
  await fs.mkdir(CACHE, { recursive: true });
  const temporary = await fs.mkdtemp(path.join(CACHE, "build-"));
  try {
    const source = path.join(temporary, "Resume.tex");
    await fs.writeFile(source, latex);
    const { stderr } = await exec(binary, [
      "--untrusted", "--outdir", temporary, source,
    ], {
      cwd: ROOT,
      env: { ...process.env, XDG_CACHE_HOME: CACHE },
      timeout: 180_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    if (stderr) process.stderr.write(stderr);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.copyFile(path.join(temporary, "Resume.pdf"), destination);
    console.log(`[resume] Compiled resume.json → ${path.relative(ROOT, destination)}`);
  } catch (error) {
    throw new Error(`Resume LaTeX compilation failed: ${error.stderr || error.stdout || error.message}`, { cause: error });
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
}
