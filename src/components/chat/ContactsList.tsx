import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { MessageCircle, User, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Contact {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

interface ContactsListProps {
  onChatStart: (conversationId: string) => void;
}

export const ContactsList = ({ onChatStart }: ContactsListProps) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [startingChatWith, setStartingChatWith] = useState<string | null>(null);

  useEffect(() => {
    const fetchContacts = async () => {
      setIsLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setCurrentUserId(user.id);

        // 1. Fetch Social Follows
        const { data: followsData } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", user.id);

        const socialIds = followsData?.map(f => f.following_id) || [];

        // 2. Fetch Professional Connections (Residencies)
        // This query finds your manager if you are talent, or your staff if you are a manager
        const { data: staffData } = await supabase
          .from("venue_staff")
          .select(`user_id, venues ( owner_id )`)
          .or(`user_id.eq.${user.id},venues.owner_id.eq.${user.id}`)
          .eq("status", "active");

        const professionalIds = staffData?.flatMap(s => [s.user_id, (s.venues as any)?.owner_id]) || [];

        // 3. Deduplicate and Filter Self
        const combinedIds = Array.from(new Set([...socialIds, ...professionalIds]))
          .filter(id => id && id !== user.id);

        if (combinedIds.length === 0) {
          setContacts([]);
          return;
        }

        // 4. Fetch Profiles for the Unified List
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, display_name, username, avatar_url")
          .in("id", combinedIds);

        setContacts(profilesData || []);
      } catch (error) {
        console.error("Contacts Sync Error:", error);
        toast.error("Failed to load contacts");
      } finally {
        setIsLoading(false);
      }
    };

    fetchContacts();
  }, []);

  const handleStartChat = async (targetUserId: string) => {
    if (!currentUserId) return;
    setStartingChatWith(targetUserId);
    try {
      // Check for existing conversation to avoid duplicates
      const { data: existing } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", currentUserId);

      if (existing) {
        for (const convo of existing) {
          const { data: other } = await supabase
            .from("conversation_participants")
            .select("user_id")
            .eq("conversation_id", convo.conversation_id)
            .eq("user_id", targetUserId)
            .maybeSingle();

          if (other) {
            onChatStart(convo.conversation_id);
            return;
          }
        }
      }

      // Create new conversation entry
      const { data: newConvo } = await supabase.from("conversations").insert({}).select().single();
      if (newConvo) {
        await supabase.from("conversation_participants").insert([
          { conversation_id: newConvo.id, user_id: currentUserId },
          { conversation_id: newConvo.id, user_id: targetUserId },
        ]);
        onChatStart(newConvo.id);
      }
    } catch (err) {
      toast.error("Could not start chat");
    } finally {
      setStartingChatWith(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-2 p-2">
        {contacts.map((contact) => (
          <div
            key={contact.id}
            className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900/50 hover:bg-zinc-800/50 transition-colors"
          >
            <Avatar className="h-10 w-10">
              <AvatarImage src={contact.avatar_url ?? undefined} />
              <AvatarFallback className="bg-primary/20 text-primary">
                {contact.display_name?.charAt(0) ?? <User className="h-4 w-4" />}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-white truncate">
                {contact.display_name ?? "User"}
              </p>
              {contact.username && (
                <p className="text-sm text-muted-foreground truncate">
                  @{contact.username}
                </p>
              )}
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => handleStartChat(contact.id)}
              disabled={startingChatWith === contact.id}
            >
              {startingChatWith === contact.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MessageCircle className="h-4 w-4 text-primary" />
              )}
            </Button>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
};
