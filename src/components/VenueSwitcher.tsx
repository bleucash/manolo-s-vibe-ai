import { ChevronDown, Building2 } from "lucide-react";
import { useUserMode } from "@/contexts/UserModeContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export function VenueSwitcher() {
  // ✅ FIX: Renamed venues -> userVenues
  const { userVenues, activeVenueId, setActiveVenueId } = useUserMode();

  const activeVenue = userVenues.find((v) => v.id === activeVenueId);

  if (userVenues.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between border-border/50 bg-card/50 hover:bg-card hover:border-neon-purple/50 transition-all"
        >
          <div className="flex items-center gap-2 truncate">
            <Building2 className="w-4 h-4 text-neon-purple shrink-0" />
            <span className="truncate font-body text-sm">{activeVenue?.name || "Select Venue"}</span>
          </div>
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-[--radix-dropdown-menu-trigger-width] bg-card border-border/50 z-50"
      >
        {userVenues.map((venue) => (
          <DropdownMenuItem
            key={venue.id}
            onClick={() => setActiveVenueId(venue.id)}
            className={`cursor-pointer ${
              venue.id === activeVenueId
                ? "bg-neon-purple/10 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Building2 className="w-4 h-4 mr-2 shrink-0" />
            <span className="truncate">{venue.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
