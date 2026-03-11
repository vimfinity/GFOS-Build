# GFOS-Build — Final Implementation Plan

## Context

Complete ground-up rebuild. The current codebase implements a "scan-everything, build-all-found"
model which is the wrong abstraction. The real workflow is either: (a) run a single Maven build at a
specific path with specific flags, or (b) execute a saved ordered sequence of such builds. The
current code is wiped entirely; the architecture below is designed so a TUI/GUI layer can be added
later without touching core logic.

**Confirmed facts from exploration:**
- JDKs: `J:/dev/java/jdk8`, `jdk11`, `jdk17`, `jdk21` (path is machine-specific → config)
- `2025/*` → Java 21, `4.8plus/*` → Java 17, `4.8/*` → likely 11 or 8 (verify per-repo at scan)
- `2025/shared/.mvn/maven.config` contains `-T0.8C --show-version`; `.mvn/jvm.config` contains `-Xmx4G` — Maven picks these up automatically. The tool must surface this during dry-run.
- All product top-level poms have `<modules>` (aggregators). `tools/` projects have no `<modules>` (leaf projects). Both verified.
- `2025/web/xtimeweb/pep/ewbe12-war` is a Maven WAR that builds embedded Angular via `frontend-maven-plugin`. From the tool's perspective it is a Maven project — Maven orchestrates everything.
- `2025/angular_core_libraries` is a pure Angular workspace (no pom.xml) — scanner naturally skips it. Phase 2 scope.
- Non-build dirs (`bruno/`, `coding-agents/`, `delphi/`) have no pom.xml anywhere — scanner yields zero results for them naturally. Explicit `exclude` is optional, for performance only.

---

## 1. Core Domain Types (`src/core/types.ts`)

```typescript
type BuildSystem = 'maven' | 'npm'; // extensible for Phase 2

interface MavenMetadata {
  pomPath: string;
  artifactId: string;
  packaging: string;          // 'pom' | 'jar' | 'war' | 'ear'
  isAggregator: boolean;      // has <modules> section — verified against actual pom.xml
  javaVersion?: string;       // from <maven.compiler.source> or <maven.compiler.release>
  hasMvnConfig: boolean;      // .mvn/maven.config exists — user may have -T flags there
  mvnConfigContent?: string;  // raw content, surfaced in dry-run output
}

interface Project {
  name: string;           // path.basename(path)
  path: string;           // absolute, normalised path
  depth: number;
  rootName: string;       // which named root (or 'adhoc' for ad-hoc scans)
  buildSystem: BuildSystem;
  maven?: MavenMetadata;  // present when buildSystem === 'maven'
}

interface BuildStep {
  path: string;            // absolute normalised path
  goals: string[];         // e.g. ['clean', 'install']
  flags: string[];         // e.g. ['-DskipTests', '-T 2C', '-P !jsminify']
  label: string;           // from config, or path.basename(path)
  mavenExecutable: string; // fully resolved
  javaVersion?: string;    // if set, JAVA_HOME is overridden for this step
}

interface Pipeline {
  name: string;
  description?: string;
  failFast: boolean;
  steps: BuildStep[];
}

interface BuildStepResult {
  step: BuildStep;
  exitCode: number;
  durationMs: number;
  success: boolean;
}

interface RunResult {
  results: BuildStepResult[];
  success: boolean;
  durationMs: number;
  stoppedAt?: number;  // 0-based index of step that caused failFast stop
}
```

### Event streams (UI-agnostic; identical interface future TUI/GUI consumes)

```typescript
type ScanEvent =
  | { type: 'repo:found'; project: Project }
  | { type: 'scan:done'; projects: Project[]; durationMs: number; fromCache: boolean };

type BuildEvent =
  | { type: 'step:start';  step: BuildStep; index: number; total: number; pipelineName?: string }
  | { type: 'step:output'; line: string; stream: 'stdout' | 'stderr' }
  | { type: 'step:done';   step: BuildStep; exitCode: number; durationMs: number; success: boolean }
  | { type: 'run:done';    result: RunResult };
```

