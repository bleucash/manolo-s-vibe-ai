# src/hooks

## Overview

React hooks for messaging (`useChat`), following talent and venues
(`useFollow`), a viewer's relationship to one venue (`useVenueStatus`), the
Tier 2 business-verification gate (`useVenueVerified`), plus two UI utilities
(`useIsMobile`, the shadcn `useToast` store). The data hooks call Supabase
through `src/integrations/supabase/client.ts`; the venue hooks also read
`useUserMode()` from `src/contexts/UserModeContext.tsx`.

## Interface

`useChat.ts`

- `useChat(selectedConversationId: string | null)` returns `conversations`
  (accepted threads only), `requests` (pending threads), `messages`,
  `currentUserId`, `isLoadingConversations`, `isLoadingMessages`,
  `sendMessage(content)`, `respondToRequest(conversationId, accept): Promise<boolean>`,
  `loadOlderMessages()`, `hasMoreMessages`, `isLoadingOlder`,
  `refetchConversations`. [useChat.ts:useChat]
- `type ParticipantState = "accepted" | "pending" | "declined"`. [useChat.ts:ParticipantState]
- `type ConversationSummary`: the generated `conversation_summary` view row with
  `unread_count: number` and `participant_state: ParticipantState` narrowed to
  non-null. [useChat.ts:ConversationSummary]
- `interface Message { id, conversation_id, sender_id, content, created_at, sender? }`.
  [useChat.ts:Message]
- Not exported: `mergeMessages`, `PAGE_SIZE = 50`, `fetchMessagePage`,
  `markAsRead`. [useChat.ts:mergeMessages] [useChat.ts:PAGE_SIZE]

`useFollow.ts`

- `type FollowTarget = "talent" | "venue"`. [useFollow.ts:FollowTarget]
- `writeFollow(targetId, targetType, currentUserId, follow): Promise<void>`: the
  raw insert/delete with no local state, for callers that hold follow state in
  bulk (Discovery). [useFollow.ts:writeFollow]
- `useFollow(targetId, targetType = "talent")` returns
  `{ isFollowing, isLoading, toggleFollow }`. [useFollow.ts:useFollow]
- Not exported: `TARGET_TABLE` (`talent` to `followers.following_id`, `venue` to
  `venue_followers.venue_id`). [useFollow.ts:TARGET_TABLE]

`useVenueStatus.ts`

- `useVenueStatus(venueId: string)` returns
  `{ isOwner, hasPendingClaim, pendingClaimHandle, loadFailed, loading }`.
  [useVenueStatus.ts:useVenueStatus]

`useVenueVerified.ts`

- `useVenueVerified(venueId?: string | null)` returns `{ isVerified, isLoading }`.
  [useVenueVerified.ts:useVenueVerified]

`use-mobile.tsx`

- `useIsMobile(): boolean`, breakpoint `MOBILE_BREAKPOINT = 768`.
  [use-mobile.tsx:useIsMobile]

`use-toast.ts`

- `useToast()` returns `{ toasts, toast, dismiss(toastId?) }`; `toast(props)`
  returns `{ id, dismiss, update }`; `reducer(state, action)` over `ADD_TOAST`,
  `UPDATE_TOAST`, `DISMISS_TOAST`, `REMOVE_TOAST`.
  [use-toast.ts:useToast] [use-toast.ts:toast] [use-toast.ts:reducer]

## Invariants

Messaging (`useChat.ts`)

- `conversation_summary` is queried with no participant filter: the view scopes
  itself to `auth.uid()`. Do not reintroduce a client-side filter such as the old
  `.neq("participant_id", currentUserId)`. [useChat.ts:fetchConversations]
- Nullable view columns are narrowed once, in `fetchConversations`
  (`unread_count ?? 0`, `participant_state ?? "accepted"`), not at each consumer.
  [useChat.ts:fetchConversations]
- `declined` threads appear in neither `conversations` nor `requests`.
  [useChat.ts:useChat]
- Read state goes through the `mark_conversation_read` RPC, never a client UPDATE.
  If the RPC returns a `null` cursor while `unread_count > 0`, the badge stays lit
  and an error is logged instead of asserting a write that did not land.
  [useChat.ts:markAsRead]
- History uses keyset pagination on the composite `(created_at, id)`, descending,
  `limit(50)`, not `.range()`; `hasMoreMessages` is `page.length === PAGE_SIZE`.
  [useChat.ts:fetchMessagePage]
- The sender embed names its FK explicitly,
  `profiles!messages_sender_id_fkey(display_name, avatar_url)`, so a second FK to
  `profiles` cannot make it ambiguous. [useChat.ts:fetchMessagePage]
