import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Settings, BarChart2, Palette, HelpCircle, Copy, Check, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ProfileTabProps {
  onNavigate: (tab: string) => void;
}

const ProfileTab = ({ onNavigate }: ProfileTabProps) => {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const phoneNumber = "+1 (437) 239-2448";

  const copyPhoneNumber = () => {
    navigator.clipboard.writeText(phoneNumber);
    setCopied(true);
    toast.success("Phone number copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Profile Card */}
      <div className="dashboard-card p-8">
        <div className="flex flex-col items-center text-center">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mb-5 shadow-lg shadow-emerald-500/20">
            <span className="text-4xl text-white font-medium">
              {user?.name?.charAt(0).toUpperCase() || "U"}
            </span>
          </div>
          <h2 className="text-2xl font-medium text-foreground">{user?.name || "Demo User"}</h2>
          
          {/* Phone Number */}
          <div className="flex items-center gap-2 mt-3 px-4 py-2 rounded-full bg-secondary/50 border border-border/50">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-medium text-foreground">{phoneNumber}</span>
            <button
              onClick={copyPhoneNumber}
              className="p-1 rounded-md hover:bg-secondary transition-colors"
              title="Copy phone number"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </button>
          </div>
          
          <p className="text-sm text-emerald-400 mt-3 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Available
          </p>
          
          <Button 
            variant="outline" 
            className="mt-5 rounded-xl" 
            onClick={() => onNavigate("settings")}
          >
            Edit Profile
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="dashboard-card p-6">
        <h3 className="dashboard-section-title mb-5">Quick Stats</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 rounded-xl bg-secondary/30">
            <p className="text-3xl font-semibold text-foreground">24</p>
            <p className="text-sm text-muted-foreground mt-1">Messages</p>
            <p className="text-xs text-emerald-400">Today</p>
          </div>
          <div className="text-center p-4 rounded-xl bg-secondary/30">
            <p className="text-3xl font-semibold text-foreground">5</p>
            <p className="text-sm text-muted-foreground mt-1">Calls</p>
            <p className="text-xs text-emerald-400">Today</p>
          </div>
          <div className="text-center p-4 rounded-xl bg-secondary/30">
            <p className="text-3xl font-semibold text-foreground">47</p>
            <p className="text-sm text-muted-foreground mt-1">Contacts</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="dashboard-card p-6">
        <h3 className="dashboard-section-title mb-5">Recent Activity</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-4 p-3 rounded-xl bg-secondary/20">
            <span className="w-3 h-3 rounded-full bg-destructive shrink-0" />
            <div className="flex-1">
              <span className="text-foreground">Blocked 2 spam messages</span>
              <p className="text-xs text-muted-foreground mt-0.5">2 hours ago</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-3 rounded-xl bg-secondary/20">
            <span className="w-3 h-3 rounded-full bg-blue-400 shrink-0" />
            <div className="flex-1">
              <span className="text-foreground">Translated 1 message</span>
              <p className="text-xs text-muted-foreground mt-0.5">3 hours ago</p>
            </div>
          </div>
          <div className="flex items-center gap-4 p-3 rounded-xl bg-secondary/20">
            <span className="w-3 h-3 rounded-full bg-emerald-400 shrink-0" />
            <div className="flex-1">
              <span className="text-foreground">Scheduled 1 call</span>
              <p className="text-xs text-muted-foreground mt-0.5">5 hours ago</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4">
        <Button 
          variant="outline" 
          className="h-auto py-5 flex-col gap-2 rounded-xl hover:bg-secondary/50" 
          onClick={() => onNavigate("settings")}
        >
          <Settings className="w-5 h-5 text-muted-foreground" />
          <span className="font-medium">Settings</span>
        </Button>
        <Button 
          variant="outline" 
          className="h-auto py-5 flex-col gap-2 rounded-xl hover:bg-secondary/50"
        >
          <BarChart2 className="w-5 h-5 text-muted-foreground" />
          <span className="font-medium">Usage Stats</span>
        </Button>
        <Button 
          variant="outline" 
          className="h-auto py-5 flex-col gap-2 rounded-xl hover:bg-secondary/50"
        >
          <Palette className="w-5 h-5 text-muted-foreground" />
          <span className="font-medium">Appearance</span>
        </Button>
        <Button 
          variant="outline" 
          className="h-auto py-5 flex-col gap-2 rounded-xl hover:bg-secondary/50" 
          onClick={() => onNavigate("settings")}
        >
          <HelpCircle className="w-5 h-5 text-muted-foreground" />
          <span className="font-medium">Help</span>
        </Button>
      </div>
    </div>
  );
};

export default ProfileTab;
