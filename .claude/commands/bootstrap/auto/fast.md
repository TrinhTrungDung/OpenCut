---
description: ⚡⚡⚡ Quickly bootstrap a new package or module automatically
argument-hint: [package-name]
---

Think harder to bootstrap: <tasks>$ARGUMENTS</tasks>

## Workflow

1. **Scout**: Use `scout` subagent to find similar packages/modules in the monorepo
2. **Plan**: Create a quick plan based on existing patterns
3. **Implement**: Bootstrap the new package/module following monorepo conventions
4. **Verify**:
   - `bunx tsc --noEmit`
   - `bun run lint:web`
   - `bun test`
5. **Final**: Ask user if they want to commit

**IMPORTANT:** Follow turbo.json workspace conventions.
**IMPORTANT:** Sacrifice grammar for concision in reports.
