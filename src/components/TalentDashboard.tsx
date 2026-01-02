import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Music, Calendar, MapPin, Clock } from "lucide-react";

interface TalentDashboardProps {
  userId: string;
}

const TalentDashboard = ({ userId }: TalentDashboardProps) => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display text-white uppercase tracking-tighter">
          My Gigs
        </h1>
        <p className="text-zinc-500 text-sm">Manage your performances and bookings</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-zinc-900 border-white/5 p-4">
          <div className="flex items-center gap-3 mb-2">
            <Calendar className="w-5 h-5 text-neon-pink" />
            <span className="text-zinc-400 text-xs uppercase tracking-widest">Upcoming</span>
          </div>
          <p className="text-2xl font-display text-white">0</p>
        </Card>

        <Card className="bg-zinc-900 border-white/5 p-4">
          <div className="flex items-center gap-3 mb-2">
            <Music className="w-5 h-5 text-neon-purple" />
            <span className="text-zinc-400 text-xs uppercase tracking-widest">Total</span>
          </div>
          <p className="text-2xl font-display text-white">0</p>
        </Card>
      </div>

      <Card className="bg-zinc-900 border-white/5 p-6">
        <h3 className="text-white font-display uppercase tracking-tighter mb-4">
          Pending Invitations
        </h3>
        <p className="text-zinc-500 text-sm italic">No pending venue invitations</p>
      </Card>

      <Card className="bg-zinc-900 border-white/5 p-6">
        <h3 className="text-white font-display uppercase tracking-tighter mb-4">
          Active Residencies
        </h3>
        <p className="text-zinc-500 text-sm italic">Not connected to any venues yet</p>
      </Card>
    </div>
  );
};

export default TalentDashboard;
