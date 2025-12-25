import { X, AlertTriangle, Bell, Clock } from "lucide-react";

const ProblemSection = () => {
  const messages = [
    { text: "You've won $5000!", type: "spam", urgent: true },
    { text: "Meeting rescheduled to 2pm", type: "normal", urgent: false },
    { text: "Car warranty offer...", type: "spam", urgent: true },
    { text: "Mom: Please call back", type: "important", urgent: true },
  ];

  return (
    <section className="py-16 sm:py-20 md:py-28 px-4 sm:px-6 md:px-16 bg-background">
      <div className="max-w-5xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          {/* Left - Content */}
          <div>
            <span className="section-label text-red-400/90">The Problem</span>
            <h2 className="mt-3 text-2xl sm:text-3xl md:text-4xl font-light text-foreground leading-tight">
              End Communication
              <br />
              <span className="italic text-muted-foreground">Overload</span>
            </h2>
            <p className="mt-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
              With dozens of texts and emails daily, staying focused is a challenge. Comsierge ensures you never miss what's important.
            </p>

            {/* Stats */}
            <div className="mt-6 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center">
                  <X className="w-2.5 h-2.5 text-red-400" />
                </div>
                <span className="text-sm text-muted-foreground">
                  <span className="text-foreground font-medium">70%</span> of messages are distractions
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center">
                  <Clock className="w-2.5 h-2.5 text-red-400" />
                </div>
                <span className="text-sm text-muted-foreground">
                  <span className="text-foreground font-medium">25 min</span> to regain focus
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center">
                  <AlertTriangle className="w-2.5 h-2.5 text-red-400" />
                </div>
                <span className="text-sm text-muted-foreground">
                  Critical messages get <span className="text-foreground font-medium">buried</span>
                </span>
              </div>
            </div>
          </div>

          {/* Right - Visual Demo */}
          <div className="relative">
            <div className="relative bg-card/50 backdrop-blur-xl border border-white/10 rounded-2xl p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Notifications</span>
                </div>
                <span className="text-xs text-red-400">4 unread</span>
              </div>

              <div className="space-y-2">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`p-2.5 rounded-lg border ${
                      msg.type === 'spam' 
                        ? 'bg-red-500/10 border-red-500/20' 
                        : msg.type === 'important'
                        ? 'bg-accent/10 border-accent/30'
                        : 'bg-white/5 border-white/10'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs sm:text-sm text-foreground/80 flex-1">{msg.text}</p>
                      {msg.urgent && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 flex-shrink-0">
                          URGENT
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Animated loading dots */}
              <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-center gap-2">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-xs text-muted-foreground">Overwhelming</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProblemSection;
