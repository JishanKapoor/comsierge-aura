import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import ctaBg from "@/assets/cta-bg.jpg";

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
      { threshold: 0.2 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} id="contact" className="relative py-24 sm:py-32 px-4 sm:px-6 md:px-16 bg-background overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img
          src={ctaBg}
          alt="New York City at night"
          className="w-full h-full object-cover"
          loading="lazy"
          decoding="async"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, hsl(0 0% 3%) 0%, hsl(0 0% 3% / 0.85) 30%, hsl(0 0% 3% / 0.85) 70%, hsl(0 0% 3%) 100%)",
          }}
        />
      </div>

      <div className="max-w-4xl mx-auto text-center relative z-10">
        <h2 className={`section-headline text-foreground transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
          Your attention is finite.
          <br />
          <span className="italic">Protect it.</span>
        </h2>

        <p className={`mt-6 text-muted-foreground max-w-xl mx-auto transition-all duration-700 delay-100 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
          Join the waitlist. We're launching early access in New York.
        </p>

        <div className={`mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 transition-all duration-700 delay-200 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
          <Link to="/auth" className="pill-button group">
            <span className="w-8 h-8 rounded-full bg-background flex items-center justify-center">
              <ArrowRight className="w-4 h-4 text-foreground transition-transform duration-300 group-hover:translate-x-0.5" />
            </span>
            Get in touch
          </Link>
          <a
            href="mailto:jishan.kapoor@mail.utoronto.ca"
            className="pill-button-ghost"
          >
            jishan.kapoor@mail.utoronto.ca
          </a>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
