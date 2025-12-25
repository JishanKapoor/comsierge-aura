import { Phone, Mail, MessageSquare, Calendar, Globe, History, Settings, Bell } from "lucide-react";

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
  { value: "<50ms", label: "Response time" },
  { value: "24/7", label: "Protection" },
];

const StatsSection = () => {
  return (
    <section className="py-20 sm:py-28 md:py-36 px-4 sm:px-6 md:px-16 bg-background">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 sm:mb-16">
          <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Complete Control</span>
          <h2 className="mt-4 text-2xl sm:text-3xl md:text-4xl font-light text-foreground">
            The infrastructure for
            <br />
            <span className="italic text-muted-foreground">peaceful communication</span>
          </h2>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-8 gap-2 sm:gap-4 mb-16 sm:mb-20">
          {features.map((feature) => (
            <div
              key={feature.label}
              className="group flex flex-col items-center gap-2 p-3 sm:p-4 rounded-xl bg-card/30 border border-white/5 hover:border-white/10 transition-all duration-300"
            >
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                <feature.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-foreground/60" />
              </div>
              <span className="text-[10px] sm:text-xs text-muted-foreground text-center leading-tight">
                {feature.label}
              </span>
            </div>
          ))}
        </div>

        {/* Stats - Properly aligned */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center p-4 sm:p-6 rounded-2xl bg-card/20 border border-white/5">
              <p className="text-3xl sm:text-4xl md:text-5xl font-light text-foreground tracking-tight">
                {stat.value}
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground mt-2">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StatsSection;
