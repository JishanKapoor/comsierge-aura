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
      question: "How does real-time translation work?",
      answer: "If you receive a message in Italian, Comsierge translates it to English. When you reply in English, your contact receives it in Italian. It's that simple—converse globally without language barriers."
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
    <section className="py-20 sm:py-24 px-4 sm:px-6 md:px-16 bg-background">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10 sm:mb-14">
          <span className="section-label">FAQ</span>
          <h2 className="section-headline text-foreground mt-4 animate-fade-in">
            Common questions
          </h2>
        </div>

        <div className="space-y-3 sm:space-y-4">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="border border-border/50 rounded-xl overflow-hidden bg-card/30 hover:border-border transition-colors duration-300"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between text-left"
              >
                <span className="text-sm sm:text-base font-medium text-foreground pr-4">
                  {faq.question}
                </span>
                <ChevronDown 
                  className={`w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground flex-shrink-0 transition-transform duration-300 ${openIndex === i ? 'rotate-180' : ''}`} 
                />
              </button>
              <div
                className={`overflow-hidden transition-all duration-300 ease-out ${openIndex === i ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'}`}
              >
                <p className="px-4 sm:px-6 pb-4 sm:pb-5 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {faq.answer}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FAQSection;
