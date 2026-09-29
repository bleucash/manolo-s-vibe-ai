import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DollarSign, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { useVenueVerified } from "@/hooks/useVenueVerified";
import { Tier2Notice } from "@/components/dashboard/Tier2Notice";

interface VenuePriceEditorProps {
  // Only what the context venue actually carries. Prices used to be declared
  // here as optional props, which let the context venue (no price columns)
  // compile and open the editor at $0/$0. They are fetched below instead.
  venue: { id: string; name: string };
}

// A price field is valid only when it holds a real, non-negative number. An
// empty field is not zero: it blocks saving rather than writing 0.
const parsePrice = (raw: string): number | null => {
  if (raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
};

const VenuePriceEditor = ({ venue }: VenuePriceEditorProps) => {
  // Held as the text in the input, not a number, so an emptied field stays
  // empty instead of silently becoming 0.
  const [entryPrice, setEntryPrice] = useState("");
  const [vipPrice, setVipPrice] = useState("");
  const [loadState, setLoadState] = useState<"loading" | "loaded" | "failed">("loading");
  const [isSaving, setIsSaving] = useState(false);
  const { isVerified, isLoading: verificationLoading } = useVenueVerified(venue.id);
  const tier2Blocked = !verificationLoading && !isVerified;

  // Keyed on venue.id, not the venue object: a context re-sync builds a new
  // object and must not reset what the manager is typing.
  useEffect(() => {
    let cancelled = false;
    setLoadState("loading");
    supabase
      .from("venues")
      .select("entry_price, vip_price")
      .eq("id", venue.id)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          console.error("Error loading prices:", error);
          setLoadState("failed");
          return;
        }
        // A NULL price was never set; it shows as an empty field, not $0.
        setEntryPrice(data.entry_price != null ? String(data.entry_price) : "");
        setVipPrice(data.vip_price != null ? String(data.vip_price) : "");
        setLoadState("loaded");
      });
    return () => {
      cancelled = true;
    };
  }, [venue.id]);

  const entryValue = parsePrice(entryPrice);
  const vipValue = parsePrice(vipPrice);
  const pricesValid = entryValue !== null && vipValue !== null;
  const canSave = loadState === "loaded" && pricesValid && !isSaving && !tier2Blocked;

  const handleSave = async () => {
    if (loadState !== "loaded" || entryValue === null || vipValue === null) return;
    setIsSaving(true);
    try {
      // .select() so an RLS-filtered update cannot read as success: it returns
      // 200 with zero rows, and this used to say "Prices updated" regardless.
      const { data, error } = await supabase
        .from("venues")
        .update({ entry_price: entryValue, vip_price: vipValue })
        .eq("id", venue.id)
        .select("id");

      if (error) throw error;
      if (!data || data.length === 0) {
        toast.error("Failed to update prices", { description: "Nothing was saved." });
        return;
      }

      toast.success("Prices updated successfully!");
    } catch (err: any) {
      // Never surface err.message: the venues_require_business_verified
      // trigger raises "Business verification required to change entry_price",
      // which was being shown to the user verbatim as a raw DB exception.
      console.error("Error updating prices:", err);
      toast.error("Failed to update prices");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="glass border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-neon-green" />
          Ticket Pricing
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {tier2Blocked && <Tier2Notice reason="set ticket prices" venueId={venue.id} />}
        {loadState === "loading" ? (
          <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading prices
          </div>
        ) : loadState === "failed" ? (
          <p className="py-6 text-center text-xs text-red-500">Prices could not be loaded</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="entry-price" className="text-xs text-muted-foreground">
                  General Admission
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="entry-price"
                    type="number"
                    min={0}
                    step={0.01}
                    value={entryPrice}
                    onChange={(e) => setEntryPrice(e.target.value)}
                    disabled={tier2Blocked}
                    className="pl-7 bg-muted/50 border-border/50 disabled:opacity-40"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="vip-price" className="text-xs text-muted-foreground">
                  VIP Entry
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="vip-price"
                    type="number"
                    min={0}
                    step={0.01}
                    value={vipPrice}
                    onChange={(e) => setVipPrice(e.target.value)}
                    disabled={tier2Blocked}
                    className="pl-7 bg-muted/50 border-border/50 disabled:opacity-40"
                  />
                </div>
              </div>
            </div>
            {!pricesValid && !tier2Blocked && (
              <p className="text-xs text-muted-foreground">Enter both prices to save.</p>
            )}
            <Button
              onClick={handleSave}
              disabled={!canSave}
              className="w-full bg-primary hover:bg-primary/90"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Prices
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default VenuePriceEditor;
