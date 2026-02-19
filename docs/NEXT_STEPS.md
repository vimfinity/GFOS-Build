# Next Steps: Build-Strategie für tiefe Maven-Modulbäume

## Ausgangslage (ergänzt)
- In realen GFOS-Strukturen existieren **tiefe Modulhierarchien** (Root-Modul mit vielen Child-/Sub-Modules).
- Ein Build wird häufig auf dem **Hauptmodul** gestartet, das seine Children selbst baut.
- Zusätzlich gibt es Bedarf für **Build-Pipelines** (z. B. `shared -> hg -> web`) mit sequentiellen Stages.
- Ziel bleibt: maximale Geschwindigkeit **ohne** funktionale Drift zwischen CLI und späterer UI.

## Leitentscheidung
**Zuerst Build-Run-Modell + Planungslogik konsolidieren, dann gezielt ausrollen (CLI zuerst, UI danach als Adapter).**

Warum:
1. Ohne korrektes Modell für Root-/Submodule sind Performance-Maßnahmen unpräzise.
2. Pipeline-Funktionalität muss im Core/Application liegen, damit CLI und UI identisch arbeiten.
3. Observability (Reports/Events) ist Voraussetzung für belastbare Optimierungen.

## Fachliches Zielmodell (neu)

### 1) Discovery als Graph statt flache Liste
Discovery liefert nicht nur Treffer, sondern eine Struktur mit:
- `rootCandidates` (top-level Build-Startpunkte),
- `childModules` (inkl. Tiefe/Parent-Bezug),
- optionalen Repository-Grenzen (Git-Root),
- Kennzeichnung, ob ein Modul eigenständig ausführbar ist.

### 2) Build-Scope pro Run
Ein Build-Run bekommt explizit einen Scope:
- `root-only`: nur selektierte Hauptmodule starten (Maven baut Children selbst),
- `explicit-modules`: gezielte Untermodule starten,
- `auto`: heuristisch (z. B. bei erkannter Multi-Module-Topologie bevorzugt Root).

### 3) Pipeline als First-Class Feature
Pipeline-Definition mit Stages:
- jede Stage enthält Modul-Selektion + Maven-Goals,
- Stages laufen sequentiell,
- innerhalb einer Stage optional parallel (konfigurierbar),
- Fail-Strategie pro Stage (`fail-fast` / `continue`).

## JSON für zukünftige interaktive Oberflächen: Bewertung

JSON bleibt sinnvoll, aber nicht als einziges Kommunikationsmuster.

### Empfehlung
1. **JSON-Reports als persistenter Contract** beibehalten (CLI, Auditing, Export, CI).
2. Für interaktive UI zusätzlich **Event-Stream/Progress-API** bereitstellen:
   - z. B. NDJSON über stdout, SSE oder lokaler IPC-Socket,
   - Events: `run_started`, `stage_started`, `module_finished`, `run_finished`.
3. Ergebnis: UI erhält Live-Status ohne Parsing-Hacks; JSON-Report bleibt finale Wahrheit.

## Persistenzstrategie (mehrere Nutzer, späterer Rollout)

## Grundsatz
Persistenz zweistufig aufbauen:
1. **lokal pro Nutzer** (robust, offline-fähig),
2. optional **zentral/geteilt** für Team-Transparenz.

### Stufe A (kurzfristig): lokale Persistenz
- Speicherort pro User-Profil (plattformabhängig, nicht im Installationsordner).
- Artefakte:
  - `runs/*.json` (Run-Reports),
  - `pipelines/*.json` (Pipeline-Definitionen),
  - optional Cache/Indizes.
- Vorteil: keine Rechteprobleme bei ZIP-Distribution auf Netzlaufwerk.

### Stufe B (mittelfristig): zentraler Speicher (optional)
- Optionen: SMB-Share mit lock-sicherem Write-Protokoll **oder** kleiner zentraler Service (empfohlen bei vielen Nutzern).
- Empfehlung ab Team-Skalierung: service-basierte Ablage (z. B. REST + DB), weil:
  - bessere Konfliktkontrolle,
  - Berechtigungen/Audit einfacher,
  - konsistente Historie/Reporting.

## Distribution: ZIP auf Netzlaufwerk vs. bessere Optionen

ZIP auf Netzlaufwerk ist als Start praktikabel, aber mit Risiken:
- manuelle Updates,
- Version-Drift zwischen Nutzern,
- potenzielle Datei-Locks/AV-Interferenzen.

### Empfohlener Pfad
1. **Kurzfristig:** signierte Versionen + klarer Update-Hinweis beim Start.
2. **Mittelfristig:** zentraler Update-Mechanismus (z. B. interner Paketfeed oder Auto-Update-Manifest).
3. **Langfristig:** Installer/Paketierung pro Zielplattform mit Rollback-Fähigkeit.

## Konkreter Umsetzungsplan (nächste Iterationen)

### Phase 1 — Build-Run-Modell und Contracts
1. Discovery-Domain auf Modulgraph erweitern.
2. `BuildScope` + `BuildPlan` als Application-Modelle einführen.
3. Versioniertes JSON-Run-Report-Schema (`schemaVersion`) definieren.
4. Event-Modell für Live-Fortschritt spezifizieren.

### Phase 2 — Pipeline-MVP
1. Pipeline-Dateiformat (JSON) inkl. Stage-Definition.
2. CLI-Kommandos:
   - `pipeline plan`
   - `pipeline run`
3. Tests für Reihenfolge/Fail-Strategien/Nested-Module-Szenarien.

### Phase 3 — Performance & Ressourcen
1. Stage-interne Parallelisierung mit Limits (`maxParallel`).
2. Baseline vs. Optimiert messbar machen (Dauer pro Stage/Modul).
3. Optionale Discovery-Caches für große Verzeichnisbäume.

### Phase 4 — UI-Readiness
1. UI konsumiert Application-API + Event-Stream, nicht CLI-Parsing.
2. Reuse derselben Pipeline- und BuildPlan-Contracts.
3. Read-only Dashboard (Runs, Stages, Fehlerbilder), danach Steuerung.

## Definition of Done für den nächsten realen Meilenstein
- Modulgraph-Discovery für tiefe Strukturen ist implementiert und getestet.
- Build-Scope (`root-only`/`explicit-modules`/`auto`) ist über CLI wählbar.
- Pipeline-MVP kann mindestens `shared -> hg -> web` reproduzierbar ausführen.
- Run-Reports sind versioniert und für spätere UI auswertbar.


## Backlog-Update (aktueller Stand)

Erledigt in der aktuellen Basis:
- Modulgraph-Discovery + BuildScope (`root-only` / `explicit-modules` / `auto`)
- Pipeline Plan/Run + Run-Reports + Events
- Discovery-Cache + Dauer-Metriken
- JDK/Maven Toolchain-Basis (`javaHome`, `mavenExecutable`, modulbezogene Toolchain-Regeln)

Neu priorisiert für die nächsten Iterationen:
1. **Build Queue + Resource Limits (P0)**
2. **Run-Report v1.1 + JSON Schema (P0)**
3. **Persistente Run-Historie + Vergleich (P0)**
4. **Failure Taxonomy + Error Codes (P1)**
5. **Deterministische Modul-Selektion v2 (P1)**
6. **Incremental Discovery + Performance Audit (P1)**
7. **Pipeline UX Hardening inkl. `pipeline lint` (P2)**
8. **UI Integration Readiness Pack (P2)**

Hinweis: Eine Online-Doku-Plattform (z. B. Next.js/Fumadocs) wird bewusst nach Stabilisierung der Kernfeatures umgesetzt.
