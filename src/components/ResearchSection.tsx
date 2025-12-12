import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";

const ResearchSection = () => {
  const papers = [
    {
      date: "December 2025",
      title: "The Attention Economy: Why AI Must Filter, Not Just Notify"
    },
    {
      date: "November 2025",
      title: "Context-Aware Communication: Understanding Intent at Scale"
    },
    {
      date: "October 2025",
      title: "Voice Cloning for Good: Ethical Frameworks for AI Responses"
    }
  ];

  return (
    <section id="learn" className="py-24 md:py-40 px-6 md:px-16 bg-background">
      <div className="max-w-5xl mx-auto">
        <motion.div
          className="mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <span className="section-label">Research</span>
          <p className="body-text mt-4 max-w-2xl">
            We study how humans process communication—and how AI can do it better.
          </p>
        </motion.div>

        <div className="space-y-0 border-t border-border">
          {papers.map((paper, i) => (
            <motion.a
              key={i}
              href="#"
              className="block py-6 border-b border-border group"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              viewport={{ once: true }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="text-xs text-muted-foreground">{paper.date}</span>
                  <h3 className="text-lg md:text-xl font-light text-foreground mt-1 group-hover:text-muted-foreground transition-colors">
                    {paper.title}
                  </h3>
                </div>
                <ArrowUpRight className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all -translate-y-1 group-hover:translate-y-0 translate-x-1 group-hover:translate-x-0" />
              </div>
            </motion.a>
          ))}
        </div>

        <motion.div
          className="mt-8"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          viewport={{ once: true }}
        >
          <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            View all research →
          </a>
        </motion.div>
      </div>
    </section>
  );
};

export default ResearchSection;
