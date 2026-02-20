import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

interface PortfolioItem {
  id: string;
  media_url: string;
  media_type: "image" | "video";
  caption?: string;
}

interface PortfolioGalleryProps {
  items: PortfolioItem[];
  className?: string;
}

export const PortfolioGallery = ({ items, className = "" }: PortfolioGalleryProps) => {
  const [selectedItem, setSelectedItem] = useState<PortfolioItem | null>(null);
  const [loading, setLoading] = useState<{ [key: string]: boolean }>({});

  if (!items || items.length === 0) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <p className="text-muted-foreground text-sm">No Portfolio Items</p>
      </div>
    );
  }

  return (
    <>
      <div className={`flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 scrollbar-none ${className}`}>
        {items.map((item) => (
          <div
            key={item.id}
            onClick={() => setSelectedItem(item)}
            className="relative shrink-0 w-48 h-64 rounded-2xl overflow-hidden border border-white/5 bg-zinc-900 snap-center group cursor-pointer"
          >
            {loading[item.id] && (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-900 z-10">
                <Loader2 className="w-6 h-6 text-zinc-600 animate-spin" />
              </div>
            )}

            {item.media_type === "video" ? (
              <video
                src={item.media_url}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                muted
                loop
                playsInline
                onLoadedData={() => setLoading((prev) => ({ ...prev, [item.id]: false }))}
              />
            ) : (
              <img
                src={item.media_url}
                alt={item.caption || "Portfolio item"}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                onLoad={() => setLoading((prev) => ({ ...prev, [item.id]: false }))}
              />
            )}

            {item.caption && (
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <p className="text-white text-xs truncate">{item.caption}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      <Dialog open={!!selectedItem} onOpenChange={() => setSelectedItem(null)}>
        <DialogContent className="max-w-2xl p-0 bg-zinc-900 border-zinc-800 overflow-hidden">
          {selectedItem && (
            <div className="relative w-full">
              {selectedItem.media_type === "video" ? (
                <video
                  src={selectedItem.media_url}
                  className="w-full max-h-[80vh] object-contain"
                  controls
                  autoPlay
                  loop
                  muted
                />
              ) : (
                <img
                  src={selectedItem.media_url}
                  alt={selectedItem.caption || "Portfolio item"}
                  className="w-full max-h-[80vh] object-contain"
                />
              )}
              {selectedItem.caption && (
                <div className="p-4 bg-zinc-900">
                  <p className="text-sm text-muted-foreground">{selectedItem.caption}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
