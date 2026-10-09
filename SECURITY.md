# Security policy

[← Back to the README](README.md)

## Reporting a vulnerability

Please do not publish exploit details, credentials, or private data in a public issue. Use GitHub's [private vulnerability reporting](https://github.com/zazieproductions/sonogenesis-artificial-life-simulator/security/advisories/new) if it is enabled for this repository. If it is unavailable, contact the repository maintainers through a private channel before public disclosure.

Include the affected commit or package version, browser/OS, impact, and a minimal reproduction when safe. Do not include access tokens or unrelated personal information.

There is not yet a published response-time commitment or supported-version policy. Maintainers should add both if the project adopts ongoing public releases.

## Current security boundary

The application is client-side and the source currently contains no application backend, authentication, or explicit telemetry/network request path. Specimens, snapshots, and presets are stored in origin-local IndexedDB. Static hosting providers still receive normal requests for page assets.

The JSON importer performs shallow shape checks rather than full schema validation. Import files only from sources you trust; malformed input may fail during use. Do not treat saved JSON as a secure interchange format. Keep browser dependencies and deployment tooling updated, and never commit credentials or exported personal work.
