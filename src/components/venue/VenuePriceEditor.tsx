import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DollarSign, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

interface VenuePriceEditorProps {
  venue: {
    id: string;
    name: string;
    entry_price?: number;
    vip_price?: number;
  };
}

const VenuePriceEditor = ({ venue }: VenuePriceEditorProps) => {
  const [entryPrice, setEntryPrice] = useState<number>(venue.entry_price ?? 0);
  const [vipPrice, setVipPrice] = useState<number>(venue.vip_price ?? 0);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setEntryPrice(venue.entry_price ?? 0);
    setVipPrice(venue.vip_price ?? 0);
  }, [venue]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("venues")
        .update({
          entry_price: entryPrice,
          vip_price: vipPrice,
        } as any)
        .eq("id", venue.id);

      if (error) throw error;

      toast.success("Prices updated successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to update prices");
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
                onChange={(e) => setEntryPrice(parseFloat(e.target.value) || 0)}
                className="pl-7 bg-muted/50 border-border/50"
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
                onChange={(e) => setVipPrice(parseFloat(e.target.value) || 0)}
                className="pl-7 bg-muted/50 border-border/50"
              />
            </div>
          </div>
        </div>
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full bg-primary hover:bg-primary/90"
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Save Prices
        </Button>
      </CardContent>
    </Card>
  );
};

export default VenuePriceEditor;
