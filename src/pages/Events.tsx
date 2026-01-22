import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, isToday, isTomorrow, isThisWeek, parseISO } from "date-fns";
import { Calendar, MapPin, Ticket, Star, Clock, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TicketPurchaseDialog } from "@/components/TicketPurchaseDialog";

interface EventWithDetails {
  id: string;
  name: string;
  description: string | null;
  date: string;
  price: number;
  total_tickets: number;
  image_url: string | null;
  is_active: boolean;
  venue_id: string;
  created_by: string | null;
  venues: {
    id: string;
    name: string;
    location: string;
    image_url: string | null;
  } | null;
  profiles: {
    id: string;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
}

type DateCategory = "today" | "tomorrow" | "thisWeek" | "upcoming";

const Events = () => {
  const [selectedEvent, setSelectedEvent] = useState<EventWithDetails | null>(null);
  const [ticketDialogOpen, setTicketDialogOpen] = useState(false);

  const { data: events, isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select(`
          *,
          venues (id, name, location, image_url),
          profiles:created_by (id, display_name, username, avatar_url)
        `)
        .eq("is_active", true)
        .gte("date", new Date().toISOString())
        .order("date", { ascending: true });

      if (error) throw error;
      return data as EventWithDetails[];
    },
  });

  const categorizeEvents = (events: EventWithDetails[]) => {
    const categories: Record<DateCategory, EventWithDetails[]> = {
      today: [],
      tomorrow: [],
      thisWeek: [],
      upcoming: [],
    };

    events.forEach((event) => {
      const eventDate = parseISO(event.date);
      if (isToday(eventDate)) {
        categories.today.push(event);
      } else if (isTomorrow(eventDate)) {
        categories.tomorrow.push(event);
      } else if (isThisWeek(eventDate)) {
        categories.thisWeek.push(event);
      } else {
        categories.upcoming.push(event);
      }
    });

    return categories;
  };

  const featuredEvents = events?.slice(0, 5) || [];
  const categorizedEvents = events ? categorizeEvents(events) : null;

  const handleGetTickets = (event: EventWithDetails) => {
    setSelectedEvent(event);
    setTicketDialogOpen(true);
  };

  const getCategoryLabel = (category: DateCategory): string => {
    const labels: Record<DateCategory, string> = {
      today: "Today",
      tomorrow: "Tomorrow",
      thisWeek: "This Week",
      upcoming: "Upcoming",
    };
    return labels[category];
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 pb-24">
        <div className="space-y-6">
          <Skeleton className="h-8 w-48 bg-white/5" />
          <div className="flex gap-4 overflow-hidden">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-64 w-72 flex-shrink-0 rounded-2xl bg-white/5" />
            ))}
          </div>
          <Skeleton className="h-6 w-32 bg-white/5" />
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full rounded-2xl bg-white/5" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 animate-in fade-in duration-500">
      {/* Header */}
      <div className="p-4 pt-6">
        <h1 className="text-3xl font-black uppercase tracking-tighter text-foreground">
          Events
        </h1>
        <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">
          Discover What's Happening
        </p>
      </div>

      {/* Featured Events - Horizontal Scroll */}
      {featuredEvents.length > 0 && (
        <section className="mb-8">
          <div className="px-4 mb-4 flex items-center gap-2">
            <Star className="w-4 h-4 text-primary" />
            <h2 className="text-xs font-black uppercase tracking-widest text-primary">
              Featured Events
            </h2>
          </div>
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-4 px-4 pb-4">
              {featuredEvents.map((event) => (
                <Card
                  key={event.id}
                  className="w-72 flex-shrink-0 bg-white/5 border-white/10 rounded-2xl overflow-hidden group hover:border-primary/50 transition-all duration-300"
                >
                  <div className="relative h-40 overflow-hidden">
                    <img
                      src={event.image_url || event.venues?.image_url || "/placeholder.svg"}
                      alt={event.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <Badge className="absolute top-3 left-3 bg-primary/90 text-primary-foreground border-0 text-[10px] font-black uppercase tracking-wider">
                      Featured
                    </Badge>
                    <div className="absolute bottom-3 left-3 right-3">
                      <h3 className="text-lg font-black uppercase tracking-tight text-white truncate">
                        {event.name}
                      </h3>
                      <div className="flex items-center gap-1 text-white/70 mt-1">
                        <MapPin className="w-3 h-3" />
                        <span className="text-xs truncate">{event.venues?.name}</span>
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        <span className="text-xs">
                          {format(parseISO(event.date), "MMM d, h:mm a")}
                        </span>
                      </div>
                      <span className="text-primary font-black text-lg">
                        ${event.price}
                      </span>
                    </div>
                    <Button
                      onClick={() => handleGetTickets(event)}
                      className="w-full h-10 bg-primary text-primary-foreground font-black uppercase tracking-wider text-xs rounded-xl hover:bg-primary/90 transition-colors"
                    >
                      <Ticket className="w-4 h-4 mr-2" />
                      Get Tickets
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </section>
      )}

      {/* Categorized Events */}
      <div className="px-4 space-y-8">
        {categorizedEvents &&
          (Object.keys(categorizedEvents) as DateCategory[]).map((category) => {
            const categoryEvents = categorizedEvents[category];
            if (categoryEvents.length === 0) return null;

            return (
              <section key={category}>
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-4 h-4 text-primary" />
                  <h2 className="text-xs font-black uppercase tracking-widest text-primary">
                    {getCategoryLabel(category)}
                  </h2>
                  <Badge variant="secondary" className="ml-auto bg-white/5 text-muted-foreground border-0 text-[10px]">
                    {categoryEvents.length} events
                  </Badge>
                </div>
                <div className="space-y-3">
                  {categoryEvents.map((event) => (
                    <Card
                      key={event.id}
                      className="bg-white/5 border-white/10 rounded-2xl overflow-hidden hover:border-primary/30 transition-all duration-300"
                    >
                      <div className="flex">
                        <div className="w-24 h-24 flex-shrink-0 overflow-hidden">
                          <img
                            src={event.image_url || event.venues?.image_url || "/placeholder.svg"}
                            alt={event.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <CardContent className="flex-1 p-3 flex flex-col justify-between">
                          <div>
                            <h3 className="font-bold text-foreground text-sm uppercase tracking-tight line-clamp-1">
                              {event.name}
                            </h3>
                            <div className="flex items-center gap-1 text-muted-foreground mt-1">
                              <MapPin className="w-3 h-3" />
                              <span className="text-xs truncate">{event.venues?.name}</span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                <span className="text-[10px]">
                                  {format(parseISO(event.date), "MMM d")}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span className="text-[10px]">
                                  {format(parseISO(event.date), "h:mm a")}
                                </span>
                              </div>
                              {event.profiles && (
                                <div className="flex items-center gap-1">
                                  <Users className="w-3 h-3" />
                                  <span className="text-[10px] truncate">
                                    {event.profiles.display_name || event.profiles.username}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                        <div className="flex flex-col items-end justify-between p-3">
                          <span className="text-primary font-black text-lg">
                            ${event.price}
                          </span>
                          <Button
                            size="sm"
                            onClick={() => handleGetTickets(event)}
                            className="h-8 px-3 bg-primary text-primary-foreground font-bold uppercase tracking-wider text-[10px] rounded-lg"
                          >
                            <Ticket className="w-3 h-3 mr-1" />
                            Tickets
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            );
          })}
      </div>

      {/* Empty State */}
      {events?.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
            <Calendar className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-black uppercase tracking-tight text-foreground mb-2">
            No Upcoming Events
          </h3>
          <p className="text-sm text-muted-foreground text-center">
            Check back soon for new events in your area.
          </p>
        </div>
      )}

      {/* Ticket Purchase Dialog */}
      {selectedEvent && (
        <TicketPurchaseDialog
          open={ticketDialogOpen}
          onOpenChange={setTicketDialogOpen}
          venueId={selectedEvent.venue_id}
          venueName={selectedEvent.venues?.name || selectedEvent.name}
          price={selectedEvent.price}
          referralId={selectedEvent.created_by}
        />
      )}
    </div>
  );
};

export default Events;
