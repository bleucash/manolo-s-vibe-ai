import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, ArrowLeft, Sparkles, User, TrendingUp, Send } from "lucide-react";
import { toast } from "sonner";
import {
  ALL_POSITIONS,
  GUEST_FACING_POSITIONS,
  POSITIONS,
  guestFacingLabel,
} from "@/config/positions";
import { useUserMode } from "@/contexts/UserModeContext";
import { InviteTalentModal } from "@/components/InviteTalentModal";

interface TalentProfile {
  id: string;
  // profiles.username is nullable in the database. This said `string`, which
  // was simply wrong: a hand-written shape claiming a guarantee the schema
  // does not make. Both render sites already fall back
  // (`display_name || username`), so correcting the type costs nothing and
  // stops the next reader from trusting it.
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role_type: string;
  sub_role: string | null;
  // The keyset sort key: a generated column, coalesce(display_name, username,
  // ''), added 20260905120000. Typed nullable because that is what the
  // generator emits, but the '' tail makes it total at the database, so the
  // `?? ""` at the cursor is belt and braces rather than a real case.
  sort_name: string | null;
}

/** 24 divides evenly into both the 2-column and 3-column grids below. */
const PAGE_SIZE = 24;
const DEBOUNCE_MS = 300;

/**
 * Escape LIKE metacharacters so a typed term matches LITERALLY.
 *
 * NOT optional. The old client-side filter was `String.includes()`, which
 * treats every character literally. Server-side, `*`, `%` and `_` are all
 * WILDCARDS: measured 2026-09-05 against live, typing any one of them
 * returned every talent row instead of none. Without this a guest typing "%"
 * gets the whole directory back and nothing looks wrong.
 */
const likeEscape = (t: string) => t.replace(/[\\%_*]/g, (c) => "\\" + c);

/**
 * Quote a value for use INSIDE a PostgREST `or=(...)` list.
 *
 * Two measured facts, both load-bearing:
 *   1. An unquoted value containing a comma returns 400. `sort_name` is a
 *      person's name, and names contain commas, so the cursor must be quoted
 *      or pagination breaks on the first such person.
 *   2. A SINGLE backslash inside those quotes is CONSUMED. `"*Ne\_*"`
 *      returned 2 rows, not 0: the escape evaporates and `_` reverts to a
 *      wildcard, HTTP 200, no error. Doubling it (`"*Ne\\_*"`) returns 0.
 *
 * So this must run AFTER likeEscape, never before: it doubles the backslashes
 * that likeEscape added, which is exactly what the quoting layer needs. The
 * composed pipeline was verified end to end against live on every
 * metacharacter and on comma, parens, quote and backslash terms.
 */
const pgrstQuote = (v: string) => `"${v.replace(/[\\"]/g, (c) => "\\" + c)}"`;

/**
 * Operational positions never appear in the directory. Derived from
 * positions.ts rather than restated, so adding a position stays a one-line
 * change there.
 *
 * The `sub_role.is.null` disjunct is the whole point. The obvious form,
 * `sub_role=not.in.(...)`, becomes `NOT (sub_role IN (...))`, which evaluates
 * to NULL for a null sub_role and therefore DROPS those rows. Measured: that
 * would currently drop 2 of the 3 live talent. The client filter this
 * replaced kept them, deliberately, per the contract in positions.ts.
 *
 * Position keys are constrained by `profiles_sub_role_allowed` to bare
 * identifiers, so they need no quoting inside the list.
 */
const EXCLUSION_FILTER =
  `sub_role.is.null,sub_role.not.in.(` +
  ALL_POSITIONS.filter((p) => !POSITIONS[p].guestFacing).join(",") +
  `)`;

/**
 * The search half, or null when there is nothing to search for.
 *
 * The role clause is the piece with no server-side equivalent. Search used to
 * match `guestFacingLabel(sub_role)`, a display string derived in TypeScript,
 * so "bottle girl" matched "Bottle Girl". An `ilike` on `sub_role` compares
 * against `bottle_girl` and misses on the underscore. Resolving the term to
 * keys HERE keeps positions.ts as the single source of truth and reproduces
 * the old behaviour exactly.
 */
