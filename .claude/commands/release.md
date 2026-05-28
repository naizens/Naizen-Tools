# /release — Release erstellen

Vollautomatischer Release via `release-it`. Setzt voraus:
- Du bist auf Branch `dev` (oder `main` für Hotfixes)
- `GH_TOKEN` ist als Umgebungsvariable oder Repository-Secret gesetzt
- GitHub Actions Workflow `.github/workflows/release.yml` ist aktiv

## Ablauf

1. Frage welche Version: `patch` / `minor` / `major`
2. Stelle sicher dass alle Änderungen committed sind (`git status`)
3. Führe aus:
   ```
   set ELECTRON_RUN_AS_NODE=&& npx release-it <patch|minor|major>
   ```
   `release-it` erledigt automatisch:
   - Version in `package.json` bumpen
   - `CHANGELOG.md` aus Commits generieren
   - Commit + Git-Tag erstellen
   - Tag zu GitHub pushen
4. GitHub Actions startet automatisch beim Tag-Push:
   - Electron Windows-Installer bauen
   - GitHub Release erstellen
   - Installer als Asset anhängen

## Voraussetzungen (einmalig)
```bash
gh repo create Naizen-Tools --private
# GH_TOKEN in GitHub → Settings → Secrets → Actions hinterlegen
npm install --save-dev release-it @release-it/conventional-changelog
```

## Hinweis
Nach dem Release `dev` mit `main` synchron halten:
```bash
git checkout dev
git merge main
git push
```
