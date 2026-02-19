# AGENTS.md

## Projektfokus
GFOS Build wird als **performance-orientierte Build-Orchestrierung** entwickelt. Jede Änderung soll messbar zu mindestens einem dieser Ziele beitragen:
1. schnellere Build-Laufzeiten,
2. höhere Reproduzierbarkeit,
3. geringere Wartungskosten zwischen CLI und späterer Oberfläche.

## Architekturleitplanken (verbindlich)
- **Kein Feature-Duplikat zwischen CLI und UI**: Fachlogik gehört in `src/core` und `src/application`.
- CLI (`src/cli`) bleibt ein dünner Adapter (Parsing, Ausgabe, Exit-Codes).
- Infrastrukturabhängigkeiten (`fs`, Prozesse, Caching, Telemetrie) über `src/infrastructure` kapseln.
- JSON-Ausgaben gelten als stabiler Integrationsvertrag für spätere UI/API-Schichten.

## Priorisierung der nächsten Arbeiten
1. **Infrastruktur für Performance & Observability** (Messbarkeit vor Optimierung):
   - Build-Zeit-Metriken (pro Repo, gesamt, Fehlerpfade)
   - standardisierte Run-Reports (JSON)
   - Vorarbeit für Parallelisierung (Queue-Strategie, Resource-Limits)
2. **CLI nur dort erweitern, wo es UI-fähige Kernfunktionen vorbereitet**:
   - Selektions-/Filterlogik,
   - Profile,
   - dry-run/Plan-Modus.
3. UI erst aufsetzen, wenn Kern-Contracts stabil sind (keine zweite Fachlogik im Frontend).

## Arbeitsmodus für Änderungen
- Erst Domain/Application anpassen, dann CLI-Ausgabe.
- Neue Optionen immer so entwerfen, dass sie 1:1 in einer UI abbildbar sind.
- Bei Performance-Features immer Baseline + Vergleich dokumentieren (vorher/nachher).
- Keine stillen Breaking Changes bei JSON-Feldern.

## Dependency-Management
- Vor Upgrades zunächst Kompatibilitäts- und Migrationsaufwand einschätzen.
- Versionsupdates nur mit anschließendem `bun run check` und (wenn möglich) Binary-Smoke (`bun run binary:build:native && bun run binary:smoke`).
- Wenn externe Registry-Zugriffe in der Umgebung blockiert sind, Upgrade-Versuch und Blocker transparent dokumentieren.
