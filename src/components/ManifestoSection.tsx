import { Phone } from "lucide-react";

const ManifestoSection = () => {
  return (
    <section className="relative py-16 sm:py-24 md:py-32 px-4 sm:px-6 md:px-16 bg-background">
      <div className="max-w-4xl mx-auto">
        {/* The Universal Pain */}
        <div className="text-center mb-16 sm:mb-24">
          <span className="section-label">The Universal Pain</span>
          <p className="mt-6 text-lg sm:text-xl md:text-2xl font-light leading-relaxed text-foreground">
            Your phone is a firehose of notifications. Spam, marketing texts, and low-priority calls bury messages that matter, causing constant distraction and missed opportunities.
          </p>
        </div>

        {/* The Intelligent Answer */}
        <div className="text-center">
          <span className="section-label">The Intelligent Answer</span>
          <p className="mt-6 text-lg sm:text-xl md:text-2xl font-light leading-relaxed text-foreground">
            Comsierge is your AI chief of staff, providing a smart phone number that filters, summarizes, & responds. It gives you back control, ensuring you only engage with what truly matters.
          </p>
        </div>
      </div>
    </section>
  );
};

export default ManifestoSection;
