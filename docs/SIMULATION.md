# Simulation model

[← Back to the README](../README.md) · [Architecture](ARCHITECTURE.md) · [Internal API](API.md)

SONOGENESIS uses a compact, hand-authored artificial-life model to make ecological feedback legible and sonically expressive. Its organisms are not machine-learning agents; its parameters are not empirically calibrated; and its dashboard indices should be read as descriptive signals for exploration, not as scientific measurements.

## World generation and time

A world is created with `new World(seed)`. The UI defaults to `2401`. A digit-only string is parsed as base-10 and converted to an unsigned 32-bit integer; any other string (including negative notation) is hashed. Empty input falls back to the text seed `sonogenesis`.

The generated world has five adjacent habitat regions, each `760 × 900` world units. The five built-in presets—The Abyss, The Glass Garden, The Static Marsh, The Bloom Chamber, and The Null Zone—are placed in a seeded shuffled order. A small seeded perturbation is applied to selected environmental parameters. The default start creates eight founder species, each with a founder and four nearby companions.

`App.tsx` advances `World.step(1 / 30)` through a fixed-step accumulator. Simulation speed changes how quickly those steps are consumed; it does not change the step size. The UI caps catch-up at 40 steps per rendered frame and discards excess backlog when that ceiling is hit. Pausing stops world updates. Freeze-life mode pauses aging, metabolism-based mortality, and reproduction, but does not suspend movement, feeding, predation, calls, or sound.

## Genome and phenotype

Every genome is an array of 43 normalized values. `GENES` is the canonical ordered definition; values generally range from `0` to `1`.

| Group | Count | Examples of expressed traits |
| --- | ---: | --- |
| Morphology | 10 | Body size, symmetry, segmentation, branching, bell shape, tentacles, cells, spines, facets, spores |
| Pigment | 4 | Hue, hue spread, opacity, bioluminescence |
| Behavior | 8 | Speed, wander, sociality, aggression, diet, thermal preference, sensory range, hearing |
| Metabolism | 5 | Efficiency, reproductive threshold, brood size, lifespan, sexual-reproduction tendency |
| Voice | 16 | Call rate, synchrony, mimicry, waveform, pitch/range, harmonicity, FM, noise, envelope, filter, rhythm, drone tendency |

`express(genome)` maps this compact genotype to a `Phenotype` used by simulation, rendering, and sound. Some mappings are nonlinear or categorical: for example, frequency depends on both pitch and body size, waveform is selected from four oscillator types, and rhythm is selected from a discrete division table. Changing gene order is a data-format change, not a cosmetic refactor.

### Variation and speciation

- `randomGenome` draws genes from the world's seeded PRNG; optional biases add Gaussian variation around selected target values.
- `mutate` independently tests each gene against the mutation rate, applies a Gaussian step, and clamps the result. A small share of mutated genes take a macro-mutation that replaces the value.
- `crossover` chooses inheritance by gene group, with occasional per-gene override and slight blending. This preserves more linkage than independent per-gene selection.
- `geneticDistance` is a weighted mean absolute difference. Pigment genes are weighted `1.4×` and voice genes `1.1×`; other groups use `1×`.
- `assignSpecies` first tests the parent's species representative, then living representatives, against the configurable threshold. If none is close enough, a new species is created.

The Mutation Laboratory's artificial-selection routine is separate from ecological reproduction: it scores candidate genotypes against a user-defined acoustic target and repeatedly retains its top two candidates. It is an explicit heuristic search, not an estimate of natural fitness.

## Habitat and ecological feedback

The habitat presets provide resource rate, light, temperature, pressure, viscosity, electrical instability, resonance, spectral center, tonality, damping, call cost, and mutation multiplier. The Control Deck can replace a preset or edit its parameters. Global controls can additionally shift temperature and light, add instability, and scale resources or call density.

Each model step broadly proceeds in this order:

