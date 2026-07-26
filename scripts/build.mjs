import { access, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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
  "profile.eyebrow",
  "profile.introduction",
  "profile.location",
  "profile.github",
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

  for (const key of ["signalMap", "stats", "pillars", "research", "teaching", "leadership"]) {
    if (!Array.isArray(content[key]) || content[key].length === 0) {
      throw new Error(`Content field "${key}" must be a non-empty array.`);
    }
  }

  for (const key of ["url", "socialImage"]) {
    const value = content.meta[key];
    if (!value.startsWith("https://")) {
      throw new Error(`meta.${key} must be an absolute HTTPS URL.`);
    }
  }
};

const renderSignalMap = (items) =>
  items
    .map(
      (item) => `
            <li>
              <span class="signal-number">${escapeHtml(item.number)}</span>
              <span class="signal-name">${escapeHtml(item.label)}</span>
            </li>`
    )
    .join("");

const renderStats = (items) =>
  items
    .map(
      (item) => `
          <div>
            <dt>${escapeHtml(item.label)}</dt>
            <dd>${escapeHtml(item.value)}</dd>
          </div>`
    )
    .join("");

const renderPillars = (items) =>
  items
    .map(
      (item) => `
            <a class="pillar-card reveal" href="${escapeHtml(item.anchor)}">
              <span class="pillar-number">${escapeHtml(item.number)}</span>
              <h3>${escapeHtml(item.title)}</h3>
              <p>${escapeHtml(item.summary)}</p>
              <span class="pillar-link">
                Explore <span aria-hidden="true">↘</span>
              </span>
            </a>`
    )
    .join("");

const renderTags = (tags = []) =>
  tags.length === 0
    ? ""
    : `<ul class="tag-list" aria-label="Topics">
                ${tags.map((tag) => `<li>${escapeHtml(tag)}</li>`).join("")}
              </ul>`;

const renderResearch = (items) =>
  items
    .map(
      (item) => `
            <article id="${escapeHtml(item.slug)}" class="research-card reveal">
              <div class="research-topline">
                <p class="research-kicker">${escapeHtml(item.kicker)}</p>
                <span class="research-number" aria-hidden="true">${escapeHtml(item.number)}</span>
              </div>
              <h3>${escapeHtml(item.title)}</h3>
              <p class="research-summary">${escapeHtml(item.summary)}</p>
              ${renderTags(item.tags)}
            </article>`
    )
    .join("");

const renderRoles = (roles = []) =>
  roles.length === 0
    ? ""
    : `<ul class="role-list" aria-label="Roles">
                    ${roles.map((role) => `<li>${escapeHtml(role)}</li>`).join("")}
                  </ul>`;

const renderTeaching = (items) =>
  items
    .map(
      (item) => `
              <li class="teaching-item reveal">
                <span class="teaching-period">${escapeHtml(item.period)}</span>
                <article class="teaching-card">
                  <p class="teaching-program">${escapeHtml(item.program)}</p>
                  <h3>${escapeHtml(item.organization)}</h3>
                  ${renderRoles(item.roles)}
                  <p class="teaching-summary">${escapeHtml(item.summary)}</p>
                </article>
              </li>`
    )
    .join("");

const renderLeadership = (items) =>
  items
    .map(
      (item) => `
            <article class="leadership-card reveal">
              <p class="leadership-category">${escapeHtml(item.category)}</p>
              <h3>${escapeHtml(item.organization)}</h3>
              ${item.chapter ? `<p class="leadership-chapter">${escapeHtml(item.chapter)}</p>` : ""}
              <p class="leadership-role">${escapeHtml(item.role)}</p>
              <p class="leadership-summary">${escapeHtml(item.summary)}</p>
            </article>`
    )
    .join("");

const renderParagraphs = (items = []) =>
  items.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("\n            ");

const replaceTokens = (template, content) => {
  const tokens = {
    "%%TITLE%%": escapeHtml(content.meta.title),
    "%%DESCRIPTION%%": escapeHtml(content.meta.description),
    "%%CANONICAL_URL%%": escapeHtml(content.meta.url),
    "%%SOCIAL_IMAGE%%": escapeHtml(content.meta.socialImage),
    "%%PROFILE_NAME%%": escapeHtml(content.profile.name),
    "%%PROFILE_SHORT_NAME%%": escapeHtml(content.profile.shortName),
    "%%PROFILE_EYEBROW%%": escapeHtml(content.profile.eyebrow),
    "%%PROFILE_INTRODUCTION%%": escapeHtml(content.profile.introduction),
    "%%PROFILE_LOCATION%%": escapeHtml(content.profile.location),
    "%%GITHUB_URL%%": escapeHtml(content.profile.github),
    "%%SIGNAL_MAP%%": renderSignalMap(content.signalMap),
    "%%STATS%%": renderStats(content.stats),
    "%%PILLARS%%": renderPillars(content.pillars),
    "%%RESEARCH%%": renderResearch(content.research),
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
