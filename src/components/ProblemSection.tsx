import { X, AlertTriangle, Bell, Clock } from "lucide-react";

const AnimatedDots = () => {
  return (
    <span className="inline-flex">
      <span className="animate-dot-1">.</span>
      <span className="animate-dot-2">.</span>
      <span className="animate-dot-3">.</span>
    </span>
  );
};

const ProblemSection = () => {
  const messages = [
    { text: "You've won $5000!", type: "spam", urgent: true },
    { text: "Meeting rescheduled to 2pm", type: "normal", urgent: false },
    { text: "Car warranty offer...", type: "spam", urgent: true },
    { text: "Mom: Please call back", type: "important", urgent: true },
  ];

  return (
    <section className="py-24 sm:py-32 px-4 sm:px-6 md:px-16 bg-gradient-to-b from-background via-card/20 to-background">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left - Content */}
          <div>
            <span className="text-xs uppercase tracking-[0.2em] text-red-400/80">The Problem</span>
            <h2 className="mt-4 text-2xl sm:text-3xl md:text-4xl font-light text-foreground leading-tight">
              End Communication
              <br />
              <span className="italic text-muted-foreground">Overload</span>
            </h2>
            <p className="mt-6 text-sm sm:text-base text-muted-foreground leading-relaxed">
              With dozens of texts and emails daily, staying focused is a challenge. Comsierge ensures you never miss what's important.
            </p>

            {/* Stats */}
            <div className="mt-8 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center">
                  <X className="w-3 h-3 text-red-400" />
                </div>
                <span className="text-sm text-muted-foreground">
                  <span className="text-foreground font-medium">70%</span> of messages are distractions
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center">
                  <Clock className="w-3 h-3 text-red-400" />
                </div>
                <span className="text-sm text-muted-foreground">
                  <span className="text-foreground font-medium">25 minutes</span> to regain focus after interruption
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center">
                  <AlertTriangle className="w-3 h-3 text-red-400" />
                </div>
                <span className="text-sm text-muted-foreground">
                  Critical messages get <span className="text-foreground font-medium">buried</span>
                </span>
              </div>
            </div>
          </div>

          {/* Right - Visual Demo */}
          <div className="relative">
            {/* Glass phone mockup */}
            <div className="relative bg-card/30 backdrop-blur-xl border border-white/10 rounded-3xl p-4 sm:p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Notifications</span>
                </div>
                <span className="text-xs text-red-400">4 unread</span>
              </div>

              <div className="space-y-3">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-xl border transition-all duration-500 ${
                      msg.type === 'spam' 
                        ? 'bg-red-500/5 border-red-500/20' 
                        : msg.type === 'important'
                        ? 'bg-green-500/10 border-green-500/30'
                        : 'bg-white/5 border-white/10'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-xs sm:text-sm text-foreground/80 flex-1">{msg.text}</p>
                      {msg.urgent && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 flex-shrink-0">
                          URGENT
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Chaos indicator with animated dots */}
              <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                <span className="text-xs text-muted-foreground">
                  Overwhelming<AnimatedDots />
                </span>
              </div>
            </div>

            {/* Decorative blur */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProblemSection;
