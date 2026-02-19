# Feature-Audit-Backlog (Top 10)

Priorisiert nach **Impact (Produkt + Technik)**, **Risiko-Reduktion**, **UI-Vorbereitung** und **Implementierungsaufwand**.

## 1) Build Queue + Resource Limits (P0)
**Nutzen:** Kontrollierte Parallelisierung, stabile Laufzeiten unter Last.  
**Technik:** Queue-Strategie (FIFO/Priority), `maxParallel`, CPU/Memory-Limits, Backpressure.  
**Produkt:** Vorhersagbarere Builds in großen Workspaces.

## 2) Standardisierter Run-Report v1.1 mit Contract-Schema (P0)
**Nutzen:** Sichere UI/API-Integration ohne Parser-Risiko.  
**Technik:** JSON-Schema/Type-Tests, Pflichtfelder pro Modus, Kompatibilitätsregeln.  
**Produkt:** Weniger Integrationsfehler, klare Upgrade-Pfade.

## 3) Persistente Run-Historie + Vergleichsansichten (P0)
**Nutzen:** Messbarkeit "vorher/nachher" für Performance-Optimierung.  
**Technik:** History-Store (lokal), Run-Index, Delta-Berechnung.  
**Produkt:** Sichtbarkeit von Regressions und Optimierungseffekten.

## 4) Failure Taxonomy + Error Codes (P1)
**Nutzen:** Schnellere Ursachenanalyse und bessere Supportbarkeit.  
**Technik:** Einheitliche Fehlerklassen (Config, Discovery, Build, Pipeline, Usage), dokumentierte Codes.  
**Produkt:** Klare Nutzerführung und zuverlässige Automatisierung.

## 5) Profile/JDK Matrix Planung (P1)
**Nutzen:** Realistische Enterprise-Build-Szenarien abbilden.  
**Technik:** Modellierung von Profilen + JDK-Kontext je Stage/Modul.  
**Produkt:** Höhere Trefferquote für reale Projekte und CI-Flows.

## 6) Deterministische Modul-Selektion v2 (P1)
**Nutzen:** Weniger Überraschungen bei `explicit-modules` + Filtern.  
**Technik:** Präzisere Selector-Sprache (exact/path/glob), explain-mode für Selektion.  
**Produkt:** Bessere Bedienbarkeit und reproduzierbare Plans.

## 7) Discovery Performance Audit + Incremental Scan (P1)
**Nutzen:** Deutlich schnellere Scans in großen Monorepos.  
**Technik:** Incremental Discovery, Cache-Invaliderung nach Änderungszeit/Hash, Metriken je Pfad.  
**Produkt:** Schnellere Feedback-Zyklen.

## 8) Pipeline UX Hardening (P2)
**Nutzen:** Weniger Fehlkonfigurationen in `pipeline.json`.  
**Technik:** Validierungsfehler mit konkretem Pfad, Lint-Command für Pipeline-Dateien.  
**Produkt:** Schnellere Einrichtung und weniger Trial-and-Error.

## 9) Online Docs + Docs-as-Code Automation (P2)
**Nutzen:** Skalierbares Onboarding und weniger Wissen in Köpfen.  
**Technik:** Statische Docs-Site, Versionierung, PR-Preview, Link-Checks.  
**Produkt:** Besseres Self-Service für Nutzer und künftige UI-Teams.

## 10) UI Integration Readiness Pack (P2)
**Nutzen:** Reibungsloser Start einer Oberfläche ohne Kern-Refactor.  
**Technik:** Event-Stream-Dokumentation, state snapshots, referenzierte Example-Flows.  
**Produkt:** Schnellere Time-to-Value beim UI-Aufbau.

---

## Empfohlene Reihenfolge (Roadmap)

1. **P0 zuerst:** #1, #2, #3  
2. **Dann Stabilisierung:** #4, #6, #7  
3. **Erweiterungen:** #5, #8, #9, #10

## Definition of Ready pro Backlog-Item

- Ziel-Metrik definiert (z. B. Buildzeit, Fehlerquote, Durchsatz).
- Contract-Impact dokumentiert (inkl. `schemaVersion`-Bewertung).
- Testplan vorhanden (Unit + Integration + ggf. Binary Smoke).
- Doku-Anpassung vorab geplant.
