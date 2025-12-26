import { useAuth } from "@/contexts/AuthContext";
import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const ProfileTab = () => {
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
          <p className="text-sm text-muted-foreground mt-1">{user?.email || "user@example.com"}</p>
          
          <div className="flex items-center gap-2 mt-3 px-3 py-1.5 rounded-full bg-secondary/50 border border-border/30">
            <span className="w-1.5 h-1.5 rounded-full bg-gold/60" />
            <span className="text-sm text-gold">{phoneNumber}</span>
            <button onClick={copyPhoneNumber} className="p-0.5">
              {copied ? <Check className="w-3 h-3 text-gold" /> : <Copy className="w-3 h-3 text-gold/60" />}
            </button>
          </div>
          
          <p className="text-xs text-muted-foreground mt-3">Available</p>
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

      {/* Account Info */}
      <div className="bg-card/30 border border-border/50 rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-medium text-foreground">Account</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-2 border-b border-border/30">
            <span className="text-muted-foreground">Plan</span>
            <span className="text-foreground">Premium</span>
          </div>
          <div className="flex justify-between py-2 border-b border-border/30">
            <span className="text-muted-foreground">Member since</span>
            <span className="text-foreground">Jan 2024</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-muted-foreground">Messages this month</span>
            <span className="text-foreground">1,247</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileTab;
