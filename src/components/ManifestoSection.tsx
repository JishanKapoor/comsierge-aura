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
          className="text-xl md:text-2xl lg:text-[28px] font-light leading-[1.6] text-foreground"
        >
          Unknown number. Again. Could be important. Probably isn't.
        </motion.p>

        <motion.p 
          className="mt-8 body-text max-w-3xl mx-auto"
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