---

## 2. Configuration

### File locations (checked in order)

1. `--config <path>` CLI flag
2. `<cwd>/gfos-build.config.json`
3. `%APPDATA%\gfos-build\config.json` ← **primary user location; survives binary updates**

**First run:** if no config found, run `config init` wizard (see §5). Never silently create a
broken default — always guide the user through configuration.

### Zod schema (`src/config/schema.ts`)

```typescript
const buildStepConfigSchema = z.object({
  path:         z.string().min(1),
  goals:        z.array(z.string().min(1)).optional(),
  flags:        z.array(z.string()).optional(),
  label:        z.string().optional(),
  maven:        z.string().optional(),          // override mvn executable for this step
  javaVersion:  z.string().optional(),          // e.g. "17" — forces JAVA_HOME override
});

const pipelineConfigSchema = z.object({
  description:  z.string().optional(),
  failFast:     z.boolean().default(true),
  steps:        z.array(buildStepConfigSchema).min(1),
});

const configSchema = z.object({
  roots: z.record(
    z.string().min(2),    // min 2 chars — single char is a drive letter, not a root name
    z.string().min(1)
  ).default({}),

  maven: z.object({
    executable:    z.string().min(1).default('mvn'),
    defaultGoals:  z.array(z.string().min(1)).default(['clean', 'install']),
    defaultFlags:  z.array(z.string()).default([]),
  }).default({}),

  jdkRegistry: z.record(
    z.string().min(1),   // java version, e.g. "17" or "21"
    z.string().min(1)    // absolute path to JDK root, e.g. "J:/dev/java/jdk17"
  ).default({}),

  scan: z.object({
    maxDepth:      z.number().int().min(1).max(20).default(4),
    includeHidden: z.boolean().default(false),
    exclude:       z.array(z.string()).default([]),   // dir names to skip (perf opt only)
  }).default({}),

  pipelines: z.record(z.string().min(1), pipelineConfigSchema).default({}),
});

export type AppConfig = z.infer<typeof configSchema>;
```

### Path resolution (`src/config/resolver.ts`)

Distinguish by character count before the first `:`:

| Input | Resolved as |
|---|---|
| `J:/dev/quellen/2025/web` | Absolute (single char `J` before `:`) |
| `quellen:2025/web` | Root-relative (`roots['quellen']` + `2025/web`; min 2 chars enforced by schema) |
| `./relative` or no colon | `path.resolve(cwd, value)` |

Unknown root name → throws a clear error listing all configured roots.

### Annotated config example (written on `config init`, also at `config show --example`)

```json
{
  "roots": {
    "quellen": "J:/dev/quellen"
  },
  "maven": {
    "executable": "mvn",
    "defaultGoals": ["clean", "install"],
    "defaultFlags": []
  },
  "jdkRegistry": {
    "8":  "J:/dev/java/jdk8",
    "11": "J:/dev/java/jdk11",
    "17": "J:/dev/java/jdk17",
    "21": "J:/dev/java/jdk21"
  },
  "scan": {
    "maxDepth": 4,
    "includeHidden": false,
    "exclude": []
  },
  "pipelines": {
    "web-2025": {
      "description": "Build 2025 web project and produce the ear artefact",
      "failFast": true,
      "steps": [
        {
          "path": "quellen:2025/web",
          "goals": ["clean", "install"],
          "flags": ["-DskipTests", "-T 2C", "-P !jsminify"],
          "label": "web top-level"
        },
        {
          "path": "quellen:2025/web/xtimeweb/xtimeweb-ear-qs",
          "goals": ["clean", "install"],
          "label": "web ear"
        }
      ]
    }
  }
}
```

---

## 3. JDK Management (`src/core/jdk-resolver.ts`)

At build time the tool sets `JAVA_HOME` as an environment variable for the spawned Maven process.
Resolution order (first match wins):

1. Step's explicit `javaVersion` override
2. Project's scanned `maven.javaVersion` (from `<maven.compiler.source>`)
3. System `JAVA_HOME` unchanged

