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

4. `dev` in `main` mergen:
   ```
   git checkout main
   git pull origin main
   git merge dev --no-ff -m "chore: merge dev into main for release"
   ```

5. Patch Notes in der App aktualisieren (`src/components/tools/PatchNotes.tsx`):
   - Neue `version` = die neue Versionsnummer (z.B. `"0.2.0"`)
   - `date` = heutiges Datum auf Deutsch (z.B. `"31. Mai 2026"`)
   - `sections` aus den Commits seit dem letzten Tag ableiten:
     - `git log <letzter-tag>..HEAD --oneline` ausführen
     - `feat`-Commits → Section `{ label: 'Neu', color: 'text-success' }`
     - `fix`/`bug-fix`-Commits → Section `{ label: 'Behoben', color: 'text-warn' }`
     - `perf`/`refactor`-Commits → Section `{ label: 'Verbessert', color: 'text-accent' }`
   - **Sprache der Items:** Einfach, allgemeinverständlich — keine Fachbegriffe, keine technischen Details.
     Schreibe so, als würdest du es jemandem erklären, der die App einfach nur benutzt.
     Schlecht: `"Refaktorierung des IPC-Handlers"` — Gut: `"App reagiert jetzt schneller auf Tastendrücke"`
     Schlecht: `"Fix: Race condition im AutoClicker"` — Gut: `"Auto-Klicker stoppt nicht mehr unerwartet"`
   - Den neuen Eintrag **oben** ins `ENTRIES`-Array einfügen (neueste Version zuerst)
   - Danach committen:
     ```
     git add src/components/tools/PatchNotes.tsx
     git commit -m "chore: aktualisiere Patch Notes für v<version>"
     ```

6. Release auf `main` ausführen:
   ```
   set ELECTRON_RUN_AS_NODE=&& npx release-it <patch|minor|major>
   ```
   `release-it` erledigt automatisch:
   - Version in `package.json` bumpen
   - `CHANGELOG.md` aus Commits generieren
   - Commit + Git-Tag erstellen (`v<version>`)
   - Tag + `main` zu GitHub pushen

7. `main` zurück nach `dev` synchronisieren:
   ```
   git checkout dev
   git merge main --ff-only
   git push origin dev
   ```

8. GitHub Actions startet automatisch beim Tag-Push:
   - Electron Windows-Installer bauen
   - GitHub Release erstellen
   - Installer als Asset anhängen

## Voraussetzungen (einmalig)
```bash
gh repo create Naizen-Tools --private
# GH_TOKEN in GitHub → Settings → Secrets → Actions hinterlegen
npm install --save-dev release-it @release-it/conventional-changelog
```
