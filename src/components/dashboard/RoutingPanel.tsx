import { useEffect, useState, useRef } from "react";
import { API_BASE_URL } from "@/config";
import {
  MessageSquare,
  ArrowRight,
  Star,
  Users,
  Tag,
  PhoneCall,
  Languages,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { isValidUsPhoneNumber, normalizeUsPhoneDigits } from "@/lib/validations";
import { useAuth } from "@/contexts/AuthContext";
import { fetchContacts } from "./contactsApi";
import { languages } from "./mockData";
import {
  createRule,
  deleteRule,
  fetchRules,
  onRulesChange,
  updateRule,
} from "./rulesApi";

type CallFilter = "all" | "favorites" | "contacts" | "tagged";
type MessageFilter = "all" | "important" | "urgent";

interface RoutingPanelProps {
  phoneNumber: string;
}

const STORAGE_KEY = "comsierge.routing.settings";

// Same tags as ContactsTab
const DEFAULT_TAGS = ["Family", "Work", "Friend", "VIP", "Business", "School", "Gym", "Medical"];

const safeParseJson = <T,>(value: string | null): T | null => {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

const RoutingPanel = ({ phoneNumber }: RoutingPanelProps) => {
  const { user, refreshUser } = useAuth();

  const contactsCustomTagsKey = `comsierge.contacts.customTags.${user?.id || user?.email || "anon"}`;
  const [baseTags, setBaseTags] = useState<string[]>(DEFAULT_TAGS);
  const [tagOptions, setTagOptions] = useState<string[]>(DEFAULT_TAGS);
  
  // Forwarding destination
  const [forwardingNumber, setForwardingNumber] = useState(user?.forwardingNumber || "");
  const [forwardingNumberError, setForwardingNumberError] = useState("");
  const [isSavingForwarding, setIsSavingForwarding] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const savedForwardingNumber = useRef(user?.forwardingNumber || "");
  const inputRef = useRef<HTMLInputElement>(null);
  
  // What to forward
  const [forwardCalls, setForwardCalls] = useState(true);
  const [forwardMessages, setForwardMessages] = useState(true);
  
  // Call filters
  const [callFilter, setCallFilter] = useState<CallFilter>("all");
  const [selectedCallTags, setSelectedCallTags] = useState<string[]>([]);
  
  // Message filters
  const [messageFilter, setMessageFilter] = useState<MessageFilter>("all");
  const [selectedMessageTags, setSelectedMessageTags] = useState<string[]>([]);
  
  // Translation settings
  const [translateEnabled, setTranslateEnabled] = useState(false);
  const [receiveLanguage, setReceiveLanguage] = useState<string>("es");
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);

  const uniq = (arr: string[]) => Array.from(new Set(arr.map((t) => t?.trim()).filter(Boolean) as string[]));

  const validateForwardingNumber = (value: string) => {
    setForwardingNumber(value);
    // Allow empty or valid phone numbers
    if (value.trim() && !isValidUsPhoneNumber(value)) {
      setForwardingNumberError("Enter a valid US phone number");
    } else {
      setForwardingNumberError("");
    }
  };

  // Update forwarding number when user data loads
  useEffect(() => {
    if (user?.forwardingNumber && !forwardingNumber) {
      setForwardingNumber(user.forwardingNumber);
      savedForwardingNumber.current = user.forwardingNumber;
    }
  }, [user?.forwardingNumber, forwardingNumber]);

  // Check if forwarding number has changed
  const hasForwardingChanged = forwardingNumber !== savedForwardingNumber.current;

  // Save forwarding number to the server
  const saveForwardingNumber = async () => {
    if (forwardingNumber.trim() && !isValidUsPhoneNumber(forwardingNumber)) {
      toast.error("Please enter a valid US phone number");
      return;
    }

    setIsSavingForwarding(true);
    setShowSaveDialog(false);
    try {
      const token = localStorage.getItem("comsierge_token");
      // Format the number properly for the server
      let formattedNumber = "";
      if (forwardingNumber.trim()) {
        const digits = normalizeUsPhoneDigits(forwardingNumber);
        // If 11 digits starting with 1, just add +
        // If 10 digits, add +1
        formattedNumber = digits.length === 11 && digits.startsWith("1") 
          ? `+${digits}` 
          : `+1${digits}`;
      }

      const response = await fetch(`${API_BASE_URL}/api/auth/users/${user?.id}/forwarding`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ forwardingNumber: formattedNumber }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.message || "Failed to save forwarding number");
        return;
      }

      savedForwardingNumber.current = forwardingNumber;
      toast.success(forwardingNumber.trim() ? "Forwarding number saved!" : "Forwarding number cleared");
      
      // Refresh user data to update the context
      await refreshUser();
    } catch (error) {
      console.error("Error saving forwarding number:", error);
      toast.error("Failed to save forwarding number");
    } finally {
      setIsSavingForwarding(false);
    }
  };

  // Cancel forwarding number change
  const cancelForwardingChange = () => {
    setForwardingNumber(savedForwardingNumber.current);
    setForwardingNumberError("");
    setShowSaveDialog(false);
    inputRef.current?.blur();
  };

  // Handle Enter key to show save dialog
  const handleForwardingKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && hasForwardingChanged && !forwardingNumberError && !isSavingForwarding) {
      e.preventDefault();
      setShowSaveDialog(true);
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelForwardingChange();
    }
  };

  // Handle blur to show save dialog if changed
  const handleForwardingBlur = () => {
    if (hasForwardingChanged && !forwardingNumberError && !isSavingForwarding) {
      setShowSaveDialog(true);
    }
  };

  const getRoutingDestinationLabel = () => {
    const raw = (forwardingNumber || user?.forwardingNumber || "").trim();
    return raw || "your forwarding number";
  };

  const loadRoutingFromBackend = async () => {
    try {
      const rules = await fetchRules();

      const forwardRules = rules.filter((r) => r.type === "forward");
      const notifyRules = rules.filter((r) => r.type === "message-notify");

      const callRule = forwardRules.find((r) => r.active) ?? forwardRules[0];
      const msgRule = notifyRules.find((r) => r.active) ?? notifyRules[0];

      const persisted =
        safeParseJson<Record<string, any>>(localStorage.getItem(STORAGE_KEY)) || {};

      if (callRule) {
        setForwardCalls(Boolean(callRule.active));
        persisted.forwardCalls = Boolean(callRule.active);
        const mode = callRule.conditions?.mode || "all";
        const modeToFilter: Record<string, CallFilter> = {
          all: "all",
          favorites: "favorites",
          saved: "contacts",
          tags: "tagged",
        };
        setCallFilter(modeToFilter[mode] || "all");
        if (mode === "tags" && Array.isArray(callRule.conditions?.tags)) {
          setSelectedCallTags(callRule.conditions.tags);
        } else {
          setSelectedCallTags([]);
        }
      } else {
        setForwardCalls(false);
        persisted.forwardCalls = false;
        setCallFilter("all");
        setSelectedCallTags([]);
      }

      if (msgRule) {
        setForwardMessages(Boolean(msgRule.active));
        persisted.forwardMessages = Boolean(msgRule.active);
        const priorityFilter = msgRule.conditions?.priorityFilter || "all";
        setMessageFilter(priorityFilter as MessageFilter);
        if (Array.isArray(msgRule.conditions?.notifyTags)) {
          setSelectedMessageTags(msgRule.conditions.notifyTags);
        } else {
          setSelectedMessageTags([]);
        }

        setTranslateEnabled(Boolean(msgRule.conditions?.translateEnabled));
        const lang = msgRule.conditions?.receiveLanguage;
        if (typeof lang === "string" && lang && lang !== "en") {
          setReceiveLanguage(lang);
        }
      } else {
        setForwardMessages(false);
        persisted.forwardMessages = false;
        setMessageFilter("all");
        setSelectedMessageTags([]);
        setTranslateEnabled(false);
        setReceiveLanguage("es");
      }

      // Persist toggles to avoid stale UI after refresh
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
      } catch {
        // ignore
      }
    } catch (e) {
      console.error("Failed to load routing rules from backend:", e);
    }
  };

  useEffect(() => {
    // First try to load from localStorage for instant UI
    const saved = safeParseJson<{
      forwardCalls?: boolean;
      forwardMessages?: boolean;
      callFilter?: CallFilter;
      selectedCallTags?: string[];
      messageFilter?: MessageFilter;
      selectedMessageTags?: string[];
      translateEnabled?: boolean;
      receiveLanguage?: string;
    }>(localStorage.getItem(STORAGE_KEY));

    if (saved) {
      if (typeof saved.forwardCalls === "boolean") setForwardCalls(saved.forwardCalls);
      if (typeof saved.forwardMessages === "boolean") setForwardMessages(saved.forwardMessages);
      if (saved.callFilter) setCallFilter(saved.callFilter);
      if (Array.isArray(saved.selectedCallTags)) setSelectedCallTags(saved.selectedCallTags);
      if (saved.messageFilter) setMessageFilter(saved.messageFilter);
      if (Array.isArray(saved.selectedMessageTags)) setSelectedMessageTags(saved.selectedMessageTags);
      if (typeof saved.translateEnabled === "boolean") setTranslateEnabled(saved.translateEnabled);
      if (saved.receiveLanguage) setReceiveLanguage(saved.receiveLanguage);
    }

    // Then load from backend to ensure we're in sync
    loadRoutingFromBackend();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Subscribe to rules change events (instant refresh when toggled elsewhere)
  useEffect(() => {
    const unsubscribe = onRulesChange(() => {
      loadRoutingFromBackend();
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load tags from contacts + persisted custom tags (from Contacts)
  useEffect(() => {
    let isCancelled = false;

    const loadTags = async () => {
      const persistedCustom = safeParseJson<string[]>(localStorage.getItem(contactsCustomTagsKey)) ?? [];
      let contactTags: string[] = [];

      try {
        const contacts = await fetchContacts();
        contactTags = Array.from(new Set(contacts.flatMap((c) => (c.tags || []) as string[])));
      } catch {
        contactTags = [];
      }

      if (isCancelled) return;
      setBaseTags(uniq([...DEFAULT_TAGS, ...persistedCustom, ...contactTags]));
    };

    loadTags();
    return () => {
      isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactsCustomTagsKey]);

  // Ensure selected tags always appear as options
  useEffect(() => {
    setTagOptions(uniq([...baseTags, ...selectedCallTags, ...selectedMessageTags]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseTags, selectedCallTags, selectedMessageTags]);

  const handleSave = async () => {
    // Validate: if "Specific tags" is selected for calls but no tags chosen, show error
    if (forwardCalls && callFilter === "tagged" && selectedCallTags.length === 0) {
      toast.error("Please select at least one tag for call filtering, or choose a different filter.");
      return;
    }
    
    // Save to localStorage for UI persistence
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        forwardCalls,
        forwardMessages,
        callFilter,
        selectedCallTags,
        messageFilter,
        selectedMessageTags,
        translateEnabled,
        receiveLanguage,
      })
    );

    // Also save to backend as routing rules
    try {
      // Map UI filter to backend mode
      const modeMap: Record<CallFilter, string> = {
        all: "all",
        favorites: "favorites", 
        contacts: "saved",
        tagged: "tags"
      };
      
      const destinationLabel = getRoutingDestinationLabel();

      // Build the rule description
      let ruleDesc = `Forward calls to ${destinationLabel}`;
      if (callFilter === "favorites") ruleDesc = `Forward calls from favorites to ${destinationLabel}`;
      else if (callFilter === "contacts") ruleDesc = `Forward calls from saved contacts to ${destinationLabel}`;
      else if (callFilter === "tagged") {
        ruleDesc = `Forward calls from contacts tagged: ${selectedCallTags.join(", ")} to ${destinationLabel}`;
      }
      
      // Create/update the forward rule for CALLS
      const callRuleData = {
        rule: ruleDesc,
        type: "forward",
        active: forwardCalls,
        schedule: { mode: "always" },
        transferDetails: {
          mode: "calls"
        },
        conditions: {
          mode: modeMap[callFilter],
          tags: callFilter === "tagged" ? selectedCallTags : [],
          destinationLabel,
        }
      };
      
      // Create the message notification rule
      const messageRuleData = {
        rule: `Message notifications (${messageFilter}) to ${destinationLabel}`,
        type: "message-notify",
        active: forwardMessages,
        schedule: { mode: "always" },
        transferDetails: {
          mode: "messages"
        },
        conditions: {
          // Map message filter to priority requirement
          // all = notify for all, important = high+medium, urgent = high only
          priorityFilter: messageFilter,
          notifyTags: selectedMessageTags,
          // Translation settings
          translateEnabled: translateEnabled,
          receiveLanguage: translateEnabled ? receiveLanguage : "en",
          destinationLabel,
        }
      };

      const existing = await fetchRules();
      const forwardRules = existing.filter((r) => r.type === "forward");
      const notifyRules = existing.filter((r) => r.type === "message-notify");

      const callRule = forwardRules.find((r) => r.active) ?? forwardRules[0];
      const msgRule = notifyRules.find((r) => r.active) ?? notifyRules[0];

      if (callRule) {
        const ok = await updateRule(callRule.id, callRuleData as any);
        if (!ok) throw new Error("Failed to save call routing rule");
      } else {
        const created = await createRule(callRuleData as any);
        if (!created) throw new Error("Failed to save call routing rule");
      }

      if (msgRule) {
        const ok = await updateRule(msgRule.id, messageRuleData as any);
        if (!ok) throw new Error("Failed to save message routing rule");
      } else {
        const created = await createRule(messageRuleData as any);
        if (!created) throw new Error("Failed to save message routing rule");
      }

      // Remove duplicates created by older versions of the UI
      const after = await fetchRules();
      const dupForwards = after.filter((r) => r.type === "forward");
      const dupNotifies = after.filter((r) => r.type === "message-notify");

      const keepForward = (dupForwards.find((r) => r.active) ?? dupForwards[0])?.id;
      const keepNotify = (dupNotifies.find((r) => r.active) ?? dupNotifies[0])?.id;

      await Promise.all([
        ...dupForwards.filter((r) => r.id !== keepForward).map((r) => deleteRule(r.id)),
        ...dupNotifies.filter((r) => r.id !== keepNotify).map((r) => deleteRule(r.id)),
      ]);

      toast.success("Routing settings saved!");
    } catch (error) {
      console.error("Failed to save routing rule:", error);
      toast.error("Settings saved locally, but failed to sync to server");
    }
  };

  const toggleCallTag = (tag: string) => {
    setSelectedCallTags((prev) => 
      prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag]
    );
  };

  const toggleMessageTag = (tag: string) => {
    setSelectedMessageTags((prev) => 
      prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag]
    );
  };

  // Show tags section
  const showCallTags = forwardCalls && callFilter === "tagged";
  const showMessageTags = forwardMessages && messageFilter !== "all";

  return (
    <div className="space-y-4 pb-4">
      {/* Forwarding Destination */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
        <div className="flex items-center gap-2">
          <ArrowRight className="w-4 h-4 text-gray-500" />
          <h3 className="font-medium text-gray-900 text-sm">Forward To</h3>
        </div>

        <p className="text-[11px] leading-snug text-gray-500">
          Choose the number that should ring when a call matches your rules.
        </p>

        <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
          <div className="text-center flex-1 min-w-0">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">From</p>
            <p className="text-xs font-mono text-gray-800 truncate">{phoneNumber}</p>
          </div>
          <ArrowRight className="w-4 h-4 text-gray-400" />
          <div className="text-center flex-1 min-w-0">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">To</p>
            <p className="text-xs font-mono text-gray-800 truncate">{forwardingNumber || "Not set"}</p>
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 block mb-1">Your personal number</label>
          <input
            ref={inputRef}
            type="tel"
            value={forwardingNumber}
            onChange={(e) => validateForwardingNumber(e.target.value)}
            onKeyDown={handleForwardingKeyDown}
            onBlur={handleForwardingBlur}
            placeholder="+1 (555) 123-4567"
            className={cn(
              "w-full px-3 py-1.5 bg-gray-50 border rounded text-gray-700 text-xs font-mono focus:outline-none focus:border-gray-300",
              forwardingNumberError ? "border-red-300" : "border-gray-200"
            )}
          />
          {forwardingNumberError && (
            <p className="text-xs text-red-500 mt-1">{forwardingNumberError}</p>
          )}
        </div>
      </div>

      {/* Save Forwarding Number Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="sm:max-w-sm bg-white">
          <DialogHeader>
            <DialogTitle className="text-gray-900">Update Forwarding Number</DialogTitle>
            <DialogDescription className="text-gray-600">
              Are you sure you want to change your forwarding number to{" "}
              <span className="font-mono font-medium text-gray-900">
                {forwardingNumber || "none"}
              </span>
              ?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2 pt-4">
            <button
              type="button"
              onClick={cancelForwardingChange}
              disabled={isSavingForwarding}
              className="flex-1 h-7 px-3 rounded text-xs font-medium transition-colors bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50 disabled:pointer-events-none focus:outline-none"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveForwardingNumber}
              disabled={isSavingForwarding}
              className="flex-1 h-7 px-3 rounded text-xs font-medium transition-colors bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-50 disabled:pointer-events-none focus:outline-none"
            >
              {isSavingForwarding ? "Saving..." : "Confirm"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Calls */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PhoneCall className="w-4 h-4 text-gray-600" />
            <h3 className="font-medium text-gray-900 text-sm">Calls</h3>
          </div>
          <button
            onClick={() => setForwardCalls(!forwardCalls)}
            className={cn(
              "relative w-10 h-5 rounded-full transition-colors",
              forwardCalls ? "bg-indigo-500" : "bg-gray-300"
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm",
                forwardCalls ? "left-5" : "left-0.5"
              )}
            />
          </button>
        </div>

        {forwardCalls && (
          <>
            <p className="text-xs text-gray-500">Which calls should ring your phone?</p>

            <div className="space-y-1.5">
              {[
                { id: "all" as CallFilter, label: "All calls", icon: PhoneCall, desc: "Every incoming call" },
                { id: "favorites" as CallFilter, label: "Favorites only", icon: Star, desc: "Contacts marked as favorite" },
                { id: "contacts" as CallFilter, label: "Saved contacts", icon: Users, desc: "Anyone in your contacts" },
                { id: "tagged" as CallFilter, label: "Specific tags", icon: Tag, desc: "Filter by contact tags" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setCallFilter(opt.id)}
                  className={cn(
                    "w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all text-left",
                    callFilter === opt.id
                      ? "border-indigo-500 bg-indigo-50"
                      : "border-gray-200 hover:bg-gray-50"
                  )}
                >
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center",
                      callFilter === opt.id ? "bg-indigo-500" : "bg-gray-100"
                    )}
                  >
                    <opt.icon
                      className={cn(
                        "w-4 h-4",
                        callFilter === opt.id ? "text-white" : "text-gray-500"
                      )}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        callFilter === opt.id ? "text-gray-900" : "text-gray-700"
                      )}
                    >
                      {opt.label}
                    </p>
                    <p className="text-[11px] text-gray-500">{opt.desc}</p>
                  </div>
                  <div
                    className={cn(
                      "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                      callFilter === opt.id ? "border-indigo-500" : "border-gray-300"
                    )}
                  >
                    {callFilter === opt.id && <div className="w-2 h-2 rounded-full bg-indigo-500" />}
                  </div>
                </button>
              ))}
            </div>

            {showCallTags && (
              <div className="pt-2 border-t border-gray-200">
                <p className="text-xs text-gray-600 mb-2">Forward calls from contacts tagged:</p>
                <div className="flex flex-wrap gap-1.5">
                  {tagOptions.map((tag) => {
                    const selected = selectedCallTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        onClick={() => toggleCallTag(tag)}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                          selected
                            ? "bg-indigo-500 text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        )}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Messages */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-gray-600" />
            <h3 className="font-medium text-gray-900 text-sm">Messages</h3>
          </div>
          <button
            onClick={() => setForwardMessages(!forwardMessages)}
            className={cn(
              "relative w-10 h-5 rounded-full transition-colors",
              forwardMessages ? "bg-indigo-500" : "bg-gray-300"
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm",
                forwardMessages ? "left-5" : "left-0.5"
              )}
            />
          </button>
        </div>

        {forwardMessages && (
          <>
            <p className="text-xs text-gray-500">Which messages should notify you?</p>

            <div className="space-y-1.5">
              {[
                { id: "all" as MessageFilter, label: "All messages", desc: "Every incoming message" },
                { id: "important" as MessageFilter, label: "Important", desc: "High + medium priority only (No spam)" },
                { id: "urgent" as MessageFilter, label: "Urgent only", desc: "Critical messages only (No spam)" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setMessageFilter(opt.id)}
                  className={cn(
                    "w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all text-left",
                    messageFilter === opt.id
                      ? "border-indigo-500 bg-indigo-50"
                      : "border-gray-200 hover:bg-gray-50"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        messageFilter === opt.id ? "text-gray-900" : "text-gray-700"
                      )}
                    >
                      {opt.label}
                    </p>
                    <p className="text-[11px] text-gray-500">{opt.desc}</p>
                  </div>
                  <div
                    className={cn(
                      "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                      messageFilter === opt.id ? "border-indigo-500" : "border-gray-300"
                    )}
                  >
                    {messageFilter === opt.id && <div className="w-2 h-2 rounded-full bg-indigo-500" />}
                  </div>
                </button>
              ))}
            </div>

            {showMessageTags && (
              <div className="pt-2 border-t border-gray-200">
                <p className="text-xs text-gray-600 mb-2">Always notify for messages from:</p>
                <div className="flex flex-wrap gap-1.5">
                  {tagOptions.map((tag) => {
                    const selected = selectedMessageTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        onClick={() => toggleMessageTag(tag)}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                          selected
                            ? "bg-indigo-500 text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        )}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            
          </>
        )}
      </div>

      {/* Translation */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Languages className="w-4 h-4 text-gray-600" />
            <h3 className="font-medium text-gray-900 text-sm">Translation</h3>
          </div>
          <button
            onClick={() => setTranslateEnabled(!translateEnabled)}
            className={cn(
              "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
              translateEnabled ? "bg-indigo-500" : "bg-gray-200"
            )}
          >
            <span
              className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm",
                translateEnabled ? "translate-x-[18px]" : "translate-x-0.5"
              )}
            />
          </button>
        </div>

        {translateEnabled && (
          <>
            <p className="text-xs text-gray-500">Forwarded messages will show original text + translation</p>

            <div className="relative">
              <button
                onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <span>{languages.find(l => l.code === receiveLanguage)?.name || "Spanish"}</span>
                <ChevronDown className={cn("w-4 h-4 text-gray-400 transition-transform", showLanguageDropdown && "rotate-180")} />
              </button>
              
              {showLanguageDropdown && (
                <div className="absolute z-10 w-full bottom-full mb-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-44 overflow-y-auto">
                  {languages.filter(l => l.code !== 'en').map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        setReceiveLanguage(lang.code);
                        setShowLanguageDropdown(false);
                      }}
                      className={cn(
                        "w-full px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors",
                        receiveLanguage === lang.code ? "bg-indigo-50 text-indigo-700 font-medium" : "text-gray-700"
                      )}
                    >
                      {lang.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Save Button */}
      <Button
        className="w-full h-10 text-sm font-medium bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg"
        onClick={handleSave}
        disabled={Boolean(forwardingNumberError)}
      >
        Save Settings
      </Button>
    </div>
  );
};

export default RoutingPanel;
