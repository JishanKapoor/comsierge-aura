import { useState, useEffect, useCallback } from "react";
import { API_BASE_URL } from "@/config";
import {
  Zap,
  Clock,
  ArrowRightLeft,
  Sparkles,
  GripVertical,
  X,
  Check,
  Send,
  Phone,
  PhoneCall,
  Bell,
  Ban,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { 
  ActiveRule, 
  fetchRules, 
  createRule, 
  deleteRule as deleteRuleApi, 
  toggleRule as toggleRuleApi, 
  formatSchedule 
} from "./rulesApi";

interface ActiveRulesTabProps {
  externalRules?: ActiveRule[];
  onRulesChange?: (rules: ActiveRule[]) => void;
  onStartCall?: (call: { number: string; name?: string; method?: "browser" | "bridge" }) => void;
}

type RuleType = "auto-reply" | "forward" | "block" | "priority" | "transfer" | "custom" | "message-notify";

type ChatMessage =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; text: string };

const RULE_TYPE_META: Record<RuleType, { label: string; icon: typeof Zap; color: string; bgColor: string }> = {
  "auto-reply": { label: "Auto-reply", icon: Send, color: "text-blue-600", bgColor: "bg-blue-50" },
  forward: { label: "Forward", icon: ArrowRightLeft, color: "text-teal-600", bgColor: "bg-teal-50" },
  block: { label: "Block", icon: Ban, color: "text-red-600", bgColor: "bg-red-50" },
  priority: { label: "Priority", icon: Bell, color: "text-amber-600", bgColor: "bg-amber-50" },
  transfer: { label: "Transfer", icon: Phone, color: "text-purple-600", bgColor: "bg-purple-50" },
  custom: { label: "Custom", icon: Zap, color: "text-gray-600", bgColor: "bg-gray-50" },
  "message-notify": { label: "Message Notify", icon: Bell, color: "text-indigo-600", bgColor: "bg-indigo-50" },
};

const AI_EXAMPLES = [
  "Reply to work messages only on weekdays before 7pm",
  "Forward messages from boss to my second number",
  "Block spam with gambling keywords",
  "Notify me loudly if Dad texts urgent",
  "After 8pm, auto-reply to clients with a polite message",
  "If message contains invoice or payment, mark high priority",
  "Block unknown numbers during sleep hours",
  "Mute group messages, only notify direct ones",
];

