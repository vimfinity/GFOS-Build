# Online Docs Strategy

Dieses Dokument beschreibt, wie GFOS Build von lokalen Markdown-Dokumenten zu einer stabilen, versionierten Online-Dokumentation entwickelt wird.

## Ziele

1. **Single Source of Truth** für Nutzer- und Entwicklerdoku.
2. **Versionierte Doku** passend zu `schemaVersion` und Releases.
3. **UI-Readiness**: API/JSON-Contracts müssen online schnell auffindbar sein.
4. **Niedrige Wartungskosten** zwischen CLI, späterer UI und Team-Onboarding.

## Empfohlener Stack (bewährt)

- **Docusaurus** oder **MkDocs Material** als statischer Docs-Generator.
- Hosting über **GitHub Pages** oder **Cloudflare Pages**.
- Automatischer Build/Deploy bei Merge auf `main`.
- Link-Check + Markdown-Lint als CI-Gate.

## Informationsarchitektur (IA)

1. **Getting Started**
   - Installation
   - Quickstart
   - Zielsystem-Tests
2. **CLI Reference**
   - Befehle + Flags
   - Exit-Codes
   - Beispiele
3. **Run Report Contract**
   - Feldbeschreibung
   - `schemaVersion`
   - Kompatibilitätsregeln
4. **Pipeline Guide**
   - `pipeline.json` Schema
   - Plan/Run Semantik
5. **Developer Guide**
   - Architektur, DoD, Teststrategie
6. **Release Notes / Changelog**

## Mindestumfang für v1 (2-3 Iterationen)

### Iteration 1 (Basis)
- Veröffentlichung der vorhandenen `README.md` + `docs/*` Inhalte als Online-Site.
- Feste URLs für:
  - Run-Report-Contract
  - CLI-Flags
  - Pipeline-Format

### Iteration 2 (Qualität)
- Versionierte Doku pro Release-Tag.
- Automatische Prüfung auf kaputte Links und fehlende Seiten.
- "What changed"-Sektion je Release.

### Iteration 3 (UI-Vorbereitung)
- Eigene Seite "Contracts" inkl. JSON-Beispielen pro Modus (`scan`, `build-plan`, `build-run`, `pipeline-plan`, `pipeline-run`).
- Migration Guide bei Contract-Änderungen.

## Governance (Best Practice)

- Jede PR mit Contract-/CLI-Änderung muss die Online-Doku aktualisieren.
- Keine stillen Breaking Changes ohne Changelog + Migrationshinweis.
- Doku-Review ist Teil der Definition of Done.

## CI/CD Vorschlag für Docs

1. `markdownlint` / Link-Checker laufen bei jedem PR.
2. Preview-Deployment für PRs.
3. Merge auf `main` deployed automatisch die produktive Docs-Site.

## Erfolgsmetriken

- Zeit bis zum erfolgreichen ersten Scan/Build (TTFS = time to first success).
- Anzahl Support-Rückfragen zu CLI/JSON-Contract.
- Anteil PRs mit vollständigem Doku-Update.