```typescript
function resolveJavaHome(
  config: AppConfig,
  javaVersion: string | undefined,
): string | undefined {
  if (!javaVersion) return undefined;  // use system JAVA_HOME
  const jdkPath = config.jdkRegistry[javaVersion];
  if (!jdkPath) {
    // Warn but do not fail — fall back to system JAVA_HOME
    return undefined;
  }
  return jdkPath;
}
```

Spawn receives `env: { ...process.env, JAVA_HOME: resolvedJavaHome }` when a JDK path is found.
If no path found, the process inherits the current environment unchanged.

---

## 4. pom.xml Metadata Extraction (`src/core/pom-parser.ts`)

Fast inline extraction — no XML parsing library. Reads the pom.xml file content and extracts
four fields using targeted string search (not full-document regex, just `indexOf`/substring):

- `<packaging>` → `string | undefined`
- `<modules>` presence → `isAggregator: boolean`
- `<maven.compiler.source>` **or** `<maven.compiler.release>` → `javaVersion: string | undefined`
- `<artifactId>` → `string`

Called during `RepositoryScanner.scan()` for each discovered pom.xml. Errors in parsing are
non-fatal — the project is still registered, fields left undefined.

---

## 5. CLI Commands

```
gfos-build build <path> [options]          Run a single Maven build at a specific path
gfos-build pipeline run <name> [options]   Execute a saved named pipeline
gfos-build pipeline list                   List all configured pipelines (steps expanded)
gfos-build scan [path] [options]           Discover build projects under a path or root
gfos-build config init                     Interactive setup wizard (first-run)
gfos-build config show                     Print the effective resolved config
gfos-build version                         Print the binary version
gfos-build help [command]                  Show help
```

**Global options (all commands):**
```
--config <path>   Override config file location
--json            Emit newline-delimited JSON events (programmatic/UI consumption)
```

**`build` options:**
```
--goals <str>       Space-separated goals, quoted — e.g. "clean install"
--flags <str>       Space-separated flags, quoted — e.g. "-DskipTests -T 2C"
--maven <exec>      Override mvn executable
--java <version>    Override JAVA_HOME via jdkRegistry, e.g. "17"
--dry-run           Print resolved command + detected .mvn/ settings; do not execute
```

**`pipeline run` options:**
```
--from <id>         Start from step by 1-based index or exact label (case-insensitive)
--continue          Resume from last recorded failed step (reads SQLite history)
--dry-run           Print all resolved steps + .mvn/ notes; validate pom.xml existence
```

**`scan` options:**
```
--depth <n>         Override maxDepth
--no-cache          Force fresh scan, bypass SQLite cache
```

**Usage examples:**
```bash
# Ad-hoc: build any Maven project
gfos-build build quellen:2025/web --flags "-DskipTests -T 2C -P !jsminify"
gfos-build build "J:/dev/quellen/2025/web/kunden/gfostools" --goals "clean install"
gfos-build build quellen:tools/ReleaseTool --dry-run

# Pipeline
gfos-build pipeline run web-2025
gfos-build pipeline run full-2025 --from 3
gfos-build pipeline run full-2025 --from "web top-level"
gfos-build pipeline run full-2025 --continue
gfos-build pipeline run full-2025 --dry-run
gfos-build pipeline list

# Discovery
gfos-build scan quellen:2025
gfos-build scan "J:/dev/quellen/tools" --no-cache --json

# Setup
gfos-build config init
gfos-build config show
```

---

## 6. `pipeline list` Output Format

```
2 pipeline(s) configured:

  web-2025  ·  Build 2025 web project and produce the ear artefact
  ┌─ 1  web top-level   quellen:2025/web
  │        mvn clean install -DskipTests -T 2C -P !jsminify
  │        Java 21  ·  ⚠ .mvn/maven.config detected (extra Maven flags auto-applied)
  └─ 2  web ear        quellen:2025/web/xtimeweb/xtimeweb-ear-qs
           mvn clean install

  full-2025  ·  Full 2025 stack: shared → hintergrund → web
  ┌─ 1  shared          quellen:2025/shared
  ...
```

