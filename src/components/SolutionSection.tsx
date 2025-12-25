import { Shield, Zap, MessageSquare, Phone } from "lucide-react";

const SolutionSection = () => {
  return (
    <section className="py-20 sm:py-24 px-4 sm:px-6 md:px-16 bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 via-transparent to-blue-500/5 pointer-events-none" />
      
      <div className="max-w-5xl mx-auto relative">
        <div className="text-center">
          <span className="text-xs uppercase tracking-[0.2em] text-green-400/80">The Solution</span>
          <h2 className="mt-4 text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-light text-foreground leading-tight animate-fade-in">
            Meet Your Chief of Staff
            <br />
            <span className="italic text-muted-foreground">for Communication.</span>
          </h2>
          <p className="mt-6 text-sm sm:text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Comsierge listens, screens, responds, and routes messages intelligently across all platforms.
          </p>
        </div>

        <div className="mt-12 sm:mt-16">
          <div className="bg-gradient-to-br from-card/60 to-card/30 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-8 md:p-10 hover:border-white/20 transition-colors duration-300">
            <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-green-500/20 to-blue-500/20 border border-white/10 flex items-center justify-center flex-shrink-0">
                <Phone className="w-8 h-8 sm:w-10 sm:h-10 text-foreground" />
              </div>
              
              <div className="text-center lg:text-left">
                <span className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Core Insight</span>
                <p className="mt-3 text-base sm:text-lg md:text-xl font-light text-foreground leading-relaxed">
                  Comsierge is your AI assistant, intelligently filtering calls and messages, routing urgent notifications to your preferred apps, and keeping spam at bay.
                </p>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap justify-center lg:justify-start gap-3">
              {[
                { icon: Shield, label: "Filters" },
                { icon: Zap, label: "Routes" },
                { icon: MessageSquare, label: "Responds" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors duration-300"
                >
                  <item.icon className="w-4 h-4 text-foreground/70" />
                  <span className="text-sm text-foreground/80">{item.label}</span>
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
