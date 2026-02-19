# GFOS Build Foundation

GFOS Build wurde **neu initialisiert** als belastbare Foundation für ein zukünftiges, feature-reiches Maven Build Tool.

Der aktuelle Scope ist bewusst klein, aber professionell aufgebaut:
- Discovery buildbarer Maven-Repositories in variablen Verzeichnisstrukturen
- deterministische Build-Ausführung
- klare Layer-Architektur für spätere Erweiterungen (Profiles, Queueing, UI, CI-Optimierungen)

## Arbeiten wir jetzt nur mit CLI?

**Ja, kurzfristig CLI-first.**
Das ist absichtlich so gewählt, weil es für Discovery/Build-Logik die höchste Stabilität bei geringster Komplexität liefert.

**Aber:** Wir setzen bereits auf die Technologien und Architektur, die später auch für weitere Interfaces tragen:
- strikte Domain-Layer (`core`, `application`)
- entkoppelte Infrastrukturadapter (`infrastructure`)
- validierte Konfiguration (`zod`)
- maschinenlesbare Ausgabe (`--json`) als Integrationsvertrag für spätere UI/API-Schichten

Damit ist eine spätere UI ein Add-on auf denselben Kern – kein Rewrite.

## Architektur

```text
src/
  application/       # Orchestrierung von Use-Cases
  cli/               # CLI Input/Output
  config/            # Konfigurationsschema + Loader (zod-validiert)
  core/              # Domänenlogik (Discovery/Build)
  infrastructure/    # Node-Adapter (Dateisystem/Prozess)
```

## Zielsystem ohne npm/node/bun testen

Das Zielsystem braucht **keine** JS-Runtime.
Wir bauen ein Standalone-Binary via Bun-Compile:

```bash
bun run binary:build  # baut immer Windows-Binary (gfos-build.exe)
```

Danach liegt ein Windows-Artefakt in `release/gfos-build.exe`, das direkt auf dem Zielsystem ausführbar ist.

Für lokale Smoke-Tests auf Nicht-Windows-Systemen gibt es zusätzlich:
- `bun run binary:build:native` (baut natives Binary für das aktuelle Host-OS)

## Teststrategie (du + ich + CI + Zielsystem)

1. **Unit/Domain-Tests** (lokal + CI)
   - `bun run check` (lint, typecheck, tests, ts-build)
2. **Binary Smoke-Test** (lokal + CI)
   - `bun run binary:build:native`
   - `bun run binary:smoke`
   - prüft reale Ausführung des kompilierten nativen Binaries gegen Fixture-Workspace
3. **Plattformvalidierung in CI**
   - GitHub Actions baut und smoket das Windows-Binary
   - Windows-Artefakt wird hochgeladen
4. **Zielsystem-Test ohne Runtime**
   - Binary-Artefakt kopieren
   - `gfos-build.exe scan --root <dein-path> --json` ausführen

## Installation & Development

```bash
bun install
bun run check
```

## CLI Nutzung

```bash
# Repository Discovery
bun run dev -- scan --root "J:/dev/quellen" --max-depth 4 --scan-cache

# Profile Discovery (inkl. Submodule)
bun run dev -- scan --root "J:/dev/quellen" --profiles --profile-filter dev --json

# Build ausführen (parallel vorbereitet)
bun run dev -- build --root "J:/dev/quellen" --goals "clean install" --max-parallel 4

# Striktes JSON ohne Build-Log-Ausgaben auf stdout (default)
bun run dev -- build --root "J:/dev/quellen" --json > run.json

# Optional: Maven-Ausgaben trotz --json auf stderr durchreichen
bun run dev -- build --root "J:/dev/quellen" --json --verbose > run.json

# Build-Plan ohne Ausführung (Phase 1 Planungslogik)
bun run dev -- build --root "J:/dev/quellen/2025/web" --scope root-only --plan --json

# Explizite Modul-Selektion (BuildScope)
bun run dev -- build --root "J:/dev/quellen" --scope explicit-modules --module shared --module web --json

# Zusätzliche Include/Exclude Filter auf selektierte Module
bun run dev -- build --root "J:/dev/quellen" --scope root-only --include-module web --exclude-module legacy --plan --json

# Pipeline planen/ausführen
bun run dev -- pipeline plan --root "J:/dev/quellen" --pipeline ./pipeline.json --json
bun run dev -- pipeline run --root "J:/dev/quellen" --pipeline ./pipeline.json --json

# JSON-Ausgabe für Integrationen
bun run dev -- scan --root "J:/dev/quellen" --json
```

