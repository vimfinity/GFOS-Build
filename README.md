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
bun run dev -- scan --root "J:/dev/quellen" --max-depth 4

# Build ausführen
bun run dev -- build --root "J:/dev/quellen" --goals "clean install"

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
  "scan": { "maxDepth": 4, "includeHidden": false },
  "build": { "goals": ["clean", "install"], "mavenExecutable": "mvn", "failFast": true }
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
