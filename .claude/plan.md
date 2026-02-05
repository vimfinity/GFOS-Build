# GFOS-Build Refactoring Plan

## Overview

Transform the project from a CLI-with-GUI to a pure Electron GUI application with modern best practices.

**Goals:**
- Remove CLI entirely (delete `src/` directory)
- Move `electron/` contents to project root
- Update all dependencies to latest versions
- Split monolithic main.ts into focused services
- Add testing, linting, and improve CI/CD
- Keep the excellent terminal/neon UI design

---

## 1. New Project Structure

```
C:\Code\GFOS-Build\
├── .github/workflows/ci.yml          # Improved CI with caching
├── assets/                           # App icons
├── src/
│   ├── main/                         # Electron main process
│   │   ├── index.ts                  # Slim entry point
│   │   ├── window.ts                 # Window management
│   │   ├── ipc.ts                    # IPC handler registration
│   │   ├── preload.ts                # Context bridge
│   │   └── services/                 # Extracted services
│   │       ├── config.service.ts     # Settings with Zod validation
│   │       ├── workspace.service.ts  # Project/JDK scanning
│   │       ├── build.service.ts      # Maven execution
│   │       ├── process.service.ts    # Process lifecycle
│   │       ├── pipeline.service.ts   # Pipeline management
│   │       ├── cache.service.ts      # Scan caching with TTL
│   │       └── storage.service.ts    # Job/pipeline persistence
│   ├── renderer/                     # React frontend (unchanged structure)
│   │   ├── components/
│   │   ├── views/
│   │   ├── store/
│   │   └── styles/
│   └── shared/                       # Shared code
│       ├── types.ts                  # Unified domain types
│       ├── schemas.ts                # Zod validation schemas
│       └── constants.ts              # App constants
├── tests/                            # Vitest tests
│   ├── setup.ts
│   ├── main/services/
│   └── renderer/store/
├── .eslintrc.cjs                     # ESLint config
├── .prettierrc                       # Prettier config
├── electron-builder.yml              # Build configuration
├── package.json                      # Unified dependencies
├── tailwind.config.ts                # Tailwind v4
├── tsconfig.json                     # Base TypeScript
├── vite.config.ts                    # Vite 6
└── vitest.config.ts                  # Vitest config
```

---

## 2. Dependency Updates

| Package | Current | Target | Notes |
|---------|---------|--------|-------|
| electron | 28.1.0 | **34.0.0** | Latest stable |
| react | 18.2.0 | **19.0.0** | React 19 |
| react-dom | 18.2.0 | **19.0.0** | Matches React |
| vite | 5.0.10 | **6.0.0** | Faster builds |
| tailwindcss | 3.4.0 | **4.0.0** | CSS-first config |
| typescript | 5.3.3 | **5.7.0** | Latest |
| electron-builder | 24.9.1 | **25.1.0** | Latest |
| lucide-react | 0.303.0 | **0.469.0** | More icons |

**New Dependencies:**
- `vitest` - Testing framework
- `@testing-library/react` - React testing
- `happy-dom` - Fast DOM for tests
- `eslint` + plugins - Linting
- `prettier` - Formatting
- `concurrently` - Dev workflow

**Package Manager:** Bun (faster than npm)

---

## 3. Service Architecture

Split the 720-line `main.ts` into focused services:

| Service | Responsibility | Lines ~|
|---------|----------------|--------|
| `config.service.ts` | Settings load/save with Zod validation | 80 |
| `workspace.service.ts` | Project/JDK/module scanning | 200 |
| `build.service.ts` | Maven execution, progress tracking | 150 |
| `process.service.ts` | Child process lifecycle, cleanup | 60 |
| `pipeline.service.ts` | Pipeline CRUD and execution | 100 |
| `cache.service.ts` | Scan caching with 24h TTL | 80 |
| `storage.service.ts` | Job/pipeline JSON persistence | 60 |

Entry point `index.ts` reduced to ~30 lines.

---

## 4. CI/CD Improvements

**Current Issues:**
- No caching (60-90s wasted per build)
- Sequential builds
- No tests or linting in CI
- 3 minute total build time

**Improvements:**
- Bun dependency caching
- Electron binary caching
- Lint/typecheck/test gate before builds
- Parallel Windows + Linux builds
- Coverage reporting with Codecov

**Expected Build Time:** ~60-90 seconds (down from 3 minutes)

---

## 5. Testing Strategy

- **Framework:** Vitest (fast, Vite-native)
- **DOM:** happy-dom (faster than jsdom)
- **Coverage Target:** 70%+ on services

**Test Files:**
- `tests/main/services/config.service.test.ts`
- `tests/main/services/workspace.service.test.ts`
- `tests/renderer/store/useAppStore.test.ts`

---

## 6. Migration Steps

### Phase 1: Restructure (Steps 1-8)
1. Delete `src/` directory (CLI code)
2. Move `electron/src/main/` → `src/main/`
3. Move `electron/src/renderer/` → `src/renderer/`
4. Move `electron/assets/` → `assets/`
5. Create `src/shared/` with unified types
6. Update root `package.json` with electron deps
7. Update all import paths
8. Delete empty `electron/` directory

### Phase 2: Dependencies (Steps 9-11)
9. Create new `package.json` with updated deps
10. Run `bun install`
11. Fix breaking changes (minimal)

### Phase 3: Services (Steps 12-18)
12. Create `src/main/services/` directory
13. Extract `config.service.ts`
14. Extract `workspace.service.ts`
15. Extract `build.service.ts`
16. Extract `process.service.ts`
17. Extract `pipeline.service.ts` + `cache.service.ts` + `storage.service.ts`
18. Create slim `index.ts`, `window.ts`, `ipc.ts`

### Phase 4: Quality (Steps 19-22)
19. Add Vitest config and tests
20. Add ESLint + Prettier configs
21. Run lint:fix and format
22. Update CI workflow

### Phase 5: Verify (Steps 23-25)
23. Test all features manually
24. Verify CI passes
25. Clean up old files

---

## 7. Files to Preserve

These files contain excellent code/design to keep:
- `electron/src/renderer/styles/globals.css` - Terminal/neon theme (1275 lines)
- `electron/src/renderer/store/useAppStore.ts` - Zustand store
- `electron/src/renderer/views/*` - All 9 views
- `electron/tailwind.config.js` - Custom color palette

---

## 8. Files to Delete

- `src/` directory (entire CLI codebase)
- `old-plan.md` (outdated)
- Root `package.json` CLI scripts

---

## 9. Scripts After Refactor

```json
{
  "dev": "concurrently \"bun run dev:renderer\" \"bun run dev:main\"",
  "dev:renderer": "vite",
  "dev:main": "tsc -p tsconfig.main.json && electron .",
  "build": "bun run build:renderer && bun run build:main",
  "package": "bun run build && electron-builder",
  "package:win": "bun run build && electron-builder --win",
  "test": "vitest",
  "test:coverage": "vitest --coverage",
  "lint": "eslint src",
  "lint:fix": "eslint src --fix",
  "format": "prettier --write src",
  "typecheck": "tsc --noEmit"
}
```

---

## Summary

This refactoring will transform the project into a modern, maintainable Electron application with:
- Clean service architecture
- Full TypeScript strict mode
- Comprehensive testing
- Fast CI/CD with caching
- Latest dependency versions
- Professional code quality tooling

The terminal/neon UI design will be preserved exactly as-is.
