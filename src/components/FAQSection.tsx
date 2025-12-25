import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

const FAQSection = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      question: "How does Comsierge screen calls?",
      answer: "Our AI analyzes caller context, voice patterns, and intent in real-time. It identifies spam, scams, and robocalls before they reach you, while ensuring legitimate calls get through instantly."
    },
    {
      question: "Can it respond on my behalf?",
      answer: "Yes. Comsierge can handle scheduling, decline unwanted calls, take messages, and redirect conversations—all in your tone and style. You review and customize every automated response."
    },
    {
      question: "Which platforms does it support?",
      answer: "Currently integrating with WhatsApp, Telegram, Gmail, Slack, Zoom, and Microsoft Teams. All channels flow into one unified stream that's summarized and prioritized for you."
    },
    {
      question: "Is my data private?",
      answer: "Absolutely. We use end-to-end encryption and never share your data. All processing happens securely, and you have full control over what's stored and what's deleted."
    },
    {
      question: "When is early access available?",
      answer: "We're launching in New York first. Join the waitlist to get priority access and be among the first to experience peaceful communication."
    }
  ];

  return (
    <section className="py-24 md:py-32 px-6 md:px-16 bg-background">
      <div className="max-w-3xl mx-auto">
        <motion.div
          className="text-center mb-14"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <span className="section-label">FAQ</span>
          <h2 className="section-headline text-foreground mt-4">
            Common questions
          </h2>
        </motion.div>

        <motion.div
          className="space-y-4"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          viewport={{ once: true }}
        >
          {faqs.map((faq, i) => (
            <motion.div
              key={i}
              className="border border-border/50 rounded-xl overflow-hidden bg-card/30 hover:border-border transition-colors duration-300"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              viewport={{ once: true }}
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full px-6 py-5 flex items-center justify-between text-left"
              >
                <span className="text-base font-medium text-foreground pr-4">
                  {faq.question}
                </span>
                <motion.div
                  animate={{ rotate: openIndex === i ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <ChevronDown className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                </motion.div>
              </button>
              <motion.div
                initial={false}
                animate={{
                  height: openIndex === i ? "auto" : 0,
                  opacity: openIndex === i ? 1 : 0
                }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <p className="px-6 pb-5 text-sm text-muted-foreground leading-relaxed">
                  {faq.answer}
                </p>
              </motion.div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default FAQSection;
