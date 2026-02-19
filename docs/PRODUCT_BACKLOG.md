# Product Backlog (Top 10, technisch + produktseitig priorisiert)

Diese Liste kombiniert **Produktnutzen**, **technisches Risiko**, **UI-Readiness** und **Implementierungsaufwand**.

## P0 — jetzt als Nächstes

## 1) Build Queue + Resource Limits
**Ziel:** Stabilere Laufzeiten unter Last, keine Ressourcenspitzen.  
**Technik:** Queue-Strategie (FIFO/Priority), harte Limits (`maxParallel`, optional CPU/RAM-Grenzen), Backpressure.  
**Produktwirkung:** Vorhersagbare Build-Dauer in großen Workspaces.

## 2) Run-Report Contract v1.1 + JSON Schema
**Ziel:** UI/API können sich sicher an einen verifizierten Contract hängen.  
**Technik:** JSON-Schema für Reports je Modus, Pflichtfeldtests, additive Versionierungsregeln.  
**Produktwirkung:** Weniger Integrationsfehler, klarere Release-Kommunikation.

## 3) Persistente Run-Historie + Vergleichsansicht
**Ziel:** Messbarkeit von Performance-Änderungen (vorher/nachher).  
**Technik:** Lokaler History-Store, Run-Index, Delta-Berechnung pro Modul/Run.  
**Produktwirkung:** Transparenz bei Regressions und Optimierungen.

## P1 — Stabilisierung & Erweiterung

## 4) Failure Taxonomy + Error Codes
**Ziel:** Schnellere Diagnose, bessere Automatisierung.  
**Technik:** Einheitliche Fehlerklassen (Usage/Config/Discovery/Build/Pipeline), dokumentierte Exit-/Error-Codes.  
**Produktwirkung:** Besseres Troubleshooting auf Zielsystemen.

## 5) Deterministische Modul-Selektion v2
**Ziel:** Kein Überraschungsverhalten bei `explicit-modules` + Filtern.  
**Technik:** Präzisere Selector-Sprache (`exact`, `path`, `glob`) + optionaler Explain-Mode.  
**Produktwirkung:** Reproduzierbare Build-Pläne.

## 6) Discovery Performance Audit + Incremental Scan
**Ziel:** Deutlich schnellere Discovery in Monorepos.  
**Technik:** Inkrementeller Scan (mtime/hash), bessere Cache-Invaliderung, Discovery-Metriken pro Pfad.  
**Produktwirkung:** Kürzere Feedback-Loops.

## 7) Profile/JDK Matrix Planung
**Ziel:** Enterprise-Szenarien sauber abdecken.  
**Technik:** Profile/JDK-Kontext je Stage/Modul, Konfliktregeln.  
**Produktwirkung:** Weniger Build-Fehler durch Umgebungsdifferenzen.

## P2 — Produktivität & Scale

## 8) Pipeline UX Hardening
**Ziel:** Schnellere Einrichtung von `pipeline.json`, weniger Trial-and-Error.  
**Technik:** Präzise Validierungsfehler mit Feldpfaden, optional `pipeline lint` Command.  
**Produktwirkung:** Höhere Erfolgsquote beim Onboarding.

## 9) Online Docs (veröffentlicht + versioniert)
**Ziel:** Docs als verlässliche Referenz für Nutzer & künftige UI-Teams.  
**Technik:** MkDocs Material, GitHub Pages Deploy via CI, PR-Linkcheck/Preview, Versionierung pro Release.  
**Produktwirkung:** Weniger Supportfragen, schnellere Einarbeitung.

## 10) UI Integration Readiness Pack
**Ziel:** UI-Start ohne Kern-Refactor.  
**Technik:** Event-Stream-Doku, State-Snapshots je Run-Mode, Referenz-Flows.  
**Produktwirkung:** Schnellere Time-to-Value bei UI-Umsetzung.

---

## Umsetzungsreihenfolge

1. **P0:** #1, #2, #3  
2. **P1:** #4, #5, #6, #7  
3. **P2:** #8, #9, #10

## Definition of Ready (pro Item)

- Zielmetrik definiert (z. B. Buildzeit, Fehlerrate, Durchsatz)
- Contract-Impact dokumentiert (`schemaVersion`-Bewertung)
- Testplan vorhanden (Unit + Integration + Binary Smoke)
- Doku-Update im Scope
