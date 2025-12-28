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
  { id: "emergency", label: "Emergency", icon: AlertTriangle, color: "text-gray-500" },
  { id: "meeting", label: "Meeting", icon: Calendar, color: "text-gray-500" },
  { id: "family", label: "Family", icon: Home, color: "text-gray-500" },
  { id: "appointment", label: "Appointment", icon: Clock, color: "text-gray-500" },
  { id: "task", label: "Task", icon: Briefcase, color: "text-gray-500" },
  { id: "deadline", label: "Deadline", icon: Clock, color: "text-gray-500" },
  { id: "bank", label: "Bank", icon: CreditCard, color: "text-gray-500" },
  { id: "other", label: "Other", icon: MoreHorizontal, color: "text-gray-500" },
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
    <div className="space-y-4">
      {/* Header with Phone Number */}
      <div className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
        <div>
          <p className="text-xs text-gray-500">Configure how messages are prioritized and forwarded</p>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 rounded border border-gray-200">
          <Phone className="w-3.5 h-3.5 text-indigo-500" />
          <span className="text-xs font-mono text-gray-700">{phoneNumber}</span>
        </div>
      </div>

      {/* Routing Mode */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-2.5">
        <div className="flex items-center gap-1.5 mb-2">
          <Route className="w-3.5 h-3.5 text-gray-500" />
          <h3 className="font-medium text-gray-800 text-xs">Routing Mode</h3>
        </div>
        
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { id: "all" as RoutingMode, label: "All Messages", desc: "Send everything" },
            { id: "high_medium" as RoutingMode, label: "High + Medium", desc: "Priority only" },
            { id: "high_only" as RoutingMode, label: "High Only", desc: "Urgent only" },
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() => setRoutingMode(mode.id)}
              className={cn(
                "p-2.5 rounded border text-left transition-all",
                routingMode === mode.id
                  ? "bg-gray-100 border-gray-300"
                  : "bg-gray-50 border-gray-200 hover:border-gray-300"
              )}
            >
              <p className="text-xs font-medium text-gray-800">{mode.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{mode.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Priority Tag Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-2.5">
        <div className="flex items-center gap-1.5 mb-2">
          <Shield className="w-3.5 h-3.5 text-gray-500" />
          <h3 className="font-medium text-gray-800 text-xs">High Priority Filters</h3>
          <span className="text-xs text-gray-500 ml-auto">{selectedTags.length} selected</span>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {priorityTags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => toggleTag(tag.id)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded border transition-all text-left",
                selectedTags.includes(tag.id)
                  ? "bg-gray-100 border-gray-300"
                  : "bg-gray-50 border-gray-200 hover:border-gray-300"
              )}
            >
              <tag.icon className={cn("w-3.5 h-3.5", tag.color)} />
              <span className="text-xs text-gray-700">{tag.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Time-Based Rules */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-2.5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-gray-500" />
            <h3 className="font-medium text-gray-800 text-xs">Time-Based Rules</h3>
          </div>
          <Button size="sm" variant="outline" className="h-6 gap-1 text-xs border-gray-200 bg-white text-gray-700 hover:bg-gray-50" onClick={() => setShowAddTimeRule(true)}>
            <Plus className="w-3 h-3" /> Add Rule
          </Button>
        </div>

        <div className="space-y-1.5">
          {timeRules.map((rule) => (
            <div
              key={rule.id}
              className={cn(
                "flex items-center justify-between p-2.5 rounded border transition-colors",
                rule.active ? "bg-gray-50 border-gray-200" : "bg-gray-50/50 border-gray-100 opacity-60"
              )}
            >
              <div className="flex items-center gap-2">
                <div className="text-xs">
                  <span className="text-gray-700 font-mono">{rule.from}</span>
                  <span className="text-gray-400 mx-1.5">→</span>
                  <span className="text-gray-700 font-mono">{rule.to}</span>
                </div>
                <span className={cn(
                  "px-1.5 py-0.5 rounded text-xs",
                  rule.mode === "high_only" ? "bg-indigo-50 text-indigo-500" : "bg-gray-100 text-gray-500"
                )}>
                  {rule.mode === "high_only" ? "High Priority Only" : "Do Not Disturb"}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => toggleTimeRule(rule.id)}
                  className={cn(
                    "w-7 h-4 rounded-full transition-colors relative",
                    rule.active ? "bg-indigo-500" : "bg-gray-300"
                  )}
                >
                  <span className={cn(
                    "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform",
                    rule.active ? "left-3.5" : "left-0.5"
                  )} />
                </button>
                <button onClick={() => deleteTimeRule(rule.id)} className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600">
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {showAddTimeRule && (
          <div className="p-2.5 rounded border border-gray-200 bg-gray-50 space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500">From</label>
                <input
                  type="time"
                  value={newRuleFrom}
                  onChange={(e) => setNewRuleFrom(e.target.value)}
                  className="w-full mt-1 px-2.5 py-1.5 bg-white border border-gray-200 rounded text-gray-700 text-xs focus:outline-none focus:border-gray-300"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">To</label>
                <input
                  type="time"
                  value={newRuleTo}
                  onChange={(e) => setNewRuleTo(e.target.value)}
                  className="w-full mt-1 px-2.5 py-1.5 bg-white border border-gray-200 rounded text-gray-700 text-xs focus:outline-none focus:border-gray-300"
                />
              </div>
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => setNewRuleMode("high_only")}
                className={cn(
                  "flex-1 py-1.5 rounded text-xs font-medium transition-colors",
                  newRuleMode === "high_only" ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600"
                )}
              >
                High Only
              </button>
              <button
                onClick={() => setNewRuleMode("dnd")}
                className={cn(
                  "flex-1 py-1.5 rounded text-xs font-medium transition-colors",
                  newRuleMode === "dnd" ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600"
                )}
              >
                DND
              </button>
            </div>
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" className="flex-1 h-7 text-xs border-gray-200 bg-white text-gray-700 hover:bg-gray-50" onClick={() => setShowAddTimeRule(false)}>Cancel</Button>
              <Button size="sm" className="flex-1 h-7 text-xs bg-indigo-500 hover:bg-indigo-600 text-white" onClick={addTimeRule}>Add Rule</Button>
            </div>
          </div>
        )}
      </div>

      {/* Language Routing */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <button
          onClick={() => setShowLanguageSection(!showLanguageSection)}
          className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-gray-500" />
            <h3 className="font-medium text-gray-800 text-xs">Language Routing</h3>
          </div>
          <ChevronDown className={cn("w-3.5 h-3.5 text-gray-400 transition-transform", showLanguageSection && "rotate-180")} />
        </button>
        
        {showLanguageSection && (
          <div className="px-3 pb-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Incoming Languages</label>
                <select
                  value={incomingLanguage}
                  onChange={(e) => setIncomingLanguage(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded text-gray-700 text-xs focus:outline-none focus:border-gray-300"
                >
                  {languages.map((lang) => (
                    <option key={lang.code} value={lang.code}>{lang.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Send Messages In</label>
                <select
                  value={outgoingLanguage}
                  onChange={(e) => setOutgoingLanguage(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded text-gray-700 text-xs focus:outline-none focus:border-gray-300"
                >
                  {languages.map((lang) => (
                    <option key={lang.code} value={lang.code}>{lang.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Messages will be auto-translated based on these preferences
            </p>
          </div>
        )}
      </div>

      {/* Save Button */}
      <Button className="w-full h-8 text-xs bg-indigo-500 hover:bg-indigo-600 text-white" onClick={() => toast.success("Routing settings saved")}>
        Save Routing Settings
      </Button>
    </div>
  );
};

export default RoutingPanel;
