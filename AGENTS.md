# AGENTS.md

Instructions for AI coding agents working in this project. This is the cross-tool
entry point, read by Codex, Claude Code, and other compatible tools.

AI tools must not add AI attribution to commits or pull requests, including AI
`Co-Authored-By` trailers or generated-by signatures. Preserve genuine human
attribution.

## What this is

fib-league-helper is a Next.js web app.

> TODO: add a one-line description of the problem it solves.

## Proportional engineering

Build for established requirements, not hypothetical scale, threats, or future
flexibility. Reuse existing code, the standard library, native platform features,
and installed dependencies before adding machinery.

- Unknown scale or extensibility defaults to the smaller reversible design. Do
  not infer enterprise, multi-tenant, hostile-user, or compliance requirements.
- Derive trust and data-integrity boundaries from actual reachability: untrusted
  input, auth/session/ownership, shared persisted data, destructive operations,
  payments, secrets, and sensitive data.
- Ask only when an unknown materially changes behavior, architecture, persisted
  data, interoperability, a real security boundary, or cost. Otherwise choose the
  simplest repository-native implementation.
- Add an abstraction, dependency, service, configuration surface, compatibility
  layer, or security mechanism only for a current requirement.
- Simplicity never removes real trust-boundary validation, data-loss prevention,
  accessibility, explicit security requirements, configured tests, or project rules.

## Conventions

- Next.js 16 App Router, React 19, TypeScript strict mode, Tailwind CSS v4, npm.
- No `src/` directory. Routes live in `app/`, static assets in `public/`, and
  the `@/*` import alias maps to the project root.
- Server components by default; add `'use client'` only for interactivity,
  hooks, or browser APIs.
- Style with Tailwind utilities. Theme tokens live in `@theme` in
  `app/globals.css`; there is no `tailwind.config.js`. No inline styles.
- No `any`; type props, API responses, and data models.
- Validate untrusted input where it enters the app and show user-friendly
  errors.
- Comment the why, not the what. No commented-out code or unused imports.
- No em dashes in generated docs, comments, or commit messages.
- No database, auth, component library, or validation library is chosen yet. Do
  not assume one.

## Commands

Next.js 16 (App Router) with npm. Run from the project root.

- Install: `npm install`
- Dev server: `npm run dev` (http://localhost:3000)
- Build: `npm run build` (also typechecks)
- Production server: `npm run start`
- Lint: `npm run lint`

No test command is configured, so tests are not a gate yet. No separate
typecheck, format, browser test, or combined verify command exists either. When
a test runner is added, record its exact command here; from then on, logic
changes must ship with a passing test.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
