# GFOS Build

Maven Build Manager for managing local Maven projects across multiple JDK versions.

## Development

```bash
# Install dependencies
bun install

# Run in development mode (Vite dev server + Electron)
bun run dev

# Type check
bun run typecheck

# Run tests
bun run test

# Lint
bun run lint
```

## Building

```bash
# Build (compile renderer + main)
bun run build

# Package for Windows
bun run package:win

# Package for Linux
bun run package:linux
```

## Project Structure

```
src/
  main/              # Electron main process
    index.ts         # Entry point
    window.ts        # Window management
    ipc.ts           # IPC handler registration
    preload.ts       # Context bridge
    services/        # Business logic
  renderer/          # React frontend
    components/      # Reusable UI components
    views/           # Screen-level components
    store/           # Zustand state management
    styles/          # CSS (terminal neon theme)
  shared/            # Code shared between main/renderer
    types.ts         # Domain types
    constants.ts     # App constants
tests/               # Vitest tests
```

## Tech Stack

- **Runtime**: Electron 34
- **Frontend**: React 19, Tailwind CSS, Framer Motion
- **State**: Zustand
- **Build**: Vite 6, TypeScript 5.7
- **Test**: Vitest
- **Package Manager**: Bun
