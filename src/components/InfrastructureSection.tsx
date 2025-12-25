import { motion } from "framer-motion";
import { Phone, MessageSquare, Mail, MessagesSquare, Globe } from "lucide-react";

const InfrastructureSection = () => {
  const channels = [
    { icon: Phone, label: "Calls" },
    { icon: MessageSquare, label: "SMS" },
    { icon: Mail, label: "Email" },
    { icon: MessagesSquare, label: "WhatsApp" },
    { icon: Globe, label: "Telegram" },
  ];

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
          <span className="section-label">03 — Connect</span>
          <h2 className="section-headline text-foreground mt-4">
            One system.<br />
            <span className="italic">Every channel.</span>
          </h2>
          <p className="mt-6 body-text max-w-2xl mx-auto">
            Everything flows into a single, intelligent stream. Summarized. Translated. Prioritized.
          </p>
        </motion.div>

        {/* Channel icons */}
        <motion.div
          className="mt-20 flex items-center justify-center gap-6 md:gap-12 flex-wrap"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          viewport={{ once: true }}
        >
          {channels.map((channel, i) => (
            <motion.div
              key={channel.label}
              className="flex flex-col items-center gap-3"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 + i * 0.08 }}
              viewport={{ once: true }}
            >
              <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-card border border-border flex items-center justify-center">
                <channel.icon className="w-6 h-6 md:w-7 md:h-7 text-foreground/70" />
              </div>
              <span className="text-xs text-muted-foreground">{channel.label}</span>
            </motion.div>
          ))}
        </motion.div>

        {/* Convergence visual */}
        <motion.div
          className="mt-16 flex justify-center"
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          viewport={{ once: true }}
        >
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-foreground/10 to-foreground/5 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-foreground/20 to-foreground/10 flex items-center justify-center">
                <div className="w-8 h-8 rounded-full bg-foreground/30" />
              </div>
            </div>
            {/* Pulse effect */}
            <motion.div
              className="absolute inset-0 rounded-full border border-foreground/10"
              animate={{ scale: [1, 1.5, 1.5], opacity: [0.5, 0, 0] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeOut" }}
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default InfrastructureSection;
