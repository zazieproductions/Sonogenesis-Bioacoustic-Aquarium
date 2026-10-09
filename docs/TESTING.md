# Testing and quality checks

[← Back to the README](../README.md) · [Contributing](../CONTRIBUTING.md)

## Automated checks that exist today

Install the locked dependencies first, then run:

```bash
npm ci
npm audit --audit-level=high
npm run typecheck
npm run build
```

| Check | What it verifies | What it does not verify |
| --- | --- | --- |
| `npm audit --audit-level=high` | Checks the locked dependency tree against npm advisories and fails for high/critical findings. | A full security review, protection from unknown advisories, or application-code analysis. |
| `npm run typecheck` | Strict TypeScript compilation with no emitted output. | Runtime behavior, numerical correctness, browser API support, or usability. |
| `npm run build` | Vite can bundle the application for static production hosting. | That the built site works in every browser or that audio/rendering is correct. |
| GitHub Actions `Validate` workflow | Runs install, high/critical dependency audit, typecheck, and production build on pushes and pull requests. | Unit, integration, accessibility, performance, and end-to-end behavior. |

There is no `test`, lint, formatter, component-test, or browser-automation script configured in `package.json`. Do not describe the project as having automated behavioral coverage until such tests are added and run.

## Manual release smoke test

Run `npm run dev`, then work through this checklist in a current desktop browser with WebGL and IndexedDB enabled:

1. **Startup:** confirm the entry overlay appears; enter both with sound and in silent-observation mode. Verify audio starts only after a user gesture.
2. **Seed:** generate twice from the same numeric seed and compare the initial habitat order and founder arrangement. Try a text seed and an empty seed. This checks initial state, not long-run replay determinism.
3. **Simulation:** observe at `1×`; pause with the button and `Space`; try `0.5×` and a higher speed. Confirm the world responds and the HUD updates.
4. **Freeze-life:** toggle with `F`; confirm movement and communication continue while aging/metabolism/reproduction are paused. Check that predation can still occur.
5. **Interaction:** pan, zoom, use the minimap, inspect an organism, edit one genome bar, audition each call, clone/cull, and exercise spawn/feed tools.
6. **Panels:** tune a habitat and a global parameter; run the Lab's mutation/crossover and target-selection flows; open the Observatory, scrub to a keyframe, return live, and rewind a disposable world.
7. **Conductor:** add, move, and delete lane points; toggle a lane, seek with `Alt`+click, play a passage, and verify the chosen parameter changes.
8. **Persistence:** save a specimen, preset, and snapshot; reload the page on the same origin; confirm they remain. Export and import the app's own files. Test invalid or malformed JSON only in a disposable browser profile.
9. **Audio capture:** record a short output, stop, and confirm the downloaded WAV opens and has two channels.
10. **Production:** build, run `npm run preview`, and repeat startup, one simulation interaction, and one persistence flow against the production bundle.

Record browser/OS, seed, world time, selected speed, and exact reproduction steps when reporting an issue. Audio bugs also benefit from the browser's AudioContext state and whether the failure is audible, visual, or both.

## Browser-oriented test conditions

The experience uses Canvas 2D, WebGL through Three.js, Web Audio, Web Workers, Pointer Events, `requestAnimationFrame`, and IndexedDB. The background renderer currently has no documented Canvas fallback. Browser autoplay policy means an audio smoke test must start from a user gesture. If browser storage is blocked, the visualization can still run but persistence may not be available.

A silent run is a supported product path, not a substitute for checking audio. Likewise, a successful build does not establish a supported-browser matrix; test the browser versions you intend to claim support for.

## Highest-value test additions

Suggested sequence for future coverage:

1. **Pure domain tests:** genome bounds and phenotype ranges, mutation/crossover invariants, seeded world generation, speciation thresholds, signal-efficiency bounds, conductor interpolation, and `encodeWav` header/data layout.
2. **Persistence tests:** `serialize`/`deserialize` round trip, schema migrations, malformed JSON rejection, and bounded-history behavior.
3. **Browser integration tests:** audio gesture/unlock, core pointer tools, pause/speed/freeze behavior, keyframe scrub/restore, archive workflows, and graceful storage failure.
4. **Accessibility and performance checks:** keyboard flow, focus visibility, screen-reader names, reduced-motion behavior, population load profiles, audio recording memory, and WebGL failure handling.

Tests should use fixed seeds and assert invariants rather than overfitting to exact long-run population trajectories. The full interactive run intentionally contains timing-sensitive and non-seeded paths.
