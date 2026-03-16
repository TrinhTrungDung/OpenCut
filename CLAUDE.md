# CLAUDE.md

Guidance for Claude Code when working with the OpenCut codebase.

## Project Overview

**OpenCut** - Free, open-source video editor for web, desktop, and mobile.

- **Language**: TypeScript (primary)
- **Stack**: Next.js 16+, React 19, Bun, Tailwind CSS 4, PostgreSQL, Drizzle ORM
- **State**: Zustand (11 stores)
- **Video**: FFmpeg WASM, IndexedDB + OPFS storage
- **Auth**: Better Auth
- **Monorepo**: Turborepo with Bun workspaces

## Architecture

```
OpenCut/
├── apps/
│   └── web/                     # Main Next.js web application
│       └── src/
│           ├── app/             # Next.js App Router pages
│           ├── components/
│           │   ├── editor/      # Video editor (timeline, preview, panels)
│           │   └── ui/          # shadcn/ui components
│           ├── core/            # EditorCore singleton + managers
│           ├── hooks/           # 20+ custom React hooks
│           ├── stores/          # Zustand stores (11 stores)
│           ├── lib/             # Utils (canvas, timeline, storage, export)
│           │   ├── actions/     # Action definitions & system
│           │   └── commands/    # Undo/redo command system
│           ├── services/        # Service layer
│           └── types/           # TypeScript definitions
├── packages/
│   ├── env/                     # Environment config
│   └── ui/                      # Shared UI components
├── docs/                        # Documentation
└── guide/                       # User guides
```

### Core Editor System

```
EditorCore (singleton)
├── playback: PlaybackManager
├── timeline: TimelineManager
├── scene: SceneManager
├── project: ProjectManager
├── media: MediaManager
└── renderer: RendererManager
```

### Key Patterns

- **In React**: Use `useEditor()` hook (auto re-renders on changes)
- **Outside React**: Use `EditorCore.getInstance()` directly
- **User actions**: Use `invokeAction()` from `@/lib/actions`
- **Undo/redo**: Use Command pattern from `@/lib/commands/`
- **State**: Zustand stores in `@/stores/`

### Key Zustand Stores

| Store | Purpose |
|-------|---------|
| `timeline-store.ts` | Tracks, elements, drag state, clipboard |
| `media-store.ts` | Media file management |
| `playback-store.ts` | currentTime, isPlaying, volume |
| `editor-store.ts` | UI state, layout guides |
| `project-store.ts` | Canvas size, FPS, background |
| `scene-store.ts` | Scene management |

## Build Commands

```bash
# Development
bun run dev:web          # Start Next.js dev server
bun run build:web        # Build for production
bun run lint:web         # Lint with Biome
bun run lint:web:fix     # Auto-fix lint issues
bun test                 # Run tests
bunx tsc --noEmit        # Type check

# Tools
bun run dev:tools        # Start tools dev server
bun run build:tools      # Build tools
```

## Configuration

- Main config: `turbo.json` (Turborepo)
- Biome: `biome.json` (linting, NOT ESLint)
- TypeScript: `tsconfig.json`
- Docker: `docker-compose.yml` (PostgreSQL, Redis)

## Role & Responsibilities

Analyze requirements, delegate to sub-agents, ensure cohesive delivery meeting specs and architectural standards.

## Workflows

- Primary: `.claude/workflows/primary-workflow.md`
- Development rules: `.claude/workflows/development-rules.md`
- Orchestration: `.claude/workflows/orchestration-protocol.md`
- Documentation: `.claude/workflows/documentation-management.md`

**IMPORTANT:** Follow strictly `.claude/workflows/development-rules.md`.
**IMPORTANT:** Read `README.md` and `AGENTS.md` before planning any implementation.
**IMPORTANT:** Sacrifice grammar for concision in reports.
**IMPORTANT:** List unresolved questions at end of reports.

## Available Sub-Agents

Located in `.claude/agents/`:

