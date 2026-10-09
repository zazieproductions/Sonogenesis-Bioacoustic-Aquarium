# User guide

[← Back to the README](../README.md)

SONOGENESIS is designed to be explored in small gestures: alter a condition, watch a lineage respond, then listen for the change. The full control surface lives inside the browser; no account or server connection is needed.

## Start a world

1. Run `npm run dev`, or open the deployed static site.
2. Choose **Enter with sound** to start audio from a click, or **Silent observation** to keep the experience visual. Audio can be enabled later with the sound control.
3. Keep seed `2401`, enter another seed, or use the dice button. Select **Generate** to replace the current world.

Digit-only seeds are parsed as unsigned 32-bit values; other input is hashed as text. The same input gives the same initial world with the same code version. A seed does not encode an entire session or guarantee an identical long-running replay. See [Randomness and reproducibility](SIMULATION.md#randomness-and-reproducibility).

## Move through the biosphere

| Gesture / control | Result |
| --- | --- |
| Scroll | Zoom toward the pointer, from `0.18×` to `5×` camera zoom. |
| Drag empty space | Pan across habitat regions. |
| Click an organism | Open its Inspector; clear a selection by clicking empty space or pressing `Escape`. |
| Drag an organism | Relocate it. A habitat-boundary crossing is recorded as a transplant event. |
| Minimap | Click or drag within it to move the camera. |
| Tool rail → spawn | Introduce a new species near the pointer. |
| Tool rail → feed | Add nutrient particles at the pointer; dragging distributes more. |
| Tool rail → cull | Remove the organism under the pointer. |
| `1`–`6` | Set time speed: `0.5×`, `1×`, `2×`, `4×`, `8×`, `16×`. |
| `Space` | Pause or resume world stepping. |
| `F` | Toggle freeze-life mode. Aging, metabolism and reproduction pause; movement, feeding, predation, communication and audio continue. Predation can still cause deaths. |
| `G` | Toggle scientific overlays. Trails and labels have separate buttons in the tool rail. |

## Shape a habitat and its evolutionary pressure

Open **Control Deck** from the left tool rail (`H`). Its three tabs expose different kinds of intervention:

- **Habitat:** select one of the five regions, rename it, load a built-in habitat preset, edit environmental sliders or colors, and save the current habitat as a browser-local preset.
- **Evolution:** change mutation rate/strength, speciation threshold, population ceiling, nutrient multiplier, temperature/light shifts, electrical instability, synchrony, and call density.
- **Audio:** set master level, reverb, delay, drone level, voice polyphony, tempo, scale, and tempo quantization.

A setting changes the live world; it is not merely a visual filter. For example, pressure increases movement cost, light can support photosynthesis in translucent non-predators, and habitat acoustic parameters change simulated signal range. Details are in the [simulation model](SIMULATION.md).

## Inspect and engineer an organism

Click an organism to open the **Inspector**. It shows current energy, health, age, phenotype, habitat, signal carry, motif, call activity, and lineage. From here you can:

- mute or solo its generated voice, or track it with the camera;
- audition the six call styles;
- drag bars in the genome editor to change genes (the current organism's phenotype is recalculated);
- clone it, cull it, save the specimen, or save it with retained ancestry;
- send its genome and motif to the Mutation Laboratory.

Genome edits are direct engineering interventions, not inherited mutations. The edited record's lineage genome is updated to reflect the change, but the history is not an immutable scientific audit trail.

## Breed, select, and release

Open the **Mutation Laboratory** (`L`). Choose parent α and optionally parent β from random genomes or saved specimens. Generate offspring through mutation or crossover, audition candidates, and promote candidates to the workbench. **Select ×5 gen** and **Select ×25 gen** run the lab's acoustic-target heuristic; they do not simulate generations inside the live world.

Edit the workbench genome or motif, save the strain to the Archive, or choose a release count and introduce it into the current world. A release creates a fresh local lineage in the live ecosystem.

## Read history and rewind

Open the **Evolutionary Observatory** (`O`) to inspect population/food histories, species composition, Shannon diversity, mean acoustic traits, worker-derived genetic and sonic summaries, event history, and the phylogeny.

The range control scrubs population keyframes captured every 12 simulated seconds. While scrubbing, the renderer displays the historical population; the world is not stepping. **Live** returns to the current population. **Rewind world here** restores the selected keyframe and resumes from that population, trimming later keyframes. This is a population rewind, not a deterministic replay of every environmental and user event.

## Conduct an automated passage

Open the **Conductor** (`C`) to edit normalized curves for nutrient flux, temperature, light, electrical static, mutation rate, tempo, synchrony, call density, and reverb. Click the lane to add a breakpoint, drag to move it, and double-click a point to remove it. Hold `Alt` while clicking a lane to seek. Toggle each lane to hand that parameter to or from the conductor. Choose a duration and loop behavior, then select **Conduct**.

Automation advances on wall-clock time in the frame loop, even when ecological stepping is paused. If a lane is enabled, its sampled value is written back to that world/audio parameter while conducting.

## Archive and export work

The **Archive** is opened from the tool rail (it has no keyboard shortcut). It has two views:

- **Specimens:** inspect, release, revive a saved lineage, send a specimen to the lab, export its JSON, or delete it.
- **Snapshots:** capture an ecosystem, load it, export it as JSON, import a snapshot/specimen file, or delete it.

A snapshot saves a serialized world plus conductor lanes and camera position. It does not save active audio recording, a full keyframe history, or a full interaction log. Browser-local data can disappear if site storage is cleared or evicted; download important JSON exports. See [Data and privacy](DATA_AND_PRIVACY.md).

## Record the soundscape

Choose **Enable audio** or click an audition control to unlock audio. Use the master slider or `M` to control/mute it. **Rec** captures the engine's master output; pressing it again stops the capture and downloads a stereo WAV. Recording is buffered in memory until stop/export, so short sessions are safer on memory-constrained devices.

## Keyboard reference

| Key | Action |
| --- | --- |
| `Space` | Pause/resume world stepping |
| `1`–`6` | Set simulation speed |
| `F` | Toggle freeze-life mode |
| `M` | Enable/mute audio |
| `H` | Toggle Control Deck |
| `O` | Toggle Observatory |
| `L` | Toggle Mutation Laboratory |
| `C` | Toggle Conductor |
| `G` | Toggle scientific overlays |
| `Escape` | Clear selection and camera tracking |

The browser's audio autoplay policy still applies when using shortcuts. Global key handlers ignore `INPUT` and `SELECT` targets; keyboard access to every canvas gesture is not currently implemented. Accessibility limitations are documented in [Accessibility](ACCESSIBILITY.md).