The `.mvn/maven.config` warning surfaces automatically from scan metadata — no hardcoding.

---

## 7. File Structure

```
src/
├── cli/
│   ├── index.ts              Entry point. Shebang. Parses argv, dispatches to commands.
│   │                         Top-level error handler: catches errors, formats, exits.
│   ├── args.ts               argv → ParsedArgs (manual loop + Zod). No parser library.
│   ├── renderer.ts           AsyncIterable<BuildEvent|ScanEvent> → ANSI terminal output.
│   │                         ANSI codes inline — no colour library dependency.
│   └── commands/
│       ├── build.ts
│       ├── pipeline-run.ts
│       ├── pipeline-list.ts
│       ├── scan.ts
│       ├── config-init.ts    Interactive wizard via stdin (node:readline/promises)
│       └── config-show.ts
│
├── application/
│   ├── build-runner.ts       Resolves path, pre-flight pom.xml check, emits BuildEvents.
│   ├── pipeline-runner.ts    Iterates steps, failFast, --from/--continue. Emits BuildEvents.
│   │                         --continue: reads last failed step index from SQLite.
│   └── scanner.ts            CachedScanner: checks SQLite cache, falls through to
│                             RepositoryScanner on miss, writes results to cache.
│
├── core/
│   ├── types.ts
│   ├── repository-scanner.ts  BFS AsyncGenerator<ScanEvent>. Calls pom-parser per find.
│   ├── build-executor.ts      Spawns mvn via ProcessRunner. Streams ProcessEvents.
│   ├── pom-parser.ts          Fast pom.xml field extraction (no XML library).
│   └── jdk-resolver.ts        Resolves JAVA_HOME from jdkRegistry + detected version.
│
├── config/
│   ├── schema.ts              All Zod schemas. Exports AppConfig and sub-types.
│   ├── loader.ts              Config file search (3 locations). Validates with Zod.
│   │                          If not found → launch config init wizard, then exit 0.
│   ├── resolver.ts            resolveStepPath(): drive-letter vs root-relative detection.
│   └── paths.ts               getAppDataDir(), getConfigPath(), getDbPath() — all paths
│                              centralised here. %APPDATA%\gfos-build\...
│
└── infrastructure/
    ├── file-system.ts         FileSystem interface + NodeFileSystem (node:fs/promises).
    │                          Methods: exists, readDir, readFile, writeFile, mkdir.
    ├── process-runner.ts      ProcessRunner interface + NodeProcessRunner.
    │                          child_process.spawn, readline for lines, AsyncQueue merge.
    └── database.ts            SQLite wrapper via bun:sqlite. Schema migration on open.
                               Exposes typed methods for build_runs and scan_cache tables.

tests/
├── core/
│   ├── repository-scanner.test.ts   InMemoryFileSystem with OS-correct paths (path.join).
│   ├── pom-parser.test.ts           Various pom.xml content strings.
│   ├── jdk-resolver.test.ts         Registry lookup, missing entry fallback.
│   └── build-executor.test.ts       FakeProcessRunner. Event sequence validation.
├── config/
│   ├── loader.test.ts               Valid config, missing file, bad JSON, Zod errors.
│   └── resolver.test.ts             Drive letter, root-relative, unknown root, no-colon.
├── application/
│   ├── build-runner.test.ts         Pre-flight pom check. step:start→output→done→run:done.
│   └── pipeline-runner.test.ts      failFast, --from by index, --from by label, --continue.
└── fixtures/
    └── workspaces/2025/
        ├── shared/pom.xml            (packaging: pom, modules section, compiler source: 21)
        └── web/
            ├── pom.xml               (packaging: pom, modules section, compiler source: 21)
            └── xtimeweb/
                └── xtimeweb-ear-qs/
                    └── pom.xml       (packaging: ear, no modules)

scripts/
└── smoke-binary.ts    Runs .exe: scan fixtures --json; pipeline dry-run; validate output.
```