| Agent | Purpose |
|-------|---------|
| `planner` | Research & create implementation plans |
| `fullstack-developer` | Execute parallel plan phases |
| `code-reviewer` | Code quality & security review |
| `tester` | Run tests, coverage analysis |
| `debugger` | Investigate issues, analyze logs |
| `database-admin` | DB queries, optimization, migrations |
| `researcher` | Technical research, documentation |
| `docs-manager` | Documentation management |
| `git-manager` | Stage, commit, push changes |
| `scout` | Fast codebase file search |
| `scout-external` | Search with external agentic tools |
| `mcp-manager` | MCP server integrations |
| `ui-ux-designer` | Interface design work |
| `copywriter` | Marketing & engagement copy |
| `project-manager` | Project oversight & coordination |
| `journal-writer` | Document technical difficulties |
| `brainstormer` | Feature brainstorming |

## Slash Commands

Key commands in `.claude/commands/`:

| Command | Description |
|---------|-------------|
| `/plan [task]` | Create implementation plan |
| `/plan:fast [task]` | Quick plan (no research) |
| `/plan:hard [task]` | Deep research + plan |
| `/plan:parallel [task]` | Plan with parallel phases |
| `/cook [task]` | Implement feature step-by-step |
| `/cook:auto [task]` | Auto-implement ("trust me bro") |
| `/cook:auto:fast [task]` | Scout, plan & implement fast |
| `/cook:auto:parallel [task]` | Parallel phase execution |
| `/code [plan]` | Execute existing plan |
| `/code:parallel [plan]` | Execute plan with parallel agents |
| `/fix:fast [issue]` | Quick fix for small issues |
| `/fix:hard [issue]` | Complex issue resolution |
| `/fix:parallel [issues]` | Parallel fix execution |
| `/fix:ci [url]` | Fix CI/CD failures |
| `/fix:test` | Run & fix test failures |
| `/fix:types` | Fix TypeScript type errors |
| `/fix:ui [issue]` | Fix UI issues |
| `/review:codebase` | Scan & analyze codebase |
| `/scout [query]` | Search codebase files |
| `/scout:ext [query]` | Search with external tools |
| `/use-mcp [task]` | Execute MCP server tools |
| `/debug [issue]` | Debug technical issues |
| `/test` | Run test suite |
| `/git:cm` | Stage & commit changes |
| `/git:cp` | Commit & push changes |
| `/git:pr` | Create pull request |
| `/docs:init` | Initialize documentation |
| `/docs:update` | Update documentation |

## Documentation

Docs in `./docs/`:
- Architecture and design guidelines
- `AGENTS.md` in project root for editor patterns

## Code Patterns

### Zustand Store Pattern
```typescript
import { create } from "zustand";

interface Store {
  items: Item[];
  addItem: (item: Item) => void;
}

export const useStore = create<Store>((set) => ({
  items: [],
  addItem: (item) => set((state) => ({
    items: [...state.items, item]
  })),
}));
```

### Action System
```typescript
// Define in @/lib/actions/definitions.ts
export const ACTIONS = {
  "my-action": {
    description: "What the action does",
    category: "editing",
    defaultShortcuts: ["ctrl+m"],
  },
};

// Handle in @/hooks/use-editor-actions.ts
useActionHandler("my-action", () => { /* implementation */ }, undefined);

// Invoke from components
import { invokeAction } from '@/lib/actions';
const handleSplit = () => invokeAction("split-selected");
```

### Command Pattern (Undo/Redo)
```typescript
// Extend Command from @/lib/commands/base-command
class MyCommand extends Command {
  execute() { /* save state, do mutation */ }
  undo() { /* restore saved state */ }
}
```

## Testing

- Test runner: `bun test`
- Type checking: `bunx tsc --noEmit`
- Linting: Biome (`bun run lint:web`)

## Key Files Reference

- `package.json` - Workspace configuration
- `turbo.json` - Turborepo config
- `biome.json` - Linting config
- `apps/web/src/stores/` - All Zustand stores
- `apps/web/src/components/editor/` - Editor components
- `AGENTS.md` - Editor architecture & patterns
