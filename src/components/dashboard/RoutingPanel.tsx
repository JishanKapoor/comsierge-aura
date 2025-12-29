import { useEffect, useMemo, useState } from "react";
import {
  Clock,
  PhoneCall,
  MessageSquare,
  Moon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { isValidUsPhoneNumber } from "@/lib/validations";

type TransferType = "calls" | "messages" | "both";
type MessagePriority = "all" | "high_medium" | "high_only";
type QuietHoursMode = "all" | "high_only" | "dnd";
type UrgentConfigMode = "auto" | "custom";

interface RoutingPanelProps {
  phoneNumber: string;
}

type AllowedNumber = {
  id: string;
  phone: string;
  label?: string;
};

const STORAGE_KEY = "comsierge.routing.settings";

const URGENT_LABELS: Array<{ id: string; label: string }> = [
  { id: "emergency", label: "Emergency" },
  { id: "family", label: "Family" },
  { id: "meeting", label: "Meeting" },
  { id: "appointment", label: "Appointment" },
  { id: "deadline", label: "Deadline" },
  { id: "bank", label: "Bank" },
  { id: "other", label: "Other" },
];

const safeParseJson = <T,>(value: string | null): T | null => {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

const RoutingPanel = ({ phoneNumber }: RoutingPanelProps) => {
  const [transferType, setTransferType] = useState<TransferType>("both");
  const [messagePriority, setMessagePriority] = useState<MessagePriority>("all");
  const [forwardingNumber, setForwardingNumber] = useState("+1 (437) 239-2448");
  const [forwardingNumberError, setForwardingNumberError] = useState("");

  // High priority / urgent configuration
  const [urgentConfigMode, setUrgentConfigMode] = useState<UrgentConfigMode>("auto");
  const [urgentLabels, setUrgentLabels] = useState<string[]>(["emergency", "family", "meeting"]);
  const [urgentAllowedNumbers, setUrgentAllowedNumbers] = useState<AllowedNumber[]>([]);
  const [newUrgentPhone, setNewUrgentPhone] = useState("");
  const [newUrgentLabel, setNewUrgentLabel] = useState("");
  
  // Quiet Hours state
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(true);
  const [quietHoursFrom, setQuietHoursFrom] = useState("22:00");
  const [quietHoursTo, setQuietHoursTo] = useState("07:00");
  const [quietHoursCallMode, setQuietHoursCallMode] = useState<QuietHoursMode>("dnd");
  const [quietHoursMessageMode, setQuietHoursMessageMode] = useState<QuietHoursMode>("high_only");

  const validateForwardingNumber = (value: string) => {
    setForwardingNumber(value);
    if (value.trim() && !isValidUsPhoneNumber(value)) {
      setForwardingNumberError("Enter a valid phone number (10 digits, optional +1)");
    } else {
      setForwardingNumberError("");
    }
  };

  useEffect(() => {
    const saved = safeParseJson<{
      transferType?: TransferType;
      messagePriority?: MessagePriority;
      forwardingNumber?: string;
      quietHoursEnabled?: boolean;
      quietHoursFrom?: string;
      quietHoursTo?: string;
      quietHoursCallMode?: QuietHoursMode;
      quietHoursMessageMode?: QuietHoursMode;
      urgentConfigMode?: UrgentConfigMode;
      urgentLabels?: string[];
      urgentAllowedNumbers?: AllowedNumber[];
    }>(localStorage.getItem(STORAGE_KEY));

    if (!saved) return;

    if (saved.transferType) setTransferType(saved.transferType);
    if (saved.messagePriority) setMessagePriority(saved.messagePriority);
    if (typeof saved.forwardingNumber === "string") validateForwardingNumber(saved.forwardingNumber);
    if (typeof saved.quietHoursEnabled === "boolean") setQuietHoursEnabled(saved.quietHoursEnabled);
    if (typeof saved.quietHoursFrom === "string") setQuietHoursFrom(saved.quietHoursFrom);
    if (typeof saved.quietHoursTo === "string") setQuietHoursTo(saved.quietHoursTo);
    if (saved.quietHoursCallMode) setQuietHoursCallMode(saved.quietHoursCallMode);
    if (saved.quietHoursMessageMode) setQuietHoursMessageMode(saved.quietHoursMessageMode);
    if (saved.urgentConfigMode) setUrgentConfigMode(saved.urgentConfigMode);
    if (Array.isArray(saved.urgentLabels)) setUrgentLabels(saved.urgentLabels);
    if (Array.isArray(saved.urgentAllowedNumbers)) setUrgentAllowedNumbers(saved.urgentAllowedNumbers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = () => {
    if (forwardingNumber.trim() && !isValidUsPhoneNumber(forwardingNumber)) {
      toast.error("Please enter a valid personal number");
      return;
    }

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        transferType,
        messagePriority,
        forwardingNumber,
        quietHoursEnabled,
        quietHoursFrom,
        quietHoursTo,
        quietHoursCallMode,
        quietHoursMessageMode,
        urgentConfigMode,
        urgentLabels,
        urgentAllowedNumbers,
      })
    );

    toast.success("Routing settings saved");
  };

  const forwardCalls = transferType === "calls" || transferType === "both";
  const forwardMessages = transferType === "messages" || transferType === "both";

  const setForwardCalls = (next: boolean) => {
    if (next && forwardMessages) return setTransferType("both");
    if (next && !forwardMessages) return setTransferType("calls");
    // prevent turning both off
    if (!next && forwardMessages) return setTransferType("messages");
    return setTransferType("calls");
  };

  const setForwardMessages = (next: boolean) => {
    if (next && forwardCalls) return setTransferType("both");
    if (next && !forwardCalls) return setTransferType("messages");
    // prevent turning both off
    if (!next && forwardCalls) return setTransferType("calls");
    return setTransferType("messages");
  };

  const timeMeta = useMemo(() => {
    const parse = (value: string) => {
      const [h, m] = value.split(":").map((v) => Number(v));
      if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
      return h * 60 + m;
    };

    const start = parse(quietHoursFrom);
    const end = parse(quietHoursTo);
    const raw = (end - start + 1440) % 1440;
    const durationMinutes = raw === 0 ? 1440 : raw;
    const isOvernight = end <= start && durationMinutes !== 1440;

    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;
    const durationText = minutes === 0 ? `${hours} hours` : `${hours}h ${minutes}m`;

    return { isOvernight, durationText };
  }, [quietHoursFrom, quietHoursTo]);

  const showUrgentConfig =
    (forwardMessages && messagePriority === "high_only") ||
    quietHoursCallMode === "high_only" ||
    quietHoursMessageMode === "high_only";

  const toggleUrgentLabel = (id: string) => {
    setUrgentLabels((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const addUrgentNumber = () => {
    const phone = newUrgentPhone.trim();
    const label = newUrgentLabel.trim();

    if (!phone) {
      toast.error("Enter a phone number");
      return;
    }
    if (!isValidUsPhoneNumber(phone)) {
      toast.error("Enter a valid phone number");
      return;
    }

    setUrgentAllowedNumbers((prev) => {
      const exists = prev.some((n) => n.phone === phone);
      if (exists) return prev;
      return [...prev, { id: `allow-${Date.now()}`, phone, label: label || undefined }];
    });

    setNewUrgentPhone("");
    setNewUrgentLabel("");
  };

  const removeUrgentNumber = (id: string) => {
    setUrgentAllowedNumbers((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <div className="space-y-4 pb-4">
      {/* 1) Global Forwarding (Baseline) */}
      <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-3">
        <div>
          <h3 className="font-medium text-gray-800 text-sm">Global Forwarding</h3>
          <p className="text-xs text-gray-500">This is how your number behaves during the day.</p>
        </div>

        <div className="p-2 bg-gray-50 rounded border border-gray-100">
          <p className="text-xs text-gray-600">
            From: <span className="font-mono text-gray-800">Comsierge ({phoneNumber})</span>
          </p>
          <p className="text-xs text-gray-600">
            To: <span className="font-mono text-gray-800">Personal</span>
          </p>
        </div>

        <div>
          <label className="text-xs text-gray-500 block mb-1">To: Personal</label>
          <input
            type="tel"
            value={forwardingNumber}
            onChange={(e) => validateForwardingNumber(e.target.value)}
            placeholder="+1 (555) 123-4567"
            className={cn(
              "w-full px-2.5 py-2 bg-white border rounded text-gray-700 text-xs font-mono focus:outline-none",
              forwardingNumberError ? "border-red-300 focus:border-red-400" : "border-gray-200 focus:border-indigo-400"
            )}
          />
          {forwardingNumberError ? (
            <p className="text-[11px] text-red-500 mt-1">{forwardingNumberError}</p>
          ) : (
            <p className="text-[11px] text-gray-400 mt-1">Your personal number where calls/messages will be sent</p>
          )}
        </div>

        <div className="space-y-2">
          <div>
            <p className="text-xs text-gray-500 mb-1">What to Forward</p>
            <div className="flex items-center gap-4">
              <label className="inline-flex items-center gap-2 text-xs text-gray-700 select-none">
                <input
                  type="checkbox"
                  checked={forwardCalls}
                  onChange={(e) => setForwardCalls(e.target.checked)}
                  className="accent-indigo-500"
                />
                Calls
              </label>
              <label className="inline-flex items-center gap-2 text-xs text-gray-700 select-none">
                <input
                  type="checkbox"
                  checked={forwardMessages}
                  onChange={(e) => setForwardMessages(e.target.checked)}
                  className="accent-indigo-500"
                />
                Messages
              </label>
            </div>
          </div>

          {forwardMessages && (
            <div>
              <label className="text-xs text-gray-500 block mb-1">Message Filter</label>
              <div className="inline-flex w-full bg-gray-50 border border-gray-200 rounded-full p-1">
                {[
                  { id: "all" as MessagePriority, label: "All" },
                  { id: "high_medium" as MessagePriority, label: "High + Medium" },
                  { id: "high_only" as MessagePriority, label: "High Only" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setMessagePriority(opt.id)}
                    className={cn(
                      "flex-1 py-1.5 text-xs font-medium rounded-full transition-colors",
                      messagePriority === opt.id
                        ? "bg-white text-gray-800 shadow-sm"
                        : "text-gray-600 hover:text-gray-800"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* High Priority (Urgent) Rules */}
      {showUrgentConfig && (
        <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-3">
          <div>
            <h3 className="font-medium text-gray-800 text-xs">High Priority (Urgent) Rules</h3>
            <p className="text-xs text-gray-500">
              Used when you choose <span className="font-medium">High Only</span> or <span className="font-medium">Allow Urgent</span>.
            </p>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Mode</label>
            <div className="inline-flex w-full bg-gray-50 border border-gray-200 rounded-full p-1">
              {[{ id: "auto" as UrgentConfigMode, label: "Auto" }, { id: "custom" as UrgentConfigMode, label: "Custom" }].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setUrgentConfigMode(opt.id)}
                  className={cn(
                    "flex-1 py-1.5 text-xs font-medium rounded-full transition-colors",
                    urgentConfigMode === opt.id
                      ? "bg-white text-gray-800 shadow-sm"
                      : "text-gray-600 hover:text-gray-800"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {urgentConfigMode === "auto" && (
            <p className="text-xs text-gray-600">
              Auto uses Comsierge's best guess to treat emergencies and truly important messages as urgent.
            </p>
          )}

          {urgentConfigMode === "custom" && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-500">Urgent labels</label>
                <span className="text-[11px] text-gray-400">{urgentLabels.length} selected</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {URGENT_LABELS.map((t) => {
                  const selected = urgentLabels.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleUrgentLabel(t.id)}
                      className={cn(
                        "px-2.5 py-1.5 rounded-full border text-xs font-medium transition-colors",
                        selected
                          ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                          : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                      )}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs text-gray-500 block">Always allow these numbers</label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="tel"
                value={newUrgentPhone}
                onChange={(e) => setNewUrgentPhone(e.target.value)}
                placeholder="+1 (555) 123-4567"
                className="px-2.5 py-2 bg-white border border-gray-200 rounded text-gray-700 text-xs font-mono focus:outline-none focus:border-indigo-400"
              />
              <input
                type="text"
                value={newUrgentLabel}
                onChange={(e) => setNewUrgentLabel(e.target.value)}
                placeholder="Label (optional)"
                className="px-2.5 py-2 bg-white border border-gray-200 rounded text-gray-700 text-xs focus:outline-none focus:border-indigo-400"
              />
            </div>
            <Button
              type="button"
              onClick={addUrgentNumber}
              className="h-8 text-xs bg-gray-900 hover:bg-gray-800 text-white"
            >
              Add number
            </Button>

            {urgentAllowedNumbers.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {urgentAllowedNumbers.map((n) => (
                  <div
                    key={n.id}
                    className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-gray-50 border border-gray-200"
                  >
                    <span className="text-xs font-mono text-gray-800">{n.phone}</span>
                    {n.label && <span className="text-xs text-gray-500">{n.label}</span>}
                    <button
                      type="button"
                      onClick={() => removeUrgentNumber(n.id)}
                      className="text-xs text-gray-500 hover:text-gray-800"
                      aria-label="Remove"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2) Quiet Hours (Schedule) */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Moon className="w-3.5 h-3.5 text-gray-500" />
            <h3 className="font-medium text-gray-800 text-xs">Quiet Hours</h3>
          </div>
          {quietHoursEnabled ? (
            <button
              type="button"
              onClick={() => setQuietHoursEnabled(false)}
              className="text-xs font-medium text-gray-600 hover:text-gray-800"
            >
              Turn off
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setQuietHoursEnabled(true)}
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
            >
              Turn on
            </button>
          )}
        </div>
        
        {!quietHoursEnabled ? (
          <div className="p-3 bg-white border border-gray-200 rounded-lg">
            <p className="text-xs text-gray-600">
              Quiet Hours is currently off. Turn it on to set a schedule and what can reach you.
            </p>
          </div>
        ) : (
          <>
            {/* Time Range */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-600">Schedule</p>
                <div className="flex items-center gap-2">
                  {timeMeta.isOvernight && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] bg-indigo-100 text-indigo-700 border border-indigo-200">
                      Overnight
                    </span>
                  )}
                  <span className="text-[11px] text-gray-500">Active for {timeMeta.durationText}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 bg-white rounded border border-gray-200">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
              <input
                type="time"
                value={quietHoursFrom}
                onChange={(e) => setQuietHoursFrom(e.target.value)}
                className="px-2 py-1 bg-white border border-gray-200 rounded text-gray-700 text-xs font-mono focus:outline-none focus:border-indigo-400 w-24"
              />
                <span className="text-xs text-gray-400">
                  →
                </span>
              <input
                type="time"
                value={quietHoursTo}
                onChange={(e) => setQuietHoursTo(e.target.value)}
                className="px-2 py-1 bg-white border border-gray-200 rounded text-gray-700 text-xs font-mono focus:outline-none focus:border-indigo-400 w-24"
              />
              </div>
            </div>

            {/* Exceptions */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-700">Exceptions</p>
              
              {/* Calls behavior */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 w-20">
                  <PhoneCall className="w-3 h-3 text-gray-500" />
                  <span className="text-xs font-medium text-gray-700">Calls</span>
                </div>
                <div className="flex gap-1 flex-1">
                  {[
                    { id: "high_only" as QuietHoursMode, label: "Allow Urgent" },
                    { id: "all" as QuietHoursMode, label: "Allow All" },
                    { id: "dnd" as QuietHoursMode, label: "Block All" },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => setQuietHoursCallMode(mode.id)}
                      className={cn(
                        "flex-1 py-1.5 px-2 rounded text-xs font-medium transition-all border",
                        quietHoursCallMode === mode.id
                          ? mode.id === "all"
                            ? "bg-green-50 text-green-700 border-green-200"
                            : mode.id === "high_only"
                              ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                              : "bg-red-50 text-red-700 border-red-200"
                          : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                      )}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Messages behavior */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 w-20">
                  <MessageSquare className="w-3 h-3 text-gray-500" />
                  <span className="text-xs font-medium text-gray-700">Messages</span>
                </div>
                <div className="flex gap-1 flex-1">
                  {[
                    { id: "high_only" as QuietHoursMode, label: "Allow Urgent" },
                    { id: "all" as QuietHoursMode, label: "Allow All" },
                    { id: "dnd" as QuietHoursMode, label: "Block All" },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => setQuietHoursMessageMode(mode.id)}
                      className={cn(
                        "flex-1 py-1.5 px-2 rounded text-xs font-medium transition-all border",
                        quietHoursMessageMode === mode.id
                          ? mode.id === "all"
                            ? "bg-green-50 text-green-700 border-green-200"
                            : mode.id === "high_only"
                              ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                              : "bg-red-50 text-red-700 border-red-200"
                          : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                      )}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Save */}
      <div className="pt-1">
        <Button
          className="w-full h-9 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
          onClick={handleSave}
          disabled={Boolean(forwardingNumberError)}
        >
          Save routing
        </Button>
      </div>
    </div>
  );
};

export default RoutingPanel;
