# GFOS Build

A desktop application for Maven and Node project management, pipeline orchestration, and build monitoring.

> **Alpha release** — core functionality is working but rough edges remain. Feedback welcome.

## Features

- **Project Scanner** — recursively discovers Maven and Node projects across configurable root directories; distinguishes buildable modules from aggregator POMs
- **Pipeline Builder** — define multi-step Maven and Node build pipelines with detected package-manager scripts, per-step execution mode, and per-step JDK/goals for Maven
- **Live Build Output** — streaming build log with ANSI rendering, `[INFO]`/`[ERROR]`/`[WARNING]` syntax highlighting, and step progress indicator
- **Build History** — persistent log of all pipeline and ad-hoc builds including stored log output; grouped pipeline runs; searchable and filterable
- **Statistics Dashboard** — success rate, average duration, slowest steps, per-pipeline and per-project breakdowns
- **Settings** — configure scan roots, Maven defaults, Node package-manager executables, JDK paths, and exclude patterns
- **Dark / Light theme**

## Download

Go to the [Releases](../../releases) page and download the latest `GFOS-Build-<version>-win32-x64.zip`.

Extract the ZIP anywhere and run **`GFOS Build.exe`** from the extracted `GFOS Build <version>/` folder.

If you want GFOS Build to appear in Windows search, run **`Add GFOS Build to Start Menu.cmd`** once from the extracted folder. This creates a per-user Start Menu shortcut with no admin rights or installer required.

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

If you pulled an older clone, run `bun install` again after updating. Bun needs to trust Electron's install script so the desktop binary is downloaded correctly.

### Run in development mode

```bash
bun run dev:desktop    # Electron app with hot reload
```

### Start the packaged desktop app locally

```bash
bun run start:desktop
```

### Build the distributable

```bash
bun run build:desktop        # build Electron main/preload/renderer
bun run check:desktop        # typecheck + desktop build
bun run dist:desktop:win     # create the Windows desktop release
```

The release outputs will be in `release/desktop/`:

- `release/desktop/win-unpacked/GFOS Build-win32-x64/`
- `release/desktop/GFOS-Build-<version>-win32-x64.zip`

The portable desktop bundle also includes:

- `Add GFOS Build to Start Menu.cmd`
- `Remove GFOS Build from Start Menu.cmd`

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
  src/main/                  # Electron main process (hosts the local API server)
  src/renderer/              # React + TanStack Router + Tailwind
    routes/                  # builds/, pipelines/, projects/, settings/, stats/
    components/              # BuildOutput, PipelineDialog, UI primitives
    api/                     # React Query hooks, WebSocket event cache
```

The renderer communicates with a local HTTP/WebSocket API hosted inside the Electron main process on a random port.

## Configuration

On first launch, GFOS Build walks you through setting up your scan roots and Maven defaults. Config is stored in the app's user data directory as `gfos-build.config.json`.

## License

MIT