---

## 8. Data Persistence (`src/infrastructure/database.ts`)

Uses **`bun:sqlite`** — built into Bun, zero external dependency, zero runtime requirement in
the compiled binary.

Database location: `%APPDATA%\gfos-build\data.db`

Schema (created/migrated on open):

```sql
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS build_runs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  project_path TEXT    NOT NULL,
  project_name TEXT    NOT NULL,
  build_system TEXT    NOT NULL DEFAULT 'maven',
  command      TEXT    NOT NULL,        -- full command string as run
  java_home    TEXT,                    -- JAVA_HOME used, null if system default
  pipeline_name TEXT,                   -- null for ad-hoc builds
  step_index   INTEGER,                 -- null for ad-hoc builds
  started_at   TEXT    NOT NULL,        -- ISO 8601
  finished_at  TEXT,
  duration_ms  INTEGER,
  exit_code    INTEGER,
  status       TEXT    NOT NULL DEFAULT 'running'  -- running|success|failed|cancelled
);

CREATE TABLE IF NOT EXISTS pipeline_state (
  pipeline_name TEXT PRIMARY KEY,
  last_run_id   INTEGER,
  last_failed_step INTEGER,            -- 0-based; used by --continue
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scan_cache (
  cache_key    TEXT PRIMARY KEY,
  scanned_at   TEXT NOT NULL,          -- ISO 8601
  projects_json TEXT NOT NULL          -- JSON array of Project[]
);
```

**`pipeline_state` enables `--continue`:** after a `pipeline run` finishes (success or failure),
the runner upserts `pipeline_state` with the failed step index. `--continue` reads this and
passes it as `fromIndex` to the pipeline runner. On full success, `last_failed_step` is set null.

**Build statistics schema is designed now.** Statistics queries and reporting are Phase 2 (UI
layer). The data collection starts in Phase 1 automatically — every `build` and `pipeline run`
writes a `build_runs` row including duration, exit code, and path.

Scan cache TTL: 5 minutes (compare `scanned_at` to `Date.now()` at read). `--no-cache` bypasses
the lookup. Cache is invalidated automatically on schema migration.

---

## 9. `RepositoryScanner` Scan Logic

```
For each (rootName, rootPath) in options.roots:
  BFS from rootPath, queue starts at depth 0
  For each directory popped from queue:
    If pom.xml found:
      → parse pom.xml metadata (isAggregator, javaVersion, packaging, artifactId)
      → check for .mvn/maven.config, .mvn/jvm.config
      → yield { type: 'repo:found', project: Project }
      → DO NOT push children (submodule skipping is intentional)
      continue
    If depth < maxDepth:
      → readDir, skip hidden (unless includeHidden), skip names in exclude[]
      → push children at depth+1

After all roots:
  yield { type: 'scan:done', projects: sorted_by_path, ... }
```

Non-Maven directories (no pom.xml anywhere within maxDepth) yield zero `repo:found` events —
they are naturally invisible in results. `exclude[]` is purely a performance optimisation for
known-empty directories, not a correctness requirement.

After a scan completes, the application layer may compare root-level directories that yielded
zero projects against the configured roots and (Phase 2 UI) suggest them as excludes. Phase 1
this is reported as an informational line in terminal output.

---

## 10. Terminal Renderer (`src/cli/renderer.ts`)

ANSI escape codes inlined — no colour library. Two modes controlled by `--json`:

**Human mode (default):**
```
Scanning quellen:2025...  done in 1.2s  (12 projects found)

[ 1/2 ]  web top-level
         J:/dev/quellen/2025/web
         mvn clean install -DskipTests -T 2C -P !jsminify
         Java 21 (J:/dev/java/jdk21)
         ⚠ .mvn/maven.config: -T0.8C --show-version
─────────────────────────────────────────────────────────────
[INFO] Scanning for projects...
[INFO] BUILD SUCCESS
─────────────────────────────────────────────────────────────
✓  web top-level   SUCCESS   42.3s

[ 2/2 ]  web ear
...
✓  web ear         SUCCESS   8.1s

Pipeline web-2025  ✓  SUCCESS   50.4s
```

