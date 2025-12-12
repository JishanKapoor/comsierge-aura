const logos = [
  "WhatsApp",
  "Telegram",
  "Gmail",
  "Slack",
  "Zoom",
  "Teams",
  "Signal",
  "iMessage",
];

const LogoMarquee = () => {
  return (
    <section id="integrations" className="py-16 md:py-20 bg-background border-y border-border/50 overflow-hidden">
      <div className="mb-8 text-center">
        <p className="text-sm text-muted-foreground uppercase tracking-widest">
          Integrates seamlessly with
        </p>
      </div>

      <div className="relative">
        {/* Gradient masks */}
        <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-background to-transparent z-10" />
        <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-background to-transparent z-10" />

        {/* Marquee */}
        <div className="flex animate-marquee">
          {[...logos, ...logos].map((logo, index) => (
            <div
              key={`${logo}-${index}`}
              className="flex-shrink-0 mx-8 md:mx-12"
            >
              <span className="text-xl md:text-2xl font-serif text-muted-foreground/60 hover:text-foreground transition-colors duration-300 cursor-default">
                {logo}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default LogoMarquee;
