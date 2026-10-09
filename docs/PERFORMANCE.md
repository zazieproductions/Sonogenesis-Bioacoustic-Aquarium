# Performance notes

[← Back to the README](../README.md) · [Architecture](ARCHITECTURE.md) · [Testing](TESTING.md)

There are no published device benchmarks or frame-rate guarantees yet. The values below describe implementation guardrails, not measured performance. Use a current desktop browser with WebGL hardware acceleration for the intended experience.

The production build run during this documentation pass emitted one `854.38 kB` minified JavaScript chunk (`239.20 kB` gzip) and Vite's standard warning for chunks above `500 kB`. These are a build-output observation, not a network-performance promise; the numbers will change with dependencies and toolchain versions. Splitting optional panels or the Three.js background is a profiling candidate, not an assumed win.

## Existing guardrails

| Area | Current implementation |
| --- | --- |
| Simulation cadence | App advances fixed `1 / 30 s` model steps with a `requestAnimationFrame` accumulator. At most 40 steps run per frame; excess backlog is dropped at the cap. |
| Simulation speed | UI presets are `0.5×`, `1×`, `2×`, `4×`, `8×`, and `16×`. Faster settings increase work per displayed frame and can hit the step ceiling. |
| Population | Default `World.globals.maxPop` is `380`; the Control Deck exposes a configurable range of `30–800`. This is a requested simulation cap, not a performance SLA. |
| Neighborhood search | Organisms and food are bucketed in `140`-unit spatial cells. Local queries scan intersecting cells rather than every entity, then callers apply their own exact-distance checks. |
| Render scale | Foreground Canvas 2D device-pixel ratio is capped at `2`; the Three.js background caps it at `1.5`. The renderer skips organisms and detail outside the camera bounds or below a screen-size threshold. |
| React update rate | The canvas frame loop is continuous, while the top-level UI refresh tick is requested about every `0.25 s`. |
| Statistics | Basic world history is sampled once per simulated second. Per-gene/acoustic analysis runs in an inline worker about every three wall-clock seconds when at least two organisms exist; pairwise genetic distance uses at most 1,500 sampled comparisons. |
| Retained history | World samples, keyframes, lineage, serialized statistics, and event history are bounded or reduced over time. Snapshot serialization retains only selected history tails; it is not a complete research archive. |
| Audio | `AudioEngine.maxVoices` defaults to `32`; triggers apply distance/density and voice-pressure rules. Sustained drones use a pool of five voices. |

## Likely bottlenecks

- **High time scale:** more `World.step` calls per rendered frame compete with drawing and browser input. The 40-step cap bounds catch-up but can slow effective simulation time.
- **Dense populations:** the spatial grid reduces search breadth, but all organisms still require per-step behavior, integration, and render-bound checks. A high cap can increase CPU and draw cost.
- **Canvas detail:** large organisms, trails, labels, scientific overlays, and dense visible populations increase foreground draw work. The background shader still shades the viewport every frame.
- **Audio polyphony and effects:** many short-lived oscillator/filter/noise nodes and effect sends add work. Some lower-priority voices are dropped under load; audio is not computed in a separate worker.
- **WAV capture:** recording retains copied left/right `Float32Array` chunks in memory until stop, then allocates the complete WAV buffer for download. Capture duration is unbounded by the app, so memory rises with recording time and peaks higher during encoding.
- **Analysis/history:** the worker avoids some main-thread analysis, but it does not offload the actual ecosystem. Retained charts, species maps, and lineage still require main-thread data access.

## Practical tuning

1. Begin at `1×`; raise simulation speed only as far as the device remains responsive.
2. Lower the population ceiling in the Control Deck for long sessions or small devices.
3. Hide scientific overlays, labels, and trails when observing a dense view.
4. Reduce audio polyphony or mute sound if audio scheduling becomes a bottleneck. Muting does not pause simulation work.
5. Keep WAV takes short on memory-constrained hardware; stop and download before starting another capture.
6. Profile the production build in browser developer tools. Compare the same seed, viewport, camera zoom, population, and UI settings when measuring changes.

There is currently no dedicated low-detail mode, adaptive quality controller, recording duration limit, or automated benchmark. Avoid publishing numerical performance claims until they have been measured on named hardware/browser combinations.

## Performance regression protocol

When optimizing a hot path, record the browser/OS/device, viewport and DPR, world seed, live population, simulation speed, audio state, and time interval. Profile CPU and memory over a repeatable sequence; separately track main-thread responsiveness, foreground draw cost, GPU load, worker time, audio stability, and peak memory during recording/export. Add a regression test or benchmark once the repository has a test harness; do not infer improvement from one subjective run.
