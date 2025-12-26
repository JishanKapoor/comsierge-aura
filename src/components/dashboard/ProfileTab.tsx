import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Settings, BarChart2, Palette, HelpCircle, Copy, Check } from "lucide-react";
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
    toast.success("Copied");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-5 max-w-lg mx-auto">
      {/* Profile Card */}
      <div className="bg-card/30 border border-border/50 rounded-xl p-6">
        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mb-4">
            <span className="text-3xl text-foreground font-medium">
              {user?.name?.charAt(0).toUpperCase() || "U"}
            </span>
          </div>
          <h2 className="text-xl font-medium text-foreground">{user?.name || "Demo User"}</h2>
          
          <div className="flex items-center gap-2 mt-2 px-3 py-1.5 rounded-full bg-secondary/50 border border-border/30">
            <span className="w-1.5 h-1.5 rounded-full bg-foreground/50" />
            <span className="text-sm text-muted-foreground">{phoneNumber}</span>
            <button onClick={copyPhoneNumber} className="p-0.5">
              {copied ? <Check className="w-3 h-3 text-foreground" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
            </button>
          </div>
          
          <p className="text-sm text-muted-foreground mt-2">Available</p>
          
          <Button variant="outline" size="sm" className="mt-4 rounded-lg" onClick={() => onNavigate("settings")}>
            Edit Profile
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="bg-card/30 border border-border/50 rounded-xl p-5">
        <h3 className="text-sm font-medium text-foreground mb-4">Quick Stats</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-lg bg-secondary/30">
            <p className="text-2xl font-medium text-foreground">24</p>
            <p className="text-xs text-muted-foreground mt-1">Messages</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-secondary/30">
            <p className="text-2xl font-medium text-foreground">5</p>
            <p className="text-xs text-muted-foreground mt-1">Calls</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-secondary/30">
            <p className="text-2xl font-medium text-foreground">47</p>
            <p className="text-xs text-muted-foreground mt-1">Contacts</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" className="h-auto py-4 flex-col gap-1.5 rounded-xl" onClick={() => onNavigate("settings")}>
          <Settings className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm">Settings</span>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex-col gap-1.5 rounded-xl">
          <BarChart2 className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm">Stats</span>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex-col gap-1.5 rounded-xl">
          <Palette className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm">Theme</span>
        </Button>
        <Button variant="outline" className="h-auto py-4 flex-col gap-1.5 rounded-xl" onClick={() => onNavigate("settings")}>
          <HelpCircle className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm">Help</span>
        </Button>
      </div>
    </div>
  );
};

export default ProfileTab;
