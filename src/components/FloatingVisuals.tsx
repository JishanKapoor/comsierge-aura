import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

const FloatingVisuals = () => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });

  const y1 = useTransform(scrollYProgress, [0, 1], [100, -100]);
  const y2 = useTransform(scrollYProgress, [0, 1], [50, -150]);
  const rotate1 = useTransform(scrollYProgress, [0, 1], [0, 10]);
  const rotate2 = useTransform(scrollYProgress, [0, 1], [0, -5]);

  return (
    <section ref={ref} className="relative py-16 md:py-24 overflow-hidden bg-background">
      <div className="max-w-7xl mx-auto px-6 md:px-16">
        <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16">
          {/* Floating Card 1 */}
          <motion.div
            className="w-64 md:w-80 aspect-[4/5] rounded-[24px] bg-gradient-to-br from-card to-secondary overflow-hidden shadow-2xl"
            style={{ y: y1, rotate: rotate1 }}
          >
            <div className="p-6 h-full flex flex-col justify-between">
              <div className="w-12 h-12 rounded-full bg-foreground/10" />
              <div>
                <div className="h-3 w-3/4 bg-foreground/20 rounded mb-2" />
                <div className="h-3 w-1/2 bg-foreground/10 rounded" />
              </div>
            </div>
          </motion.div>

          {/* Floating Card 2 */}
          <motion.div
            className="w-72 md:w-96 aspect-[4/3] rounded-[24px] bg-gradient-to-br from-secondary to-card overflow-hidden shadow-2xl"
            style={{ y: y2, rotate: rotate2 }}
          >
            <div className="p-8 h-full flex flex-col justify-between">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/50" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                <div className="w-3 h-3 rounded-full bg-green-500/50" />
              </div>
              <div className="space-y-3">
                <div className="h-2 w-full bg-foreground/10 rounded" />
                <div className="h-2 w-4/5 bg-foreground/10 rounded" />
                <div className="h-2 w-3/5 bg-foreground/10 rounded" />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default FloatingVisuals;
