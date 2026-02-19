# TECH DECISIONS — Foundation Reset

## Ziel

Ein sauberer und langlebiger Startpunkt für ein Maven-Orchestrierungs-Tool, das später umfangreiche Features erhält.

## Entscheidungsübersicht

## 1) Runtime & Language
- **TypeScript (strict)** für robuste, evolvierbare Domänenlogik.
- **Bun** für schnelle lokale Iteration und CI-Laufzeiten.

## 2) Architektur
- **`core`**: reine Fachlogik ohne I/O-Abhängigkeiten.
- **`infrastructure`**: Node-gebundene Implementierungen (FS/Process/Persistenzadapter).
- **`application`**: Orchestrierung von Discovery + Build + Config + Pipelines.
- **`cli`**: Ein-/Ausgabe, Mapping von Flags auf Application Inputs.

Diese Trennung erlaubt später UI-, API- oder Worker-Schichten ohne Rewrites.

## 3) Konfigurationsstrategie
- Zod-validierte Konfiguration via `gfos-build.config.json`.
- CLI-Flags überschreiben Konfigurationswerte.
- Defaults sind konservativ und produktionsnah.

## 4) Discovery-Regeln (aktualisiert für tiefe Modulstrukturen)
- Buildbar = `pom.xml` im Verzeichnis.
- Discovery modelliert **Modulhierarchien** (Root/Children/Submodule), nicht nur flache Treffer.
- Git-Repositories und Maven-Module können unterschiedliche Grenzen haben und werden getrennt betrachtet.
- Hidden-Verzeichnisse standardmäßig aus.
- Begrenzte Traversierung über `maxDepth`.
- Mehrere Roots werden unterstützt.

## 5) Build-Regeln (aktualisiert)
- Build-Ausführung orientiert sich an einem **BuildScope**:
  - `root-only` (Hauptmodul triggert Children),
  - `explicit-modules`,
  - `auto`.
- Baseline bleibt reproduzierbar/sequentiell, wird aber für kontrollierte Parallelisierung vorbereitet.
- `failFast` standardmäßig aktiv.
- Maven command/goals vollständig parametrisiert.
- Build-Pipelines werden als First-Class-Konzept eingeführt (Stages + Ziele + Fail-Strategie).

## 6) Observability & Contracts
- Versionierte JSON-Run-Reports als stabiler Persistenz-/Export-Contract.
- Zusätzlich Live-Event-Modell für interaktive Oberflächen (Progress ohne stdout-Parsing).
- Keine stillen Breaking Changes bei Report- oder Event-Feldern.

## 7) Persistenz- und Mehrnutzerstrategie
- Primär lokale Persistenz pro Nutzerprofil (Runs, Pipeline-Definitionen, Caches).
- Optional zentrale Ablage für Teamnutzung (Share oder Service), bevorzugt service-basiert bei wachsender Nutzerzahl.
- Persistenzschicht als Infrastrukturadapter, damit Speicherbackend austauschbar bleibt.

## 8) CI/CD & Distribution
- Strikte Quality-Gates: `lint`, `typecheck`, `test`, `build`.
- Zusätzlicher Windows-Binary-Build/Smoke-Job auf der Zielplattform.
- Standalone Distribution via `bun build --compile` mit Windows-Target (`bun-windows-x64-modern`).
- ZIP-Distribution auf Netzlaufwerk ist möglich, aber perspektivisch durch kontrollierten Update-Kanal ersetzen.

## 9) Erweiterbarkeit
Die Foundation ist vorbereitet für:
- Filter/Selection Engine,
- Profile/JDK-Mappings,
- Queue + Parallelism,
- Pipeline-Orchestrierung,
- JSON Reports + Event-Streams,
- UI-Schichten auf stabiler Application/Core-Basis.

## 10) CLI und UI Koexistenzstrategie
- Standardweg: Shared Application/Core, mehrere Adapter (CLI jetzt, UI später).
- Keine primäre UI->CLI-Subprocess-Kopplung für Kernlogik.
- Falls UI ein separater Prozess wird, sollte sie eine interne API/Service-Schicht gegen dieselbe Application-Logik nutzen.
