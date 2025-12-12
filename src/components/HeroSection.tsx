import { ArrowRight } from "lucide-react";
import heroImage from "@/assets/hero-landscape.jpg";

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <img
          src={heroImage}
          alt="Serene landscape with mountains and lake"
          className="w-full h-full object-cover animate-scale-in"
        />
        {/* Gradient Overlay */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, transparent 0%, hsl(0 0% 4% / 0.4) 60%, hsl(0 0% 4%) 100%)",
          }}
        />
        {/* Side vignettes */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, hsl(0 0% 4% / 0.5) 0%, transparent 20%, transparent 80%, hsl(0 0% 4% / 0.5) 100%)",
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 text-center px-6 max-w-5xl mx-auto">
        <h1 className="hero-title text-foreground mb-8 animate-fade-up">
          The AI guardian for
          <br />
          <span className="italic">your communications</span>
        </h1>

        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-12 animate-fade-up-delay-2 font-light">
          Comsierge filters your calls and messages, blocks spam, and only
          alerts you when something truly matters.
        </p>

        <div className="animate-fade-up-delay-3">
          <a href="#contact" className="pill-button group">
            <span className="w-8 h-8 rounded-full bg-background flex items-center justify-center">
              <ArrowRight className="w-4 h-4 text-foreground group-hover:translate-x-0.5 transition-transform" />
            </span>
            Get in touch
          </a>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-fade-up-delay-4">
        <div className="w-6 h-10 rounded-full border-2 border-foreground/30 flex items-start justify-center p-2">
          <div className="w-1 h-2 bg-foreground/50 rounded-full animate-bounce" />
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
