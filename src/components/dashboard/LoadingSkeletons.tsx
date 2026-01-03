import { cn } from "@/lib/utils";

// Consistent skeleton pulse
const Pulse = ({ className }: { className?: string }) => (
  <div className={cn("animate-pulse rounded bg-gray-200", className)} />
);

// Conversation/Message list item skeleton
export const ConversationSkeleton = () => (
  <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
    <Pulse className="w-10 h-10 rounded-full shrink-0" />
    <div className="flex-1 min-w-0 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Pulse className="h-3.5 w-28" />
        <Pulse className="h-3 w-12" />
      </div>
      <Pulse className="h-3 w-full max-w-[200px]" />
    </div>
  </div>
);

// Call list item skeleton
export const CallSkeleton = () => (
  <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
    <Pulse className="w-10 h-10 rounded-full shrink-0" />
    <div className="flex-1 min-w-0 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Pulse className="h-3.5 w-32" />
        <Pulse className="h-3 w-16" />
      </div>
      <div className="flex items-center gap-2">
        <Pulse className="h-3 w-3 rounded-full" />
        <Pulse className="h-3 w-20" />
      </div>
    </div>
  </div>
);

// Contact list item skeleton
export const ContactSkeleton = () => (
  <div className="flex items-center gap-2.5 px-3 py-2 border-b border-gray-100">
    <Pulse className="w-7 h-7 rounded-full shrink-0" />
    <div className="flex-1 min-w-0 space-y-1.5">
      <Pulse className="h-3 w-28" />
      <Pulse className="h-2.5 w-20" />
    </div>
  </div>
);

// Chat message skeleton
export const ChatMessageSkeleton = ({ isOutgoing = false }: { isOutgoing?: boolean }) => (
  <div className={cn("flex", isOutgoing ? "justify-end" : "justify-start")}>
    <div className={cn(
      "max-w-[75%] rounded-2xl px-4 py-2.5 space-y-1.5",
      isOutgoing ? "bg-gray-100" : "bg-gray-50"
    )}>
      <Pulse className="h-3 w-48" />
      <Pulse className="h-3 w-32" />
    </div>
  </div>
);

// Inbox loading state
export const InboxLoadingSkeleton = () => (
  <div className="flex flex-col h-full">
    {/* Search area */}
    <div className="p-3 border-b border-gray-200">
      <Pulse className="h-8 w-full rounded-lg" />
    </div>
    {/* Filter tabs */}
    <div className="flex gap-2 p-3 border-b border-gray-100">
      <Pulse className="h-6 w-12 rounded" />
      <Pulse className="h-6 w-16 rounded" />
      <Pulse className="h-6 w-14 rounded" />
    </div>
    {/* List items */}
    <div className="flex-1 overflow-hidden">
      {[...Array(6)].map((_, i) => (
        <ConversationSkeleton key={i} />
      ))}
    </div>
  </div>
);

// Calls loading state
export const CallsLoadingSkeleton = () => (
  <div className="space-y-4">
    {/* Header buttons */}
    <div className="flex justify-end gap-2">
      <Pulse className="h-8 w-24 rounded" />
    </div>
    {/* Search */}
    <Pulse className="h-8 w-full rounded-lg" />
    {/* Filter tabs */}
    <div className="flex gap-2">
      <Pulse className="h-7 w-12 rounded" />
      <Pulse className="h-7 w-16 rounded" />
      <Pulse className="h-7 w-20 rounded" />
    </div>
    {/* Call list */}
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {[...Array(5)].map((_, i) => (
        <CallSkeleton key={i} />
      ))}
    </div>
  </div>
);

// Contacts loading state
export const ContactsLoadingSkeleton = () => (
  <div className="space-y-3">
    {/* Add button */}
    <div className="flex justify-end">
      <Pulse className="h-7 w-16 rounded" />
    </div>
    {/* Search */}
    <Pulse className="h-8 w-full rounded" />
    {/* Filter tabs */}
    <div className="flex gap-2">
      <Pulse className="h-6 w-10 rounded" />
      <Pulse className="h-6 w-16 rounded" />
      <Pulse className="h-6 w-14 rounded" />
    </div>
    {/* Contact list */}
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Letter header */}
      <div className="px-3 py-1 bg-gray-50">
        <Pulse className="h-3 w-4" />
      </div>
      {[...Array(4)].map((_, i) => (
        <ContactSkeleton key={i} />
      ))}
      {/* Another letter header */}
      <div className="px-3 py-1 bg-gray-50">
        <Pulse className="h-3 w-4" />
      </div>
      {[...Array(3)].map((_, i) => (
        <ContactSkeleton key={`b-${i}`} />
      ))}
    </div>
  </div>
);

// Chat panel loading state
export const ChatLoadingSkeleton = () => (
  <div className="flex flex-col h-full">
    {/* Header */}
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
      <Pulse className="w-10 h-10 rounded-full" />
      <div className="space-y-1.5">
        <Pulse className="h-4 w-32" />
        <Pulse className="h-3 w-24" />
      </div>
    </div>
    {/* Messages */}
    <div className="flex-1 p-4 space-y-4">
      <ChatMessageSkeleton />
      <ChatMessageSkeleton isOutgoing />
      <ChatMessageSkeleton />
      <ChatMessageSkeleton isOutgoing />
      <ChatMessageSkeleton />
    </div>
    {/* Input */}
    <div className="p-3 border-t border-gray-200">
      <Pulse className="h-10 w-full rounded-lg" />
    </div>
  </div>
);
