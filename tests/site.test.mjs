import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const html = await readFile(join(projectRoot, "index.html"), "utf8");
const css = await readFile(join(projectRoot, "assets", "css", "main.css"), "utf8");
const content = JSON.parse(await readFile(join(projectRoot, "content", "site.json"), "utf8"));

test("the generated page has complete metadata and no unresolved tokens", () => {
  assert.match(html, /<title>Yuelong \(John\) Guo/);
  assert.match(html, /property="og:image"/);
  assert.doesNotMatch(html, /%%[A-Z_]+%%/);
});

test("the page has one primary heading and all core sections", () => {
  assert.equal((html.match(/<h1\b/g) || []).length, 1);

  for (const sectionId of ["research", "teaching", "leadership", "about"]) {
    assert.match(html, new RegExp(`id="${sectionId}"`));
  }
});

test("all supplied teaching and leadership experiences are rendered", () => {
  const expectedText = [
    "Cary Chinese School",
    "RTAI",
    "CAST",
    "AI Saturdays",
    "SAPA",
    "CASTNC",
    "Zhejiang University Alumni Association",
    "Curriculum Designer",
    "Instructor",
    "Vice President",
    "IT Director",
    "President"
  ];

  for (const text of expectedText) {
    assert.ok(html.includes(text), `Expected generated page to include "${text}"`);
  }
});

test("experience detail fields remain structured for future expansion", () => {
  assert.ok(content.research.every((item) => item.details));
  assert.ok(content.research.every((item) => Array.isArray(item.details.outcomes)));
  assert.ok(content.teaching.every((item) => Array.isArray(item.roles)));
  assert.ok(content.leadership.every((item) => Array.isArray(item.contributions)));
});

test("navigation targets are unique and keyboard focus is visible", () => {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, "HTML IDs should be unique");
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
});

test("deployment output contains the page, worker, and social image", async () => {
  await Promise.all([
    access(join(projectRoot, "dist", "client", "index.html")),
    access(join(projectRoot, "dist", "server", "index.js")),
    access(join(projectRoot, "dist", "client", "public", "og.png"))
  ]);
});
