import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Skeleton } from "@/components/ui/skeleton";
import { Image as ImageIcon, Lock, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface PortfolioGalleryProps {
  userId: string;
  isEditable?: boolean;
}

export const PortfolioGallery = ({ userId, isEditable = false }: PortfolioGalleryProps) => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) fetchPortfolio();
  }, [userId]);

  const fetchPortfolio = async () => {
    try {
      const { data, error } = await supabase
        .from("portfolio_items")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setItems(data || []);
    } catch (err) {
      console.error("Portfolio Sync Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (itemId: string) => {
    if (!isEditable) return;
    try {
      const { error } = await supabase.from("portfolio_items").delete().eq("id", itemId);
      if (error) throw error;
      setItems(items.filter(item => item.id !== itemId));
      toast.success("Content purged from portfolio");
    } catch (err) {
      toast.error("Deletion failed");
    }
  };

  if (loading) {
    return (
      <div className="flex gap-4 overflow-hidden px-8">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="min-w-[300px] h-[45vh] rounded-[2.5rem] bg-zinc-900" />
        ))}
      </div>
    );
  }

  if (items.length === 0 && !isEditable) return null;

  return (
    <div className="w-full space-y-4">
      {/* SECTION HEADER */}
      <div className="px-8 flex justify-between items-center">
        <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.4em] flex items-center gap-2">
          <ImageIcon className="w-3 h-3" /> Professional Portfolio
        </h3>
      </div>

      {/* HORIZONTAL SCROLL AREA */}
      <div className="flex gap-6 overflow-x-auto px-8 pb-8 no-scrollbar snap-x snap-mandatory">
        {items.map((item) => (
          <div 
            key={item.id} 
            className="relative min-w-[70vw] md:min-w-[350px] h-[45vh] snap-center group"
          >
            <div className="w-full h-full overflow-hidden rounded-[2.5rem] border border-white/5 bg-zinc-900 shadow-2xl transition-transform duration-500 group-hover:scale-[1.02]">
              <img
                src={item.image_url}
                alt="Portfolio content"
                className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700"
              />
              
              {/* EDIT OVERLAY */}
              {isEditable && (
                <button
                  onClick={() => handleDelete(item.id)}
                  className="absolute top-6 right-6 p-3 bg-black/60 backdrop-blur-md rounded-full text-red-500 border border-red-500/20 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}

        {/* EMPTY STATE FOR OWNER */}
        {isEditable && items.length === 0 && (
          <div className="min-w-[70vw] md:min-w-[350px] h-[45vh] rounded-[2.5rem] border border-dashed border-white/10 flex flex-col items-center justify-center bg-zinc-900/20">
            <ImageIcon className="w-8 h-8 text-zinc-700 mb-4" />
            <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest text-center px-12">
              Portfolio Empty. Use the Dashboard to upload professional content.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
