const CompanyMarquee = () => {
  const companies = [
    "FedEx", "Stripe", "Notion", "Slack", "Zoom", "Linear", "Vercel", "Figma", "Discord", "Shopify"
  ];

  return (
    <section className="py-10 sm:py-14 bg-card/20 border-y border-white/5 overflow-hidden">
      <div className="relative">
        <div className="flex animate-marquee">
          {/* First set */}
          {companies.map((company) => (
            <div
              key={company}
              className="flex-shrink-0 mx-8 sm:mx-12"
            >
              <span className="text-lg sm:text-xl font-light text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                {company}
              </span>
            </div>
          ))}
          {/* Duplicate for seamless loop */}
          {companies.map((company) => (
            <div
              key={`${company}-2`}
              className="flex-shrink-0 mx-8 sm:mx-12"
            >
              <span className="text-lg sm:text-xl font-light text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                {company}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CompanyMarquee;
