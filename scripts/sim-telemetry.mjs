#!/usr/bin/env node
// Runs the ACTUAL src/sim/world.ts headlessly (no browser required) and writes the
// telemetry JSON that powers the README charts.
//
// Usage: node scripts/sim-telemetry.mjs [seed] [seconds] [out.json]
//   seed     world seed (default 2401, the README screenshot seed)
//   seconds  simulated time to run (default 1800)
//   out      JSON output path (default: stdout)
//
// Requires: npm ci (uses esbuild that ships with the Vite toolchain).
import { build } from "esbuild";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const seed = parseInt(process.argv[2] || "2401", 10);
const seconds = parseFloat(process.argv[3] || "1800");
const out = process.argv[4] || null;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sonogenesis-sim-"));
const bundleOut = path.join(tmp, "world.mjs");
try {
  await build({
    entryPoints: [path.join(repo, "src/sim/world.ts")],
    bundle: true,
    format: "esm",
    outfile: bundleOut,
    logLevel: "silent",
  });
  const { World } = await import(pathToFileURL(bundleOut).href);

  const DT = 1 / 30;
  const w = new World(seed);
  const totalSteps = Math.round(seconds / DT);
  const series = { t: [], pop: [], food: [], zones: [] };
  for (let i = 0; i < totalSteps; i++) {
    w.step(DT);
    if ((i + 1) % 30 === 0) {
      const z = [0, 0, 0, 0, 0];
      for (const o of w.orgs) z[o.zone]++;
      series.t.push(w.time);
      series.pop.push(w.orgs.length);
      series.food.push(w.food.length);
      series.zones.push(z);
    }
  }
  const last = w.stats[w.stats.length - 1];
  const dump = {
    seed,
    seconds,
    series,
    stats: w.stats, // per-second StatSamples recorded by the simulation itself
    events: w.events,
    zones: w.zones,
    globals: w.globals,
    final: {
      time: w.time,
      pop: w.orgs.length,
      speciesLiving: new Set(w.orgs.map((o) => o.speciesId)).size,
      speciesEver: w.species.size,
      totalMutations: w.totalMutations,
      meanGen: last ? last.meanGen : 0,
      diversity: last ? last.diversity : 0,
    },
    species: [...w.species.values()],
  };
  const json = JSON.stringify(dump);
  if (out) {
    fs.writeFileSync(out, json);
    console.error(`wrote ${out} (pop=${dump.final.pop}, species=${dump.final.speciesLiving}/${dump.final.speciesEver}, mutations=${dump.final.totalMutations})`);
  } else {
    process.stdout.write(json);
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