**On failure (failFast):**
```
✗  hintergrund    FAILED (exit 1)   23.1s

Pipeline full-2025  ✗  FAILED at step 2 of 5
Resume:   gfos-build pipeline run full-2025 --from 2
Or:       gfos-build pipeline run full-2025 --continue  (next time)
```

**JSON mode:** each `BuildEvent`/`ScanEvent` emitted as a single line of JSON (NDJSON).
This is the interface the future TUI/GUI will consume via process pipe.

---

## 11. Dry-Run Output

`build --dry-run`:
```
[DRY RUN]
  Project:     J:/dev/quellen/2025/web
  pom.xml:     found ✓
  Command:     mvn clean install -DskipTests -T 2C -P !jsminify
  Java:        21  →  J:/dev/java/jdk21
  .mvn config: -T0.8C --show-version  ← applied automatically by Maven
```

`pipeline run --dry-run` outputs the above block for every step, plus lists any steps that would
be skipped when `--from` is provided.

---

## 12. Distribution

**Current:** hand `release/gfos-build.exe` to users manually.

**Better, still feasible without infrastructure:** provide a PowerShell install script on a
shared network drive:
```powershell
# install.ps1 — place next to gfos-build.exe on the share
$dest = "$env:LOCALAPPDATA\gfos-build"
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Copy-Item ".\gfos-build.exe" "$dest\gfos-build.exe" -Force
# Add to user PATH if not already present
$path = [Environment]::GetEnvironmentVariable("PATH","User")
if ($path -notlike "*$dest*") {
  [Environment]::SetEnvironmentVariable("PATH","$dest;$path","User")
}
Write-Host "Installed. Run: gfos-build version"
```

Users run `PowerShell -ExecutionPolicy Bypass -File .\install.ps1` once.
Binary goes to `%LOCALAPPDATA%\gfos-build\`, added to user `PATH`.
Config stays at `%APPDATA%\gfos-build\config.json` — unaffected by reinstalls.

**Self-update check (Phase 2):** binary can check a known share path for a newer `.exe` and
inform the user, or auto-update via the same copy logic.

---

## 13. Dependency Decisions

| Package | Decision | Reason |
|---|---|---|
| `zod` | **Keep** | Config + arg validation, already present |
| `picomatch` | **Remove** | Glob matching not needed; dir-name exclusion is exact string match |
| `bun:sqlite` | **Add** (built-in) | Replaces JSON cache files; enables history and `--continue`. Zero runtime dependency — compiled into binary by Bun. |
| `typescript` | Keep (dev) | — |
| `vitest` | Keep (dev) | — |
| `eslint` + `typescript-eslint` | Keep (dev) | — |
| `prettier` | Keep (dev) | — |

No colour library (chalk, picocolors, etc.) — ANSI codes are trivial inline.
No argument parsing library (commander, yargs) — manual loop + Zod is sufficient and keeps the
binary lean.
No XML library — four-field pom.xml extraction done with targeted string search.

---

## 14. Implementation Order

**Phase 1A — Infrastructure & Core**
1. Delete `src/` and `tests/` entirely
2. `src/config/paths.ts` — `getAppDataDir()`, `getConfigPath()`, `getDbPath()`
3. `src/infrastructure/file-system.ts` — interface + NodeFileSystem
4. `src/infrastructure/process-runner.ts` — interface + NodeProcessRunner + AsyncQueue
5. `src/infrastructure/database.ts` — `bun:sqlite` wrapper, schema creation/migration
6. `src/core/types.ts` — all domain interfaces and event types
7. `src/core/pom-parser.ts` — fast metadata extraction
8. `src/core/jdk-resolver.ts` — JAVA_HOME resolution
9. `src/core/repository-scanner.ts` — BFS AsyncGenerator<ScanEvent>, calls pom-parser
10. `src/core/build-executor.ts` — delegates to ProcessRunner, streams ProcessEvents
11. `src/config/schema.ts` — Zod schemas + AppConfig
12. `src/config/resolver.ts` — resolveStepPath()
13. `src/config/loader.ts` — 3-location search, Zod validation, first-run → wizard

**Phase 1B — Application Layer**
14. `src/application/scanner.ts` — CachedScanner (SQLite cache)
15. `src/application/build-runner.ts` — pre-flight + BuildEvent envelope
16. `src/application/pipeline-runner.ts` — failFast + --from + --continue + DB writes

**Phase 1C — CLI**
17. `src/cli/renderer.ts` — ANSI human output + JSON mode
18. `src/cli/commands/config-init.ts` — readline wizard
19. `src/cli/commands/config-show.ts`
20. `src/cli/commands/scan.ts`
21. `src/cli/commands/build.ts`
22. `src/cli/commands/pipeline-run.ts`
23. `src/cli/commands/pipeline-list.ts`
24. `src/cli/args.ts` — argument parser
25. `src/cli/index.ts` — entry point + dispatcher

**Phase 1D — Tests & Ship**
26. All unit tests (see §7 file structure)
27. Update `scripts/smoke-binary.ts` for new commands
28. Update fixture pom.xml files with real metadata (packaging, compiler.source)
29. `bun run check` (lint + typecheck + test)
30. `bun run binary:build:win`
31. `bun run binary:smoke`
32. Manual validation on J:/dev/quellen (see §15)
33. Write `install.ps1` alongside the `.exe`

---

## 15. Verification

```bash
# Unit + type check
bun run check

