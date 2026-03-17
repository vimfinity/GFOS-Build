# GFOS Build

A local-first desktop application for Maven and Node project management, pipeline orchestration, and run monitoring.

> **Alpha release** — core functionality is working but rough edges remain. Feedback welcome.

## Features

- **Project Scanner** — recursively discovers Maven and Node projects across configurable root directories; distinguishes buildable modules from aggregator POMs
- **Pipeline Builder** — define multi-step Maven and Node build pipelines with detected package-manager scripts, per-step execution mode, and per-step JDK/goals for Maven
- **Live Build Output** — streaming build log with ANSI rendering, `[INFO]`/`[ERROR]`/`[WARNING]` syntax highlighting, and step progress indicator
- **Build History** — persistent log of all pipeline and quick runs including stored log output; grouped pipeline runs; searchable and filterable
- **Statistics Dashboard** — success rate, average duration, slowest steps, per-pipeline and per-project breakdowns
- **Settings** — configure scan roots, Maven defaults, Node package-manager executables, JDK paths, and exclude patterns
- **Dark / Light theme**

## Distribution

Go to the [Releases](../../releases) page and use the Windows portable package:

- **Portable ZIP** — `GFOS-Build-<version>-win32-x64.zip`

### Portable package

Extract the ZIP anywhere and run **`GFOS Build.exe`** from the extracted `GFOS Build <version>/` folder.

This build is fully local and does not include a background updater or managed installer flow.

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
- `release/desktop/win-unpacked/`

The portable desktop bundle also includes:

- `Add GFOS Build to Start Menu.cmd`
- `Remove GFOS Build from Start Menu.cmd`

### Run tests

```bash
bun run check          # lint + typecheck + unit tests + build
```

## Architecture

```
apps/
  cli/                       # CLI entrypoints
  desktop/                   # Electron main, preload, renderer

packages/
  contracts/                 # shared IPC/query/event types
  domain/                    # pure domain types and helpers
  application/               # orchestration and use cases
  platform-node/             # SQLite, file system, process spawning, local runtime
```

The renderer communicates with the Electron main process through a typed preload bridge. No localhost HTTP or WebSocket sidecar is used.

## Configuration

On first launch, GFOS Build walks you through setting up your scan roots and Maven defaults. Settings are stored in `config/settings.json` under the app state directory, while durable run data is stored in `data/state.sqlite`.

## License

MIT
