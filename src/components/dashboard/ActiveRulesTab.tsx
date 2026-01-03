import { useState, useEffect } from "react";
import {
  Trash2,
  Zap,
  Clock,
  ArrowRightLeft,
  Sparkles,
  GripVertical,
  X,
  Check,
  Send,
  Phone,
  Bell,
  Ban,
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
}

type RuleType = "auto-reply" | "forward" | "block" | "priority" | "transfer" | "custom";

interface ParsedRule {
  type: RuleType;
  condition: string;
  action: string;
  schedule?: string;
}

type ChatMessage =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; suggestion: ParsedRule };

const RULE_TYPE_META: Record<RuleType, { label: string; icon: typeof Zap; color: string; bgColor: string }> = {
  "auto-reply": { label: "Auto-reply", icon: Send, color: "text-blue-600", bgColor: "bg-blue-50" },
  forward: { label: "Forward", icon: ArrowRightLeft, color: "text-teal-600", bgColor: "bg-teal-50" },
  block: { label: "Block", icon: Ban, color: "text-red-600", bgColor: "bg-red-50" },
  priority: { label: "Priority", icon: Bell, color: "text-amber-600", bgColor: "bg-amber-50" },
  transfer: { label: "Transfer", icon: Phone, color: "text-purple-600", bgColor: "bg-purple-50" },
  custom: { label: "Custom", icon: Zap, color: "text-gray-600", bgColor: "bg-gray-50" },
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

// Simulate AI parsing a natural language request
const parseAIRequest = (input: string): ParsedRule => {
  const lower = input.toLowerCase();

  // Detect type
  let type: RuleType = "custom";
  if (lower.includes("reply") || lower.includes("respond")) type = "auto-reply";
  else if (lower.includes("forward") || lower.includes("send to")) type = "forward";
  else if (lower.includes("block") || lower.includes("ignore") || lower.includes("mute")) type = "block";
  else if (lower.includes("priority") || lower.includes("urgent") || lower.includes("notify") || lower.includes("alert")) type = "priority";

  // Extract condition
  let condition = "All messages";
  if (lower.includes("weekend")) condition = "On weekends";
  else if (lower.includes("after") && /\d+\s*(pm|am)/.test(lower)) {
    const timeMatch = lower.match(/after\s+(\d+)\s*(pm|am)/);
    if (timeMatch) condition = `After ${timeMatch[1]}${timeMatch[2].toUpperCase()}`;
  }
  else if (lower.includes("before") && /\d+\s*(pm|am)/.test(lower)) {
    const timeMatch = lower.match(/before\s+(\d+)\s*(pm|am)/);
    if (timeMatch) condition = `Before ${timeMatch[1]}${timeMatch[2].toUpperCase()}`;
  }
  else if (lower.includes("weekday")) condition = "Weekdays only";
  else if (lower.includes("from") && (lower.includes("boss") || lower.includes("dad") || lower.includes("mom") || lower.includes("family"))) {
    const contactMatch = lower.match(/from\s+(boss|dad|mom|family|wife|husband)/i);
    if (contactMatch) condition = `From contact '${contactMatch[1]}'`;
  }
  else if (lower.includes("contain") || lower.includes("include") || lower.includes("with")) {
    const keywordMatch = lower.match(/(contain|include|with)\s+['""]?([^'""]+)['""]?/i);
    if (keywordMatch) condition = `Message contains '${keywordMatch[2].trim()}'`;
  }
  else if (lower.includes("unknown")) condition = "From unknown numbers";
  else if (lower.includes("sleep") || lower.includes("night")) condition = "During sleep hours (10PM-7AM)";

  // Extract action
  let action = input;
  if (type === "auto-reply") {
    action = "Send polite auto-reply message";
    if (lower.includes("monday")) action = "Reply: 'Thanks — I'll get back to you on Monday.'";
    else if (lower.includes("morning")) action = "Reply: 'Thanks — I'll reply in the morning.'";
    else if (lower.includes("calendar") || lower.includes("link")) action = "Reply with calendar booking link";
    else action = "Reply: 'Thanks for your message — I'll respond soon.'";
  } else if (type === "forward") {
    action = "Forward to personal number";
    if (lower.includes("second number")) action = "Forward to secondary number";
  } else if (type === "block") {
    action = "Block and don't notify";
    if (lower.includes("mute")) action = "Mute notifications";
  } else if (type === "priority") {
    action = "Mark as high priority + push notification";
    if (lower.includes("loud")) action = "Mark high priority + loud alert";
  }

  // Extract schedule
  let schedule: string | undefined;
  if (lower.includes("weekend")) schedule = "Weekends only";
  else if (lower.includes("weekday")) schedule = "Weekdays only";
  else if (/\d+\s*(pm|am)/.test(lower)) {
    const times = lower.match(/(\d+)\s*(pm|am)/g);
    if (times && times.length >= 1) schedule = `Scheduled: ${times.join(" - ")}`;
  }

  return { type, condition, action, schedule };
};

const ActiveRulesTab = ({ externalRules, onRulesChange }: ActiveRulesTabProps) => {
  const [rules, setRules] = useState<ActiveRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [aiDraft, setAiDraft] = useState("");
  const [aiProcessing, setAiProcessing] = useState(false);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [pendingSuggestionId, setPendingSuggestionId] = useState<string | null>(null);
  const [draggedRuleId, setDraggedRuleId] = useState<string | null>(null);

  // Fetch rules from API on mount
  useEffect(() => {
    const loadRulesFromApi = async () => {
      setIsLoading(true);
      try {
        const apiRules = await fetchRules();
        setRules(apiRules);
      } catch (error) {
        console.error("Failed to load rules:", error);
        toast.error("Failed to load rules");
      } finally {
        setIsLoading(false);
      }
    };
    loadRulesFromApi();
  }, []);

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

  const sendAiMessage = () => {
    const text = aiDraft.trim();
    if (!text) {
      toast.error("Describe the rule you want");
      return;
    }

    const userId = `u-${Date.now()}`;
    setChat((prev) => [...prev, { id: userId, role: "user", text }]);
    setAiDraft("");
    setAiProcessing(true);

    setTimeout(() => {
      const suggestion = parseAIRequest(text);
      const assistantId = `a-${Date.now()}`;
      setChat((prev) => [...prev, { id: assistantId, role: "assistant", suggestion }]);
      setPendingSuggestionId(assistantId);
      setAiProcessing(false);
    }, 650);
  };

  const acceptSuggestion = (messageId: string) => {
    const msg = chat.find((m) => m.id === messageId);
    if (!msg || msg.role !== "assistant") return;
    const ruleText = `${msg.suggestion.condition}: ${msg.suggestion.action}`;
    addRule(ruleText, msg.suggestion.type);
    setPendingSuggestionId(null);
  };

  const dismissSuggestion = (messageId: string) => {
    if (pendingSuggestionId === messageId) setPendingSuggestionId(null);
    setChat((prev) => prev.filter((m) => m.id !== messageId));
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

                const meta = RULE_TYPE_META[m.suggestion.type];
                const Icon = meta.icon;
                const isPending = pendingSuggestionId === m.id;

                return (
                  <div key={m.id} className="flex justify-start gap-2">
                    <div className="w-7 h-7 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0 mt-0.5">
                      <Sparkles className="w-3.5 h-3.5 text-gray-500" />
                    </div>
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-3 py-2 bg-white border text-left shadow-sm",
                        isPending ? "border-indigo-200 bg-indigo-50/40" : "border-gray-200"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                            meta.bgColor,
                            meta.color
                          )}
                        >
                          <Icon className="w-3 h-3" />
                          {meta.label}
                        </span>
                        <span className="text-xs text-gray-400">Suggested rule</span>
                      </div>

                      <div className="space-y-1">
                        <div className="text-sm text-gray-800">
                          <span className="text-xs text-gray-500">Condition:</span> {m.suggestion.condition}
                        </div>
                        <div className="text-sm text-gray-800">
                          <span className="text-xs text-gray-500">Action:</span> {m.suggestion.action}
                        </div>
                        {m.suggestion.schedule && (
                          <div className="text-sm text-gray-800">
                            <span className="text-xs text-gray-500">Schedule:</span> {m.suggestion.schedule}
                          </div>
                        )}
                      </div>

                      {isPending && (
                        <div className="mt-2 flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => acceptSuggestion(m.id)}
                            className="h-8 text-xs bg-gray-900 hover:bg-gray-800"
                          >
                            <Check className="w-3.5 h-3.5 mr-1.5" />
                            Add
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => dismissSuggestion(m.id)}
                            className="h-8 text-xs"
                          >
                            <X className="w-3.5 h-3.5 mr-1.5" />
                            Dismiss
                          </Button>
                        </div>
                      )}
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

        {isLoading ? (
          <div className="p-6 text-center">
            <span className="w-5 h-5 border-2 border-gray-300 border-t-indigo-600 rounded-full animate-spin inline-block" />
            <p className="text-xs text-gray-400 mt-2">Loading rules...</p>
          </div>
        ) : rules.length > 0 ? (
          <div>
            {rules.map((rule) => {
              const meta = RULE_TYPE_META[rule.type || "custom"];
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
                      {rule.rule}
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
    </div>
  );
};

export default ActiveRulesTab;
