import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Check, Trash2, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import LoadingState from "@/components/ui/LoadingState";

const Notifications = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();

    // ✅ Real-time Handshake: Listen for new alerts as they happen
    const channel = supabase
      .channel("neural-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => fetchNotifications())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (err) {
      console.error("Feed Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const markAllRead = async () => {
    try {
      const { error } = await supabase.from("notifications").update({ is_read: true }).eq("is_read", false);

      if (error) throw error;
      fetchNotifications();
    } catch (err) {
      toast.error("Ledger Update Failure");
    }
  };

  const clearAll = async () => {
    try {
      const { error } = await supabase.from("notifications").delete().neq("id", "00000000-0000-0000-0000-000000000000"); // Standard way to clear all for current user RLS

      if (error) throw error;
      setNotifications([]);
      toast.success("Feed Purged");
    } catch (err) {
      toast.error("Purge Failure");
    }
  };

  if (loading) return <LoadingState />;

  return (
    <div className="min-h-screen bg-black pb-24 text-white animate-in fade-in duration-700">
      <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-md border-b border-white/5 safe-top">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-zinc-500">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Bell className="h-5 w-5 text-neon-purple" />
            <h1 className="text-xl font-black uppercase italic tracking-tighter">Neural Feed</h1>
          </div>
          {notifications.length > 0 && (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllRead}
                className="text-[10px] font-black uppercase tracking-widest text-zinc-500"
              >
                <Check className="h-3 w-3 mr-1" /> Read All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="text-[10px] font-black uppercase tracking-widest text-red-500/50 hover:text-red-500"
              >
                <Trash2 className="h-3 w-3 mr-1" /> Clear
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-md mx-auto">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="relative mb-6">
              <Bell className="h-16 w-16 text-zinc-900" />
              <div className="absolute inset-0 blur-2xl bg-neon-purple/5 rounded-full" />
            </div>
            <p className="text-zinc-600 font-black uppercase tracking-[0.3em] text-[10px]">Zero Activity Detected</p>
          </div>
        ) : (
          notifications.map((n) => (
            <Card
              key={n.id}
              className={`p-5 rounded-2xl transition-all border-white/5 ${
                n.is_read
                  ? "bg-zinc-900/20 opacity-50"
                  : "bg-zinc-900/60 border-l-2 border-l-neon-purple shadow-[0_0_20px_rgba(191,0,255,0.05)]"
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-white uppercase italic tracking-tight">{n.title}</h3>
                {!n.is_read && (
                  <Badge className="bg-neon-purple text-white text-[8px] font-black uppercase tracking-widest px-2 h-4">
                    New
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed font-medium">{n.message}</p>
              <p className="text-[8px] text-zinc-600 font-black uppercase mt-3">
                {new Date(n.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default Notifications;
