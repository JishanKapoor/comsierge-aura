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

  return (
    <section ref={ref} className="relative py-32 md:py-48 px-6 md:px-16 lg:px-24 bg-background">
      <motion.div 
        className="max-w-4xl mx-auto text-center"
        style={{ opacity, y }}
      >
        <motion.p 
          className="text-xl md:text-2xl lg:text-[28px] font-light leading-[1.5] text-foreground"
        >
          Your phone rings. Unknown number. Spam? Urgent? You'll never know until you pick up.
        </motion.p>

        <motion.p 
          className="mt-8 body-text max-w-3xl mx-auto"
        >
          Comsierge answers first. It listens, understands context, filters the noise, and only 
          interrupts you when something real demands attention. One AI, managing the chaos 
          so you don't have to.
        </motion.p>
      </motion.div>
    </section>
  );
};

export default ManifestoSection;
