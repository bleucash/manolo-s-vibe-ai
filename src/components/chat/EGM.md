# chat

## Overview

Presentational view for a single message thread. `ChatWindow` renders a header
(avatar plus `thread_title`), a scrollable message list with an explicit "load
earlier" control, per-sender attribution in multi-party threads, and a composer.
It makes no Supabase calls: it imports only the `Message` type from
`@/hooks/useChat`, and all data and actions arrive through props.

## Interface

- `[ChatWindow.tsx:ChatWindow]` named export. Props `ChatWindowProps`:
  `{ messages: Message[]; currentUserId: string | null; thread: { kind: string | null; thread_title: string | null; avatar_url: string | null; member_avatars: string[] | null } | undefined; isLoading: boolean; onLoadOlder?: () => void; hasMoreMessages?: boolean; isLoadingOlder?: boolean; onBack: () => void; onSend: (content: string) => void }`
- Subdirectories: None.

## Invariants

- `[ChatWindow.tsx:ChatWindow]` Thread shape is decided by `thread.kind`, never by
  a NULL `display_name`. The header avatar is
  `thread?.kind === "dm" ? thread?.avatar_url : thread?.member_avatars?.[0]`, and
  the title is `thread?.thread_title || "NEURAL NODE"`.
- `[ChatWindow.tsx:ChatWindow]` Sender attribution renders only when
  `isMultiParty && !isMe && startsRun`, where `isMultiParty` is
  `thread?.kind === "venue" || thread?.kind === "group"` and `startsRun` is
  `!prev || prev.sender_id !== message.sender_id`.
- `[ChatWindow.tsx:handleSend]` Blank or whitespace-only input never reaches
  `onSend` (`if (inputValue.trim())`). The send button is
  `disabled={!inputValue.trim()}`, and the input is cleared after a send.
- `[ChatWindow.tsx:ChatWindow]` The load-older button renders only when
  `hasMoreMessages` is true and is `disabled={isLoadingOlder}`. `isLoading` swaps
  the list for a loading placeholder.
- `[ChatWindow.tsx:useEffect]` Scroll anchoring. A changed first message id is
  treated as a prepend, and the reader's position is kept with
  `prev.scrollTop + (el.scrollHeight - prev.scrollHeight)`. On first load, or when
  the reader was within 80px of the bottom, the view scrolls to the bottom.

## Side Effects

- `[ChatWindow.tsx:useEffect]` DOM only: adds a passive `scroll` listener to the
  `[data-radix-scroll-area-viewport]` element (removed on cleanup) and sets
  `scrollTop` directly.
- `[ChatWindow.tsx:ChatWindow]` Calls the `onSend`, `onBack` and `onLoadOlder`
  props. Persistence, read-cursor updates and network I/O belong to the caller
  (for example `@/hooks/useChat`), not to this directory.
- No Supabase, RPC, storage, realtime, fetch, navigation or localStorage calls.

## Verification

- Run: `npm run typecheck` (`tsc --build`) and `npm run build` (`vite build`).
  `package.json` has no `test` script.
