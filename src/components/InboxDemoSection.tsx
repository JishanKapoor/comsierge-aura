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
    <section className="py-16 sm:py-20 md:py-28 px-4 sm:px-6 md:px-16 bg-card/20 border-y border-white/5">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <span className="section-label">Live Demo</span>
          <h2 className="mt-3 text-2xl sm:text-3xl md:text-4xl font-light text-foreground">
            See It In Action.
          </h2>
        </div>

        {/* Inbox Demo */}
        <div className="bg-card/60 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
                <Shield className="w-3.5 h-3.5 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">Comsierge Inbox</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              <span className="text-xs text-accent">Protected</span>
            </div>
          </div>

          {/* Messages */}
          <div className="divide-y divide-white/5">
            {messages.map((msg, i) => (
              <div
                key={i}
                className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 hover:bg-white/5 transition-colors"
              >
                {/* Status icon */}
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  msg.status === 'allowed' ? 'bg-primary/20' :
                  msg.status === 'blocked' ? 'bg-red-500/20' :
                  'bg-accent/20'
                }`}>
                  {msg.status === 'blocked' ? (
                    <X className="w-3.5 h-3.5 text-red-400" />
                  ) : msg.status === 'priority' ? (
                    <AlertCircle className="w-3.5 h-3.5 text-accent" />
                  ) : (
                    <Check className="w-3.5 h-3.5 text-primary" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{msg.sender}</p>
                  <p className="text-xs text-muted-foreground truncate">{msg.preview}</p>
                </div>

                {/* Action badge */}
                <span className={`text-[10px] px-2 py-1 rounded-md flex-shrink-0 ${
                  msg.status === 'allowed' ? 'bg-primary/20 text-primary' :
                  msg.status === 'blocked' ? 'bg-red-500/20 text-red-400' :
                  'bg-accent/20 text-accent'
                }`}>
                  {msg.action}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default InboxDemoSection;
