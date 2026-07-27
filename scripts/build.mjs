import { access, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { renderChart } from "./chart.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const contentPath = join(projectRoot, "content", "site.json");
const templatePath = join(projectRoot, "src", "index.template.html");
const indexPath = join(projectRoot, "index.html");
const distPath = join(projectRoot, "dist");
const clientPath = join(distPath, "client");
const serverPath = join(distPath, "server");

const requiredStrings = [
  "meta.title",
  "meta.description",
  "meta.url",
  "meta.socialImage",
  "profile.name",
  "profile.shortName",
  "profile.initials",
  "profile.eyebrow",
  "profile.role",
  "profile.introduction",
  "profile.location",
  "profile.scholar",
  "profile.project.label",
  "profile.project.url",
  "profile.project.blurb",
  "initiative.label",
  "initiative.url",
  "initiative.tagline",
  "initiative.description",
  "scholar.source",
  "scholar.profileUrl",
  "scholar.retrieved",
  "scholar.recentLabel",
  "scholar.explainer",
  "scholar.indexedWorks",
  "scholar.yearSpan",
  "scholar.chart.title",
  "scholar.chart.caption",
  "about.eyebrow",
  "about.headline"
];

const getValue = (object, path) =>
  path.split(".").reduce((value, key) => value?.[key], object);

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const assertContent = (content) => {
  const missing = requiredStrings.filter((path) => {
    const value = getValue(content, path);
    return typeof value !== "string" || value.trim() === "";
  });

  if (missing.length > 0) {
    throw new Error(`Missing required content fields: ${missing.join(", ")}`);
  }

  for (const key of ["stats", "research", "publications", "teaching", "leadership"]) {
    if (!Array.isArray(content[key]) || content[key].length === 0) {
      throw new Error(`Content field "${key}" must be a non-empty array.`);
    }
  }

  if (!Array.isArray(content.scholar.metrics) || content.scholar.metrics.length === 0) {
    throw new Error('Content field "scholar.metrics" must be a non-empty array.');
  }

  const series = content.scholar.chart.series;
  if (!Array.isArray(series) || series.some((value) => !Number.isFinite(value))) {
    throw new Error('"scholar.chart.series" must be an array of numbers.');
  }

  const sorted = [...series].sort((a, b) => b - a);
  if (series.some((value, index) => value !== sorted[index])) {
    throw new Error('"scholar.chart.series" must be sorted from most to least cited.');
  }

  // The h-index is derivable from the series, so the published figure must agree
  // with the data behind the chart rather than being asserted independently.
  const derivedHIndex = sorted.filter((value, index) => value >= index + 1).length;
  const claimedHIndex = content.scholar.metrics.find((metric) => metric.key === "h-index")?.all;
  if (claimedHIndex !== undefined && Number(claimedHIndex) !== derivedHIndex) {
    throw new Error(
      `Stated h-index (${claimedHIndex}) does not match the citation series, which gives ${derivedHIndex}.`
    );
  }
  if (Number(content.scholar.chart.highlight) !== derivedHIndex) {
    throw new Error(
      `chart.highlight (${content.scholar.chart.highlight}) must equal the derived h-index (${derivedHIndex}).`
    );
  }

  const publicationIds = new Set(content.publications.map((item) => item.id));
  for (const theme of content.research) {
    for (const reference of theme.details?.publications ?? []) {
      if (!publicationIds.has(reference)) {
        throw new Error(`Research theme "${theme.slug}" references unknown publication "${reference}".`);
      }
    }
  }

  for (const key of ["url", "socialImage"]) {
    const value = content.meta[key];
    if (!value.startsWith("https://")) {
      throw new Error(`meta.${key} must be an absolute HTTPS URL.`);
    }
  }
};

const renderStats = (items) =>
  items
    .map(
      (item) => `
            <div class="stat">
              <dt>
                <span class="stat-label">${escapeHtml(item.label)}</span>
                ${item.note ? `<span class="stat-note">${escapeHtml(item.note)}</span>` : ""}
              </dt>
              <dd>${escapeHtml(item.value)}</dd>
            </div>`
    )
    .join("");

const renderMetrics = (items, recentLabel) =>
  items
    .map(
      (item) => `
              <article class="metric">
                <p class="metric-key">${escapeHtml(item.key)}</p>
                <p class="metric-value">${escapeHtml(item.all)}</p>
                <p class="metric-recent">
                  <span class="metric-recent-value">${escapeHtml(item.recent)}</span>
                  <span class="metric-recent-label">${escapeHtml(recentLabel)}</span>
                </p>
                ${item.note ? `<p class="metric-note">${escapeHtml(item.note)}</p>` : ""}
              </article>`
    )
    .join("");

const renderTags = (tags = [], label = "Topics") =>
  tags.length === 0
    ? ""
    : `<ul class="tag-list" aria-label="${escapeHtml(label)}">
                  ${tags.map((tag) => `<li>${escapeHtml(tag)}</li>`).join("")}
                </ul>`;

const renderResearch = (items) =>
  items
    .map(
      (item) => `
            <article id="theme-${escapeHtml(item.slug)}" class="theme reveal">
              <div class="theme-index" aria-hidden="true">${escapeHtml(item.number)}</div>
              <div class="theme-body">
                <p class="theme-kicker">${escapeHtml(item.kicker)}</p>
                <h3 class="theme-title">${escapeHtml(item.title)}</h3>
                <p class="theme-summary">${escapeHtml(item.summary)}</p>
                ${renderTags(item.tags)}
              </div>
            </article>`
    )
    .join("");

const renderPublications = (items) =>
  items
    .map(
      (item) => `
              <li class="publication reveal">
                <p class="publication-meta">
                  <span class="publication-authors">${escapeHtml(item.authors)}</span>
                  <span class="publication-year">${escapeHtml(item.year)}</span>
                  ${item.firstAuthor ? '<span class="publication-flag">First author</span>' : ""}
                </p>
                <p class="publication-title">${escapeHtml(item.title)}</p>
                <p class="publication-venue">
                  <cite>${escapeHtml(item.venue)}</cite>
                  <span class="publication-citations"><span class="publication-count">${escapeHtml(item.citations)}</span> citations</span>
                </p>
              </li>`
    )
    .join("");

const renderRoles = (roles = []) =>
  roles.length === 0
    ? ""
    : `<ul class="role-list" aria-label="Roles">
                    ${roles.map((role) => `<li>${escapeHtml(role)}</li>`).join("")}
                  </ul>`;

/** An organization name, linked out only when a URL is on file. */
const renderOrgName = (name, url) =>
  url
    ? `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(name)} <span class="org-arrow" aria-hidden="true">↗</span></a>`
    : escapeHtml(name);

const renderCurriculum = (items = []) =>
  items.length === 0
    ? ""
    : `<ul class="course-curriculum" aria-label="Course outline">
                    ${items.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("\n                    ")}
                  </ul>`;

const renderArtifacts = (items = []) =>
  items.length === 0
    ? ""
    : `<p class="course-artifacts">
                    ${items
                      .map(
                        (artifact) =>
                          `<a class="course-artifact" href="${escapeHtml(artifact.url)}" target="_blank" rel="noreferrer">${escapeHtml(artifact.label)} <span aria-hidden="true">↗</span></a>`
                      )
                      .join("\n                    ")}
                  </p>`;

const renderTeaching = (items) =>
  items
    .map(
      (item) => `
              <li class="course reveal">
                <p class="course-period">${escapeHtml(item.period)}</p>
                <div class="course-body">
                  <p class="course-program">${escapeHtml(item.program)}</p>
                  <h3 class="course-org">${renderOrgName(item.organization, item.url)}</h3>
                  <p class="course-summary">${escapeHtml(item.summary)}</p>
                  ${renderCurriculum(item.curriculum)}
                  ${renderArtifacts(item.artifacts)}
                  ${renderRoles(item.roles)}
                </div>
              </li>`
    )
    .join("");

const renderLeadership = (items) =>
  items
    .map(
      (item) => `
              <article class="service reveal">
                <p class="service-category">${escapeHtml(item.category)}</p>
                <h3 class="service-org">${renderOrgName(item.organization, item.url)}</h3>
                ${item.chapter ? `<p class="service-chapter">${escapeHtml(item.chapter)}</p>` : ""}
                <p class="service-role">${escapeHtml(item.role)}</p>
                <p class="service-summary">${escapeHtml(item.summary)}</p>
              </article>`
    )
    .join("");

const renderParagraphs = (items = []) =>
  items.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("\n            ");

const renderAffiliation = (affiliation) =>
  affiliation
    ? `<p class="hero-affiliation">${escapeHtml(affiliation)}</p>`
    : "";

const renderEmail = (email) =>
  email
    ? `<a class="link-row" href="mailto:${escapeHtml(email)}">
              <span class="link-row-key">Email</span>
              <span class="link-row-value">${escapeHtml(email)}</span>
            </a>`
    : "";

const replaceTokens = (template, content) => {
  const tokens = {
    "%%TITLE%%": escapeHtml(content.meta.title),
    "%%DESCRIPTION%%": escapeHtml(content.meta.description),
    "%%CANONICAL_URL%%": escapeHtml(content.meta.url),
    "%%SOCIAL_IMAGE%%": escapeHtml(content.meta.socialImage),
    "%%PROFILE_NAME%%": escapeHtml(content.profile.name),
    "%%PROFILE_SHORT_NAME%%": escapeHtml(content.profile.shortName),
    "%%PROFILE_INITIALS%%": escapeHtml(content.profile.initials),
    "%%PROFILE_EYEBROW%%": escapeHtml(content.profile.eyebrow),
    "%%PROFILE_ROLE%%": escapeHtml(content.profile.role),
    "%%PROFILE_INTRODUCTION%%": escapeHtml(content.profile.introduction),
    "%%PROFILE_LOCATION%%": escapeHtml(content.profile.location),
    "%%AFFILIATION_BLOCK%%": renderAffiliation(content.profile.affiliation),
    "%%EMAIL_ROW%%": renderEmail(content.profile.email),
    "%%PROJECT_URL%%": escapeHtml(content.profile.project.url),
    "%%PROJECT_LABEL%%": escapeHtml(content.profile.project.label),
    "%%PROJECT_BLURB%%": escapeHtml(content.profile.project.blurb),
    "%%INITIATIVE_URL%%": escapeHtml(content.initiative.url),
    "%%INITIATIVE_LABEL%%": escapeHtml(content.initiative.label),
    "%%INITIATIVE_TAGLINE%%": escapeHtml(content.initiative.tagline),
    "%%INITIATIVE_DESCRIPTION%%": escapeHtml(content.initiative.description),
    "%%SCHOLAR_URL%%": escapeHtml(content.scholar.profileUrl),
    "%%SCHOLAR_SOURCE%%": escapeHtml(content.scholar.source),
    "%%SCHOLAR_RETRIEVED%%": escapeHtml(content.scholar.retrieved),
    "%%RECENT_LABEL%%": escapeHtml(content.scholar.recentLabel),
    "%%SCHOLAR_EXPLAINER%%": escapeHtml(content.scholar.explainer),
    "%%INDEXED_WORKS%%": escapeHtml(content.scholar.indexedWorks),
    "%%YEAR_SPAN%%": escapeHtml(content.scholar.yearSpan),
    "%%CHART_TITLE%%": escapeHtml(content.scholar.chart.title),
    "%%CHART_CAPTION%%": escapeHtml(content.scholar.chart.caption),
    "%%CHART%%": renderChart(content.scholar.chart),
    "%%METRICS%%": renderMetrics(content.scholar.metrics, content.scholar.recentLabel),
    "%%STATS%%": renderStats(content.stats),
    "%%RESEARCH%%": renderResearch(content.research),
    "%%PUBLICATIONS%%": renderPublications(content.publications),
    "%%TEACHING%%": renderTeaching(content.teaching),
    "%%LEADERSHIP%%": renderLeadership(content.leadership),
    "%%ABOUT_EYEBROW%%": escapeHtml(content.about.eyebrow),
    "%%ABOUT_HEADLINE%%": escapeHtml(content.about.headline),
    "%%ABOUT_PARAGRAPHS%%": renderParagraphs(content.about.paragraphs),
    "%%CURRENT_YEAR%%": String(new Date().getFullYear())
  };

  let result = template;
  for (const [token, value] of Object.entries(tokens)) {
    result = result.replaceAll(token, value);
  }

  const unresolved = result.match(/%%[A-Z_]+%%/g);
  if (unresolved) {
    throw new Error(`Unresolved template tokens: ${[...new Set(unresolved)].join(", ")}`);
  }

  return result;
};

const exists = async (path) => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

const workerSource = `const fallbackPaths = new Set(["/", "/index.html"]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const response = await env.ASSETS.fetch(request);

    if (response.status !== 404 || request.method !== "GET") {
      return response;
    }

    const looksLikePage = fallbackPaths.has(url.pathname) || !url.pathname.split("/").pop().includes(".");
    if (!looksLikePage) {
      return response;
    }

    const indexRequest = new Request(new URL("/index.html", request.url), request);
    return env.ASSETS.fetch(indexRequest);
  }
};
`;

const content = JSON.parse(await readFile(contentPath, "utf8"));
const template = await readFile(templatePath, "utf8");

assertContent(content);
const html = replaceTokens(template, content);

await writeFile(indexPath, html, "utf8");
await rm(distPath, { recursive: true, force: true });
await mkdir(clientPath, { recursive: true });
await mkdir(serverPath, { recursive: true });

await writeFile(join(clientPath, "index.html"), html, "utf8");
await writeFile(join(clientPath, ".nojekyll"), "", "utf8");
await cp(join(projectRoot, "assets"), join(clientPath, "assets"), { recursive: true });
await cp(join(projectRoot, "public"), join(clientPath, "public"), { recursive: true });
await writeFile(join(serverPath, "index.js"), workerSource, "utf8");

const hostingPath = join(projectRoot, ".openai", "hosting.json");
if (await exists(hostingPath)) {
  const hostingDistPath = join(distPath, ".openai");
  await mkdir(hostingDistPath, { recursive: true });
  await cp(hostingPath, join(hostingDistPath, "hosting.json"));
}

console.log(`Built ${indexPath}`);
console.log(`Prepared deployment output in ${distPath}`);
