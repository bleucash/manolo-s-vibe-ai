import { Sparkles, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface EmptyFeedStateProps {
  isCreator?: boolean;
  onAction?: () => void;
}

export const EmptyFeedState = ({ isCreator, onAction }: EmptyFeedStateProps) => {
  const navigate = useNavigate();

  const handleAction = () => {
    if (onAction) {
      onAction();
    } else {
      navigate("/discovery");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Sparkles className="h-16 w-16 text-neon-pink/20 mb-4" />
      <h3 className="text-xl font-display text-white uppercase tracking-tighter mb-2">
        Your Feed is Empty
      </h3>
      <p className="text-zinc-500 text-sm mb-6 max-w-xs">
        {isCreator
          ? "Create your first post to share with your followers"
          : "Follow venues and talent to see their updates here"}
      </p>
      <Button
        onClick={handleAction}
        className="bg-neon-pink text-white uppercase tracking-widest text-xs"
      >
        {isCreator ? (
          <>
            <Plus className="h-4 w-4 mr-2" />
            Create Post
          </>
        ) : (
          "Discover Now"
        )}
      </Button>
    </div>
  );
};
