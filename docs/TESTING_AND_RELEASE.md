# Testing & Release Strategy (No Node Runtime on Target)

## Warum das wichtig ist
Das Zielsystem hat weder npm, Node.js noch Bun. Deshalb muss GFOS Build als ausführbares Standalone-Binary geliefert und getestet werden.

## Ebenen

## 1. Unit + Static Checks
- `bun run check`
- Enthält Lint, Typecheck, Unit Tests und TS Build.

## 2. Binary Build
- `bun run binary:build`
- Erzeugt immer das Windows-Binary: `release/gfos-build.exe`.
- Optional lokal: `bun run binary:build:native` für Host-OS-Binary (nur für lokale Smoke-Tests).

## 3. Binary Smoke-Test
- `bun run binary:smoke`
- Führt das echte Binary gegen Fixture-Repositories aus und validiert JSON-Output.

## 4. CI Plattformabdeckung
- Windows Build/Smoke in GitHub Actions (Zielplattform).
- Upload des Windows-Binärartefakts.

## 5. Zielsystem-Akzeptanztest
Empfehlung vor Rollout:
1. Binary vom CI-Artifact herunterladen.
2. Auf Zielsystem kopieren.
3. Testaufruf:
   - `gfos-build.exe scan --root <workspace-root> --json`
4. Danach Build-Test:
   - `gfos-build.exe build --root <workspace-root> --goals "clean install"`


## 3b. CLI-Integrationstests mit synthetischen Workspaces
- Integrationstests erzeugen zur Laufzeit temporäre Maven-Workspace-Strukturen (inkl. verschachtelter Module) und führen die CLI dagegen aus.
- Für Build-Tests wird ein Mock-Maven-Executable genutzt, damit das Verhalten reproduzierbar ohne echte Maven-Installation geprüft wird.
- Validiert werden dabei insbesondere:
  - `build --plan` führt **keinen** Maven-Prozess aus,
  - `build --json` liefert konsistente Stats und Report-Felder (`schemaVersion`, `mode`, `stats`).
