# Data and privacy

[← Back to the README](../README.md) · [Architecture](ARCHITECTURE.md) · [User guide](USER_GUIDE.md)

## Where data lives

The app has no application backend, account system, cloud sync, or explicit telemetry/networking code. Specimens, ecosystem snapshots, and habitat presets are stored in the browser's IndexedDB database named `sonogenesis`, scoped to the origin serving the app. The current database version is `1`; stores use an `id` key path.

This is local browser storage, not durable archival storage. Browser settings, private-browsing modes, quota pressure, site-data cleanup, a new origin/domain, or an origin change can make saved work unavailable. Export important records and keep your own backups.

A static hosting provider still receives ordinary requests for the site and its assets. Provider-side access logs and retention are governed by that provider, not by this client-side app.

## Stored records

| Store | Type | Typical contents |
| --- | --- | --- |
| `specimens` | `Specimen` | ID, name, 43-value genome, motif, species label, generation, save time, and optionally a bounded ancestry list. |
| `snapshots` | `SnapshotRec` | Name, save time, population/species counts, simulation time, seed, and serialized payload. |
| `presets` | `PresetRec` | Name and habitat parameter values, including colors. |

The ecosystem snapshot payload has the shape `{ world, lanes, cam }`:

- `world` is `World.serialize()` output. It includes version `v: 1`, seed/RNG state, time and next-ID counters, habitats, organism records, food, species, a bounded lineage tail, a bounded statistics tail, recent events, globals, and total mutations.
- `lanes` contains conductor lane keys, enabled state, and automation points.
- `cam` contains the camera's world position and zoom.

Derived phenotypes and render bodies are reconstructed when data is loaded. Keyframe history, pending audio events, audio graph state, transient food pools, complete lineage history, and the full statistics/event history are not part of a snapshot. A snapshot therefore restores a useful working ecosystem, not every transient detail or a frame-exact recording.

## Import and export

The Archive downloads specimen JSON and ecosystem-snapshot JSON. A snapshot export wraps its payload in a record with `data` and `seed`; the in-app importer identifies snapshots by those fields and specimens by the presence of `genome`.

**Import validation is currently shallow.** The importer parses JSON and performs basic shape checks; it does not enforce genome length/ranges, deeply validate nested fields, or run a schema migration. Import only files you trust and keep exports from this application. Malformed or incompatible input may fail during loading. Do not use this import path as a secure interchange protocol.

Importing creates a new local record ID. Export files remain wherever you save them; the application does not upload or synchronize them.

## Recording data

WAV recording is generated in the browser from the audio engine's master output. Samples are retained in memory until recording stops and a download is produced. The audio file is not automatically written to IndexedDB or sent to a server. Long recordings consume increasing memory; stop and export before ending the page.

## Clearing local records

Records can be deleted individually in the Archive or Control Deck (habitat presets). The app has no clear-all control. Browser site-data settings can also remove the entire IndexedDB database; that action is destructive and may affect other data for the same origin.

## Format evolution and maintenance

Two different version numbers must be managed deliberately:

1. **IndexedDB schema version** is passed to `indexedDB.open` in `src/db.ts`. Bump it when object stores/indexes change and add an `onupgradeneeded` migration that preserves existing user data.
2. **Serialized world version** is the `v` field from `World.serialize()`. Add a migration/compatibility path before changing world-record structure, genome order, or any interpretation of persisted fields.

Before shipping a format change, add fixtures and round-trip tests for old-to-new records, validate imported structures at runtime, and handle quota/transaction errors visibly. Do not treat TypeScript interfaces as runtime validation. Keep migration code independent of view components where possible.
