# Naizen-Tools — CLAUDE.md

## Stack
- Electron v33 + electron-vite + React + TypeScript + Tailwind CSS v3
- State: Zustand + persist (nur `config` + `theme` persistieren)
- Automation: `@nut-tree-fork/nut-js` (kostenloser Fork), `uiohook-napi`
- Kein Python, kein CSS-in-JS, kein class-basiertes React

## Kritischer Bug — ELECTRON_RUN_AS_NODE
**IMMER** in npm scripts vor `electron-vite` setzen: `set ELECTRON_RUN_AS_NODE=&&`
Ohne das läuft Electron als Node.js und `require('electron')` liefert nur einen Pfad-String statt der API.
Betrifft `dev`, `build` und alle Electron-Befehle.

## Electron Security (Pflicht)
- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- Automation-Logik ausschließlich in `electron/main.ts` — niemals im Renderer
- Alle APIs nur über `contextBridge` + `preload.ts` exponieren

## Tailwind-First
- Styling nur über Tailwind-Klassen + CSS-Variablen in `globals.css`
- Keine inline-styles, keine externen CSS-Dateien außer `globals.css`
- Dark/Light Mode via `.dark`-Klasse auf `<html>` + Tailwinds `dark:`-Prefix
- Keine hardcoded Farben — nur `text-accent`, `text-warn`, `text-success`, `bg-surface/5` etc.

## Komponenten-Stil (Glassmorphism)
```
Panel:       rounded-2xl bg-surface/5 backdrop-blur-md border border-surface/10 p-5
Button:      rounded-xl px-5 py-2.5 font-mono font-semibold border transition-colors
Spinbox:     bg-surface/10 border border-surface/15 rounded-lg px-3 py-1.5 font-mono text-sm
CaptureBox:  border-2 border-dashed border-surface/20 rounded-xl px-4 py-3
StatusBadge: text-success (aktiv) | text-muted/40 (gestoppt)
```

## Performance
- Automation-Loops: setTimeout-Ketten, kein `while(true)`
- IPC-Ticker (`afk:tick`) maximal 4×/s
- Tool-Komponenten via `React.lazy()` + `Suspense`
- `React.memo()` für alle Tool-Komponenten

## Build
- `asarUnpack`: `@nut-tree-fork`, `uiohook-napi` (native Module)
- Kein Sourcemap in Production
- UPX nicht verwenden (Antivirus-Fehlalarme)

## Commits (Conventional Commits)
Format: `<type>(<scope>): <Beschreibung>`
Typen: feat, fix, chore, style, refactor, perf, docs
Sprache: Deutsch, Imperativ, max. 72 Zeichen

## Branches
- `main` — nur getaggte Releases; direkte Commits verboten
- `dev` — aktiver Entwicklungs-Branch; Basis für alle Feature- und Bug-Zweige
- `feat/<name>` → von `dev`, Merge nach `dev`
- `bug-fix/<name>` → von `dev`, Merge nach `dev` **und** `main`
