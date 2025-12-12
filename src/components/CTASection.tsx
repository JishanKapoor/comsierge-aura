import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { ArrowRight } from "lucide-react";

const CTASection = () => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });

  const scale = useTransform(scrollYProgress, [0, 0.5], [0.9, 1]);
  const opacity = useTransform(scrollYProgress, [0, 0.3], [0, 1]);

  return (
    <section ref={ref} id="contact" className="relative py-32 md:py-48 px-6 md:px-16 bg-background overflow-hidden">
      {/* Background image with parallax */}
      <motion.div 
        className="absolute inset-0 z-0"
        style={{ scale }}
      >
        <div 
          className="w-full h-full bg-cover bg-center"
          style={{
            backgroundImage: "url('https://images.unsplash.com/photo-1534430480872-3498386e7856?w=1920&q=80')",
          }}
        />
        <div 
          className="absolute inset-0"
          style={{
            background: "linear-gradient(180deg, hsl(0 0% 3%) 0%, hsl(0 0% 3% / 0.85) 30%, hsl(0 0% 3% / 0.85) 70%, hsl(0 0% 3%) 100%)"
          }}
        />
      </motion.div>

      <motion.div 
        className="max-w-4xl mx-auto text-center relative z-10"
        style={{ opacity }}
      >
        <motion.h2
          className="section-headline text-foreground"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          Your attention is finite.
          <br />
          <span className="italic">Protect it.</span>
        </motion.h2>

        <motion.div
          className="mt-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          viewport={{ once: true }}
        >
          <a href="mailto:hello@comsierge.ai" className="pill-button group">
            <span className="w-8 h-8 rounded-full bg-background flex items-center justify-center">
              <ArrowRight className="w-4 h-4 text-foreground transition-transform group-hover:translate-x-0.5" />
            </span>
            Get in touch
          </a>
        </motion.div>
      </motion.div>
    </section>
  );
};

export default CTASection;
