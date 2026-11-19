# Handoff: linkding Raycast extension

**Status:** complete on branch `dev`. `main` still points at the initial commit. Nothing was pushed. The extension uses linkding's official logo for the one icon Raycast requires, focuses the URL field or tag picker based on the launch argument, and puts read status last. Product scope, setup, and usage live in [`README.md`](../README.md).

## What is left

- Nothing for local use. On macOS or Windows, run `ray develop` to try the command inside Raycast.
- The manifest uses `author: "crush"` because `ray lint` requires a real Raycast handle. Change it before publishing.
- Raycast requires a 512x512 extension icon. The current one is linkding's official `logo-512.png`; the command has no separate icon.
- `ray build` was not run because it needs macOS or Windows. The checks below pass on Linux.

## Verification

- `npm test`: 40 tests pass.
- `npm run lint`: passes.
- `npx tsc --noEmit`: passes.

## Suggested skills

- `diagnose` if the linkding API behaves differently than the contract described in the README.
- `unslop` for README or user-facing copy changes.
