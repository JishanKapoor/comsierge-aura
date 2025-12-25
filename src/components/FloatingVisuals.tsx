import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import floatingCard1 from "@/assets/floating-card-1.jpg";
import floatingCard2 from "@/assets/floating-card-2.jpg";

const FloatingVisuals = () => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });

  const y1 = useTransform(scrollYProgress, [0, 1], [100, -100]);
  const y2 = useTransform(scrollYProgress, [0, 1], [50, -150]);
  const rotate1 = useTransform(scrollYProgress, [0, 1], [0, 8]);
  const rotate2 = useTransform(scrollYProgress, [0, 1], [0, -5]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.95, 1, 0.95]);

  return (
    <section ref={ref} className="relative py-24 md:py-40 overflow-hidden bg-background">
      <div className="max-w-7xl mx-auto px-6 md:px-16">
        <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16 lg:gap-24">
          {/* Floating Card 1 */}
          <motion.div
            className="w-56 md:w-72 aspect-[3/4] rounded-[28px] overflow-hidden shadow-2xl"
            style={{ y: y1, rotate: rotate1, scale }}
          >
            <img 
              src={floatingCard1} 
              alt="AI Phone Interface"
              className="w-full h-full object-cover"
            />
          </motion.div>

          {/* Floating Card 2 */}
          <motion.div
            className="w-72 md:w-96 aspect-[4/3] rounded-[28px] overflow-hidden shadow-2xl"
            style={{ y: y2, rotate: rotate2, scale }}
          >
            <img 
              src={floatingCard2} 
              alt="Dashboard Interface"
              className="w-full h-full object-cover"
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default FloatingVisuals;
