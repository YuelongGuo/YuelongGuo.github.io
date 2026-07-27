# Yuelong (John) Guo — Personal Site

A content-driven personal site organized around three areas:

- **Contributions to science** — research threads, Google Scholar metrics, selected publications;
- **Volunteer education** — curriculum design and instruction;
- **Community & service** — volunteer leadership roles.

The site is deliberately lightweight: semantic HTML, modern CSS, and a small amount of
JavaScript, with no runtime dependencies. The generated `index.html` is served directly by
GitHub Pages. The only network request beyond the site's own assets is the Google Fonts
stylesheet.

## Updating the content

The source of truth is [`content/site.json`](content/site.json). Update that file when adding a
research thread, publication, course, leadership role, or biographical detail, then run the build.

Only populated fields are rendered. Keep a clear distinction between:

1. **role** — a verified title;
2. **contribution** — a specific action;
3. **outcome** — an evidence-backed result.

This makes it easy to expand the site without turning a title into an unsupported impact claim.

### Fields left intentionally empty

Two fields are present but blank, because they are personal decisions rather than facts the site
should assume:

- `profile.affiliation` — set it to a current employer or institution and it renders under the
  name in the hero. Left blank, that line is omitted entirely.
- `profile.email` — set it and a contact row appears in the hero record card. Left blank, no
  email is published anywhere on the page.

## Outbound links

Organization URLs live alongside each entry: `teaching[].url`, `leadership[].url`, and
`teaching[].artifacts[]` for student work. An organization name renders as plain text when its
`url` is empty and as an external link when it is set, so partial information degrades cleanly.

`profile.project` is the single featured link in the hero record card and the About section.
`initiative` drives the highlighted program card at the top of the Education section.

A test asserts that every URL in `content/site.json` actually appears in the built page and that
every `target="_blank"` link carries `rel="noreferrer"`.

## Keeping the Scholar metrics honest

The `scholar` block holds the citation record. It is deliberately *not* fetched at runtime — the
figures are a dated snapshot, and `scholar.retrieved` is rendered on the page next to a link to
the live profile.

`scholar.chart.series` is the citation count of each indexed work, sorted from most to least
cited. The build **derives** the h-index from that series and refuses to build if it disagrees
with `metrics[].all` or with `chart.highlight`. The test suite additionally re-derives the
i10-index. So the published summary figures cannot silently drift away from the data drawn in
the chart.

To refresh the numbers:

1. Open the Google Scholar profile and read off citations, h-index, and i10-index (both columns).
2. Update `scholar.metrics`, `scholar.indexedWorks`, `scholar.yearSpan`, and `scholar.retrieved`.
3. Update `scholar.chart.series` and `scholar.chart.highlight` to match.
4. Run `npm.cmd test` — a mismatch fails the build with an explicit message.

## Building and previewing

Node.js 22 or later is the only requirement.

```bash
npm.cmd run build
```

```bash
npm.cmd run dev
```

The development server prints the local preview address. The build regenerates the root
`index.html` and the deployment-ready `dist` folder.

```bash
npm.cmd test
```

The checks cover metadata, section structure, the h-index derivation, chart accessibility, unique
IDs, and a **type-scale guard** that fails if any declared `font-size` exceeds 3.5rem (56px).

## The social card

[`public/og.png`](public/og.png) is the 1200×630 image that link previews show. It is generated,
not hand-drawn:

```bash
npm.cmd run og
```

That reads the same `content/site.json`, renders [`src/og.template.html`](src/og.template.html)
in headless Chrome or Edge, and writes the PNG. It reuses the site's own h-index chart via
`renderChart()`, so the card cannot drift away from the page.

It is **not** part of `npm run build`, because the build cannot assume a browser is installed.
Regenerate it by hand whenever the name, role, or Scholar metrics change, and commit the result.
Set `CHROME_PATH` if neither browser is in a standard location. A test checks the committed file
is a real PNG at the right dimensions and under 1 MB.

## Editing the design

- Page structure: [`src/index.template.html`](src/index.template.html)
- Visual system and responsive layout: [`assets/css/main.css`](assets/css/main.css)
- Citation chart, shared by page and card: [`scripts/chart.mjs`](scripts/chart.mjs)
- Navigation and reveal behavior: [`assets/js/site.js`](assets/js/site.js)
- Social card layout: [`src/og.template.html`](src/og.template.html)

### Type scale

The largest text on the page is the name, at 56px. Section headings cap at 36px and everything
else sits between 11px and 22px. The scale lives in the `--fs-*` custom properties at the top of
`main.css`; change it there rather than in individual rules, and keep the test passing.

## Suggested next content

- methods, collaborators, and outcomes for each research thread;
- an approved description of the histology imaging work, which currently has no linked publication;
- course audience, session plans, and teaching artifacts;
- leadership terms and documented initiatives;
- a downloadable CV and a preferred contact method.
