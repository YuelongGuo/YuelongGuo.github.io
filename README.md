# Yuelong (John) Guo — Personal Portfolio

A content-driven personal site organized around three connected areas:

- biomedical research;
- curriculum design and teaching;
- volunteer leadership and community service.

The site is deliberately lightweight. It uses semantic HTML, modern CSS, and a small amount of JavaScript, with no external runtime dependencies. The generated `index.html` can be served directly by GitHub Pages.

## Updating the content

The source of truth is [`content/site.json`](content/site.json). Update that file when adding a research project, course, leadership role, or biographical detail.

Each experience has structured fields for future depth:

- research: context, role, methods, outcomes, publications, and media;
- teaching: program, organization, period, roles, description, curriculum, artifacts, and outcomes;
- leadership: organization, title, term, contributions, and outcomes.

Only populated fields should be presented as facts. Keep a clear distinction between:

1. **role** — a verified title;
2. **contribution** — a specific action;
3. **outcome** — an evidence-backed result.

This makes it easy to expand the site without turning a title into an unsupported impact claim.

## Building and previewing

Node.js 22 or later is the only requirement.

```powershell
npm.cmd run build
npm.cmd run dev
```

The development server prints the local preview address. The build command regenerates the root `index.html` and creates the deployment-ready `dist` folder.

Run the checks with:

```powershell
npm.cmd test
```

## Editing the design

- Page structure: [`src/index.template.html`](src/index.template.html)
- Visual system and responsive layout: [`assets/css/main.css`](assets/css/main.css)
- Navigation and restrained reveal behavior: [`assets/js/site.js`](assets/js/site.js)
- Social preview card: [`public/og.png`](public/og.png)

## Suggested next content

The framework is ready for these additions when the details are available:

- research questions, methods, publications, collaborators, and outcomes;
- course audience, session plan, teaching artifacts, and learner feedback;
- leadership terms, initiatives, community contributions, and outcomes;
- a downloadable CV and a preferred contact method;
- approved photos, event materials, talks, or project media.
