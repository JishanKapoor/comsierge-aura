import { useEffect, useState, useRef } from "react";
import {
  PhoneCall,
  MessageSquare,
  ArrowRight,
  Star,
  Users,
  Tag,
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

      const response = await fetch(`/api/auth/users/${user?.id}/forwarding`, {
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

  useEffect(() => {
    const saved = safeParseJson<{
      forwardCalls?: boolean;
      forwardMessages?: boolean;
      callFilter?: CallFilter;
      selectedCallTags?: string[];
      messageFilter?: MessageFilter;
      selectedMessageTags?: string[];
    }>(localStorage.getItem(STORAGE_KEY));

    if (!saved) return;

    if (typeof saved.forwardCalls === "boolean") setForwardCalls(saved.forwardCalls);
    if (typeof saved.forwardMessages === "boolean") setForwardMessages(saved.forwardMessages);
    if (saved.callFilter) setCallFilter(saved.callFilter);
    if (Array.isArray(saved.selectedCallTags)) setSelectedCallTags(saved.selectedCallTags);
    if (saved.messageFilter) setMessageFilter(saved.messageFilter);
    if (Array.isArray(saved.selectedMessageTags)) setSelectedMessageTags(saved.selectedMessageTags);
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

  const handleSave = () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        forwardCalls,
        forwardMessages,
        callFilter,
        selectedCallTags,
        messageFilter,
        selectedMessageTags,
      })
    );

    toast.success("Routing settings saved!");
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
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
        <h3 className="font-medium text-gray-900 text-sm">Forward To</h3>
        
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <div className="text-center flex-1">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">From</p>
            <p className="text-xs font-mono text-gray-800">{phoneNumber}</p>
          </div>
          <ArrowRight className="w-4 h-4 text-gray-400" />
          <div className="text-center flex-1">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">To</p>
            <p className="text-xs font-mono text-gray-800">{forwardingNumber || "Not set"}</p>
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-600 block mb-1">Your personal number</label>
          <input
            ref={inputRef}
            type="tel"
            value={forwardingNumber}
            onChange={(e) => validateForwardingNumber(e.target.value)}
            onKeyDown={handleForwardingKeyDown}
            onBlur={handleForwardingBlur}
            placeholder="+1 (555) 123-4567"
            className={cn(
              "w-full px-3 py-2 bg-white border rounded-lg text-gray-800 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-900/10",
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
              forwardCalls ? "bg-gray-900" : "bg-gray-300"
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
                      ? "border-gray-900 bg-gray-50"
                      : "border-gray-100 hover:border-gray-200"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center",
                    callFilter === opt.id ? "bg-gray-900" : "bg-gray-100"
                  )}>
                    <opt.icon className={cn(
                      "w-4 h-4",
                      callFilter === opt.id ? "text-white" : "text-gray-500"
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm font-medium",
                      callFilter === opt.id ? "text-gray-900" : "text-gray-700"
                    )}>
                      {opt.label}
                    </p>
                    <p className="text-[11px] text-gray-500">{opt.desc}</p>
                  </div>
                  <div className={cn(
                    "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                    callFilter === opt.id ? "border-gray-900" : "border-gray-300"
                  )}>
                    {callFilter === opt.id && (
                      <div className="w-2 h-2 rounded-full bg-gray-900" />
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Tags selection */}
            {showCallTags && (
              <div className="pt-2 border-t border-gray-100">
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
                            ? "bg-gray-900 text-white"
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
              forwardMessages ? "bg-gray-900" : "bg-gray-300"
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
                { id: "important" as MessageFilter, label: "Important", desc: "High + medium priority only" },
                { id: "urgent" as MessageFilter, label: "Urgent only", desc: "Critical messages only" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setMessageFilter(opt.id)}
                  className={cn(
                    "w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all text-left",
                    messageFilter === opt.id
                      ? "border-gray-900 bg-gray-50"
                      : "border-gray-100 hover:border-gray-200"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm font-medium",
                      messageFilter === opt.id ? "text-gray-900" : "text-gray-700"
                    )}>
                      {opt.label}
                    </p>
                    <p className="text-[11px] text-gray-500">{opt.desc}</p>
                  </div>
                  <div className={cn(
                    "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                    messageFilter === opt.id ? "border-gray-900" : "border-gray-300"
                  )}>
                    {messageFilter === opt.id && (
                      <div className="w-2 h-2 rounded-full bg-gray-900" />
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Tags selection for important/urgent */}
            {showMessageTags && (
              <div className="pt-2 border-t border-gray-100">
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
                            ? "bg-gray-900 text-white"
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

      {/* Save Button */}
      <Button
        className="w-full h-10 text-sm font-medium bg-gray-900 hover:bg-gray-800 text-white rounded-lg"
        onClick={handleSave}
        disabled={Boolean(forwardingNumberError)}
      >
        Save Settings
      </Button>
    </div>
  );
};

export default RoutingPanel;
