# UI Readiness Pack

Dieses Paket bereitet die Codebase auf eine kommende Oberfläche vor, ohne Fachlogik aus dem Core zu duplizieren.

## Enthaltene Artefakte

- `assets/ui-readiness/*.report.json`
  - deterministische Beispiel-Reports für:
    - `scan`
    - `build-plan`
    - `build-run`
    - `pipeline-plan`
    - `pipeline-run`
- `apps/ui-readiness/`
  - leichtgewichtiges Referenz-Frontend (read-only), das die Report-Contracts visualisiert.
  - nutzt bestehende Assets (`assets/GFOS_Logo_with_text.svg`) und zeigt Summary/Event/Details.

## Aktualisierung der Beispiel-Reports

```bash
bun run ui:readiness:pack
```

Der Generator nutzt einen synthetischen Workspace + Mock-Maven und schreibt bereinigte Reports (redacted timestamps/durations) nach `assets/ui-readiness`.

## Contract-Regeln für kommende UI

1. UI liest ausschließlich `RunReport` v1.1 (`assets/contracts/run-report.v1.1.schema.json`).
2. CLI bleibt Adapter; Selektion/Planung/Toolchain-Auflösung liegt in `core`/`application`.
3. Events (`run_started`, `plan_created`, `module_finished`, ...) sind die Quelle für Progress-UI.

## Bewertung des vorgesehenen Online-Docs-Stacks

Für spätere veröffentlichte Online-Doku ist der vorgeschlagene Stack sinnvoll:

- **Next.js (App Router)**: etablierte Basis für versionierte Produkt-/Dev-Doku.
- **MDX als Content-Quelle**: docs-as-code, reviewbar im selben Repo.
- **Fumadocs**: gute Navigation/Search/Versioning-Basis für technische Produkte.
- **Tailwind + shadcn/ui + Lucide**: schnell und wartbar für konsistente UI.
- **Shiki**: hochwertiges Syntax-Highlighting für Contracts/CLI-Beispiele.

Empfohlener Rollout: Erst Kernfeatures stabilisieren, dann diese Doku-Plattform aufsetzen und Inhalte aus `docs/*.md` nach MDX migrieren.
