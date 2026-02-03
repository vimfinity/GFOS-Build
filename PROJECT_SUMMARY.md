# GFOS-Build – Projektzusammenfassung (Stand: 2026-02-03)

## Zielbild
GFOS-Build ist ein Build-Manager für lokale Maven-Projekte mit mehreren JDK-Versionen. Ziel ist ein performantes, eigenständiges Tool mit guter UX und stabiler, nicht-blockierender UI.

Der aktuelle Fokus ist ein hochwertiges GUI, das die Build-Logik und Projekt-Erkennung komfortabel bedienbar macht. Electron funktioniert gut und ist schnell produktiv, aber eine alternative GUI-Technik ist noch offen.

---

## Bisherige Architektur (Kernprojekt)
**Runtime:** Bun
**Sprache:** TypeScript (Strict)
**UI (CLI):** React + Ink
**State:** Zustand
**Validierung:** Zod
**Build/Distribution:** `bun build --compile`

### Ordnerstruktur (CLI)
- **src/core**: Business-Logik & Services (kein React)
- **src/infrastructure**: Dateisystem & Prozess-Ausführung (Bun.spawn)
- **src/ui**: Ink-UI für Terminal

### Wichtige Dienste
- `WorkspaceScanner`: Projekt-/Pom-Erkennung
- `BuildRunner`: Maven-Ausführung
- `ProcessManager`: Prozesse/Jobs
- `PipelineService`: Build-Pipelines
- `JobHistoryService` / `JobLogService`

### Mock-First Konzept
Alle IO-Aktionen hängen an Interfaces; in Codespaces wird ein `MockFileSystem` verwendet (basiert auf `result.json`).

---

## Aktueller GUI-Stand (Electron-Prototyp)
**Ziel:** Desktop-GUI mit React + Tailwind, IPC und Build-Ausführung.

### Renderer-Stack
- React + Vite
- TailwindCSS
- Zustand Store

### Main-Prozess (Electron)
- IPC Handler für Scan/Build/Config
- Preload für sicheres API-Bridge

### Wichtige Änderungen zuletzt
- **ESM/CommonJS Konflikt gelöst**: `"type": "module"` entfernt
- **Mock-API für Browser-Dev**: `mockApi.ts` liefert Fake-Daten
- **API-Abstraktion**: `api.ts` exportiert automatisch Mock/Real-API
- **Views aktualisiert**: Komponenten verwenden `api.*` statt `window.electronAPI.*`
- **postcss.config.js**: auf CommonJS umgestellt

### Electron-Projektstruktur (Auszug)
```
electron/
  src/
    main/
      main.ts
      preload.ts
    renderer/
      App.tsx
      api.ts
      types/
        mockApi.ts
      views/
        HomeView.tsx
        ProjectsView.tsx
        ProjectDetailView.tsx
        BuildConfigView.tsx
        JobsView.tsx
        JobDetailView.tsx
        SettingsView.tsx
      components/
        Header.tsx
        Sidebar.tsx
```

---

## Gelöste Probleme
1. **CommonJS/ESM Crash** in Electron-Hauptprozess
2. **Browser-Dev ohne Electron**: Mock-API löst `window.electronAPI`-Fehler
3. **IPC-Verwendung**: Saubere Abstraktion mit `api.ts`

---

## Offene Punkte / Risiken
- **Build/Distribution**: Cross-Build unter Linux benötigt Windows Runner
- **Tech-Entscheidung GUI**: Electron ist gut, alternative GUI-Technik möglich
- **UI/UX-Fokus**: Es soll visuell und funktional „hochwertig“ sein (weiter designen)

---

## Empfehlungen für den Neustart
### 1) Ziel & UX definieren
- Haupt-Workflows: Scan → Projekt → Build → Logs → History
- Navigation (Stack/Back), Layout, Status-Feedback

### 2) Architektur-Entscheidung GUI
- **Option A: Electron** (schnell & stabil)
- **Option B: Tauri** (kleiner Footprint, Rust Backend)
- **Option C: WebView2 + Native** (Windows-only, maximal leicht)

### 3) Core-Logik als Paket isolieren
- `core` unabhängig halten und GUI nur „andocken“

### 4) Entwicklungsmodus klären
- Mock-Mode fest integrieren (inkl. Sample-Daten)

---

## Neue Basis – Vorschlag
Ein klarer Schnitt:
- **/core**: Maven/Scanner/Jobs
- **/gui**: gewünschte GUI-Technik + UI
- **/shared**: Typen & Zod Schemas

Start mit Fokus auf UI, aber die core-Logik bleibt wiederverwendbar.

---

## Nächster Schritt (wenn gewünscht)
- GUI-Technik final auswählen
- neues UI-Konzept skizzieren
- minimalen Prototypen mit Mock-Daten erstellen
