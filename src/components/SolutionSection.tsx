import { Shield, Zap, MessageSquare, Phone } from "lucide-react";

const SolutionSection = () => {
  return (
    <section className="py-16 sm:py-20 md:py-28 px-4 sm:px-6 md:px-16 bg-background">
      <div className="max-w-4xl mx-auto">
        <div className="text-center">
          <span className="section-label">The Solution</span>
          <h2 className="mt-3 text-2xl sm:text-3xl md:text-4xl font-light text-foreground leading-tight">
            Meet Your Chief of Staff
            <br />
            <span className="italic text-muted-foreground">for Communication.</span>
          </h2>
          <p className="mt-4 text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">
            Comsierge listens, screens, responds, and routes messages intelligently across all platforms.
          </p>
        </div>

        {/* Core Insight Card */}
        <div className="mt-10 sm:mt-12">
          <div className="bg-gradient-to-br from-primary/10 to-accent/10 backdrop-blur-sm border border-primary/20 rounded-2xl p-5 sm:p-8">
            <div className="flex flex-col sm:flex-row items-center gap-5 sm:gap-8">
              {/* Icon */}
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
                <Phone className="w-7 h-7 sm:w-9 sm:h-9 text-primary" />
              </div>
              
              {/* Content */}
              <div className="text-center sm:text-left">
                <span className="text-[10px] uppercase tracking-[0.15em] text-primary/70">Core Insight</span>
                <p className="mt-2 text-sm sm:text-base md:text-lg font-light text-foreground leading-relaxed">
                  Comsierge is your AI assistant, intelligently filtering calls and messages, routing urgent notifications to your preferred apps, and keeping spam at bay.
                </p>
              </div>
            </div>

            {/* Feature pills */}
            <div className="mt-6 flex flex-wrap justify-center sm:justify-start gap-2">
              {[
                { icon: Shield, label: "Filters" },
                { icon: Zap, label: "Routes" },
                { icon: MessageSquare, label: "Responds" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10"
                >
                  <item.icon className="w-3.5 h-3.5 text-primary/70" />
                  <span className="text-xs text-foreground/80">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SolutionSection;
