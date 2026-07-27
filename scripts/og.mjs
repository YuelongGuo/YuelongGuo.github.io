/**
 * Renders public/og.png from content/site.json via headless Chrome or Edge.
 *
 * This is deliberately NOT part of `npm run build`: it needs a browser binary,
 * which the build cannot assume. The card is a committed artifact — regenerate
 * it with `npm run og` whenever the name, role, or Scholar metrics change.
 */

import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { renderChart } from "./chart.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const contentPath = join(projectRoot, "content", "site.json");
const templatePath = join(projectRoot, "src", "og.template.html");
const outputPath = join(projectRoot, "public", "og.png");

const WIDTH = 1200;
const HEIGHT = 630;

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const exists = async (path) => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

const candidates = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium"
].filter(Boolean);

const findBrowser = async () => {
  for (const candidate of candidates) {
    if (await exists(candidate)) return candidate;
  }
  throw new Error(
    `No Chrome or Edge binary found. Set CHROME_PATH to one, or install either browser.\nLooked in:\n  ${candidates.join("\n  ")}`
  );
};

const run = (binary, args) =>
  new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(binary, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", rejectPromise);
    child.on("close", (code) => {
      if (code === 0) resolvePromise();
      else rejectPromise(new Error(`${binary} exited with ${code}\n${stderr.slice(-2000)}`));
    });
  });

const content = JSON.parse(await readFile(contentPath, "utf8"));
const template = await readFile(templatePath, "utf8");

const hIndex = content.scholar.metrics.find((metric) => metric.key === "h-index");
if (!hIndex) throw new Error('content.scholar.metrics must include an "h-index" entry.');

const citations = content.scholar.metrics.find((metric) => metric.key === "citations");

const statCards = [
  { value: citations?.all ?? "", label: "citations" },
  { value: content.scholar.indexedWorks, label: "indexed works" },
  { value: content.scholar.yearSpan, label: "publishing" }
]
  .filter((item) => item.value)
  .map(
    (item) => `<div>
          <p class="stat-value">${escapeHtml(item.value)}</p>
          <p class="stat-label">${escapeHtml(item.label)}</p>
        </div>`
  )
  .join("\n        ");

const chart = renderChart(content.scholar.chart, {
  width: 380,
  height: 190,
  padLeft: 8,
  padRight: 8,
  padTop: 26,
  padBottom: 8,
  minimal: true,
  role: "presentation",
  labelledBy: ""
});

const domain = new URL(content.meta.url).host;

const tokens = {
  "%%PROFILE_NAME%%": escapeHtml(content.profile.name),
  "%%PROFILE_EYEBROW%%": escapeHtml(content.profile.eyebrow),
  "%%PROFILE_ROLE%%": escapeHtml(content.profile.role),
  "%%H_INDEX%%": escapeHtml(hIndex.all),
  "%%H_INDEX_NOTE%%": escapeHtml(hIndex.note ?? ""),
  "%%CHART%%": chart,
  "%%STATS%%": statCards,
  "%%DOMAIN%%": escapeHtml(domain)
};

let html = template;
for (const [token, value] of Object.entries(tokens)) {
  html = html.replaceAll(token, value);
}

const unresolved = html.match(/%%[A-Z_]+%%/g);
if (unresolved) {
  throw new Error(`Unresolved card tokens: ${[...new Set(unresolved)].join(", ")}`);
}

const browser = await findBrowser();
const workDir = await mkdtemp(join(tmpdir(), "og-card-"));
const pagePath = join(workDir, "card.html");
await writeFile(pagePath, html, "utf8");

try {
  await run(browser, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "--default-background-color=00000000",
    // Web fonts load over the network; give the renderer time to settle before
    // it captures, otherwise the card ships in fallback typefaces.
    "--virtual-time-budget=8000",
    `--window-size=${WIDTH},${HEIGHT}`,
    `--screenshot=${outputPath}`,
    `file://${pagePath.replaceAll("\\", "/")}`
  ]);
} finally {
  await rm(workDir, { recursive: true, force: true });
}

const { size } = await stat(outputPath);
console.log(`Rendered ${outputPath} (${WIDTH}x${HEIGHT}, ${(size / 1024).toFixed(0)} KB) using ${browser}`);

if (size > 1_000_000) {
  console.warn("Warning: the card is over 1 MB. Social platforms prefer smaller images.");
}
