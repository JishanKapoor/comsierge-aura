import { Check, X, AlertCircle, Shield } from "lucide-react";

const InboxDemoSection = () => {
  const messages = [
    {
      sender: "FedEx Delivery",
      preview: "Your package will arrive tomorrow between 2-4pm.",
      action: "Allowed",
      rule: "Delivery Service",
      status: "allowed"
    },
    {
      sender: "Unknown Number",
      preview: "We've been trying to reach you about your car's...",
      action: "Blocked",
      rule: "Spam Detected",
      status: "blocked"
    },
    {
      sender: "Grandma",
      preview: "Hi sweetie, are you free for a call later?",
      action: "Priority",
      rule: "Family",
      status: "priority"
    },
  ];

  return (
    <section className="py-24 sm:py-32 px-4 sm:px-6 md:px-16 bg-card/20 border-y border-white/5">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12 sm:mb-16">
          <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Live Demo</span>
          <h2 className="mt-4 text-2xl sm:text-3xl md:text-4xl font-light text-foreground">
            See It In Action.
          </h2>
        </div>

        {/* Inbox Demo */}
        <div className="bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-2xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="px-4 sm:px-6 py-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-foreground/10 flex items-center justify-center">
                <Shield className="w-4 h-4 text-foreground" />
              </div>
              <div>
                <span className="text-sm font-medium text-foreground">Comsierge Inbox</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Status:</span>
              <span className="flex items-center gap-1.5 text-xs text-green-400">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                Protected
              </span>
            </div>
          </div>

          {/* Messages */}
          <div className="divide-y divide-white/5">
            {messages.map((msg, i) => (
              <div
                key={i}
                className="px-4 sm:px-6 py-4 sm:py-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 hover:bg-white/5 transition-colors"
              >
                {/* Status icon */}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  msg.status === 'allowed' ? 'bg-blue-500/20' :
                  msg.status === 'blocked' ? 'bg-red-500/20' :
                  'bg-green-500/20'
                }`}>
                  {msg.status === 'blocked' ? (
                    <X className="w-4 h-4 text-red-400" />
                  ) : msg.status === 'priority' ? (
                    <AlertCircle className="w-4 h-4 text-green-400" />
                  ) : (
                    <Check className="w-4 h-4 text-blue-400" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{msg.sender}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground truncate mt-0.5">"{msg.preview}"</p>
                </div>

                {/* Action badges */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs px-2 py-1 rounded-md ${
                    msg.status === 'allowed' ? 'bg-blue-500/20 text-blue-400' :
                    msg.status === 'blocked' ? 'bg-red-500/20 text-red-400' :
                    'bg-green-500/20 text-green-400'
                  }`}>
                    {msg.action}
                  </span>
                  <span className="text-xs text-muted-foreground hidden sm:inline">
                    Rule: {msg.rule}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="px-4 sm:px-6 py-3 border-t border-white/10 bg-white/5">
            <p className="text-xs text-center text-muted-foreground">
              Real-time filtering • 3 messages processed
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default InboxDemoSection;