const ActiveRulesTab = ({ externalRules, onRulesChange, onStartCall }: ActiveRulesTabProps) => {
  const [rules, setRules] = useState<ActiveRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [aiDraft, setAiDraft] = useState("");
  const [aiProcessing, setAiProcessing] = useState(false);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [pendingSuggestionId, setPendingSuggestionId] = useState<string | null>(null);
  const [draggedRuleId, setDraggedRuleId] = useState<string | null>(null);
  
  // Call mode dialog state
  const [showCallModeDialog, setShowCallModeDialog] = useState(false);
  const [pendingCall, setPendingCall] = useState<{ number: string; name?: string } | null>(null);

  // Reusable function to load rules from API
  const loadRules = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    try {
      const apiRules = await fetchRules();
      setRules(apiRules);
    } catch (error) {
      console.error("Failed to load rules:", error);
      if (showLoading) {
        toast.error("Failed to load rules");
      }
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, []);

  // Fetch rules from API on mount
  useEffect(() => {
    loadRules(true);
  }, [loadRules]);

  // Poll for rule updates every 30 seconds (silent refresh)
  useEffect(() => {
    const pollInterval = setInterval(() => {
      loadRules(false);
    }, 30000);
    return () => clearInterval(pollInterval);
  }, [loadRules]);

  // Sync with external rules (from Transfer modal)
  useEffect(() => {
    if (externalRules) {
      setRules(externalRules);
    }
  }, [externalRules]);

  // Notify parent when rules change
  useEffect(() => {
    onRulesChange?.(rules);
  }, [rules, onRulesChange]);

  const toggleRule = async (id: string) => {
    // Optimistic update
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, active: !r.active } : r)));
    
    const success = await toggleRuleApi(id);
    if (success) {
      toast.success("Rule updated");
    } else {
      // Revert on failure
      setRules((prev) => prev.map((r) => (r.id === id ? { ...r, active: !r.active } : r)));
      toast.error("Failed to update rule");
    }
  };

  const deleteRule = async (id: string) => {
    // Optimistic update
    const previousRules = [...rules];
    setRules((prev) => prev.filter((r) => r.id !== id));
    
    const success = await deleteRuleApi(id);
    if (success) {
      toast.success("Rule deleted");
    } else {
      // Revert on failure
      setRules(previousRules);
      toast.error("Failed to delete rule");
    }
  };

  const addRule = async (text: string, type?: RuleType) => {
    const cleaned = text.trim();
    if (!cleaned) {
      toast.error("Enter a rule first");
      return;
    }
    
    const newRule = await createRule({
      rule: cleaned,
      active: true,
      type: type || "custom",
    });
    
    if (newRule) {
      setRules((prev) => [newRule, ...prev]);
      toast.success("Rule added");
    } else {
      toast.error("Failed to add rule");
    }
  };

  const sendAiMessage = async () => {
    const text = aiDraft.trim();
    if (!text) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      text,
    };

    setChat((prev) => [...prev, userMsg]);
    setAiDraft("");
    setAiProcessing(true);

    try {
      const token = localStorage.getItem("comsierge_token");
      const response = await fetch(`${API_BASE_URL}/api/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({
          message: text,
          chatHistory: [...chat, userMsg]
            .slice(-12)
            .map((m) => ({ role: m.role, text: m.text })),
        }),
      });

      const data = await response.json();
      
      console.log("AI Response data:", data);
      console.log("Action check:", data?.action?.action, data?.action?.confirm, data?.action?.contactPhone);

      // If the agent returned a call action, show the call mode dialog HERE in this tab
      if (data?.action?.action === "call" && data?.action?.confirm && data?.action?.contactPhone) {
        console.log("Setting up call modal in ActiveRulesTab");
        setPendingCall({
          number: data.action.contactPhone,
          name: data.action.contactName,
        });
        setShowCallModeDialog(true);
      }
      
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        text: data.response || "I processed your request.",
      };
      
      setChat((prev) => [...prev, aiMsg]);
      
      // Refresh rules
      const updatedRules = await fetchRules();
      setRules(updatedRules);
      
    } catch (error) {
      console.error("AI Chat error:", error);
      toast.error("Failed to communicate with AI");
      
      setChat((prev) => [...prev, { 
        id: (Date.now() + 1).toString(), 
        role: "assistant", 
        text: "Sorry, I encountered an error. Please try again." 
      }]);
    } finally {
      setAiProcessing(false);
    }
  };

  const handleDragStart = (id: string) => {
    setDraggedRuleId(id);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedRuleId || draggedRuleId === targetId) return;

    setRules((prev) => {
      const draggedIndex = prev.findIndex((r) => r.id === draggedRuleId);
      const targetIndex = prev.findIndex((r) => r.id === targetId);
      if (draggedIndex === -1 || targetIndex === -1) return prev;

      const newRules = [...prev];
      const [dragged] = newRules.splice(draggedIndex, 1);
      newRules.splice(targetIndex, 0, dragged);
      return newRules;
    });
  };

  const handleDragEnd = () => {
    setDraggedRuleId(null);
  };

  const activeRulesCount = rules.filter((r) => r.active).length;

  // Call mode handlers
  const handleBrowserCall = () => {
    if (!pendingCall) return;
    setShowCallModeDialog(false);
    onStartCall?.({
      number: pendingCall.number,
      name: pendingCall.name,
      method: "browser",
    });
    setPendingCall(null);
  };

  const handleBridgeCall = () => {
    if (!pendingCall) return;
    setShowCallModeDialog(false);
    onStartCall?.({
      number: pendingCall.number,
      name: pendingCall.name,
      method: "bridge",
    });
    setPendingCall(null);
  };

  return (
    <div className="space-y-4 pb-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
           <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center">
            <Zap className="w-4 h-4 text-gray-700" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Active Rules</h2>
            <p className="text-xs text-gray-500">
              Automations that manage calls & messages.
            </p>
          </div>
        </div>
      </div>

      {/* AI Rule Builder (Chat) */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-gray-600" />
            <h3 className="text-sm font-medium text-gray-900">AI Rule Builder</h3>
          </div>
          <span className="text-[11px] text-gray-400">Describe what you want. AI suggests a rule.</span>
        </div>

        <div className="p-4 space-y-3 bg-white">
          {/* Chat history */}
          {chat.length > 0 ? (
            <div className="space-y-2 max-h-[260px] overflow-auto pr-1">
              {chat.map((m) => {
                if (m.role === "user") {
                  return (
                    <div key={m.id} className="flex justify-end gap-2">
                      <div className="max-w-[85%] rounded-2xl px-3 py-2 text-sm bg-indigo-600 text-white shadow-sm">
                        {m.text}
                      </div>
                      <div className="w-7 h-7 rounded-full bg-gray-900 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-[11px] font-semibold text-white">U</span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={m.id} className="flex justify-start gap-2">
                    <div className="w-7 h-7 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0 mt-0.5">
                      <Sparkles className="w-3.5 h-3.5 text-gray-500" />
                    </div>
                    <div className="max-w-[85%] rounded-2xl px-3 py-2 bg-white border border-gray-200 text-sm text-gray-800 shadow-sm whitespace-pre-wrap">
                      {m.text}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-3">
              Try: <span className="font-medium">“Reply to work messages only on weekdays before 7pm.”</span>
              <div className="mt-1 text-[11px] text-gray-400">You'll always confirm before it's added.</div>
            </div>
          )}

          {/* Example prompts */}
          <div className="flex flex-wrap gap-1.5">
            {AI_EXAMPLES.slice(0, 4).map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setAiDraft(example)}
                className="px-2.5 py-1.5 rounded-full bg-gray-50 border border-gray-200 text-xs text-gray-700 hover:bg-gray-100 transition-colors truncate max-w-[220px]"
                title={example}
              >
                {example}
              </button>
            ))}
          </div>

          {/* Composer */}
          <div className="flex items-center gap-2">
            <input
              value={aiDraft}
              onChange={(e) => setAiDraft(e.target.value)}
              placeholder="Describe the rule you want…"
              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-indigo-300"
              onKeyDown={(e) => {
                if (e.key === "Enter") sendAiMessage();
              }}
            />
            <Button
              size="sm"
              onClick={sendAiMessage}
              disabled={aiProcessing || !aiDraft.trim()}
              className="h-9 px-3 bg-indigo-600 hover:bg-indigo-700"
              aria-label="Send"
              title="Send"
            >
              {aiProcessing ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Active Rules List */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-700">Your Rules</span>
            <span className="text-[11px] text-gray-400">{activeRulesCount} active</span>
          </div>
          <span className="text-[10px] text-gray-400">Drag to reorder</span>
        </div>

        {isLoading && rules.length === 0 ? (
          <div className="divide-y divide-gray-100">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="px-4 py-3 flex items-start gap-3">
                <div className="w-4 h-4 bg-gray-200 rounded animate-pulse mt-1" />
                <div className="w-7 h-7 bg-gray-200 rounded-md animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
                  <div className="h-3 w-48 bg-gray-200 rounded animate-pulse" />
                </div>
                <div className="w-10 h-5 bg-gray-200 rounded-full animate-pulse" />
              </div>
            ))}
          </div>
        ) : rules.length > 0 ? (
          <div>
            {rules.map((rule) => {
              const meta = RULE_TYPE_META[rule.type as RuleType] || RULE_TYPE_META.custom;
              const Icon = meta.icon;
              const isDragging = draggedRuleId === rule.id;

              return (
                <div
                  key={rule.id}
                  draggable
                  onDragStart={() => handleDragStart(rule.id)}
                  onDragOver={(e) => handleDragOver(e, rule.id)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    "group px-4 py-3 flex items-start gap-3 border-b border-gray-100 last:border-b-0 transition-colors hover:bg-gray-50",
                    rule.active ? "bg-white" : "bg-gray-50",
                    isDragging && "opacity-50 bg-indigo-50"
                  )}
                >
                  {/* Drag handle */}
                  <div className="pt-0.5 cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    <GripVertical className="w-4 h-4" />
                  </div>

                  {/* Type indicator */}
                  <div
                    className={cn(
                      "w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5",
                      meta.bgColor
                    )}
                  >
                    <Icon className={cn("w-3.5 h-3.5", meta.color)} />
                  </div>

                  {/* Rule content */}
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-sm",
                        rule.active ? "text-gray-800" : "text-gray-500"
                      )}
                    >
                      {/* For transfer rules, dynamically build the description from stored data */}
                      {rule.type === "transfer" && rule.transferDetails ? (() => {
                        const mode = rule.transferDetails.mode || "both";
                        const priority = rule.transferDetails.priority || "all";
                        const tgtName = rule.transferDetails.contactName || rule.transferDetails.contactPhone || "Unknown";
                        
                        // Get source name - try conditions first, then fall back to parsing old rule text
                        let srcName = rule.conditions?.sourceContactName || rule.conditions?.sourceContactPhone;
                        if (!srcName && rule.rule) {
                          // Try to extract from old format: "Transfer ... from X to Y"
                          const fromMatch = rule.rule.match(/from\s+(.+?)\s+to\s+/i);
                          if (fromMatch) {
                            srcName = fromMatch[1];
                          }
                        }
                        srcName = srcName || "All contacts";
                        
                        let what = "";
                        if (mode === "calls") {
                          what = "all calls";
                        } else if (mode === "messages") {
                          what = priority === "all" ? "all messages" : "high priority messages";
                        } else {
                          const msgPart = priority === "all" ? "all messages" : "high priority messages";
                          what = `all calls and ${msgPart}`;
                        }
                        
                        return `Transfer ${what} from ${srcName} to ${tgtName}`;
                      })() : rule.rule}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={cn(
                          "text-[10px] font-medium px-1.5 py-0.5 rounded",
                          meta.bgColor,
                          meta.color
                        )}
                      >
                        {meta.label}
                      </span>
                      <span className="text-xs text-gray-400">Created {rule.createdAt}</span>
                      {rule.schedule && rule.schedule.mode !== "always" && (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                          <Clock className="w-3 h-3" />
                          {formatSchedule(rule.schedule)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => toggleRule(rule.id)}
                      className={cn(
                        "w-10 h-5 rounded-full transition-colors relative",
                        rule.active ? "bg-indigo-500" : "bg-gray-300"
                      )}
                      aria-label={rule.active ? "Disable rule" : "Enable rule"}
                      title={rule.active ? "Disable" : "Enable"}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform",
                          rule.active ? "left-5" : "left-0.5"
                        )}
                      />
                    </button>
                    <button
                      onClick={() => deleteRule(rule.id)}
                      className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-6 text-center text-gray-400 text-xs">No rules yet</div>
        )}
      </div>

      {/* Call Mode Selection Dialog */}
      {showCallModeDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
          <div className="bg-white border border-gray-200 rounded-lg shadow-lg w-full max-w-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-800">Choose Calling Method</h3>
              <Button 
                variant="ghost" 
                size="icon" 
                className="rounded h-7 w-7 text-gray-500 hover:bg-gray-100" 
                onClick={() => {
                  setShowCallModeDialog(false);
                  setPendingCall(null);
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="space-y-3">
              <p className="text-xs text-gray-500 mb-4">
                How would you like to place this call to <strong>{pendingCall?.name || pendingCall?.number}</strong>?
              </p>

              <button
                onClick={handleBrowserCall}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all group text-left"
              >
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 group-hover:bg-indigo-200">
                  <Phone className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">Browser Call (VoIP)</p>
                  <p className="text-xs text-gray-500">Call directly from this device using microphone</p>
                </div>
              </button>

              <button
                onClick={handleBridgeCall}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-green-300 hover:bg-green-50 transition-all group text-left"
              >
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0 group-hover:bg-green-200">
                  <PhoneCall className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">Call via My Phone</p>
                  <p className="text-xs text-gray-500">We'll ring your phone, then connect you to them</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActiveRulesTab;
