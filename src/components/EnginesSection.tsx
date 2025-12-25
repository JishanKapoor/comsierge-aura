import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

const EnginesSection = () => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  });

  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0]);

  const engines = [
    {
      id: "silence",
      label: "01 — Intercept",
      title: "Every call screened.\nEvery spam blocked.",
      description: "Real-time analysis that knows the difference between your mother and a robocall. Context-aware. Instant."
    },
    {
      id: "respond",
      label: "02 — Respond", 
      title: "Your voice,\nwithout you.",
      description: "AI that speaks on your behalf—scheduling, declining, redirecting—all in your tone. Seamless."
    }
  ];

  return (
    <section ref={ref} id="silence" className="relative py-24 md:py-40 px-6 md:px-16 bg-background">
      <motion.div className="max-w-6xl mx-auto" style={{ opacity }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 md:gap-24">
          {engines.map((engine, i) => (
            <motion.div
              key={engine.id}
              id={engine.id}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: i * 0.15 }}
              viewport={{ once: true, margin: "-100px" }}
            >
              <span className="section-label">{engine.label}</span>
              <h2 className="section-headline text-foreground mt-4 whitespace-pre-line">
                {engine.title}
              </h2>
              <p className="body-text mt-6">
                {engine.description}
              </p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
};

export default EnginesSection;
