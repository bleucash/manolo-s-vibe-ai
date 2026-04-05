

## Problem

Line 187 shows only a single skeleton when loading, and when `spotlightTalent` is empty (no data returned from RPC), the section shows nothing except the Directory button.

## Plan

**File: `src/pages/Discovery.tsx`**

1. **Replace the single loading skeleton** (line 187) with 3 skeleton cards that match the `SpotlightCard` dimensions (`w-[75vw] h-[48dvh] rounded-[2.5rem]`), each with inner skeleton elements for the name/role text area at the bottom.

2. **Add empty-state skeletons** — when `!loading && spotlightTalent.length === 0`, render 3 placeholder skeleton cards so the spotlight section never appears empty (just the directory button).

**File: `src/pages/Gigs.tsx`** (build fix)

3. Fix the TS error by passing the required `userId` prop to `TalentDashboard`.

---

**Skeleton card design:**
- Outer: `w-[75vw] md:w-80 h-[48dvh] rounded-[2.5rem] bg-zinc-950 border border-white/5 overflow-hidden`
- Inside bottom area: skeleton bar for name (w-32 h-6) and sub-role (w-20 h-3)
- Animate with standard `animate-pulse`

