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

test("every organization and artifact URL on file is linked from the page", () => {
  const urls = [
    content.profile.project.url,
    content.initiative.url,
    ...content.teaching.map((item) => item.url),
    ...content.teaching.flatMap((item) => (item.artifacts ?? []).map((a) => a.url)),
    ...content.leadership.map((item) => item.url)
  ].filter(Boolean);

  for (const url of new Set(urls)) {
    assert.ok(html.includes(`href="${url}"`), `expected a link to ${url}`);
  }
});

test("external links are safe and the retired GitHub link is gone", () => {
  const externals = [...html.matchAll(/<a[^>]*target="_blank"[^>]*>/g)].map((m) => m[0]);
  assert.ok(externals.length > 0);

  for (const anchor of externals) {
    assert.match(anchor, /rel="noreferrer"/, `missing rel=noreferrer: ${anchor}`);
  }

  assert.doesNotMatch(html, /github\.com/i, "the GitHub link was replaced and should not linger");
  assert.equal(content.profile.github, undefined, "profile.github should be removed from content");
});

test("course detail survives the render", () => {
  const withCurriculum = content.teaching.filter((item) => item.curriculum.length > 0);
  assert.ok(withCurriculum.length > 0, "at least one course should list a curriculum");

  for (const course of withCurriculum) {
    for (const entry of course.curriculum) {
      const escaped = entry.replaceAll("&", "&amp;").replaceAll("'", "&#039;");
      assert.ok(html.includes(escaped), `missing curriculum line: ${entry}`);
    }
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

test("the social card is a correctly sized PNG that social platforms will accept", async () => {
  const png = await readFile(join(projectRoot, "public", "og.png"));

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.ok(png.subarray(0, 8).equals(signature), "og.png must be a real PNG");

  // IHDR is the first chunk; width and height are big-endian uint32 at 16 and 20.
  assert.equal(png.toString("ascii", 12, 16), "IHDR");
  assert.equal(png.readUInt32BE(16), 1200, "og.png should be 1200px wide");
  assert.equal(png.readUInt32BE(20), 630, "og.png should be 630px tall");

  assert.ok(
    png.length < 1_000_000,
    `og.png is ${(png.length / 1024).toFixed(0)} KB; keep social cards well under 1 MB`
  );
});

test("deployment output contains the page, worker, and social image", async () => {
  await Promise.all([
    access(join(projectRoot, "dist", "client", "index.html")),
    access(join(projectRoot, "dist", "server", "index.js")),
    access(join(projectRoot, "dist", "client", "public", "og.png"))
  ]);
});
