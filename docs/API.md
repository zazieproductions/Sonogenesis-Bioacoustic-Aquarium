# Internal API reference

[← Back to the README](../README.md) · [Architecture](ARCHITECTURE.md)

There is **no hosted HTTP API** and no published npm library interface. The symbols below are source-level TypeScript exports used inside this application. They are useful when extending the codebase, but are not currently covered by a package export map or a semver compatibility promise.

## Simulation: `src/sim/world.ts`

| Export | Contract |
| --- | --- |
| `World` | Owns the mutable world: seed/RNG, habitats, organisms, food, species, lineage, statistics, events, keyframes, global controls, and pending audio events. |
| `new World(seed, empty?)` | Creates the world. With `empty` omitted/false, calls `generate()` and seeds habitats, resources, and founders. `new World(seed, true)` creates an empty shell for deserialization. |
| `world.step(dt)` | Advances the ecology by `dt` simulation seconds. The app supplies `1 / 30`; callers must provide their own timing policy. |
| `world.spawn(x, y, genome, opts?)` | Adds an organism. Options include species/parent IDs, generation, motif, starting energy, mutation count, and whether to create a new species. Returns the new `Organism`. |
| `world.findOrg(id)` | Looks up a living organism by ID. |
| `world.near(x, y, radius, callback)` | Visits organism candidates in intersecting spatial-grid cells. Apply an exact distance test when needed. |
| `world.nearFood(x, y, radius, callback)` | Visits food candidates from the food grid. Apply an exact distance test when needed. |
| `world.assignSpecies(genome, parentSpecies)` | Reuses a close living representative or creates a new species, according to `globals.speciationThreshold`. |
| `world.emit(organism, type, habitat, isResponse?)` | Emits one call into model signals/audio events and updates nearby listeners. |
| `world.serialize()` / `World.deserialize(data)` | Converts the current saveable world to/from the version-1 JSON-compatible format. See [Data and privacy](DATA_AND_PRIVACY.md). |
| `world.ancestors(id, max?)`, `world.descendants(id, max?)` | Query retained lineage records; available history is bounded. |
| `world.dominantMotif(speciesId)` | Returns the most frequent living motif and its share in that species. |
| `signalEfficiency(phenotype, habitat)`, `callRange(phenotype, habitat)` | Calculate simulated acoustic transmission quality and base range. |

Core data types include `Organism`, `Species`, `LineageRec`, `StatSample`, `WorldEvent`, `Globals`, `AudioEvent`, `KeyFrame`, and `SerialOrg`. Constants include `ZONE_W`, `WORLD_H`, `CALL_TYPES`, and `CALL_COLORS`.

### Spawn options

```ts
interface SpawnOptions {
  speciesId?: number;
  parentId?: number;
  parent2Id?: number;
  generation?: number;
  newSpecies?: boolean;
  motif?: number[];
  energyFrac?: number;
  energy?: number;
  mutations?: number;
  silentEvent?: boolean;
}
```

This is a documentation summary of the inline option type on `World.spawn`, not a separately exported interface.

## Genetics: `src/sim/genome.ts`

| Export | Contract |
| --- | --- |
| `GENES`, `G`, `GENE_COUNT`, `GROUPS` | Canonical gene metadata/order, key-to-index lookup, current count (`43`), and linkage groups. Treat gene order as serialized-data structure. |
| `randomGenome(rng, bias?)` | Creates normalized gene values using an `RNG`; optional biases apply to named gene keys. |
| `mutate(genome, rate, strength, rng)` | Returns `{ genome, count }`; makes a copied genome with per-gene mutation and clamping. |
| `crossover(parentA, parentB, rng)` | Returns a group-linked recombinant genome. |
| `geneticDistance(a, b)` | Returns weighted mean absolute genetic distance. |
| `express(genome)` | Maps genes to the simulation/render/audio `Phenotype`. |
| `speciesName(id, seed)` | Creates a seeded generated species name. |

`Phenotype` contains organism dimensions, locomotion, metabolism, sensory traits, reproduction, pigment, and voice parameters. Call `express` again after editing a genome; the selected-organism edit workflow also invalidates its cached render body.

## Habitat: `src/sim/habitats.ts`

