import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import ctaBg from "@/assets/cta-bg.jpg";

const CTASection = () => {
  return (
    <section id="contact" className="relative py-24 sm:py-32 px-4 sm:px-6 md:px-16 bg-background overflow-hidden">
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
        <h2 className="section-headline text-foreground animate-fade-in">
          Your attention is finite.
          <br />
          <span className="italic">Protect it.</span>
        </h2>

        <p className="mt-6 text-muted-foreground max-w-xl mx-auto">
          Join the waitlist. We're launching early access in New York.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link to="/auth" className="pill-button group">
            <span className="w-8 h-8 rounded-full bg-background flex items-center justify-center">
              <ArrowRight className="w-4 h-4 text-foreground transition-transform duration-300 group-hover:translate-x-0.5" />
            </span>
            Request early access
          </Link>
          <a href="mailto:hello@comsierge.ai" className="pill-button-ghost">
            Get in touch
          </a>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
