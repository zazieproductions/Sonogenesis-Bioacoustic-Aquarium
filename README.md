# SONOGENESIS — Artificial Ecology of Living Sound

An interactive artificial-life simulator and audiovisual instrument. Organisms evolve, move, communicate, and produce synthesized sound, creating an explorable generative ecosystem.

## Stack
React 19, TypeScript, Vite 7, Tailwind CSS 4, Three.js, Canvas/WebAudio, Web Workers, browser IndexedDB.

## Quick start

```bash
npm ci
npm run dev
```

Visit the local URL printed by Vite (usually http://localhost:5173).

## Checks and production build

```bash
npm run typecheck
npm run build
npm run preview
```

The production build is generated into `dist/`.

## Cloudflare Pages deployment

1. Create a Cloudflare Pages project, connect your GitHub repo, and choose **Vite**.
2. **Build command:** `npm run build`
3. **Build output directory:** `dist`
4. **Root directory:** repository root.

Or deploy manually:

```bash
npx wrangler pages deploy dist --project-name sonogenesis
```

The Pages `_redirects` file is included for application fallback routing.

## Structure

- `src/sim/` — genetics, morphology, environments, life-cycle and world simulation
- `src/audio/` — generative synthesizer/audio engine
- `src/render/` — organism visualization and background renderer
- `src/components/` — control surfaces, inspector, observatory, laboratory, library, conductor
- `src/conductor.ts` — sequencing and musical orchestration logic
- `src/db.ts` — IndexedDB persistence

## Notes

Sound playback requires a user gesture in modern browsers. For best results, open on a desktop browser with hardware acceleration and audio output enabled. No hosted server or API credentials are required for the simulation.
