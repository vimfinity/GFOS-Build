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

Go to the [Releases](../../releases) page and pick one of the Windows artifacts:

- **Managed installer** — `GFOS-Build-Setup-<version>-x64.exe`
- **Portable ZIP** — `GFOS-Build-<version>-win32-x64.zip`

### Managed installer

Run the setup `.exe` and install it for the current user. No admin rights are required.

Managed installs include:

- proper Windows uninstall support
- in-app update checks
- background download + restart-to-apply updates

### Portable ZIP

Extract the ZIP anywhere and run **`GFOS Build.exe`** from the extracted `GFOS Build <version>/` folder.

Portable builds remain a supported fallback. They can detect newer releases and link you to the latest download, but they do not replace themselves automatically.

If you want the portable build to appear in Windows search, run **`Add GFOS Build to Start Menu.cmd`** once from the extracted folder. This creates a per-user Start Menu shortcut with no admin rights or installer required.

### Requirements

- Windows x64
- [Maven](https://maven.apache.org/download.cgi) accessible in `PATH` (or configured per-pipeline)
- At least one JDK installed

No Java runtime, Node.js, or other dependencies required — the app is fully self-contained.

## Development

### Prerequisites

- [Bun](https://bun.sh) >= 1.3.10 for workspace installs and `bunx`
- Node.js 24 LTS for the CLI runtime, CI, and Electron main-process compatibility
- Windows (packaging target is win32-x64)

Validated in this repo with:

- Bun `1.3.10`
- Node.js `24.12.0`
- Electron `41.0.2`

### Setup

```bash
bun install
```

If you pulled an older clone, run `bun install` again after updating. Bun needs to trust Electron's install script so the desktop binary is downloaded correctly.

GFOS Build uses Bun as the package manager, but the built CLI and desktop runtime target plain Node.js 24.

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
bun run smoke:desktop        # smoke-test the packaged Windows desktop app
```

The release outputs will be in `release/desktop/`:

- `release/desktop/GFOS-Build-<version>-win32-x64.zip`
- `release/desktop/win-unpacked/GFOS Build-win32-x64/`
- `release/desktop/managed/GFOS-Build-Setup-<version>-x64.exe`
- `release/desktop/managed/latest.yml`
- `release/desktop/managed/*.blockmap`

The portable desktop bundle also includes:

- `Add GFOS Build to Start Menu.cmd`
- `Remove GFOS Build from Start Menu.cmd`

### Run tests

```bash
bun run check          # lint + typecheck + unit tests + build
```

## Architecture

```
src/                         # Node-first server (CLI + HTTP API)
  application/               # pipeline runner, scanner
  cli/                       # HTTP/WS server, route handlers
  config/                    # zod-validated config schema
  core/                      # domain types, JDK resolver
  infrastructure/            # SQLite DB (node:sqlite), file system

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
