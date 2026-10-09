# Changelog

Notable user-facing and maintenance changes are recorded here. Entries describe repository changes; they are not a substitute for a release tag.

## Unreleased

### Documentation

- Reworked the README as a project overview, setup path, feature map, controls reference, and documentation index.
- Added architecture, simulation, internal API, user, data/privacy, testing, performance, accessibility, deployment, and roadmap guides.
- Replaced archive-oriented deploy instructions with guidance for a normal clone and static hosting.
- Added contributor expectations, licensing disclosure, and a pull-request verification checklist.
- Clarified freeze-life behavior in the UI so the label distinguishes suspended life-cycle updates from continuing interactions.

### Developer experience

- Added GitHub Actions checks for dependency installation, high/critical dependency advisories, strict TypeScript typechecking, and a production build.
- Added a pull request template with validation, accessibility, performance, and documentation prompts.
- Updated Vite and its esbuild toolchain to patched compatible releases; removed the unused single-file plugin dependency.

## Release history

`package.json` currently reports version `1.0.0`. The checked-out repository history does not provide a curated, tagged change history from which to reconstruct earlier release notes, so no past product changes are inferred here. Add dated release sections when maintainers publish tags or confirm historical changes.
