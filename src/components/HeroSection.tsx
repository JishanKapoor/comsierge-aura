import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import heroImage from "@/assets/hero-nyc.jpg";

const HeroSection = () => {
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setImageLoaded(true);
    img.src = heroImage;
  }, []);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20 bg-background">
      <div className="absolute inset-0 z-0">
        <img
          src={heroImage}
          alt="New York City"
          className={`w-full h-full object-cover object-center transition-opacity duration-700 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
          loading="eager"
          decoding="async"
          fetchPriority="high"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, hsl(0 0% 3% / 0.4) 0%, hsl(0 0% 3% / 0.2) 40%, hsl(0 0% 3% / 0.7) 80%, hsl(0 0% 3%) 100%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, hsl(0 0% 3% / 0.6) 0%, transparent 25%, transparent 75%, hsl(0 0% 3% / 0.6) 100%)",
          }}
        />
      </div>

      <div className={`relative z-10 text-center px-4 sm:px-6 max-w-5xl mx-auto transition-opacity duration-700 ${imageLoaded ? "opacity-100" : "opacity-0"}`}>
        <h1 className="hero-headline text-foreground animate-fade-in">
          The AI layer between
          <br />
          <span className="italic font-light">you and noise</span>
        </h1>

        <p className="mt-4 sm:mt-6 text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto px-4">
          Calls, messages, spam—handled. Built in New York.
        </p>

        <div className="mt-8 sm:mt-10 flex items-center justify-center gap-4">
          <a href="/auth?signup=true" className="pill-button group">
            <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-background flex items-center justify-center">
              <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-foreground transition-transform duration-300 group-hover:translate-x-0.5" />
            </span>
            <span className="text-sm sm:text-base">Get started</span>
          </a>
        </div>
      </div>

      <div className="absolute bottom-6 sm:bottom-8 left-1/2 -translate-x-1/2">
        <div className="w-6 h-10 rounded-full border border-foreground/30 flex items-start justify-center p-2">
          <div className="w-1 h-2 bg-foreground/50 rounded-full animate-bounce" />
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
