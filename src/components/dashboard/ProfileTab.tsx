import { useAuth } from "@/contexts/AuthContext";
import { Settings, BarChart2, Palette, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProfileTabProps {
  onNavigate: (tab: string) => void;
}

const ProfileTab = ({ onNavigate }: ProfileTabProps) => {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      {/* Profile Card */}
      <div className="bg-card/50 border border-border rounded-2xl p-6">
        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mb-4">
            <span className="text-3xl text-foreground">
              {user?.name?.charAt(0).toUpperCase() || "U"}
            </span>
          </div>
          <h2 className="text-xl font-medium text-foreground">{user?.name || "Demo User"}</h2>
          <p className="text-muted-foreground">+1 (437) 239-2448</p>
          <p className="text-sm text-green-400 mt-2">🟢 Available</p>
          <Button variant="outline" className="mt-4" onClick={() => onNavigate("settings")}>
            Edit Profile
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="bg-card/50 border border-border rounded-2xl p-6">
        <h3 className="font-medium text-foreground mb-4">Quick Stats</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-medium text-foreground">24</p>
            <p className="text-sm text-muted-foreground">📱 Messages Today</p>
          </div>
          <div>
            <p className="text-2xl font-medium text-foreground">5</p>
            <p className="text-sm text-muted-foreground">📞 Calls Today</p>
          </div>
          <div>
            <p className="text-2xl font-medium text-foreground">47</p>
            <p className="text-sm text-muted-foreground">⭐ Contacts</p>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-card/50 border border-border rounded-2xl p-6">
        <h3 className="font-medium text-foreground mb-4">Recent Activity</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <span className="w-2 h-2 rounded-full bg-destructive" />
            <span className="text-muted-foreground">Blocked 2 spam messages</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            <span className="text-muted-foreground">Translated 1 message</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="w-2 h-2 rounded-full bg-green-400" />
            <span className="text-muted-foreground">Scheduled 1 call</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4">
        <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => onNavigate("settings")}>
          <Settings className="w-5 h-5" />
          <span>Settings</span>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex-col gap-2">
          <BarChart2 className="w-5 h-5" />
          <span>Usage Stats</span>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex-col gap-2">
          <Palette className="w-5 h-5" />
          <span>Appearance</span>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex-col gap-2" onClick={() => onNavigate("settings")}>
          <HelpCircle className="w-5 h-5" />
          <span>Help</span>
        </Button>
      </div>
    </div>
  );
};

export default ProfileTab;