## Konfiguration

Optional kann eine `gfos-build.config.json` im Projektverzeichnis liegen.
Ein Beispiel liegt in [`gfos-build.config.example.json`](gfos-build.config.example.json).

Beispiel:

```json
{
  "roots": ["J:/dev/quellen"],
  "scan": { "maxDepth": 4, "includeHidden": false, "cacheEnabled": true, "cacheTtlSec": 300 },
  "build": { "goals": ["clean", "install"], "mavenExecutable": "mvn", "failFast": true, "maxParallel": 4 }
}
```

CLI-Parameter überschreiben die Config.

## Nächste Ausbaustufen

1. Build-Profile & Selektionsregeln (Include/Exclude)
2. JDK-Matrix und Context-Switching
3. Parallel Build Queue mit Resource Limits
4. Persistente Job-Historie + Reports
5. UI-Schicht (TUI/GUI/Web) auf derselben Core-Logik

Mehr technische Hintergründe: [`docs/TECH_DECISIONS.md`](docs/TECH_DECISIONS.md).

Architektur-Blueprint (inkl. UI-vs-CLI Strategie): [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
Konkrete Priorisierung der nächsten Umsetzungsschritte: [`docs/NEXT_STEPS.md`](docs/NEXT_STEPS.md).
Ausführlicher Entwicklungsleitfaden für kommende Features & UI-Fähigkeit: [`docs/DEVELOPER_GUIDE.md`](docs/DEVELOPER_GUIDE.md).
Strategie für veröffentlichte Online-Dokumentation: [`docs/ONLINE_DOCS_STRATEGY.md`](docs/ONLINE_DOCS_STRATEGY.md).
Priorisierter Feature-Audit-Backlog: [`docs/FEATURE_AUDIT_BACKLOG.md`](docs/FEATURE_AUDIT_BACKLOG.md).


## Run-Report (versioniert)

Die JSON-Ausgabe liefert ab Phase 1 einen versionierten Report (`schemaVersion: "1.0"`) inkl.
- Laufzeitmetadaten (`startedAt`, `finishedAt`, `durationMs`),
- optionalem `buildPlan` für `build --plan`,
- Modulgraph (`moduleGraph`) für Root/Submodule-Beziehungen,
- Event-Liste (`events`) als Contract für interaktive Oberflächen,
- optionalem Profile-Report (`profileScan`) für Maven-Profile über Module/Submodule,
- aggregierten Kennzahlen unter `stats` (discovered/planned/built/succeeded/failed/totalBuildDurationMs/failedBuildDurationMs/maxParallelUsed/profileCount).


## Pipeline-Format (Phase 2 MVP)

Beispiel `pipeline.json`:

```json
{
  "schemaVersion": "1.0",
  "mavenExecutable": "mvn",
  "stages": [
    { "name": "shared", "scope": "explicit-modules", "modules": ["shared"], "goals": ["clean", "install"] },
    { "name": "web", "scope": "root-only", "goals": ["verify"] }
  ]
}
```


## Hinweis zu `discovered` vs. `moduleGraph.rootModules`

- `discovered` enthält **alle** gefundenen Maven-Module (inkl. Submodule).
- `moduleGraph.rootModules` enthält nur Top-Level-Module ohne Parent.
- Für BuildScope `root-only` werden ausschließlich `rootModules` als Startpunkte genutzt.

## Speicherorte (Best Practice)

- `gfos-build.config.json`: standardmäßig im aktuellen Arbeitsverzeichnis (alternativ über `--config <path>`).
- Discovery-Cache: im Nutzer-Cache-Verzeichnis des Betriebssystems, nicht neben dem Binary.
  - Windows: `%LOCALAPPDATA%\GFOS-Build\cache`
  - macOS: `~/Library/Caches/gfos-build`
  - Linux: `${XDG_CACHE_HOME:-~/.cache}/gfos-build`
