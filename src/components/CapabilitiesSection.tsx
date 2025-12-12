import { useEffect, useRef, useState } from "react";
import {
  Phone,
  Mail,
  MessageCircle,
  Calendar,
  Languages,
  History,
  Settings,
  Bell,
} from "lucide-react";

const capabilities = [
  { icon: Phone, label: "Call Screening" },
  { icon: Mail, label: "Email Routing" },
  { icon: MessageCircle, label: "SMS & WhatsApp" },
  { icon: Calendar, label: "Scheduling" },
  { icon: Languages, label: "Translation" },
  { icon: History, label: "Full History" },
  { icon: Settings, label: "Custom Rules" },
  { icon: Bell, label: "Smart Alerts" },
];

const CapabilitiesSection = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.2 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="intelligence"
      ref={sectionRef}
      className="py-24 md:py-32 px-6 md:px-12 lg:px-24 bg-background relative overflow-hidden"
    >
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)`,
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      <div className="max-w-6xl mx-auto relative">
        <div className="text-center mb-16">
          <p
            className={`text-sm text-accent uppercase tracking-widest mb-4 transition-all duration-700 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            Complete Control
          </p>
          <h2
            className={`section-title text-foreground transition-all duration-700 delay-100 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            }`}
          >
            The infrastructure for
            <br />
            <span className="italic">peaceful communication</span>
          </h2>
        </div>

        {/* Capabilities Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {capabilities.map((cap, index) => (
            <div
              key={cap.label}
              className={`group p-6 md:p-8 rounded-2xl bg-secondary/50 border border-border/50 text-center transition-all duration-700 hover:bg-secondary hover:border-accent/30 cursor-pointer ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
              style={{ transitionDelay: `${200 + index * 50}ms` }}
            >
              <div className="w-10 h-10 md:w-12 md:h-12 mx-auto mb-4 rounded-xl bg-accent/10 flex items-center justify-center group-hover:scale-110 group-hover:bg-accent/20 transition-all duration-300">
                <cap.icon className="w-5 h-5 md:w-6 md:h-6 text-accent" />
              </div>
              <p className="text-sm md:text-base text-foreground font-medium">
                {cap.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CapabilitiesSection;
