# home

## Overview

Home-feed presentation pieces. `EmptyFeedState` is the placeholder shown when the
feed has no posts. Its copy and button label depend on whether the viewer is a
creator.

## Interface

- `[EmptyFeedState.tsx:EmptyFeedState]` named export, props
  `EmptyFeedStateProps = { isCreator?: boolean; onAction?: () => void }`.
- Subdirectories: None.

## Invariants

- `[EmptyFeedState.tsx:handleAction]` `if (onAction) onAction(); else navigate("/discovery")`.
  A supplied `onAction` always wins over the default navigation.
- `[EmptyFeedState.tsx:EmptyFeedState]` `isCreator` selects between the
  "Create Post" and "Discover Now" labels and their messages. It is a display
  switch only and grants nothing.

## Side Effects

- `[EmptyFeedState.tsx:handleAction]` `navigate("/discovery")` through
  react-router `useNavigate`, only when `onAction` is not provided.
- No Supabase or network calls.

## Verification

- Run: `npm run typecheck` (`tsc --build`) and `npm run build` (`vite build`).
  `package.json` has no `test` script.
