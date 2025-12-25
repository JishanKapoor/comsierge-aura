import { Globe, Settings, Calendar } from "lucide-react";

const PrototypeSection = () => {
  const features = [
    {
      icon: Globe,
      title: "Translate & Communicate",
      description: "Converse globally with real-time translation. Receive in Italian, respond in English—your contact gets it in Italian.",
      gradient: "from-blue-500/20 to-cyan-500/20"
    },
    {
      icon: Settings,
      title: "Automate Your Workflow",
      description: "Forward 'emergency' messages to Dad. Route bank alerts to your accountant. Comsierge handles the logistics.",
      gradient: "from-purple-500/20 to-pink-500/20"
    },
    {
      icon: Calendar,
      title: "Master Your Schedule",
      description: "Intelligently groups meeting requests into single events. Schedule reminders so nothing falls through the cracks.",
      gradient: "from-orange-500/20 to-yellow-500/20"
    }
  ];

  return (
    <section className="py-20 sm:py-28 md:py-36 px-4 sm:px-6 md:px-16 bg-background">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12 sm:mb-16">
          <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Prototype</span>
          <h2 className="mt-4 text-2xl sm:text-3xl md:text-4xl font-light text-foreground">
            See The Prototype In Action
          </h2>
          <p className="mt-4 text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">
            Already delivering results for <span className="text-foreground">30+ beta testers</span>
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid md:grid-cols-3 gap-4 sm:gap-6">
          {features.map((feature, i) => (
            <div
              key={i}
              className={`group relative p-6 sm:p-8 rounded-2xl sm:rounded-3xl bg-gradient-to-br ${feature.gradient} border border-white/10 backdrop-blur-sm hover:border-white/20 transition-all duration-500`}
            >
              {/* Icon */}
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-background/50 backdrop-blur-sm border border-white/10 flex items-center justify-center mb-5 sm:mb-6 group-hover:scale-105 transition-transform duration-300">
                <feature.icon className="w-5 h-5 sm:w-6 sm:h-6 text-foreground" />
              </div>

              <h3 className="text-base sm:text-lg font-medium text-foreground mb-2 sm:mb-3">
                {feature.title}
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>

              {/* Hover glow */}
              <div className="absolute inset-0 rounded-2xl sm:rounded-3xl bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PrototypeSection;
