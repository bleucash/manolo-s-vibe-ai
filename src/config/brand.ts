/**
 * Brand-level values that are expected to change before launch.
 *
 * Deliberately its own file rather than inlined at the point of use: these
 * get swapped once the final brand name and accounts are settled, and hunting
 * them across JSX is exactly the kind of thing that gets half-done.
 *
 * Add to this file rather than hardcoding a new one somewhere.
 */

/**
 * Instagram account that talent applicants DM their verification code to.
 * Stored WITHOUT the leading "@" so it composes into both display strings
 * and instagram.com URLs; add the "@" at render time.
 *
 * TEMPORARY: this is a test account used to exercise the DM handshake. The
 * real brand account is still undecided, so this must change again before
 * public launch. Applicants are told to DM whatever is set here.
 */
export const VERIFICATION_INSTAGRAM_HANDLE = "__money__machine";
