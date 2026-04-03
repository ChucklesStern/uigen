# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# First-time setup (install deps + Prisma generate + migrate)
npm run setup

# Development server (Turbopack)
npm run dev

# Run all tests
npm test

# Run a single test file
npx vitest run src/lib/__tests__/file-system.test.ts

# Reset the database
npm run db:reset

# Regenerate Prisma client after schema changes
npx prisma generate && npx prisma migrate dev
```

## Architecture

### Request Flow

1. User types a prompt → `ChatContext` (wraps Vercel AI SDK's `useChat`) sends a POST to `/api/chat` with the current message history and the serialized `VirtualFileSystem`.
2. `POST /api/chat` reconstructs the `VirtualFileSystem` server-side, calls `streamText` with two tools (`str_replace_editor`, `file_manager`), and streams back a data response.
3. As tool calls stream in, `ChatContext.onToolCall` dispatches them to `FileSystemContext.handleToolCall`, which mutates the in-memory `VirtualFileSystem` and triggers a React re-render via `refreshTrigger`.
4. `PreviewFrame` reacts to `refreshTrigger`, calls `createImportMap` to Babel-transform all files into blob URLs, injects an `<importmap>` into an `<iframe>`'s `srcdoc`, and renders the live component.
5. On finish, the route saves updated `messages` + serialized `VirtualFileSystem` to the `Project` row in SQLite (authenticated users only).

### Virtual File System (`src/lib/file-system.ts`)

`VirtualFileSystem` is an in-memory tree of `FileNode` objects. It lives client-side and is serialized as `Record<string, FileNode>` when sent to the API. Key methods used by tools:
- `createFileWithParents` / `replaceInFile` / `insertInFile` — called by `str_replace_editor` tool
- `rename` / `deleteFile` — called by `file_manager` tool
- `serialize` / `deserializeFromNodes` — used for API transport and project persistence

### AI Tools (`src/lib/tools/`)

Two Vercel AI SDK tools are registered in the chat route:
- **`str_replace_editor`** — create, str_replace, insert, view commands operating on the VFS
- **`file_manager`** — rename and delete commands

The AI prompt (`src/lib/prompts/generation.tsx`) instructs Claude to always start with `/App.jsx` as the entry point and use `@/` alias for local imports.

### Preview Pipeline (`src/lib/transform/jsx-transformer.ts`)

`createImportMap` iterates all VFS files, Babel-transforms each `.jsx`/`.tsx` file into a blob URL, and builds a native `<importmap>`. Third-party package imports are routed to `https://esm.sh/`. CSS files are injected as `<style>` tags. Missing local imports get placeholder stub modules so the preview doesn't crash.

### Authentication

JWT-based auth via `jose`. Sessions are stored in an `httpOnly` cookie (`auth-token`, 7-day TTL). `src/lib/auth.ts` is server-only. Middleware protects `/api/projects` and `/api/filesystem` routes. The chat route itself is unprotected — project saving is skipped silently for unauthenticated users.

### Mock Provider (`src/lib/provider.ts`)

When `ANTHROPIC_API_KEY` is absent, `getLanguageModel()` returns `MockLanguageModel`, which simulates a multi-step tool-calling sequence using static component templates. The real model is `claude-haiku-4-5`.

### Data Model (Prisma / SQLite)

- `User` — email + bcrypt password
- `Project` — belongs to an optional `User`; `messages` and `data` are JSON strings storing the full chat history and serialized VFS respectively

### Context Providers

Two React contexts wrap the app:
- `FileSystemContext` — owns the `VirtualFileSystem` instance and exposes mutation helpers + `handleToolCall`
- `ChatContext` — owns `useAIChat`; depends on `FileSystemContext` to read/write files during streaming

Both are provided in `src/app/[projectId]/page.tsx` (authenticated project view) and `src/app/main-content.tsx` (anonymous view).
