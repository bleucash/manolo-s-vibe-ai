import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Card } from "@/components/ui/card";
import { Activity, TrendingUp, Bell } from "lucide-react";

export const ActivitySidebar = () => {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5 text-muted-foreground" />
        </Button>
      </SheetTrigger>
      <SheetContent className="bg-zinc-900 border-white/10">
        <SheetHeader>
          <SheetTitle className="text-white font-display uppercase tracking-tighter">Activity</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <Card className="bg-zinc-800 border-white/5 p-4">
            <h3 className="text-white font-display text-sm uppercase tracking-widest flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-neon-pink" />
              Recent Activity
            </h3>
            <div className="space-y-3">
              <p className="text-zinc-500 text-sm italic">No recent activity</p>
            </div>
          </Card>

          <Card className="bg-zinc-800 border-white/5 p-4">
            <h3 className="text-white font-display text-sm uppercase tracking-widest flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-neon-green" />
              Trending
            </h3>
            <div className="space-y-3">
              <p className="text-zinc-500 text-sm italic">Nothing trending yet</p>
            </div>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
};
