# Deployment

[← Back to the README](../README.md)

SONOGENESIS builds to static files and can be hosted on any static web host that serves `dist/` at the site root and honors the included fallback rule. No application server, environment variables, database credentials, or runtime API secrets are required.

## Verify a production build locally

```bash
npm ci
npm run typecheck
npm run build
npm run preview
```

The build output is `dist/`. Vite's preview server is for local verification, not a production web server.

## Cloudflare Pages

### Git-connected deployment

Create a Pages project and connect this repository. Use:

| Setting | Value |
| --- | --- |
| Framework preset | Vite (or static site / no framework) |
| Root directory | `/` (repository root) |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node version | `22` (or a compatible version satisfying Vite's declared range) |

Cloudflare installs from the committed lockfile. If the project dashboard offers a separate install command, use `npm ci`.

### Wrangler deployment

Install or invoke Cloudflare Wrangler and authenticate using Cloudflare's documented flow. From the repository root:

```bash
npm ci
npm run typecheck
npm run build
npx wrangler pages deploy dist --project-name sonogenesis
```

Change `sonogenesis` to the name of your existing Pages project. Wrangler may prompt to create a project if that name does not exist. Cloudflare authentication is separate from GitHub authentication; never commit credentials or tokens.

## Other static hosts

Upload the contents of `dist/` to the host's public root. The Vite build copies `public/_redirects`, which contains:

```text
/* /index.html 200
```

This is Cloudflare Pages-style single-page fallback syntax. On another provider, configure its equivalent fallback to serve `index.html` for application routes. The current application is a single screen and does not define a route table, but the fallback keeps direct navigation and future client routes from returning a host-level 404.

The Vite base path is the site root (`/`). For a project deployed under a URL subdirectory, configure and verify Vite's `base` and the provider's fallback path together before publishing.

## Post-deploy smoke test

- Load the root URL and refresh it; the app should return its entry document.
- Confirm the background can initialize with WebGL and the foreground renders.
- Enter with sound from the in-app gesture, then confirm silent observation also works.
- Generate a world, inspect an organism, and open the Observatory.
- Save and reload one specimen on the same domain to verify origin-local IndexedDB persistence.
- Export any work you need to retain. A new hostname is a different storage origin; there is no cross-domain sync.

## Root shortcut

The repository-root [`DEPLOY.md`](../DEPLOY.md) links here for older bookmarks. This guide assumes a normal clone of the existing repository; it does not ask you to reinitialize Git or create a second repository.
