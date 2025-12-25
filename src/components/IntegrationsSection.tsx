import { motion } from "framer-motion";
import { MessageCircle, Send, Mail, Hash, Video, Users } from "lucide-react";

const IntegrationsSection = () => {
  const integrations = [
    { name: "WhatsApp", icon: MessageCircle, color: "hsl(142 70% 45%)" },
    { name: "Telegram", icon: Send, color: "hsl(200 80% 55%)" },
    { name: "Gmail", icon: Mail, color: "hsl(4 80% 58%)" },
    { name: "Slack", icon: Hash, color: "hsl(340 80% 55%)" },
    { name: "Zoom", icon: Video, color: "hsl(210 90% 55%)" },
    { name: "Teams", icon: Users, color: "hsl(260 60% 55%)" },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.9 },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1,
      transition: { type: "spring", stiffness: 100, damping: 15 }
    }
  };

  return (
    <section className="py-20 md:py-28 px-6 md:px-16 bg-background border-t border-border/30">
      <div className="max-w-5xl mx-auto">
        <motion.p
          className="text-center text-sm text-muted-foreground mb-14"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          Integrates seamlessly with
        </motion.p>

        <motion.div
          className="flex flex-wrap items-center justify-center gap-6 md:gap-10"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {integrations.map((integration) => (
            <motion.div
              key={integration.name}
              className="group flex flex-col items-center gap-3"
              variants={itemVariants}
              whileHover={{ scale: 1.1, y: -5 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <motion.div 
                className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-card border border-border/50 flex items-center justify-center group-hover:border-border transition-all duration-300 relative overflow-hidden"
                whileHover={{ 
                  boxShadow: `0 10px 40px -10px ${integration.color}40`
                }}
              >
                <integration.icon 
                  className="w-7 h-7 md:w-8 md:h-8 text-muted-foreground group-hover:text-foreground transition-colors duration-300" 
                />
                {/* Glow effect on hover */}
                <motion.div 
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{
                    background: `radial-gradient(circle at center, ${integration.color}10 0%, transparent 70%)`
                  }}
                />
              </motion.div>
              <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors duration-300">
                {integration.name}
              </span>
            </motion.div>
          ))}
        </motion.div>

        <motion.p
          className="text-center text-xs text-muted-foreground/60 mt-10"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          viewport={{ once: true }}
        >
          and more coming soon
        </motion.p>
      </div>
    </section>
  );
};

export default IntegrationsSection;