1. Accumulate and spawn food in drifting, partly clustered plumes.
2. Build spatial grids for organisms and food, using `140`-unit cells to narrow local-neighbor searches.
3. Update organisms using wander, food seeking, conspecific flocking, separation, mate approach, predation, threat avoidance, acoustic memory, and symbiont attraction.
4. Integrate velocity with habitat-dependent drag and world-boundary reflection.
5. Apply energy costs and benefits: basal metabolism, pressure/speed cost, thermal mismatch, light-dependent photosynthesis, and stochastic electrical jolts.
6. Advance rhythm phases and emit calls; calls propagate to nearby organisms and may affect mate targeting, social bonds, mimicry, synchrony, and approach/avoid memory.
7. Reproduce when maturity, energy, mate, and population conditions permit; inherit or recombine genomes and mutate offspring.
8. Remove dead entities, update signal rings, record aggregate statistics, and periodically save a population keyframe.

`World.step` is the behavioral model. Visual labels such as *forage*, *hunt*, *court*, and *flee* are state summaries, not a full decision policy or a guarantee that an action succeeds.

## Communication and sound

The model distinguishes **world-level communication** from **listener audio**:

- A call has a type (`pulse`, `social`, `mating`, `territory`, `food`, or `distress`), a position, a motif, and a phenotype.
- `signalEfficiency(phenotype, habitat)` combines spectral fit, tonal/noisy fit, harmonicity, resonance, and damping. `callRange` scales the resulting efficiency by the organism's loudness. Emission also applies type-specific range modifiers.
- Nearby listeners use the signal to update their simulated behavior. For example, mating calls can set mate targets; social calls can encourage bonding, response calls, mimicry, and phase coupling; food and distress calls alter acoustic memory.
- Separately, `AudioEngine` synthesizes eligible events into oscillator/filter/noise voices, envelopes, stereo panning, tempo quantization, reverb, delay, and a small pool of sustained drone voices. Distance from the viewport attenuates audible event gain. Habitat signal efficiency affects simulated call propagation; the audio engine is not a ray-traced or physically modeled sound field.

Motifs are initially generated from a hash of the genome and are passed to offspring with small changes. Social copying can further alter a motif. This is a lightweight mechanism for emergent song conventions, not linguistic communication.

## Statistics and historical playback

`World.sample()` runs about once per simulated second. Samples include population, food, species counts, mean traits, births, deaths, mutations, call counts, and Shannon diversity across current species proportions. The Observatory renders these histories.

Population keyframes are captured about every 12 simulated seconds. Scrubbing displays hydrated organisms from a keyframe; **Rewind world here** restores that saved population and trims later keyframes. A keyframe contains a population snapshot, not every environmental, statistical, audio, or interaction detail needed for deterministic replay.

The separate statistics worker receives genome and voice arrays. It calculates per-gene standard deviations, samples up to 1,500 pairwise genome comparisons, and bins acoustic traits to calculate a Shannon-entropy-style `sonicIndex`. Pairwise comparisons use `Math.random`, so that estimate is intentionally not seeded.

## Randomness and reproducibility

The `RNG` in `src/sim/rng.ts` is a seeded Mulberry32-style generator used by world generation and core simulation choices. Re-entering the same seed creates the same initial habitat order, perturbations, founder genomes, and placements, assuming the same code version.

A seed is a reproducible **starting condition**, not a replay file or a guarantee that two fully interactive sessions remain identical. User actions can be time-derived or use `Math.random` (for example, manual nutrient placement and species introduction); audio noise/effect construction and worker pair sampling also use non-seeded randomness. Browser frame timing, audio scheduling, parameter changes, and snapshot omissions further make exact long-run replay out of scope.

## Model boundaries

- The ecology is deliberately stylized, with hand-authored equations and thresholds. It has not been calibrated against an external dataset or validated for research use.
- The worker's diversity metrics are descriptive approximations; `sonicIndex` depends on a discretized trait lattice, and genetic pair distance is sampled.
- Freeze-life mode is not a global halt: interactions and predation continue.
- The soundscape is a synthesis design, not a biological acoustic model. Audio effects are an artistic rendering layer.
- Population caps and time-step limits are operational guardrails, not biological carrying-capacity claims.

These boundaries are part of the design: the project is an instrument for making simple rules observable and audible, not a claim that an artificial biosphere predicts real ecosystems.