- The message list is only ever added to: older pages prepend, realtime inserts
  append, duplicates are dropped by `id`, and `mergeMessages` lets the enriched
  copy win. [useChat.ts:loadOlderMessages] [useChat.ts:mergeMessages]
- `sendMessage` inserts with `.select().single()` and reconciles the optimistic
  `tempId` entry to the saved row by removal then conditional add, correct
  whichever of the response or the realtime INSERT arrives first.
  [useChat.ts:sendMessage]
- `respondToRequest` checks rows affected (`.select("conversation_id")`); zero
  rows means the transition was refused and returns `false` with
  "Request No Longer Pending". [useChat.ts:respondToRequest]
- `Message` deliberately has no `is_read`. The comment beside it says the column
  "still exists on messages"; the generated `messages` Row in
  `src/integrations/supabase/types.ts` no longer has it, so that comment is
  stale. [useChat.ts:Message]

Following (`useFollow.ts`)

- `TARGET_TABLE` is `as const satisfies Record<FollowTarget, { table: keyof Database["public"]["Tables"]; ... }>`,
  so a table-name typo is a compile error. [useFollow.ts:TARGET_TABLE]
- `writeFollow` throws on error and lets `23505` propagate; `toggleFollow` treats
  `23505` as already following. [useFollow.ts:writeFollow] [useFollow.ts:toggleFollow]
- `writeFollow` checks `error` only. The unfollow DELETE does not `.select()`
  rows affected, so a delete matching zero rows (including one filtered by RLS)
  reports success. [useFollow.ts:writeFollow]
- Self-follow is blocked client-side (`currentUserId === targetId`); a signed-out
  user gets a toast and no write. [useFollow.ts:toggleFollow]

Venue hooks

- `useVenueStatus` waits for `useUserMode().isLoading` before querying.
  [useVenueStatus.ts:useVenueStatus]
- It reads only the live `pending` claim with `limit(1)`, because one user can
  hold several claims on a venue over time. [useVenueStatus.ts:useVenueStatus]
- A failed read sets `loadFailed` rather than reading as "not owner, no claim".
  [useVenueStatus.ts:useVenueStatus]
- Edit rights come from `isOwner` alone; a pending claim confers nothing.
  [useVenueStatus.ts:useVenueStatus]
- `useVenueVerified` reads `userVenues` from context and does not query; a venue
  not in that owner-scoped list returns `false`. Callers must respect `isLoading`
  before rendering a blocked state. [useVenueVerified.ts:useVenueVerified]

UI utilities

- `useIsMobile` returns `false` until the first measurement (`!!undefined`).
  [use-mobile.tsx:useIsMobile]
- `use-toast` keeps one module-level `memoryState` and `listeners` array shared
  by every `useToast` caller, with `TOAST_LIMIT = 1`. `useChat` and `useFollow`
  use `toast` from `sonner` instead, a separate toast system.
  [use-toast.ts:dispatch] [use-toast.ts:TOAST_LIMIT] [useChat.ts:toast import]

## Side Effects

- `useChat`: `supabase.auth.getUser()`; reads `conversation_summary` and
  `messages`; inserts into `messages`; updates `conversation_participants.state`;
  calls RPC `mark_conversation_read({ _conversation_id })`; subscribes to the
  realtime channel `"neural-comms-global"` for `postgres_changes` INSERT on
  `public.messages` and removes it on cleanup; `toast` (sonner) and console
  logging. [useChat.ts:useChat]
- `useFollow`: `supabase.auth.getUser()`; reads, inserts into and deletes from
  `followers` or `venue_followers`; `toast` (sonner). [useFollow.ts:useFollow]
  [useFollow.ts:writeFollow]
- `useVenueStatus`: reads `venues` (`select("owner_id")`) and `venue_claims`
  (`select("id, instagram_handle")`); `console.error` on failure.
  [useVenueStatus.ts:useVenueStatus]
- `useVenueVerified`: None (context read only). [useVenueVerified.ts:useVenueVerified]
- `useIsMobile`: adds and removes a `window.matchMedia` change listener.
  [use-mobile.tsx:useIsMobile]
- `use-toast`: mutates module-level state; `DISMISS_TOAST` schedules removal with
  `setTimeout(TOAST_REMOVE_DELAY = 1000000)`. [use-toast.ts:addToRemoveQueue]

## Verification

- Run: `npm run typecheck` (`tsc --build`), then `npm run build` (`vite build`).
  `package.json` defines no `test` script.
