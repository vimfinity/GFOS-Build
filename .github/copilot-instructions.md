# GFOS-Build - Project Instructions for Copilot

## Project Goal
We are building "GFOS-Build", a high-performance, standalone CLI tool for managing local Maven builds across multiple JDK versions. The target environment is Windows, but development happens in a Linux-based GitHub Codespace.

## Tech Stack & Constraints
- **Runtime:** Bun (Latest Version).
- **UI:** React with `ink` (Terminal UI).
- **Language:** TypeScript (Strict Mode).
- **State Management:** Zustand (for decoupling logic from UI).
- **Validation:** Zod (for config and schema validation).
- **Distribution:** Single executable binary (`bun build --compile`). The target machine has **NO** Node.js/npm installed.
- **Performance:** Non-blocking UI, async operations, parallel build execution.

## Architectural Guidelines
1.  **Separation of Concerns:**
    - `src/core`: Pure business logic, services, and state management. NO React code here.
    - `src/ui`: Pure React components for the CLI interface.
    - `src/infrastructure`: File system access, shell execution (`Bun.spawn`).
2.  **Mock-First Development:**
    - Since we run in Codespaces, we cannot access the user's local C:\ drive.
    - All file system operations (scanning, executing) must be behind Interfaces.
    - Create a `MockFileSystem` adapter that returns data based on the provided `result.json` structure when `MOCK_MODE=true` is set.
3.  **UI/UX Best Practices:**
    - **Flicker-Free:** Use `ink` correctly. No `console.log`.
    - **Responsive:** Handle terminal resizing gracefully.
    - **Navigation:** Stack-based navigation (Home -> Repo -> Build).
4.  **Clean Code:**
    - Use functional components and hooks.
    - Strong typing (no `any`).
    - Error handling: Graceful degradation, no crashes.

## Key Features
- **Smart Discovery:** Detect `.git` repos and `pom.xml` files.
- **Context Switching:** Dynamic `JAVA_HOME` injection per build.
- **Job Queue:** Background build execution while UI remains interactive.