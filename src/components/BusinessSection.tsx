import { Phone, Voicemail, Monitor, Users, ArrowRightLeft, Clock } from "lucide-react";

const BusinessSection = () => {
  const features = [
    { icon: Phone, title: "Auto Attendant", description: "Voice response system lets callers reach the right person quickly." },
    { icon: Voicemail, title: "Shared Voicemail", description: "Multiple team members access one inbox for faster response." },
    { icon: Monitor, title: "Multi-Device Support", description: "Any phone, tablet, or PC becomes your business line." },
    { icon: Users, title: "Ring Groups", description: "Calls ring multiple team members to reduce wait times." },
    { icon: ArrowRightLeft, title: "Call Transfer", description: "Easily transfer ongoing calls to anyone on your team." },
    { icon: Clock, title: "Call Queues", description: "Intelligent routing so no caller waits too long." },
  ];

  return (
    <section className="py-20 sm:py-24 px-4 sm:px-6 md:px-16 bg-gradient-to-b from-card/30 to-background border-t border-white/5">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-12 sm:mb-16">
          <div>
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">For Teams</span>
            <h2 className="mt-4 text-2xl sm:text-3xl md:text-4xl font-light text-foreground animate-fade-in">
              Business Features
            </h2>
          </div>
          <p className="text-sm text-muted-foreground max-w-md lg:text-right">
            Built for both businesses and consumers. Solutions for everyone.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {features.map((feature, i) => (
            <div
              key={i}
              className="group flex items-start gap-3 sm:gap-4 p-4 sm:p-5 rounded-xl sm:rounded-2xl bg-card/20 border border-white/5 hover:border-white/10 hover:bg-card/30 transition-colors duration-300"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0 group-hover:bg-white/10 transition-colors duration-300">
                <feature.icon className="w-4 h-4 sm:w-5 sm:h-5 text-foreground/60 group-hover:text-foreground/80 transition-colors duration-300" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-foreground mb-1">
                  {feature.title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
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
