# Roadmap

[← Back to the README](../README.md) · [Changelog](../CHANGELOG.md)

This is a proposed direction for the project, not a delivery commitment. Priorities should be revisited with the maintainers and users; licensing and contributor terms are a prerequisite to inviting broader external participation.

## P0 · Resolve project terms

- Choose whether the project is intended to be proprietary or open source; the current all-rights-reserved `LICENSE` is not an open-source grant.
- If external contributions or reuse are intended, publish an approved license and contribution terms before accepting community code.
- Publish support/contact expectations and a supported-browser baseline if the public release needs them.

**Exit condition:** the repository's license, contribution guidance, and public claims agree.

## P1 · Make behavior testable

- Add a unit-test runner and cover deterministic seed setup, genotype bounds/phenotype mapping, species assignment, signal efficiency, conductor interpolation, and WAV output.
- Add world serialization round-trip and malformed-import tests before evolving the stored format.
- Expand GitHub Actions after tests exist so tests run alongside the current typecheck/build checks.
- Separate the core simulation clock and world lifecycle from the large `App.tsx` orchestration effect, preserving update order and manual test workflows.

**Exit condition:** core domain invariants can be exercised headlessly and regressions fail in CI.

## P2 · Strengthen the data contract

- Deeply validate imported specimen/snapshot JSON and report actionable errors.
- Add explicit migrations for IndexedDB records and serialized-world versions, including an export/backup path before destructive changes.
- Centralize gene-key serialization and remove consumers' magic gene indexes.
- Document which state a snapshot intentionally preserves and test that promise.

**Exit condition:** old saved work is either migrated safely or rejected with a clear recovery path.

## P3 · Improve accessibility and adaptive use

- Give icon controls visible labels or robust accessible names, and expose toggle state and panel relationships.
- Add visible focus styling, deliberate focus movement/restoration for panels, and keyboard alternatives for canvas interactions.
- Respect reduced-motion preferences and measure text/control contrast.
- Provide a structured text view for selected organisms and core population data, plus a clear WebGL failure/fallback state.
- Test keyboard-only operation, touch, zoom/reflow, and representative screen-reader/browser combinations.

**Exit condition:** accessibility work is validated with users and tools, with results documented before any conformance claim.

## P4 · Profile before scaling

- Establish reproducible CPU, memory, GPU, and audio profiles for named browsers/devices and population targets.
- Profile the default `380` cap and the UI maximum of `800`; adjust spatial indexing, render culling, or update cadence only from observed bottlenecks.
- Investigate the current >500 kB production-chunk warning and evaluate lazy loading/code splitting against measured startup cost.
- Replace deprecated `ScriptProcessorNode` capture with a modern audio-capture path, preserving recording quality and memory behavior.
- Add bounded or streaming recording options and visible memory/duration feedback.
- Consider an adaptive-detail mode only after the profiling baseline exists.

**Exit condition:** documented profiles and regression coverage support any published performance limits.

## P5 · Maintainable extension points

- Define stable seams for domain simulation, browser adapters (render/audio/storage), and user interface.
- Make statistics definitions explicit and distinguish deterministic measures from sampled estimates.
- Keep the design playful, but ensure every new mechanic has a stated model rule, observable UI feedback, and a test or manual acceptance case.

## Out of scope until justified

No remote accounts, server simulation, social feed, or cloud-sync service is currently planned. Those features would change the privacy, deployment, and operational model and should not be added as incidental dependencies.
