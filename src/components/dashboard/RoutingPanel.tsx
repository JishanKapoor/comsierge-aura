import { useState } from "react";
import {
  Route,
  Shield,
  Clock,
  Globe,
  Phone,
  ChevronDown,
  Plus,
  X,
  AlertTriangle,
  Calendar,
  Users,
  Briefcase,
  Home,
  CreditCard,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { languages } from "./mockData";

type RoutingMode = "all" | "high_medium" | "high_only";

interface TimeRule {
  id: string;
  from: string;
  to: string;
  mode: "high_only" | "dnd";
  active: boolean;
}

interface RoutingPanelProps {
  phoneNumber: string;
}

const priorityTags = [
  { id: "emergency", label: "Emergency", icon: AlertTriangle, color: "text-red-400" },
  { id: "meeting", label: "Meeting", icon: Calendar, color: "text-blue-400" },
  { id: "family", label: "Family", icon: Home, color: "text-pink-400" },
  { id: "appointment", label: "Appointment", icon: Clock, color: "text-purple-400" },
  { id: "task", label: "Task", icon: Briefcase, color: "text-amber-400" },
  { id: "deadline", label: "Deadline", icon: Clock, color: "text-orange-400" },
  { id: "bank", label: "Bank", icon: CreditCard, color: "text-emerald-400" },
  { id: "other", label: "Other", icon: MoreHorizontal, color: "text-gray-400" },
];

const RoutingPanel = ({ phoneNumber }: RoutingPanelProps) => {
  const [routingMode, setRoutingMode] = useState<RoutingMode>("all");
  const [selectedTags, setSelectedTags] = useState<string[]>(["emergency", "family", "meeting"]);
  const [incomingLanguage, setIncomingLanguage] = useState("en");
  const [outgoingLanguage, setOutgoingLanguage] = useState("en");
  const [showLanguageSection, setShowLanguageSection] = useState(false);
  
  const [timeRules, setTimeRules] = useState<TimeRule[]>([
    { id: "1", from: "22:00", to: "07:00", mode: "high_only", active: true },
    { id: "2", from: "15:00", to: "16:00", mode: "high_only", active: false },
  ]);
  
  const [showAddTimeRule, setShowAddTimeRule] = useState(false);
  const [newRuleFrom, setNewRuleFrom] = useState("09:00");
  const [newRuleTo, setNewRuleTo] = useState("17:00");
  const [newRuleMode, setNewRuleMode] = useState<"high_only" | "dnd">("high_only");

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev =>
      prev.includes(tagId) ? prev.filter(t => t !== tagId) : [...prev, tagId]
    );
  };

  const addTimeRule = () => {
    const newRule: TimeRule = {
      id: `rule-${Date.now()}`,
      from: newRuleFrom,
      to: newRuleTo,
      mode: newRuleMode,
      active: true,
    };
    setTimeRules([...timeRules, newRule]);
    setShowAddTimeRule(false);
    toast.success("Time rule added");
  };

  const toggleTimeRule = (id: string) => {
    setTimeRules(prev => prev.map(r => r.id === id ? { ...r, active: !r.active } : r));
  };

  const deleteTimeRule = (id: string) => {
    setTimeRules(prev => prev.filter(r => r.id !== id));
    toast.success("Rule deleted");
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header with Phone Number */}
      <div className="flex items-center justify-between p-4 bg-card/50 border border-border/50 rounded-xl">
        <div>
          <h2 className="font-medium text-foreground">Smart Routing</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Configure how messages are prioritized and forwarded</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 bg-secondary/50 rounded-lg border border-border/30">
          <Phone className="w-4 h-4 text-emerald-500" />
          <span className="text-sm font-mono text-foreground">{phoneNumber}</span>
        </div>
      </div>

      {/* Routing Mode */}
      <div className="bg-card/30 border border-border/50 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 mb-3">
          <Route className="w-4 h-4 text-blue-400" />
          <h3 className="font-medium text-foreground text-sm">Routing Mode</h3>
        </div>
        
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: "all" as RoutingMode, label: "All Messages", desc: "Send everything" },
            { id: "high_medium" as RoutingMode, label: "High + Medium", desc: "Priority only" },
            { id: "high_only" as RoutingMode, label: "High Only", desc: "Urgent only" },
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() => setRoutingMode(mode.id)}
              className={cn(
                "p-3 rounded-xl border text-left transition-all",
                routingMode === mode.id
                  ? "bg-foreground/10 border-foreground/30"
                  : "bg-secondary/20 border-border/30 hover:border-border/60"
              )}
            >
              <p className="text-sm font-medium text-foreground">{mode.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{mode.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Priority Tag Filters */}
      <div className="bg-card/30 border border-border/50 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-amber-400" />
          <h3 className="font-medium text-foreground text-sm">High Priority Filters</h3>
          <span className="text-xs text-muted-foreground ml-auto">{selectedTags.length} selected</span>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {priorityTags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => toggleTag(tag.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-left",
                selectedTags.includes(tag.id)
                  ? "bg-foreground/10 border-foreground/30"
                  : "bg-secondary/20 border-border/30 hover:border-border/60"
              )}
            >
              <tag.icon className={cn("w-4 h-4", tag.color)} />
              <span className="text-sm text-foreground">{tag.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Time-Based Rules */}
      <div className="bg-card/30 border border-border/50 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-purple-400" />
            <h3 className="font-medium text-foreground text-sm">Time-Based Rules</h3>
          </div>
          <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => setShowAddTimeRule(true)}>
            <Plus className="w-3 h-3" /> Add Rule
          </Button>
        </div>

        <div className="space-y-2">
          {timeRules.map((rule) => (
            <div
              key={rule.id}
              className={cn(
                "flex items-center justify-between p-3 rounded-lg border transition-colors",
                rule.active ? "bg-secondary/30 border-border/40" : "bg-secondary/10 border-border/20 opacity-60"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="text-sm">
                  <span className="text-foreground font-mono">{rule.from}</span>
                  <span className="text-muted-foreground mx-2">→</span>
                  <span className="text-foreground font-mono">{rule.to}</span>
                </div>
                <span className={cn(
                  "px-2 py-0.5 rounded text-xs",
                  rule.mode === "high_only" ? "bg-amber-500/15 text-amber-500" : "bg-red-500/15 text-red-400"
                )}>
                  {rule.mode === "high_only" ? "High Priority Only" : "Do Not Disturb"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleTimeRule(rule.id)}
                  className={cn(
                    "w-9 h-5 rounded-full transition-colors relative",
                    rule.active ? "bg-emerald-500" : "bg-secondary"
                  )}
                >
                  <span className={cn(
                    "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform",
                    rule.active ? "left-4" : "left-0.5"
                  )} />
                </button>
                <button onClick={() => deleteTimeRule(rule.id)} className="p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {showAddTimeRule && (
          <div className="p-3 rounded-lg border border-border/50 bg-secondary/20 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">From</label>
                <input
                  type="time"
                  value={newRuleFrom}
                  onChange={(e) => setNewRuleFrom(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-secondary/50 border border-border/50 rounded-lg text-foreground text-sm focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">To</label>
                <input
                  type="time"
                  value={newRuleTo}
                  onChange={(e) => setNewRuleTo(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-secondary/50 border border-border/50 rounded-lg text-foreground text-sm focus:outline-none"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setNewRuleMode("high_only")}
                className={cn(
                  "flex-1 py-2 rounded-lg text-sm transition-colors",
                  newRuleMode === "high_only" ? "bg-foreground text-background" : "bg-secondary/50 text-muted-foreground"
                )}
              >
                High Only
              </button>
              <button
                onClick={() => setNewRuleMode("dnd")}
                className={cn(
                  "flex-1 py-2 rounded-lg text-sm transition-colors",
                  newRuleMode === "dnd" ? "bg-foreground text-background" : "bg-secondary/50 text-muted-foreground"
                )}
              >
                DND
              </button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowAddTimeRule(false)}>Cancel</Button>
              <Button size="sm" className="flex-1" onClick={addTimeRule}>Add Rule</Button>
            </div>
          </div>
        )}
      </div>

      {/* Language Routing */}
      <div className="bg-card/30 border border-border/50 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowLanguageSection(!showLanguageSection)}
          className="w-full flex items-center justify-between p-4 hover:bg-secondary/20 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-cyan-400" />
            <h3 className="font-medium text-foreground text-sm">Language Routing</h3>
          </div>
          <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", showLanguageSection && "rotate-180")} />
        </button>
        
        {showLanguageSection && (
          <div className="p-4 pt-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Incoming Languages</label>
                <select
                  value={incomingLanguage}
                  onChange={(e) => setIncomingLanguage(e.target.value)}
                  className="w-full px-3 py-2 bg-secondary/50 border border-border/50 rounded-lg text-foreground text-sm focus:outline-none"
                >
                  {languages.map((lang) => (
                    <option key={lang.code} value={lang.code}>{lang.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Send Messages In</label>
                <select
                  value={outgoingLanguage}
                  onChange={(e) => setOutgoingLanguage(e.target.value)}
                  className="w-full px-3 py-2 bg-secondary/50 border border-border/50 rounded-lg text-foreground text-sm focus:outline-none"
                >
                  {languages.map((lang) => (
                    <option key={lang.code} value={lang.code}>{lang.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Messages will be auto-translated based on these preferences
            </p>
          </div>
        )}
      </div>

      {/* Save Button */}
      <Button className="w-full" onClick={() => toast.success("Routing settings saved")}>
        Save Routing Settings
      </Button>
    </div>
  );
};

export default RoutingPanel;
