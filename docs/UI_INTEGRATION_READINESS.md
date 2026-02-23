# UI Integration Readiness (ohne Frontend-Fachlogik)

Dieses Dokument definiert den Übergabepunkt vom stabilen Core zur späteren Oberfläche.

## 1) Stabiler Contract

UI nutzt ausschließlich den Run-Report `schemaVersion: "1.1"` als Snapshot-Quelle:
- `command`, `mode`, `durationMs`
- `stats` inkl. Discovery-/Cache-Metriken
- `events` als Laufzeit-Timeline
- optional `selectionExplanation` für Explain-Ansicht

Schema-Quelle: `assets/contracts/run-report.v1.1.schema.json`.

## 2) Event-Stream-Konzept

Bis eine dedizierte Streaming-API existiert, gilt:
- `events[]` im Report ist die referenzierte Event-Historie.
- CLI kann Events zusätzlich als NDJSON ausgeben (`--events-ndjson`, Ausgabe nach `stderr`), sodass UI-Adapter früh integriert werden können ohne Report-Contract zu brechen.
- Event-Typen mit UI-Relevanz:
  - `run_started`
  - `discovery_completed`
  - `plan_created`
  - `module_started` / `module_finished`
  - `stage_started` / `stage_finished`
  - `selection_explained`
  - `pipeline_lint_issue`
  - `run_finished`

## 3) Referenz-Flows für UI

### A) Scan-Flow
1. Nutzer startet Scan.
2. UI zeigt Discovery-Fortschritt über `events`.
3. UI rendert `moduleGraph` + `stats.discoveryRoots`.

### B) Build-Plan-Flow
1. Nutzer wählt Scope/Selektoren.
2. UI ruft Build im `--plan`-Modus.
3. UI zeigt `buildPlan` + optional `selectionExplanation`.

### C) Pipeline-Lint-Flow
1. Nutzer lädt Pipeline-Definition.
2. UI ruft `pipeline lint` auf.
3. UI zeigt `pipeline.lintIssues` nach `severity` und `path`.

### D) Build-/Pipeline-Run-Flow
1. Nutzer startet Run.
2. UI zeigt Timeline aus `events`.
3. UI zeigt Abschlusswerte aus `stats` und ggf. `comparison`.

## 4) UI-Start-Checklist

- [ ] Report-Schema wird im UI-Projekt validiert (build-time + runtime).
- [ ] Mapping `mode -> UI View` ist definiert.
- [ ] Fehlercodes (`2/3/4`) sind in UX-Fehlerzuständen hinterlegt.
- [ ] `selectionExplanation` und `pipeline.lintIssues` werden lesbar dargestellt.
- [ ] Keine neue Fachlogik im Frontend (nur Darstellung/Interaktion).
