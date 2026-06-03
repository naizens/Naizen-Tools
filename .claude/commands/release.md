# /release — Release erstellen

Vollautomatischer Release nach den Branch-Regeln aus CLAUDE.md.

## Branch-Regeln (Pflicht)
- `main` — nur getaggte Releases; direkte Commits verboten
- `dev` — Entwicklungs-Branch; Basis für alle Merges
- `feat/*` → Merge nach `dev`
- `bug-fix/*` → Merge nach `dev` **und** `main`

## Ablauf

1. Frage welche Version: `patch` / `minor` / `major`

2. Stelle sicher dass alle Änderungen committed und gepusht sind:
   ```
   git status
   git diff
   ```
   Falls offene Änderungen: Abbrechen und zuerst committen (`/commit`).

3. Auf `dev` wechseln und aktuell halten:
   ```
   git checkout dev
   git pull origin dev
   ```

4. Open Source Credits prüfen (`src/components/shell/About.tsx`):
   - Jede runtime dependency aus `package.json` → dependencies muss einen Eintrag haben
   - Bekannte Liste: Electron, React, Tailwind, Zustand, Lucide, sharp, koffi,
     uiohook-napi, nut-tree-fork, node-window-manager, electron-updater,
     electron-builder, electron-vite
   - Falls eine Dependency fehlt oder entfernt wurde → Credits anpassen und committen

5. Patch Notes aktualisieren (`src/components/shell/PatchNotes.tsx`):
   - Commits seit dem letzten Tag lesen:
     ```
     git log <last-tag>..HEAD --oneline
     ```
   - Neuen Eintrag **oben** ins `ENTRIES`-Array einfügen:
     - `version` = neue Versionsnummer (z.B. `"0.11.0"`)
     - `date` = heutiges Datum auf Englisch (z.B. `"June 3, 2026"`)
     - Sections aus Commits ableiten:
       - `feat` → `{ label: 'New', color: 'text-success' }`
       - `fix` → `{ label: 'Fixed', color: 'text-warn' }`
       - `perf` / `refactor` → `{ label: 'Improved', color: 'text-accent' }`
       - Entfernte Features → `{ label: 'Removed', color: 'text-warn' }`
   - **Sprache:** Einfaches Englisch — keine technischen Details, aus User-Sicht.
     Schlecht: `"Refactored IPC handler"` — Gut: `"App responds faster to keypresses"`
   - Danach committen:
     ```
     git add src/components/shell/PatchNotes.tsx
     git commit -m "docs: add vX.Y.Z patch notes"
     git push origin dev
     ```

6. `dev` in `main` mergen:
   ```
   git checkout main
   git pull origin main
   git merge dev --no-ff -m "chore: merge dev into main for release vX.Y.Z"
   git push origin main
   ```

7. Release von `main` ausführen:
   ```
   git checkout main
   npm run release
   ```
   `release-it --ci` erledigt automatisch:
   - Version in `package.json` bumpen
   - `CHANGELOG.md` aus Commits generieren
   - Commit + Git-Tag erstellen (`vX.Y.Z`)
   - Tag + `main` zu GitHub pushen

8. `main` zurück nach `dev` synchronisieren:
   ```
   git checkout dev
   git merge main --ff-only
   git push origin dev
   ```

9. GitHub Actions startet automatisch beim Tag-Push:
   - Electron Windows-Installer bauen
   - GitHub Release erstellen
   - Installer als Asset anhängen

## Commit-Konventionen (release-it liest diese für den Changelog)

| Prefix | Wann | Version-Bump |
|---|---|---|
| `feat:` | Neues Feature | minor |
| `feat!:` / `BREAKING CHANGE` | Breaking / Entfernung | major |
| `fix:` | Bug Fix | patch |
| `perf:` | Performance | patch |
| `refactor:` / `chore:` / `docs:` | Intern | keiner |
