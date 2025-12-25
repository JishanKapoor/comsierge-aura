import { motion } from "framer-motion";
import { Shield, Zap, MessageCircle, Globe, Lock, BarChart3 } from "lucide-react";

const FeaturesGrid = () => {
  const features = [
    {
      icon: Shield,
      title: "Smart Screening",
      description: "Every call analyzed in real-time. Spam, scams, and noise—gone before they reach you."
    },
    {
      icon: Zap,
      title: "Instant Response",
      description: "AI that speaks your tone. Scheduling, declining, routing—seamless automation."
    },
    {
      icon: MessageCircle,
      title: "Unified Inbox",
      description: "SMS, WhatsApp, Telegram, email—one intelligent stream, fully prioritized."
    },
    {
      icon: Globe,
      title: "Real-time Translation",
      description: "Conversations transcribed, summarized, and translated on the fly."
    },
    {
      icon: Lock,
      title: "Your Rules",
      description: "Custom filters, VIP lists, time-based routing. Full control, zero compromise."
    },
    {
      icon: BarChart3,
      title: "Complete History",
      description: "Every decision logged. Searchable. Transparent. Always accessible."
    }
  ];

  return (
    <section className="py-24 md:py-32 px-6 md:px-16 bg-background">
      <div className="max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <span className="section-label">How it works</span>
          <h2 className="section-headline text-foreground mt-4">
            Intelligence meets simplicity
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              className="group p-8 rounded-2xl bg-card/50 border border-border/50 hover:border-border transition-all duration-500 hover:bg-card"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              viewport={{ once: true }}
            >
              <div className="w-12 h-12 rounded-xl bg-foreground/5 flex items-center justify-center mb-6 group-hover:bg-foreground/10 transition-colors duration-300">
                <feature.icon className="w-6 h-6 text-foreground/70" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-3">
                {feature.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesGrid;
