import { useEffect, useRef, useState } from "react";
import { ArrowRight, MapPin } from "lucide-react";

const CTASection = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.3 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="contact"
      ref={sectionRef}
      className="py-32 md:py-48 px-6 md:px-12 lg:px-24 bg-background relative"
    >
      {/* Ambient glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full opacity-20 blur-3xl pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse, hsl(180 30% 30% / 0.3) 0%, transparent 70%)",
        }}
      />

      <div className="max-w-4xl mx-auto text-center relative">
        <h2
          className={`section-title text-foreground mb-8 transition-all duration-1000 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          }`}
        >
          Reclaim your
          <br />
          <span className="italic">peace of mind</span>
        </h2>

        <p
          className={`text-lg md:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto transition-all duration-1000 delay-200 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          }`}
        >
          Stop the endless notifications. Let Comsierge handle the noise while
          you focus on what matters.
        </p>

        <div
          className={`flex flex-col sm:flex-row items-center justify-center gap-4 transition-all duration-1000 delay-300 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          }`}
        >
          <a href="mailto:hello@comsierge.ai" className="pill-button group">
            <span className="w-8 h-8 rounded-full bg-background flex items-center justify-center">
              <ArrowRight className="w-4 h-4 text-foreground group-hover:translate-x-0.5 transition-transform" />
            </span>
            Get in touch
          </a>
          <a href="#features" className="pill-button-outline">
            Explore features
          </a>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
