import { motion } from "framer-motion";
import { Phone, Mail, MessageSquare, Calendar, Globe, History, Settings, Bell } from "lucide-react";

const InfrastructureSection = () => {
  const features = [
    { icon: Phone, label: "Call Screening" },
    { icon: Mail, label: "Email Routing" },
    { icon: MessageSquare, label: "SMS & WhatsApp" },
    { icon: Calendar, label: "Scheduling" },
    { icon: Globe, label: "Translation" },
    { icon: History, label: "Full History" },
    { icon: Settings, label: "Custom Rules" },
    { icon: Bell, label: "Smart Alerts" },
  ];

  const stats = [
    { value: "98%", label: "Spam blocked" },
    { value: "12M+", label: "Calls screened" },
    { value: "< 50ms", label: "Response time" },
    { value: "24/7", label: "Protection" },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.05, delayChildren: 0.2 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { 
      opacity: 1, 
      scale: 1,
      transition: { type: "spring", stiffness: 150, damping: 15 }
    }
  };

  return (
    <section className="py-24 md:py-32 px-6 md:px-16 bg-card/30 border-y border-border/30">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          viewport={{ once: true }}
        >
          <motion.span 
            className="section-label"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            viewport={{ once: true }}
          >
            Complete Control
          </motion.span>
          <motion.h2 
            className="section-headline text-foreground mt-4"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            viewport={{ once: true }}
          >
            The infrastructure for
            <br />
            <span className="italic">peaceful communication</span>
          </motion.h2>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-20"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {features.map((feature) => (
            <motion.div
              key={feature.label}
              className="group flex flex-col items-center gap-3 p-6 rounded-2xl bg-background border border-border/50 hover:border-border transition-all duration-300 cursor-pointer"
              variants={itemVariants}
              whileHover={{ 
                scale: 1.03, 
                y: -5,
                boxShadow: "0 20px 40px -20px hsl(0 0% 0% / 0.5)"
              }}
            >
              <motion.div
                className="w-12 h-12 rounded-xl bg-foreground/5 flex items-center justify-center group-hover:bg-foreground/10 transition-colors duration-300"
                whileHover={{ rotate: [0, -5, 5, 0] }}
                transition={{ duration: 0.4 }}
              >
                <feature.icon className="w-5 h-5 text-foreground/70 group-hover:text-foreground transition-colors" />
              </motion.div>
              <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors text-center">
                {feature.label}
              </span>
            </motion.div>
          ))}
        </motion.div>

        {/* Stats */}
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          viewport={{ once: true }}
        >
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              className="text-center"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 + i * 0.1 }}
              viewport={{ once: true }}
            >
              <motion.p 
                className="text-4xl md:text-5xl font-light text-foreground"
                whileInView={{ 
                  scale: [0.5, 1.1, 1],
                }}
                transition={{ duration: 0.6, delay: 0.5 + i * 0.1 }}
                viewport={{ once: true }}
              >
                {stat.value}
              </motion.p>
              <p className="text-sm text-muted-foreground mt-2">{stat.label}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default InfrastructureSection;
