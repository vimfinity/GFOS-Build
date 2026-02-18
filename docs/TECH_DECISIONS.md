# TECH DECISIONS — Foundation Reset

## Ziel

Ein sauberer und langlebiger Startpunkt für ein Maven-Orchestrierungs-Tool, das später umfangreiche Features erhält.

## Entscheidungsübersicht

## 1) Runtime & Language
- **TypeScript (strict)** für robuste, evolvierbare Domänenlogik.
- **Bun** für schnelle lokale Iteration und CI-Laufzeiten.

## 2) Architektur
- **`core`**: reine Fachlogik ohne I/O-Abhängigkeiten.
- **`infrastructure`**: Node-gebundene Implementierungen (FS/Process).
- **`application`**: Orchestrierung von Discovery + Build + Config.
- **`cli`**: Ein-/Ausgabe, Mapping von Flags auf Application Inputs.

Diese Trennung erlaubt später UI-, API- oder Worker-Schichten ohne Rewrites.

## 3) Konfigurationsstrategie
- Zod-validierte Konfiguration via `gfos-build.config.json`.
- CLI-Flags überschreiben Konfigurationswerte.
- Defaults sind konservativ und produktionsnah.

## 4) Discovery-Regeln (Lessons Learned)
- Buildbar = `pom.xml` im Verzeichnis.
- Stop unterhalb gefundener Repositories (kein Untermodul-Lärm).
- Hidden-Verzeichnisse standardmäßig aus.
- Begrenzte Traversierung über `maxDepth`.
- Mehrere Roots werden unterstützt.

## 5) Build-Regeln
- Sequentielles Baseline-Building (einfach debugbar, stabil).
- `failFast` standardmäßig aktiv.
- Maven command/goals vollständig parametrisiert.

## 6) CI/CD & Distribution
- Strikte Quality-Gates: `lint`, `typecheck`, `test`, `build`.
- Zusätzlicher Windows-Binary-Build/Smoke-Job auf der Zielplattform.
- Standalone Distribution via `bun build --compile` mit Windows-Target (`bun-windows-x64-modern`), damit Zielsysteme ohne Node/npm/Bun das Tool direkt ausführen können.

## 7) Erweiterbarkeit
Die Foundation ist vorbereitet für:
- Filter/Selection Engine
- Profile/JDK-Mappings
- Queue + Parallelism
- JSON Reports/Observability
- UI-Schichten auf stabiler Application/Core-Basis


## 8) CLI und UI Koexistenzstrategie
- Standardweg: Shared Application/Core, mehrere Adapter (CLI jetzt, UI später).
- Keine primäre UI->CLI-Subprocess-Kopplung für Kernlogik.
- Falls UI ein separater Prozess wird, sollte sie eine interne API/Service-Schicht gegen dieselbe Application-Logik nutzen.
