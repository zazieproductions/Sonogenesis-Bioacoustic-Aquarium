# Contributing

[← Back to the README](README.md) · [Testing](docs/TESTING.md) · [Roadmap](docs/ROADMAP.md)

Thank you for helping make the little biosphere easier to understand, use, and maintain. Keep changes focused, preserve the browser-local design unless a deliberate product decision changes it, and document what a feature actually does.

## Important licensing status

The current [`LICENSE`](LICENSE) is an all-rights-reserved notice. It does not grant the public general rights to copy, modify, or redistribute this project, and it is not an open-source license. Do not assume that a public GitHub repository is permission to reuse the code.

If you are not already authorized by the rights holder, open a discussion/issue before preparing or submitting code. A pull request does not itself change the project's license or grant reuse rights. Maintainers should publish an approved license and contribution terms before inviting broad community contributions. Do not submit code copied from projects with incompatible terms.

## Development setup

**Prerequisites:** Node.js `^20.19.0` or `>=22.12.0`, npm, and a current desktop browser with Canvas 2D, WebGL, Web Audio, Web Workers, Pointer Events, and IndexedDB support.

```bash
npm ci
npm run dev
```

Before opening a pull request, run the checks configured in the repository:

```bash
npm audit --audit-level=high
npm run typecheck
npm run build
```

GitHub Actions runs the dependency audit, typecheck, and production build on pushes and pull requests. There is no unit-test, lint, or formatter command yet; see [Testing and quality](docs/TESTING.md) for manual verification and gaps. For sound-related work, test after an explicit user gesture because browsers gate autoplay.

## Working agreements

- **Keep the model legible.** Put ecological rules in `src/sim/`, synthesis in `src/audio/`, drawing in `src/render/`, and browser controls in `src/components/` or `src/App.tsx`.
- **Preserve update order.** Changes to the hot loop can affect simulation outcomes; note altered timing, event queues, and pause/freeze behavior.
- **Keep state scoped.** No new server, analytics, external API, or third-party runtime dependency without a clear product/privacy rationale.
- **Respect stored data.** Treat genome order, snapshot payloads, and IndexedDB records as user data. Add validation and migrations before changing them.
- **Design for bounded work.** Keep loops, retained histories, audio scheduling, and recording memory explicit. Profile before claiming a performance improvement.
- **Include accessibility impact.** Name controls, preserve keyboard paths, consider motion and contrast, and note any remaining limitation.
- **Update docs with behavior.** Changes to controls, model rules, data formats, deployment, or shortcuts should update the relevant guide and changelog.
- **Keep the diff clean.** Do not commit `node_modules/`, `dist/`, audio captures, personal exports, secrets, or machine-specific settings.

## Pull request checklist

Before requesting review, confirm that:

- [ ] The change has a clear user or maintenance purpose and is scoped to that purpose.
- [ ] `npm run typecheck` and `npm run build` pass locally.
- [ ] Relevant manual checks, seeds, browsers, and limitations are included in the PR description.
- [ ] UI changes have been checked at the intended viewport and with keyboard input where applicable.
- [ ] Simulation, genome, import/export, or persistence changes include a migration and test plan.
- [ ] Documentation and `CHANGELOG.md` are updated when behavior or maintenance expectations change.
- [ ] No generated artifacts, secrets, or unrelated formatting changes are included.
- [ ] The licensing status has been discussed with the rights holder before code is contributed.

A useful PR description states **what changed**, **why**, **how it was verified**, and **what is intentionally not covered**. For simulation work, include the seed, population/speed settings, and expected observable effect. For visual work, include before/after images where practical.

## Reporting a bug

Include the browser and OS, viewport, seed, simulation speed/time, exact steps, expected result, actual result, and console errors. For audio issues, describe whether sound was enabled by a user gesture, whether the engine is muted, and whether the failure is missing, distorted, or late audio. Avoid attaching private ecosystem exports; they contain generated state and may include names you entered.

## Change labels

Use concise conventional-style commit subjects when helpful: `docs:`, `fix:`, `feat:`, `perf:`, `refactor:`, or `test:`. This is a readability convention, not an enforced release automation rule.
