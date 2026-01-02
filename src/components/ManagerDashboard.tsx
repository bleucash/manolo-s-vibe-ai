import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Calendar, TrendingUp, Settings } from "lucide-react";

const ManagerDashboard = () => {
  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      <div className="mb-6">
        <h1 className="text-3xl font-display text-white uppercase tracking-tighter">
          Manager Dashboard
        </h1>
        <p className="text-zinc-500 text-sm">Control your venue operations</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card className="bg-zinc-900 border-white/5 p-4">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-5 h-5 text-neon-green" />
            <span className="text-zinc-400 text-xs uppercase tracking-widest">Staff</span>
          </div>
          <p className="text-2xl font-display text-white">0</p>
        </Card>

        <Card className="bg-zinc-900 border-white/5 p-4">
          <div className="flex items-center gap-3 mb-2">
            <Calendar className="w-5 h-5 text-neon-pink" />
            <span className="text-zinc-400 text-xs uppercase tracking-widest">Events</span>
          </div>
          <p className="text-2xl font-display text-white">0</p>
        </Card>

        <Card className="bg-zinc-900 border-white/5 p-4">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-5 h-5 text-neon-purple" />
            <span className="text-zinc-400 text-xs uppercase tracking-widest">Revenue</span>
          </div>
          <p className="text-2xl font-display text-white">$0</p>
        </Card>

        <Card className="bg-zinc-900 border-white/5 p-4">
          <div className="flex items-center gap-3 mb-2">
            <Settings className="w-5 h-5 text-zinc-400" />
            <span className="text-zinc-400 text-xs uppercase tracking-widest">Settings</span>
          </div>
          <Badge className="bg-zinc-800 text-zinc-400">Configure</Badge>
        </Card>
      </div>

      <Card className="bg-zinc-900 border-white/5 p-6">
        <h3 className="text-white font-display uppercase tracking-tighter mb-4">
          Pending Requests
        </h3>
        <p className="text-zinc-500 text-sm italic">No pending talent applications</p>
      </Card>
    </div>
  );
};

export default ManagerDashboard;
