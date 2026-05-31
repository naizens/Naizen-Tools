# /commit — Conventional Commit

Create a Conventional Commit following the project rules from CLAUDE.md.

## Steps

1. Run `git status` and `git diff` to see the changes
2. Run `npm run lint` — fix any errors before proceeding
3. Derive type, scope, and description from the changes (or ask briefly)
4. Build the commit message:
   ```
   <type>(<scope>): <description in English, imperative, max 72 chars>
   ```
5. Stage relevant files and create the commit

## Types
| Type | When |
|---|---|
| feat | New feature |
| fix | Bug fix |
| chore | Config, dependencies, tooling |
| style | Styling only (Tailwind, colors) |
| refactor | Restructure without behavior change |
| perf | Performance improvement |
| docs | Documentation only |

## Rules
- Description: English, imperative, no trailing period
- Scope optional, in parentheses: `feat(auto-clicker): ...`
- Body only if the why is not obvious
- Never commit directly to `main`
