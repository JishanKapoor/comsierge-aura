import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

const ManifestoSection = () => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });

  const opacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0, 1, 1, 0]);
  const y = useTransform(scrollYProgress, [0, 0.3], [60, 0]);
  const glowOpacity = useTransform(scrollYProgress, [0.2, 0.4, 0.6, 0.8], [0, 0.8, 0.8, 0]);
  const glowScale = useTransform(scrollYProgress, [0.2, 0.5], [0.8, 1.1]);

  return (
    <section ref={ref} className="relative py-32 md:py-48 px-6 md:px-16 lg:px-24 bg-background overflow-hidden">
      {/* Glow effect background */}
      <motion.div 
        className="absolute inset-0 pointer-events-none"
        style={{ opacity: glowOpacity, scale: glowScale }}
      >
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full blur-[120px]"
          style={{
            background: "radial-gradient(ellipse, hsl(200 60% 50% / 0.15) 0%, hsl(280 60% 50% / 0.1) 40%, transparent 70%)"
          }}
        />
      </motion.div>

      {/* Lightning/electric effect lines */}
      <motion.div
        className="absolute inset-0 pointer-events-none overflow-hidden"
        style={{ opacity: glowOpacity }}
      >
        <motion.div 
          className="absolute top-1/4 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent"
          animate={{ x: ["-100%", "100%"] }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        />
        <motion.div 
          className="absolute top-3/4 left-0 w-full h-px bg-gradient-to-r from-transparent via-accent/15 to-transparent"
          animate={{ x: ["100%", "-100%"] }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        />
      </motion.div>

      <motion.div 
        className="max-w-4xl mx-auto text-center relative z-10"
        style={{ opacity, y }}
      >
        {/* Main headline with glow */}
        <motion.div className="relative">
          <motion.p 
            className="text-xl md:text-2xl lg:text-[28px] font-light leading-[1.6] text-foreground relative z-10"
            style={{
              textShadow: "0 0 40px hsl(200 60% 50% / 0.3)"
            }}
          >
            Unknown number. Again. Could be important. Probably isn't.
          </motion.p>
          
          {/* Glow underline effect */}
          <motion.div 
            className="mt-4 mx-auto w-32 h-0.5 bg-gradient-to-r from-transparent via-foreground/30 to-transparent"
            style={{ opacity: glowOpacity, scaleX: glowScale }}
          />
        </motion.div>

        <motion.p 
          className="mt-10 body-text max-w-3xl mx-auto"
          style={{
            textShadow: "0 0 20px hsl(200 60% 50% / 0.15)"
          }}
        >
          We built an AI that answers before you do. It listens, understands intent, 
          filters the noise, and only interrupts when something real needs your attention. 
          One system. Total control.
        </motion.p>
      </motion.div>
    </section>
  );
};

export default ManifestoSection;