# Binary smoke (fixture-based, no Maven invoked)
bun run binary:smoke

# Manual: discovery
gfos-build scan quellen:2025 --no-cache
# → expect ~7 top-level Maven projects, each showing isAggregator + javaVersion

gfos-build scan quellen:2025
# → second run: "from cache"

gfos-build scan "J:/dev/quellen/tools" --no-cache
# → expect ~100 leaf projects

# Manual: dry-run build (no Maven invoked)
gfos-build build quellen:2025/web --dry-run
# → correct path, Java 21 → J:/dev/java/jdk21, no .mvn warning for web

gfos-build build quellen:2025/shared --dry-run
# → correct path, Java 21, ⚠ .mvn/maven.config: -T0.8C --show-version shown

# Manual: pipeline dry-run
gfos-build pipeline run full-2025 --dry-run
# → 5 steps, all pom.xml found ✓, correct Java version per step

# Manual: pipeline list
gfos-build pipeline list
# → steps expanded with Java version and .mvn notes

# Manual: actual build (real Maven)
gfos-build build quellen:2025/shared --dry-run   # confirm first
gfos-build build quellen:2025/shared              # run for real

# Manual: --from and --continue
gfos-build pipeline run web-2025 --from 2        # starts at web ear step
gfos-build pipeline run web-2025 --continue      # uses stored last_failed_step
```

---

## 16. Out of Scope (Phase 2+)

- **Angular/npm `BuildSystem`** — architecture ready (`buildSystem` discriminant on `Project`)
- **Parallel pipeline execution** — `AsyncGenerator` per pipeline; CLI runs one at a time
- **Build statistics commands** — schema designed now, data collected from Phase 1 day 1
- **TUI layer** — consumes same `AsyncIterable<BuildEvent>` as CLI renderer, no core changes
- **Self-update check** — binary reads version from a known share, prompts user
- **`gfos-build pipeline create`** — interactive pipeline builder
- **`.mvn/` conflict detection** — warn when user flags duplicate `.mvn/maven.config` flags
- **JDK auto-detection** — ~~Phase 2~~ **moved to Phase 1**: `config init` wizard scans a user-provided JDK base directory for subdirs containing `bin/javac.exe`, reads each `release` file for the major version, auto-populates `jdkRegistry`
