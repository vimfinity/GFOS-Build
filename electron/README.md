# GFOS Build GUI (Electron)

Eine moderne Desktop-Anwendung zur Verwaltung von Maven-Builds mit dynamischer JDK-Auswahl.

## Features

- 🔍 **Automatische Projekt-Erkennung** - Findet Maven-Projekte und Git-Repositories
- ☕ **JDK-Management** - Scannt und verwaltet mehrere JDK-Versionen
- 🚀 **Build-Ausführung** - Führt Maven-Builds mit konfigurierbaren Optionen aus
- 📊 **Live-Logs** - Zeigt Build-Output in Echtzeit an
- ⚡ **Parallele Builds** - Unterstützt Maven Multi-Threading (-T)

## Entwicklung

### Voraussetzungen

- Node.js 18+
- npm oder yarn

### Installation

```bash
cd electron
npm install
```

### Entwicklungsmodus

```bash
npm run dev
```

Dies startet:
1. Vite Dev Server für das Frontend (Port 5173)
2. Electron mit Hot-Reload

### Projekt bauen

```bash
# Nur bauen
npm run build

# Windows .exe erstellen
npm run package:win
```

## Architektur

```
electron/
├── src/
│   ├── main/           # Electron Main Process
│   │   ├── main.ts     # Hauptprozess, IPC Handler
│   │   └── preload.ts  # Context Bridge für Renderer
│   └── renderer/       # React Frontend
│       ├── App.tsx
│       ├── components/
│       ├── views/
│       ├── store/
│       └── types/
├── dist/               # Kompilierte Dateien
└── release/            # Fertige Executables
```

## Build-Konfiguration

Die Standalone `.exe` wird mit `electron-builder` erstellt:

- **Format:** Portable (keine Installation nötig)
- **Größe:** ~150-200MB (inkl. Chromium)
- **Zielplattform:** Windows x64

## Unterschied zur CLI-Version

| Feature | CLI (Bun + ink) | GUI (Electron) |
|---------|-----------------|----------------|
| Größe | ~50MB | ~180MB |
| UI | Terminal | Native Desktop |
| Start | Sofort | 1-2 Sekunden |
| Interaktion | Tastatur | Maus + Tastatur |

Die Core-Logik (Build-Ausführung, Scanning) ist identisch - nur die UI unterscheidet sich.
