import { motion } from "framer-motion";

const InfrastructureSection = () => {
  return (
    <section id="connect" className="relative py-24 md:py-40 px-6 md:px-16 bg-background overflow-hidden">
      {/* Background gradient */}
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          background: "radial-gradient(ellipse 80% 50% at 50% 50%, hsl(200 30% 15% / 0.4) 0%, transparent 70%)"
        }}
      />

      <div className="max-w-5xl mx-auto relative">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <span className="section-label">The infrastructure</span>
          <h2 className="section-headline text-foreground mt-4">
            One system.<br />
            <span className="italic">Every channel.</span>
          </h2>
        </motion.div>

        {/* Visual diagram */}
        <motion.div
          className="mt-20 relative"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.2 }}
          viewport={{ once: true }}
        >
          <div className="aspect-[16/9] rounded-[32px] bg-gradient-to-br from-card via-secondary to-card p-8 md:p-16">
            <div className="h-full flex items-center justify-center">
              <div className="grid grid-cols-3 gap-4 md:gap-8 w-full max-w-2xl">
                {["Calls", "Messages", "Email"].map((item, i) => (
                  <motion.div
                    key={item}
                    className="aspect-square rounded-2xl bg-background/50 flex items-center justify-center"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.4 + i * 0.1 }}
                    viewport={{ once: true }}
                  >
                    <span className="text-sm md:text-base text-foreground/70">{item}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default InfrastructureSection;
