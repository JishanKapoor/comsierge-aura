import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";

const ResearchSection = () => {
  const papers = [
    {
      date: "Dec 2025",
      category: "AI Research",
      title: "The Attention Economy: Why AI Must Filter, Not Just Notify"
    },
    {
      date: "Nov 2025",
      category: "NLP",
      title: "Context-Aware Communication: Understanding Intent at Scale"
    },
    {
      date: "Oct 2025",
      category: "Ethics",
      title: "Voice Cloning for Good: Ethical Frameworks for AI Responses"
    }
  ];

  return (
    <section id="learn" className="py-24 md:py-32 px-6 md:px-16 bg-background">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-end justify-between mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <span className="section-label">Research</span>
            <h2 className="section-headline text-foreground mt-4">
              Advancing communication intelligence
            </h2>
          </motion.div>

          <motion.a
            href="#"
            className="hidden md:flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            viewport={{ once: true }}
          >
            View all research
            <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </motion.a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {papers.map((paper, i) => (
            <motion.a
              key={i}
              href="#"
              className="group block p-6 rounded-2xl bg-card/50 border border-border/50 hover:border-border hover:bg-card transition-all duration-300"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              viewport={{ once: true }}
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs text-muted-foreground">{paper.date}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-foreground/5 text-muted-foreground">
                  {paper.category}
                </span>
              </div>
              <h3 className="text-base font-medium text-foreground leading-snug group-hover:text-muted-foreground transition-colors">
                {paper.title}
              </h3>
              <div className="mt-4 flex items-center gap-1 text-sm text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                Read paper
                <ArrowUpRight className="w-3 h-3" />
              </div>
            </motion.a>
          ))}
        </div>

        <motion.div
          className="mt-8 md:hidden"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          viewport={{ once: true }}
        >
          <a href="#" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            View all research
            <ArrowUpRight className="w-4 h-4" />
          </a>
        </motion.div>
      </div>
    </section>
  );
};

export default ResearchSection;
