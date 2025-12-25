import { Globe, Settings, Calendar, Phone, Voicemail, Monitor, Users, ArrowRightLeft, Clock } from "lucide-react";

const FeaturesGrid = () => {
  const prototypeFeatures = [
    {
      icon: Globe,
      title: "Translate & Communicate",
      description: "Converse globally with real-time translation. Receive in Italian, respond in English—your contact gets it in Italian."
    },
    {
      icon: Settings,
      title: "Automate Your Workflow",
      description: "Forward 'emergency' messages to Dad. Route bank alerts to your accountant. Comsierge handles the logistics."
    },
    {
      icon: Calendar,
      title: "Master Your Schedule",
      description: "Intelligently groups meeting requests into single events. Schedule reminders so nothing falls through the cracks."
    }
  ];

  const businessFeatures = [
    { icon: Phone, title: "Auto Attendant", description: "Voice response system lets callers reach the right person quickly." },
    { icon: Voicemail, title: "Shared Voicemail", description: "Multiple team members access one inbox for faster response." },
    { icon: Monitor, title: "Multi-Device Support", description: "Any phone, tablet, or PC becomes your business line." },
    { icon: Users, title: "Ring Groups", description: "Calls ring multiple team members to reduce wait times." },
    { icon: ArrowRightLeft, title: "Call Transfer", description: "Easily transfer ongoing calls to anyone on your team." },
    { icon: Clock, title: "Call Queues", description: "Intelligent routing so no caller waits too long." },
  ];

  return (
    <section className="py-16 sm:py-24 md:py-32 px-4 sm:px-6 md:px-16 bg-background">
      <div className="max-w-6xl mx-auto">
        {/* Prototype Section */}
        <div className="text-center mb-12 sm:mb-16">
          <span className="section-label">See The Prototype In Action</span>
          <p className="mt-4 text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
            Our fully functional prototype is already delivering powerful results for 30+ beta testers.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-16 sm:mb-24">
          {prototypeFeatures.map((feature) => (
            <div
              key={feature.title}
              className="group p-6 sm:p-8 rounded-2xl bg-card/50 border border-border/50 hover:border-border transition-all duration-300"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-foreground/5 flex items-center justify-center mb-4 sm:mb-6">
                <feature.icon className="w-5 h-5 sm:w-6 sm:h-6 text-foreground/70" />
              </div>
              <h3 className="text-base sm:text-lg font-medium text-foreground mb-2 sm:mb-3">
                {feature.title}
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* Business Features */}
        <div className="text-center mb-12 sm:mb-16">
          <span className="section-label">Business Features</span>
          <p className="mt-4 text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
            We target both businesses and consumers. While competitors are built for businesses, we offer solutions for everyone.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {businessFeatures.map((feature) => (
            <div
              key={feature.title}
              className="group p-5 sm:p-6 rounded-xl bg-card/30 border border-border/30 hover:border-border/50 transition-all duration-300"
            >
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-foreground/5 flex items-center justify-center flex-shrink-0">
                  <feature.icon className="w-4 h-4 sm:w-5 sm:h-5 text-foreground/60" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-medium text-foreground mb-1">
                    {feature.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesGrid;
