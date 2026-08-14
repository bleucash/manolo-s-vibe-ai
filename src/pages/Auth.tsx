import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");

  // Preserve a same-origin relative redirect (used by the OAuth consent flow).
  const nextParam = new URLSearchParams(window.location.search).get("next");
  const redirectTo = nextParam && /^\/(?!\/)/.test(nextParam) ? nextParam : "/";

  // Where each role actually works. Talent and managers used to land on the
  // guest homepage and navigate themselves.
  //
  // role_type is NOT NULL, defaults to 'guest', and handle_new_user inserts
  // 'guest' explicitly, so a brand-new signup is guest rather than null and
  // needs no separate case. The enum still carries unused legacy values
  // (staff, user, venue_manager), which is why this falls through to
  // /discovery rather than assuming the set is exhaustive.
  const landingPathForRole = (role: string | null | undefined) => {
    if (role === "manager") return "/venue/manage";
    if (role === "talent") return "/talent-manage";
    return "/discovery";
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // 🛡️ CLEAN SLATE: Clear only this app's own mode state before signing in.
    // Supabase's own sb-* session keys are left untouched.
    localStorage.removeItem("userMode");
    localStorage.removeItem("activeVenueId");
    try {
      if (mode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        // An explicit ?next always wins: it means something bounced the user
        // here mid-flow (the OAuth consent screen) and is waiting to resume.
        // Overriding it with a role landing page would silently drop that.
        let target = nextParam ? redirectTo : "/discovery";
        if (!nextParam) {
          // Read the role directly rather than waiting for UserModeContext,
          // which has not re-synced yet at this point.
          const { data: profile } = await supabase
            .from("profiles")
            .select("role_type")
            .eq("id", data.user.id)
            .maybeSingle();
          target = landingPathForRole(profile?.role_type);
        }

        // Use a hard reload to ensure Context re-initializes with fresh data
        window.location.href = target;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}${redirectTo}` },
        });
        if (error) throw error;
        alert("Check your email for the confirmation link!");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md bg-zinc-950 border-white/10">
        <CardHeader>
          <CardTitle className="text-white">{mode === "login" ? "Welcome Back" : "Create Account"}</CardTitle>
          <CardDescription className="text-zinc-500">Enter your credentials to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            {error && (
              <Alert variant="destructive" className="bg-red-500/10 border-red-500/50 text-red-500">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-zinc-400">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-zinc-900 border-white/10 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" title="Password" className="text-zinc-400">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-zinc-900 border-white/10 text-white"
              />
            </div>

            <Button type="submit" className="w-full bg-white text-black hover:bg-zinc-200" disabled={loading}>
              {loading ? "Synchronizing..." : mode === "login" ? "Sign In" : "Sign Up"}
            </Button>

            <div className="text-center text-sm text-muted-foreground">
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={() => setMode(mode === "login" ? "signup" : "login")}
              >
                {mode === "login" ? "Need an account? Sign up" : "Have an account? Log in"}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
