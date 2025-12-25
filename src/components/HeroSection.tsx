import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import heroImage from "@/assets/hero-nyc.jpg";

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
          alt="New York City skyline at dusk"
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

        <motion.p
          className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.65, ease: [0.22, 1, 0.36, 1] }}
        >
          Calls, messages, spam—handled. Built in New York.
        </motion.p>

        <motion.div
          className="mt-10 flex items-center justify-center gap-4"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <Link to="/auth" className="pill-button group">
            <span className="w-8 h-8 rounded-full bg-background flex items-center justify-center">
              <ArrowRight className="w-4 h-4 text-foreground transition-transform group-hover:translate-x-0.5" />
            </span>
            Request early access
          </Link>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
      >
        <motion.div
          className="w-6 h-10 rounded-full border border-foreground/30 flex items-start justify-center p-2"
          animate={{ y: [0, 5, 0] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
        >
          <div className="w-1 h-2 bg-foreground/50 rounded-full" />
        </motion.div>
      </motion.div>
    </section>
  );
};

export default HeroSection;