const buildSearchFilter = (term: string): string | null => {
  const t = term.trim().toLowerCase();
  if (!t) return null; // empty term matched everything before; it still does

  const pattern = pgrstQuote(`*${likeEscape(t)}*`);
  const parts = [`display_name.ilike.${pattern}`, `username.ilike.${pattern}`];

  const positions = ALL_POSITIONS.filter(
    (p) => POSITIONS[p].guestFacing && POSITIONS[p].label.toLowerCase().includes(t),
  );
  // Omitted entirely when nothing matches. An empty `in.()` does parse and
  // match nothing, measured, but omitting relies on nothing unusual.
  if (positions.length) parts.push(`sub_role.in.(${positions.join(",")})`);

  // PRESERVED, not dropped. The old filter fell back to `t.role_type` when
  // guestFacingLabel returned null, so the literal text "talent" matched
  // every talent who has not set a position, and 2 of the 3 live rows are in
  // that state. These two disjuncts are exactly "the displayed role label is
  // the Talent fallback". The behaviour is a little accidental, since every
  // row here is already role_type = 'talent', but changing it silently is
  // worse than keeping it.
  if ("talent".includes(t)) {
    parts.push("sub_role.is.null");
    parts.push(`sub_role.not.in.(${GUEST_FACING_POSITIONS.join(",")})`);
  }

  return parts.join(",");
};

