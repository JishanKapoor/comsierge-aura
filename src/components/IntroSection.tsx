import { useEffect, useRef, useState } from "react";

const IntroSection = () => {
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
      ref={sectionRef}
      className="relative py-32 md:py-48 px-6 md:px-12 lg:px-24 bg-background"
    >
      {/* Subtle glow effect */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-30 blur-3xl pointer-events-none"
        style={{
          background: "radial-gradient(circle, hsl(180 30% 25% / 0.2) 0%, transparent 70%)",
        }}
      />

      <div className="max-w-4xl mx-auto text-center relative">
        <p
          className={`text-2xl md:text-3xl lg:text-4xl font-serif font-light leading-relaxed text-foreground transition-all duration-1000 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          }`}
        >
          Comsierge transforms how you manage communications, intelligently
          filtering every call and message to ensure only{" "}
          <span className="italic text-accent">what truly matters</span> reaches
          you.
        </p>

        <p
          className={`mt-8 text-lg md:text-xl text-muted-foreground font-light leading-relaxed transition-all duration-1000 delay-200 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          }`}
        >
          Behind every peaceful moment lies a sophisticated AI that screens,
          responds, and routes your communications with precision—across calls,
          SMS, WhatsApp, Telegram, and email.
        </p>
      </div>
    </section>
  );
};

export default IntroSection;
