/**
 * Checks the built page for horizontal overflow at several widths.
 *
 * Horizontal scroll is the one layout failure that is invisible in the markup,
 * survives every unit test, and is immediately obvious to anyone on a phone.
 * It is caused here by grid and flex items, whose automatic minimum size is
 * their min-content width rather than zero.
 *
 * Like `npm run og`, this needs a browser binary and so is not part of
 * `npm test`. Run it after touching layout CSS.
 *
 * Note: headless Chrome clamps the window to a 500px minimum width on Windows,
 * so 500 is the narrowest width that can be measured here. A layout that is
 * clean at 500 has cleared the breakpoints that matter.
 */

import { spawn } from "node:child_process";
import { access, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const widths = process.argv.slice(2).map(Number).filter(Boolean);
const testWidths = widths.length > 0 ? widths : [500, 620, 780, 1000, 1280];
const origin = process.env.ORIGIN || "http://localhost:4173";

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
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome"
].filter(Boolean);

let browser;
for (const candidate of candidates) {
  if (await exists(candidate)) {
    browser = candidate;
    break;
  }
}
if (!browser) throw new Error("No Chrome or Edge found. Set CHROME_PATH.");

const probe = `
    <script>
      addEventListener("load", () => {
        const vw = document.documentElement.clientWidth;
        const name = (el) => el.tagName.toLowerCase() +
          (typeof el.className === "string" && el.className
            ? "." + el.className.trim().split(/\\s+/)[0] : "");
        // Anything inside a deliberate scroll container is allowed to be wider.
        const offenders = [...document.querySelectorAll("body *")]
          .filter((el) => !el.closest("[data-allow-overflow]"))
          .filter((el) => Math.round(el.getBoundingClientRect().right) > vw + 1)
          .map((el) => name(el) + " (" + Math.round(el.getBoundingClientRect().width) + "px)");
        document.title = "DIAG" + JSON.stringify({
          vw,
          scrollWidth: document.documentElement.scrollWidth,
          offenders: [...new Set(offenders)].slice(0, 8)
        });
      });
    </script>
  </head>`;

const html = await readFile(join(projectRoot, "index.html"), "utf8");
const file = "_layout-check.html";
await writeFile(join(projectRoot, file), html.replace("</head>", probe), "utf8");

const measure = (width) =>
  new Promise((res, rej) => {
    const child = spawn(
      browser,
      [
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        "--force-prefers-reduced-motion",
        "--virtual-time-budget=6000",
        `--window-size=${width},1000`,
        "--dump-dom",
        `${origin}/${file}`
      ],
      { stdio: ["ignore", "pipe", "ignore"] }
    );
    let buf = "";
    child.stdout.on("data", (d) => (buf += d));
    child.on("error", rej);
    child.on("close", () => {
      const match = buf.match(/<title>DIAG(.*?)<\/title>/s);
      if (!match) return rej(new Error(`probe did not run at ${width}px — is ${origin} serving?`));
      res(JSON.parse(match[1]));
    });
  });

let failed = false;
try {
  for (const width of testWidths) {
    const result = await measure(width);
    const overflow = result.scrollWidth - result.vw;
    if (overflow > 1) {
      failed = true;
      console.error(`FAIL  ${result.vw}px viewport overflows by ${overflow}px`);
      for (const offender of result.offenders) console.error(`        ${offender}`);
    } else {
      console.log(`ok    ${result.vw}px viewport — no horizontal overflow`);
    }
  }
} finally {
  await rm(join(projectRoot, file), { force: true });
}

if (failed) {
  console.error(
    "\nA grid or flex item is refusing to shrink. The usual fix is min-width: 0\n" +
      "on the item, plus an overflow-x: auto wrapper if the content genuinely\n" +
      "needs the space."
  );
  process.exit(1);
}

console.log("\nNo horizontal overflow at any tested width.");
