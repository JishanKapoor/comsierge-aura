import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import heroImage from "@/assets/hero-landscape.jpg";

const HeroSection = () => {
  return (
    <section className="relative h-screen flex items-center justify-center overflow-hidden">
      {/* Background */}
      <motion.div 
        className="absolute inset-0 z-0"
        initial={{ scale: 1.1, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <img
          src={heroImage}
          alt="Atmospheric landscape"
          className="w-full h-full object-cover"
        />
        {/* Gradients matching micro1 exactly */}
        <div 
          className="absolute inset-0"
          style={{
            background: "linear-gradient(180deg, hsl(0 0% 3% / 0.3) 0%, hsl(0 0% 3% / 0.1) 40%, hsl(0 0% 3% / 0.7) 80%, hsl(0 0% 3%) 100%)"
          }}
        />
        <div 
          className="absolute inset-0"
          style={{
            background: "linear-gradient(90deg, hsl(0 0% 3% / 0.6) 0%, transparent 25%, transparent 75%, hsl(0 0% 3% / 0.6) 100%)"
          }}
        />
      </motion.div>

      {/* Content */}
      <div className="relative z-10 text-center px-6 max-w-5xl mx-auto">
        <motion.h1 
          className="hero-headline text-foreground"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          The AI layer between
          <br />
          <span className="italic font-light">you and noise</span>
        </motion.h1>

        <motion.div
          className="mt-10"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <a href="#contact" className="pill-button group">
            <span className="w-8 h-8 rounded-full bg-background flex items-center justify-center">
              <ArrowRight className="w-4 h-4 text-foreground transition-transform group-hover:translate-x-0.5" />
            </span>
            Get in touch
          </a>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