`HabitatParams` defines the environmental values consumed by the simulation, `HabitatType` lists preset types, and `HABITAT_PRESETS` provides built-ins. `HABITAT_SLIDERS`, `sliderMax`, and `cloneHabitat` support the Control Deck. `cloneHabitat` copies both color tuples instead of sharing their arrays.

## Rendering: `src/render/`

| Export | Contract |
| --- | --- |
| `Background` (`Background.ts`) | Owns the Three.js WebGL background renderer. Call `resize(width, height)`, then `render(time, camX, camY, zoom, zones, zoneW, worldH, level)`; call `dispose()` during teardown. |
| `renderWorld(ctx, world, camera, width, height, options)` | Draws the foreground world and HUD minimap onto Canvas 2D. `RenderOpts` controls overlays, trails, labels, selected/hover IDs, optional historical organisms, and solo highlighting. |
| `screenToWorld(camera, width, height, sx, sy)` | Converts viewport coordinates to world coordinates. |
| `pickOrganism(orgs, x, y, zoom)` | Returns the nearest organism within its zoom-adjusted hit radius, or `null`. |
| `getBody(organism)` | Lazily generates/caches a body shape on the organism. |
| `generateBody(genome, phenotype?)`, `drawBody(...)`, `renderThumb(...)` (`src/sim/morph.ts`) | Generate and draw organism forms for the main view and thumbnails. |

## Audio: `src/audio/engine.ts`

`AudioEngine` owns one lazily initialized `AudioContext` and its graph. Important methods:

- `start()` creates or resumes audio. Invoke from a user gesture to comply with browser autoplay policy.
- `trigger(audioEvent, camera, density?)` applies mute/solo, viewport range, gain, panning, and event-density rules before synthesis.
- `audition(phenotype, callType, motif)` plays a selected voice directly for preview.
- `noteFreq(phenotype, degree)` maps scale degrees under the chosen `ScaleName`; supported names are `pentatonic`, `just`, `chromatic`, `whole`, and `free`.
- `setVolume`, `setMuted`, `setReverb`, `setDelay`, and `setTempo` update the graph.
- `updateDrones(targets)` updates the pooled sustained voices.
- `startRecording()` / `stopRecording()` capture the master output; `stopRecording()` returns a WAV `Blob` or `null`.

`Cam`, `DroneTarget`, `ScaleName`, and `encodeWav` are exported types/helper. The browser UI wires simulation events to the engine; call synthesis directly only when deliberately creating a preview or another instrument workflow.

## Automation: `src/conductor.ts`

- `Lane` and `AutoPoint` describe a normalized automation lane and its breakpoints.
- `defaultLanes()` returns the initial lane configuration.
- `sampleLane(lane, t)` evaluates a lane at normalized time `t` using smoothstep interpolation between points.
- `applyLanes(lanes, t, world, audio)` applies enabled values to world globals and audio controls.

A lane key is serialized with ecosystem snapshots. When introducing a new key, update the lane union, defaults, evaluator/application switch, UI, and persistence workflow together.

## Persistence: `src/db.ts`

```ts
export type StoreName = 'specimens' | 'snapshots' | 'presets';

dbPut<T extends { id: string }>(store: StoreName, value: T): Promise<void>;
dbAll<T>(store: StoreName): Promise<T[]>;
dbDel(store: StoreName, id: string): Promise<void>;
```

Records are `Specimen`, `SnapshotRec`, and `PresetRec`. `dbAll` is generic for caller convenience; IndexedDB does not validate the requested TypeScript type at runtime. The database schema currently has no clear-store helper or formal migration registry.

## Worker messages: `src/sim/stats.worker.ts`

`StatsRequest` contains `genomes`, acoustic `voice` tuples (`spectral`, `noise`, `harmonicity`, `rhythmDiv`), and `geneCount`. `StatsResult` contains `geneStd`, `meanPairwise`, `sonicIndex`, `spectralHist`, `textureHist`, and sample count `n`. `App.tsx` imports the worker with Vite's `?worker&inline` query; this is a Vite build convention, not a browser module URL.

## Component contracts

The React components are app-local interfaces, not package exports. Their responsibilities and wiring are catalogued in [Architecture → Component inventory](ARCHITECTURE.md#component-inventory); exact props are declared next to each component. Prefer adding a typed prop/callback over giving a panel a new independent animation loop or browser-storage implementation.
