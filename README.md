# GFOS Build

A desktop application for Maven project management, pipeline orchestration, and build monitoring.

> **Alpha release** — core functionality is working but rough edges remain. Feedback welcome.

## Features

- **Project Scanner** — recursively discovers Maven projects across configurable root directories; distinguishes buildable modules from aggregator POMs
- **Pipeline Builder** — define multi-step Maven build pipelines with per-step JDK, goals, and flags; resume from failed steps
- **Live Build Output** — streaming build log with ANSI rendering, `[INFO]`/`[ERROR]`/`[WARNING]` syntax highlighting, and step progress indicator
- **Build History** — persistent log of all pipeline and ad-hoc builds including stored log output; grouped pipeline runs; searchable and filterable
- **Statistics Dashboard** — success rate, average duration, slowest steps, per-pipeline and per-project breakdowns
- **Settings** — configure scan roots, Maven defaults, JDK paths, and exclude patterns
- **Dark / Light theme**

## Download

Go to the [Releases](../../releases) page and download `GFOS-Build-win32-x64.zip` from the latest release.

Extract the ZIP anywhere and run **`GFOS Build.exe`**.

### Requirements

- Windows x64
- [Maven](https://maven.apache.org/download.cgi) accessible in `PATH` (or configured per-pipeline)
- At least one JDK installed

No Java runtime, Node.js, or other dependencies required — the app is fully self-contained.

## Development

### Prerequisites

- [Bun](https://bun.sh) >= 1.1
- Node.js >= 20 (for `electron-rebuild`)
- Windows (packaging target is win32-x64)

### Setup

```bash
bun install
```

### Run in development mode

```bash
bun run dev:gui        # Electron app with hot reload
```

### Build the distributable

```bash
bun run build:server         # bundle server with tsdown
bun run binary:build:win     # compile Bun CLI binary for Windows
bun run check:gui            # typecheck + Electron package
```

The packaged app will be in `release/gui/GFOS Build-win32-x64/`.

### Run tests

```bash
bun run check          # lint + typecheck + unit tests + build
```

## Architecture

```
src/                         # Bun server (CLI + HTTP API)
  application/               # pipeline runner, scanner
  cli/                       # HTTP/WS server, route handlers
  config/                    # zod-validated config schema
  core/                      # domain types, JDK resolver
  infrastructure/            # SQLite DB (bun:sqlite), file system

shared/                      # shared TypeScript types (api, types)

gui/
  src/main/                  # Electron main process (spawns server)
  src/renderer/              # React + TanStack Router + Tailwind
    routes/                  # builds/, pipelines/, projects/, settings/, stats/
    components/              # BuildOutput, PipelineDialog, UI primitives
    api/                     # React Query hooks, WebSocket event cache
```

The server runs as a bundled Bun binary inside the packaged Electron app. The renderer communicates via a local HTTP/WebSocket API on a random port.

## Configuration

On first launch, GFOS Build walks you through setting up your scan roots and Maven defaults. Config is stored in the app's user data directory as `gfos-build.config.json`.

## License

MIT
