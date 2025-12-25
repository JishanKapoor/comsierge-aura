import { Globe, Settings, Calendar } from "lucide-react";

const PrototypeSection = () => {
  const features = [
    {
      icon: Globe,
      title: "Translate & Communicate",
      description: "Receive in Italian, respond in English—your contact gets it in Italian."
    },
    {
      icon: Settings,
      title: "Automate Your Workflow",
      description: "Route 'emergency' to Dad. Bank alerts to your accountant. Done."
    },
    {
      icon: Calendar,
      title: "Master Your Schedule",
      description: "Groups meeting requests into single events. Nothing falls through."
    }
  ];

  return (
    <section className="py-16 sm:py-20 md:py-28 px-4 sm:px-6 md:px-16 bg-background">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <span className="section-label">Prototype</span>
          <h2 className="mt-3 text-2xl sm:text-3xl md:text-4xl font-light text-foreground">
            See The Prototype In Action
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Delivering results for <span className="text-primary">30+ beta testers</span>
          </p>
        </div>

        {/* Cards */}
        <div className="grid sm:grid-cols-3 gap-4">
          {features.map((feature, i) => (
            <div
              key={i}
              className="group p-5 sm:p-6 rounded-xl bg-card/30 border border-white/5 hover:border-primary/30 hover:bg-card/50 transition-all duration-300"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <feature.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-sm sm:text-base font-medium text-foreground mb-2">
                {feature.title}
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PrototypeSection;
