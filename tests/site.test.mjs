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

test("the citation series reproduces the published h-index and i10-index", () => {
  const series = [...content.scholar.chart.series].sort((a, b) => b - a);
  const hIndex = series.filter((value, index) => value >= index + 1).length;
  const i10 = series.filter((value) => value >= 10).length;

  const stated = Object.fromEntries(
    content.scholar.metrics.map((metric) => [metric.key, Number(metric.all)])
  );

  assert.equal(hIndex, stated["h-index"], "series must yield the stated h-index");
  assert.equal(i10, stated["i10-index"], "series must yield the stated i10-index");
  assert.equal(Number(content.scholar.chart.highlight), hIndex);
});

test("the h-index chart and its metrics reach the page", () => {
  assert.match(html, /class="chart"/);
  assert.match(html, /class="chart-bar chart-bar-core"/);
  assert.match(html, /h = 20/);
  assert.ok(html.includes("1,925"), "all-time citation count should be rendered");
  assert.match(html, /Google Scholar/);
  assert.match(html, new RegExp(content.scholar.retrieved), "metrics must be dated");
});

test("every research theme and selected publication is rendered", () => {
  for (const theme of content.research) {
    assert.ok(html.includes(`id="theme-${theme.slug}"`), `missing theme ${theme.slug}`);
  }

  for (const publication of content.publications) {
    assert.ok(html.includes(publication.venue), `missing venue ${publication.venue}`);
  }
});

test("headline type stays within a professional scale", () => {
  const remValues = [...css.matchAll(/font-size:[^;]*?(\d+(?:\.\d+)?)rem\s*\)?\s*;/g)].map((match) =>
    Number(match[1])
  );

  const largest = Math.max(...remValues);
  assert.ok(
    largest <= 3.5,
    `no declared font-size should exceed 3.5rem (56px); found ${largest}rem`
  );
});

test("navigation targets are unique and accessibility affordances exist", () => {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, "HTML IDs should be unique");
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(html, /role="img"/, "the chart must expose an accessible role");
  assert.match(html, /aria-labelledby="chart-title chart-caption"/);
});

test("deployment output contains the page, worker, and social image", async () => {
  await Promise.all([
    access(join(projectRoot, "dist", "client", "index.html")),
    access(join(projectRoot, "dist", "server", "index.js")),
    access(join(projectRoot, "dist", "client", "public", "og.png"))
  ]);
});