const TalentDirectory = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const [talent, setTalent] = useState<TalentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  /**
   * Monotonic request id. The debounce below stops a request that has not
   * been SENT yet; this handles the race the debounce cannot, which is two
   * requests already in flight and the slower one landing last, overwriting
   * fresher results with stale ones. Every fetch captures the id at send time
   * and discards its own response if the ref has moved on.
   */
  const requestIdRef = useRef(0);

  // Invites need a manager AND a venue to invite into. activeVenueId is the
  // venue the invite lands on, so without one there is nothing to send.
  const { isManager, activeVenueId } = useUserMode();
  const canInvite = isManager && !!activeVenueId;
  const [inviteTarget, setInviteTarget] = useState<any>(null);

  /**
   * One page, server-side. This used to fetch EVERY talent row globally with
   * no limit and then filter the array in the browser, so it grew with
   * platform size rather than with the user.
   *
   * KEYSET, not `.range()`, and the cursor is COMPOSITE (sort_name, id).
   * sort_name alone is not unique: 60 people can share a display name, and a
   * single-column cursor makes the page boundary between two of them
   * ambiguous. The symptom is one person silently missing from the directory,
   * which is close to undiagnosable after the fact. Proven against a
   * 2,000-row rolled-back fixture: 61 pages walked with a seam landing inside
   * a 60-row identical-sort_name run, zero gaps and zero repeats, and the
   * planner using idx_profiles_talent_directory with no Sort node.
   *
   * Three chained `.or()` calls, which are ANDed. That is measured, not
   * assumed: a test designed so AND, OR, first-wins and last-wins each give a
   * different row count returned the AND answer. If they ORed, the
   * operational exclusion would leak.
   *
   * Fetches PAGE_SIZE + 1 and renders PAGE_SIZE, so "is there another page"
   * is exact with no extra round trip and no button that does nothing.
   */
  const fetchPage = useCallback(
    async (term: string, cursor: { sort_name: string; id: string } | null) => {
      let q = supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, role_type, sub_role, sort_name")
        .eq("role_type", "talent")
        .or(EXCLUSION_FILTER);

      const search = buildSearchFilter(term);
      if (search) q = q.or(search);

      if (cursor) {
        const n = pgrstQuote(cursor.sort_name);
        q = q.or(`sort_name.gt.${n},and(sort_name.eq.${n},id.gt.${cursor.id})`);
      }

      const { data, error } = await q
        .order("sort_name", { ascending: true })
        .order("id", { ascending: true })
        .limit(PAGE_SIZE + 1);

      if (error) throw error;
      return data ?? [];
    },
    [],
  );

  // Debounce: every keystroke is now a round trip.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedTerm(searchTerm), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [searchTerm]);

  // Page 1, and the reset when the term changes.
  //
  // Note what is NOT here: any cursor state to clear. The cursor is derived
  // at call time from the last rendered row, so replacing the list discards
  // it by construction rather than by anyone remembering a second reset. A
  // cursor from the previous term is meaningless against the new result set,
  // and this is the shape that makes carrying one over impossible.
  useEffect(() => {
    const myId = ++requestIdRef.current;
    setLoading(true);
    fetchPage(debouncedTerm, null)
      .then((page) => {
        if (requestIdRef.current !== myId) return;
        setTalent(page.slice(0, PAGE_SIZE));
        setHasMore(page.length > PAGE_SIZE);
      })
      .catch((err) => {
        if (requestIdRef.current !== myId) return;
        console.error(err);
        toast.error("Directory sync failed");
      })
      .finally(() => {
        if (requestIdRef.current === myId) setLoading(false);
      });
  }, [debouncedTerm, fetchPage]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    const last = talent[talent.length - 1];
    if (!last) return;

    // Captured WITHOUT bumping: this continues the current term rather than
    // starting a new query, so a term change mid-flight discards the append.
    const myId = requestIdRef.current;
    setLoadingMore(true);
    try {
      const page = await fetchPage(debouncedTerm, {
        sort_name: last.sort_name ?? "",
        id: last.id,
      });
      if (requestIdRef.current !== myId) return;
      setHasMore(page.length > PAGE_SIZE);
      const next = page.slice(0, PAGE_SIZE);
      if (next.length) {
        setTalent((prev) => {
          const known = new Set(prev.map((r) => r.id));
          return [...prev, ...next.filter((r) => !known.has(r.id))];
        });
      }
    } catch (err) {
      console.error(err);
      toast.error("Could not load more");
    } finally {
      if (requestIdRef.current === myId) setLoadingMore(false);
    }
  };

  if (loading)
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-neon-pink" />
      </div>
    );

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* STICKY HEADER */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-white/10">
        <div className="px-4 py-4 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/discovery")}
            className="text-zinc-400 hover:text-white bg-white/5 rounded-full"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-display text-white tracking-tighter uppercase flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-neon-pink" />
            Spotlight Directory
          </h1>
        </div>

        <div className="px-4 pb-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <Input
              placeholder="Search DJ, Dancer, Host..."
              className="pl-11 bg-zinc-900/50 border-white/10 text-white rounded-xl h-12"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* TALENT GRID */}
      <div className="px-4 py-6">
        {talent.length === 0 ? (
          <div className="text-center py-24">
            <User className="w-12 h-12 text-zinc-800 mx-auto mb-4" />
            <p className="text-zinc-500">No matches found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
            {talent.map((t) => (
              <div key={t.id} className="relative cursor-pointer group" onClick={() => navigate(`/talent/${t.id}`)}>
                <div className="aspect-[3/4.5] rounded-2xl overflow-hidden relative transition-all duration-500 border border-white/10">
                  <img
                    src={t.avatar_url || "https://github.com/shadcn.png"}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent" />

                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h3 className="text-white font-display text-lg leading-none truncate tracking-tight">
                      {t.display_name || t.username}
                    </h3>
                    {/* The real position, always. This used to read "Top
                        Talent" for array indices 0, 3 and 7. That was a
                        placeholder standing in for the charge system, which
                        never got wired, so the glow and the badge claimed an
                        engagement signal that was really just sort order, and
                        hid the person's actual position to do it. Removed
                        2026-09-05 rather than deferred: a false claim to
                        guests is worse than an absent feature. The real
                        version returns when charges exist. */}
                    <p className="text-neon-pink text-[10px] font-bold uppercase tracking-widest mt-2">
                      {guestFacingLabel(t.sub_role) || "Talent"}
                    </p>
                  </div>

                  {/* Manager-only. The directory was guest-only before: no
                      user context at all, every card going to the public
                      profile. stopPropagation so inviting does not also
                      navigate away to that profile. */}
                  {canInvite && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setInviteTarget(t);
                      }}
                      className="absolute top-3 left-3 z-10 h-8 px-3 rounded-full bg-black/70 backdrop-blur-md border border-amber-500/40 text-amber-500 text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 hover:bg-amber-500 hover:text-black transition-all"
                    >
                      <Send className="w-3 h-3" /> Invite
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* A button rather than a scroll listener, matching ChatWindow: an
            explicit control is honest about what it does and does not have to
            fight the browser's scroll anchoring.

            Rendered ONLY when there is genuinely another page. hasMore comes
            from fetching PAGE_SIZE + 1 and rendering PAGE_SIZE, so it is
            exact. The `page.length === PAGE_SIZE` form used in useChat is off
            by one at a full final page, which shows a button that fetches
            nothing. */}
        {hasMore && (
          <div className="flex justify-center pt-8">
            <Button
              variant="ghost"
              onClick={loadMore}
              disabled={loadingMore}
              className="h-9 px-5 rounded-full bg-white/5 border border-white/10 text-zinc-500 hover:text-white text-[9px] font-black uppercase tracking-[0.2em]"
            >
              {loadingMore ? "Loading" : "Load more talent"}
            </Button>
          </div>
        )}
      </div>

      <InviteTalentModal
        talent={inviteTarget}
        isOpen={!!inviteTarget}
        onClose={() => setInviteTarget(null)}
      />
    </div>
  );
};

export default TalentDirectory;
