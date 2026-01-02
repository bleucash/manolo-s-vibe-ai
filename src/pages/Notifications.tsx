import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Check, Trash2 } from "lucide-react";

interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
}

const Notifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const markAllRead = () => {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read: true }))
    );
  };

  const clearAll = () => {
    setNotifications([]);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 bg-background border-b border-border safe-top">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-neon-pink" />
            <h1 className="text-xl font-bold">Notifications</h1>
          </div>
          {notifications.length > 0 && (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllRead}
                className="text-xs text-zinc-400"
              >
                <Check className="h-3 w-3 mr-1" />
                Mark all read
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="text-xs text-zinc-400"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Clear
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Bell className="h-16 w-16 text-muted-foreground/20 mb-4" />
            <p className="text-muted-foreground">No notifications yet</p>
            <p className="text-sm text-zinc-600 mt-2">
              You'll see updates from venues and talent you follow here
            </p>
          </div>
        ) : (
          notifications.map((notification) => (
            <Card
              key={notification.id}
              className={`p-4 border-border/50 ${
                notification.read ? "bg-card" : "bg-primary/5 border-l-2 border-l-neon-pink"
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-foreground">{notification.title}</h3>
                {!notification.read && (
                  <Badge className="bg-neon-pink/20 text-neon-pink text-[10px]">New</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{notification.message}</p>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default Notifications;
