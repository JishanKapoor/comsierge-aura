import { Phone, Voicemail, Monitor, Users, ArrowRightLeft, Clock } from "lucide-react";

const BusinessSection = () => {
  const features = [
    { icon: Phone, title: "Auto Attendant", description: "Callers reach the right person quickly." },
    { icon: Voicemail, title: "Shared Voicemail", description: "Team access to one inbox." },
    { icon: Monitor, title: "Multi-Device", description: "Phone, tablet, or PC." },
    { icon: Users, title: "Ring Groups", description: "Reduce wait times." },
    { icon: ArrowRightLeft, title: "Call Transfer", description: "Transfer to anyone." },
    { icon: Clock, title: "Call Queues", description: "Smart routing." },
  ];

  return (
    <section className="py-16 sm:py-20 md:py-28 px-4 sm:px-6 md:px-16 bg-card/20 border-y border-white/5">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
          <div>
            <span className="section-label">For Teams</span>
            <h2 className="mt-3 text-2xl sm:text-3xl font-light text-foreground">
              Business Features
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-xs">
            Built for both businesses and consumers.
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {features.map((feature, i) => (
            <div
              key={i}
              className="group flex items-start gap-3 p-3 sm:p-4 rounded-xl bg-background/50 border border-white/5 hover:border-accent/30 transition-all duration-300"
            >
              <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                <feature.icon className="w-4 h-4 text-accent" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-medium text-foreground">
                  {feature.title}
                </h3>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BusinessSection;
