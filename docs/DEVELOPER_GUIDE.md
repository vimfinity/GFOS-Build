# Developer Guide

Dieser Guide ist die operative Grundlage, um GFOS Build sicher weiterzuentwickeln (inkl. späterer UI/API-Schichten) ohne Contract-Brüche.

## 1) Architekturprinzipien

- **Single Source of Truth für Fachlogik**: Selektions-, Planungs-, Ausführungslogik nur in `src/core` und `src/application`.
- **CLI ist Adapter**: Parsing, Ausgabe, Exit-Codes in `src/cli`, keine Fachlogik-Duplikation.
- **Infrastruktur abstrahieren**: Dateisystem, Prozesse, Caching in `src/infrastructure`.
- **JSON Contract ist stabil**: Neue Felder nur additiv, bestehende Felder nicht still ändern.

## 2) Entwicklungspfad für neue Features

1. Contract/Typen zuerst in `src/core/types.ts` definieren.
2. Use-Case in `src/application/orchestrator.ts` implementieren.
3. Infrastruktur ggf. über neue Adapter/Interfaces in `src/infrastructure` anbinden.
4. CLI nur für neue Parameter + Ausgabe erweitern (`src/cli/*`).
5. Tests ergänzen:
   - Unit (Core/Application)
   - CLI-Integration
   - optional Binary-Smoke relevante Pfade
6. Doku synchronisieren (`README.md`, `docs/*`).

## 3) Logging-Modi (Best Practice)

- `--json` ist **strict machine output** auf stdout.
- Build-Tool-Ausgaben werden standardmäßig unterdrückt, um JSON nicht zu beschädigen.
- Mit `--verbose` werden Maven-Ausgaben nach stderr weitergeleitet.
- Für Textmodus ist verbose standardmäßig aktiv.

## 4) Run-Report Contract

Pflichtfelder, auf die UI/API sicher bauen darf:

- Meta: `schemaVersion`, `command`, `mode`, `startedAt`, `finishedAt`, `durationMs`
- Discovery: `discovered`, `moduleGraph`
- Observability: `events`, `stats`
- Optional je Modus: `buildPlan`, `buildResults`, `pipeline`, `profileScan`

Aktuelle Stats:
- `discoveredCount`, `plannedCount`, `builtCount`, `succeededCount`, `failedCount`
- `totalBuildDurationMs`, `failedBuildDurationMs`
- `maxParallelUsed`, `profileCount`

## 5) Teststrategie für Feature-Arbeit

Vor jedem Merge:

1. `bun run check`
2. Bei CLI/Binary-relevanten Änderungen zusätzlich:
   - `bun run binary:build:native`
   - `bun run binary:smoke`
3. Bei Contract-Änderungen:
   - explizite Tests auf `schemaVersion`, `mode`, Pflichtfelder, Stats

## 6) Definition of Done (DoD)

Ein Feature ist nur dann „fertig“, wenn:

- Architekturleitplanken eingehalten sind.
- JSON-Contract rückwärtskompatibel bleibt.
- Tests + Typecheck + Build grün sind.
- Doku aktualisiert ist (mind. README + relevante `docs/*`).
- Änderungsimpact auf Zielsystem/Binary klar ist.

## 7) UI-Readiness Checklist

- [ ] Fachlogik vollständig in Core/Application gekapselt
- [ ] Report-Felder eindeutig und versioniert
- [ ] Plan/Run separat modelliert
- [ ] Event-Liste für Progress/Timeline verfügbar
- [ ] Fehlerfälle mit deterministischem Exit-Code + Nachricht

Diese Liste sollte bei jedem größeren Feature-PR geprüft werden.
