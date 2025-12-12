import { useEffect, useRef, useState } from "react";
import { Shield, MessageSquare, Zap, Globe } from "lucide-react";

const features = [
  {
    icon: Shield,
    title: "Call Filter",
    subtitle: "Intelligent Protection",
    description:
      "Screens every incoming call, blocks spam and robocalls, and only rings you when the caller is verified important. Your phone stays silent until it matters.",
  },
  {
    icon: MessageSquare,
    title: "Auto-Reply",
    subtitle: "Smart Responses",
    description:
      "Sends contextual, intelligent responses when you're busy. Handles scheduling, answers FAQs, and routes urgent messages to you immediately.",
  },
  {
    icon: Zap,
    title: "Intelligence",
    subtitle: "AI-Powered Insights",
    description:
      "Summarizes conversations, transcribes voicemails, translates messages in real-time, and maintains a complete searchable history of every interaction.",
  },
  {
    icon: Globe,
    title: "Unified Inbox",
    subtitle: "All Channels, One Place",
    description:
      "Routes messages across WhatsApp, Telegram, SMS, and email into a single intelligent stream. Set priority rules and never miss what's critical.",
  },
];

const FeaturesSection = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [visibleCards, setVisibleCards] = useState<number[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(entry.target.getAttribute("data-index"));
            setVisibleCards((prev) =>
              prev.includes(index) ? prev : [...prev, index]
            );
          }
        });
      },
      { threshold: 0.2, rootMargin: "0px 0px -100px 0px" }
    );

    const cards = sectionRef.current?.querySelectorAll("[data-index]");
    cards?.forEach((card) => observer.observe(card));

    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="features"
      ref={sectionRef}
      className="py-24 md:py-32 px-6 md:px-12 lg:px-24 bg-background"
    >
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              data-index={index}
              className={`feature-card group cursor-pointer transition-all duration-700 ${
                visibleCards.includes(index)
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-12"
              }`}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              {/* Icon */}
              <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                <feature.icon className="w-6 h-6 text-accent" />
              </div>

              {/* Content */}
              <p className="text-sm text-muted-foreground uppercase tracking-wider mb-2">
                {feature.subtitle}
              </p>
              <h3 className="section-title text-foreground mb-4">
                {feature.title}
              </h3>
              <p className="text-muted-foreground font-light leading-relaxed">
                {feature.description}
              </p>

              {/* Hover arrow */}
              <div className="mt-8 flex items-center gap-2 text-accent opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                <span className="text-sm font-medium">Learn more</span>
                <span className="group-hover:translate-x-1 transition-transform">
                  →
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
