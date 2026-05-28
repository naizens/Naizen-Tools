# /commit — Konventioneller Commit

Erstelle einen Conventional Commit nach den Projektregeln aus CLAUDE.md.

## Ablauf

1. Führe `git status` und `git diff` aus um die Änderungen zu sehen
2. Führe `npm run lint` aus — behebe etwaige Fehler, bevor du weiter machst
3. Leite Typ, Scope und Beschreibung aus den Änderungen ab (oder frage kurz nach)
4. Baue die Commit-Message:
   ```
   <type>(<scope>): <Beschreibung auf Deutsch, Imperativ, max 72 Zeichen>
   ```
5. Stage relevante Dateien und erstelle den Commit

## Typen
| Typ | Wann |
|---|---|
| feat | Neue Funktion |
| fix | Bugfix |
| chore | Config, Dependencies, Tooling |
| style | Nur Styling (Tailwind, Farben) |
| refactor | Umbau ohne Verhaltensänderung |
| perf | Performance-Verbesserung |
| docs | Nur Dokumentation |

## Regeln
- Beschreibung: Deutsch, Imperativ, kein Punkt am Ende
- Scope optional, in Klammern: `feat(auto-clicker): ...`
- Body nur wenn das Warum nicht offensichtlich ist
- Niemals direkt auf `main` committen
