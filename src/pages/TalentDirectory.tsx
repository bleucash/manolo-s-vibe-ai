import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, ArrowLeft, Sparkles, User, TrendingUp } from "lucide-react";
import { toast } from "sonner";

// 1. SHARED NEON ANIMATION (Matches Discovery.tsx)
const neonPulseStyles = `
  @keyframes neon-breathe {
    0%, 100% { 
      box-shadow: 0 0 15px rgba(255, 0, 128, 0.3); 
      border-color: rgba(255, 0, 128, 0.2);
    }
    50% { 
      box-shadow: 0 0 40px rgba(255, 0, 128, 0.7); 
      border-color: rgba(255, 0, 128, 1);
    }
  }
  .animate-neon-breathe {
    animation: neon-breathe 3s ease-in-out infinite;
  }
`;

interface TalentProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  role_type: string;
  sub_role: string | null;
  is_featured?: boolean;
}

const TalentDirectory = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [talent, setTalent] = useState<TalentProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTalent();
  }, []);

  const fetchTalent = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, role_type, sub_role")
        .eq("role_type", "talent")
        .order("username", { ascending: true });

      if (error) throw error;

      const enhancedTalent = (data || []).map((t, i) => ({
        ...t,
        is_featured: i === 0 || i === 3 || i === 7, // Featured Logic
      }));

      setTalent(enhancedTalent);
    } catch (error) {
      console.error(error);
      toast.error("Directory sync failed");
    } finally {
      setLoading(false);
    }
  };

  const filteredTalent = talent.filter((t) => {
    const searchLower = searchTerm.toLowerCase();
    const name = (t.display_name || t.username || "").toLowerCase();
    const role = (t.sub_role || t.role_type || "").toLowerCase();
    return name.includes(searchLower) || role.includes(searchLower);
  });

  if (loading)
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-neon-pink" />
      </div>
    );

  return (
    <div className="min-h-screen bg-background pb-24">
      <style>{neonPulseStyles}</style>

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
        {filteredTalent.length === 0 ? (
          <div className="text-center py-24">
            <User className="w-12 h-12 text-zinc-800 mx-auto mb-4" />
            <p className="text-zinc-500">No matches found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
            {filteredTalent.map((t) => (
              <div key={t.id} className="relative cursor-pointer group" onClick={() => navigate(`/talent/${t.id}`)}>
                <div
                  className={`aspect-[3/4.5] rounded-2xl overflow-hidden relative transition-all duration-500 ${
                    t.is_featured ? "border-neon-pink animate-neon-breathe" : "border border-white/10"
                  }`}
                >
                  <img
                    src={t.avatar_url || "https://github.com/shadcn.png"}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent" />

                  {t.is_featured && (
                    <div className="absolute top-3 right-3 z-10">
                      <Badge className="bg-neon-pink text-white border-none text-[8px] font-bold px-2 py-0.5 uppercase tracking-widest shadow-lg">
                        Featured
                      </Badge>
                    </div>
                  )}

                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h3 className="text-white font-display text-lg leading-none truncate tracking-tight">
                      {t.display_name || t.username}
                    </h3>
                    <p className="text-neon-pink text-[10px] font-bold uppercase tracking-widest mt-2">
                      {t.is_featured ? "Top Talent" : t.sub_role || "Talent"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TalentDirectory;
