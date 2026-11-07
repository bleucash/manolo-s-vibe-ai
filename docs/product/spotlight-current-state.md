# Spotlight: how it works today

Status: a description of current behaviour, for product logic review area 1 (Discovery and Spotlight). It is not a spec and nothing in it is approved design. Checked against the code at `f843037` and the live database on 2026-11-06.

## What users actually see right now

**Everyone sees the same empty card: "Spotlight Is Cold. No talent trending right now. Charge a post to heat someone up."** It sits at the top of Discovery, followed by the card that links to the talent directory.

This is not because nobody has tapped anyone. Taps are being recorded, but the database will not let any user's request read them back, so the ranking always comes back empty for signed-in and signed-out visitors alike. Measured 2026-11-06 with one test tap: the database's own admin connection got 1 talent back, a signed-in user got 0, a signed-out visitor got 0. (Technically: the ranking function runs with the visitor's permissions, and the table of taps has no rule allowing anyone to read it. Backlog A28.)

The empty card's prompt is also misleading: charging a post does not feed Spotlight. Post charges feed a separate "heat score" that nothing displays yet.

## Where it appears

- Only on the Discovery page, as the first row: up to 3 large talent cards that scroll sideways, then a card that opens the talent directory.
- Nowhere else. Home, talent profiles and venue pages do not show it.
- Discovery is open to everyone, so signed-out visitors see the row too.

## What data it uses

- **Card taps on Discovery.** When a signed-in user taps a talent or venue card on Discovery (including the Spotlight cards themselves), the app records one "tap" row. Only talent taps count for Spotlight; venue taps are stored and unused.
- Taps were not being saved at all from 2026-03-28 until fix 2 (`e60b43c`, 2026-11-04). They are saved now.
- Signed-out visitors' taps are not recorded.
- **Each person counts once per talent, ever.** The database refuses a second tap row for the same person and talent, so tapping again later adds nothing, even weeks later.
- The talent's own taps on their own card count like anyone else's.

## How it ranks

- Each tap is worth 1 point, and its value fades with time: about half after 14 hours.
- Only taps from the last 24 hours count. After that a tap is gone from the ranking for good (and, because of the once-ever rule, that person can never put it back).
- Talent are ordered by their total, highest first, and the top 3 are shown.
- Only accounts that are currently talent can appear. Security and event-staff positions are filtered out after the ranking, so the row can show fewer than 3 even when more qualify.

## Who sees it

Everyone who opens Discovery: guests, talent, managers, and signed-out visitors. Everyone sees the same row; nothing is personalised.

## Smaller things noticed while checking

- The Spotlight card is meant to show a green "active" badge when the talent is working at an open venue right now, but the ranking does not return the venue details the badge needs, so the badge can never appear on a Spotlight card (it works on the other Discovery cards).
- The ranking function's code in the repository's migration files is an older version (it counted post charges, not taps). The live version is different (backlog A2).

## Questions for the product discussion

These are open, not proposals:

1. What should Spotlight measure: popularity (taps or views), approval (charges), presence right now, or a mix?
2. Should it be visible to signed-out visitors?
3. Should repeat interest from the same person count, and if so how often (for example once per day)?
4. Should a talent's own taps count?
5. What should the row show when nothing qualifies: an empty card, a fallback (for example most recently active talent), or nothing?
6. Should venues have their own Spotlight (CLAUDE.md's "venue heat" tiers)?
