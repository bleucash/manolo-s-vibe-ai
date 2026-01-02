import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CreatePostDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onPostCreated?: () => void;
}

export const CreatePostDialog = ({ open, onOpenChange, onPostCreated }: CreatePostDialogProps) => {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim()) {
      toast.error("Post content cannot be empty");
      return;
    }
    
    setLoading(true);
    // Placeholder for actual post creation logic
    await new Promise((resolve) => setTimeout(resolve, 500));
    toast.success("Post created!");
    setContent("");
    onOpenChange?.(false);
    setLoading(false);
    onPostCreated?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-white/10">
        <DialogHeader>
          <DialogTitle className="text-white">Create Post</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Textarea
            placeholder="What's happening tonight?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[120px] bg-zinc-800 border-white/10 text-white"
          />
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-neon-pink text-white"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
