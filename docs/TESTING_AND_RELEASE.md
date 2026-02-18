# Testing & Release Strategy (No Node Runtime on Target)

## Warum das wichtig ist
Das Zielsystem hat weder npm, Node.js noch Bun. Deshalb muss GFOS Build als ausführbares Standalone-Binary geliefert und getestet werden.

## Ebenen

## 1. Unit + Static Checks
- `bun run check`
- Enthält Lint, Typecheck, Unit Tests und TS Build.

## 2. Binary Build
- `bun run binary:build`
- Erzeugt `release/gfos-build` bzw. `release/gfos-build.exe`.

## 3. Binary Smoke-Test
- `bun run binary:smoke`
- Führt das echte Binary gegen Fixture-Repositories aus und validiert JSON-Output.

## 4. CI Plattformabdeckung
- Linux + Windows Build/Smoke in GitHub Actions.
- Upload der Binärartefakte pro OS.

## 5. Zielsystem-Akzeptanztest
Empfehlung vor Rollout:
1. Binary vom CI-Artifact herunterladen.
2. Auf Zielsystem kopieren.
3. Testaufruf:
   - `gfos-build.exe scan --root <workspace-root> --json`
4. Danach Build-Test:
   - `gfos-build.exe build --root <workspace-root> --goals "clean install"`
