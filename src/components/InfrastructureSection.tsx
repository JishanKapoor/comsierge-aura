import { Phone, Mail, MessageSquare, Calendar, Globe, History, Settings, Bell } from "lucide-react";

const InfrastructureSection = () => {
  const features = [
    { icon: Phone, label: "Call Screening" },
    { icon: Mail, label: "Email Routing" },
    { icon: MessageSquare, label: "SMS & WhatsApp" },
    { icon: Calendar, label: "Scheduling" },
    { icon: Globe, label: "Translation" },
    { icon: History, label: "Full History" },
    { icon: Settings, label: "Custom Rules" },
    { icon: Bell, label: "Smart Alerts" },
  ];

  const stats = [
    { value: "98%", label: "Spam blocked" },
    { value: "12M+", label: "Calls screened" },
    { value: "< 50ms", label: "Response time" },
    { value: "24/7", label: "Protection" },
  ];

  return (
    <section className="py-16 sm:py-24 md:py-32 px-4 sm:px-6 md:px-16 bg-card/30 border-y border-border/30">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 sm:mb-16">
          <span className="section-label">Complete Control</span>
          <h2 className="section-headline text-foreground mt-4">
            The infrastructure for
            <br />
            <span className="italic">peaceful communication</span>
          </h2>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mb-12 sm:mb-20">
          {features.map((feature) => (
            <div
              key={feature.label}
              className="group flex flex-col items-center gap-2 sm:gap-3 p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-background border border-border/50 hover:border-border transition-all duration-300"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-foreground/5 flex items-center justify-center">
                <feature.icon className="w-4 h-4 sm:w-5 sm:h-5 text-foreground/70" />
              </div>
              <span className="text-xs sm:text-sm text-muted-foreground text-center">
                {feature.label}
              </span>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 md:gap-12">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-3xl sm:text-4xl md:text-5xl font-light text-foreground">
                {stat.value}
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 sm:mt-2">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default InfrastructureSection;
