import { motion } from "framer-motion";

const TrustedCompanies = () => {
  // Professional company logos as SVG components
  const companies = [
    { name: "FedEx", logo: <FedExLogo /> },
    { name: "Stripe", logo: <StripeLogo /> },
    { name: "Slack", logo: <SlackLogo /> },
    { name: "Notion", logo: <NotionLogo /> },
    { name: "Linear", logo: <LinearLogo /> },
    { name: "Vercel", logo: <VercelLogo /> },
  ];

  return (
    <section className="py-20 md:py-28 px-6 md:px-16 bg-background border-t border-border/50">
      <div className="max-w-6xl mx-auto">
        <motion.p
          className="text-center text-sm text-muted-foreground mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          Trusted by teams at
        </motion.p>

        <motion.div
          className="flex flex-wrap items-center justify-center gap-10 md:gap-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          viewport={{ once: true }}
        >
          {companies.map((company, i) => (
            <motion.div
              key={company.name}
              className="opacity-40 hover:opacity-70 transition-opacity duration-300"
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 0.4, y: 0 }}
              whileHover={{ opacity: 0.7 }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              viewport={{ once: true }}
            >
              {company.logo}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

// SVG Logo Components
const FedExLogo = () => (
  <svg className="h-6 md:h-8 w-auto" viewBox="0 0 172 48" fill="currentColor">
    <path d="M14.5 14h18.2v5.2H21.3v4.9h10.8v5H21.3v8.5h-6.8V14zm36.7 0h7.4l8.2 13.5L75 14h7.3v23.6h-6.6V23.3L67.5 37h-.5l-8.1-13.6v14.2h-6.5V14h-1.2zm54.3 0v5.2h-11v4.3h10.3v5h-10.3v4h11.3v5.1H87.7V14h17.8z"/>
    <path d="M127.8 24.6l-7-10.6h8l4 7 4.2-7h7.8l-7.2 10.4 7.8 11.2h-8.1l-4.7-7.6-4.8 7.6h-8l8-11z" fill="hsl(var(--accent))"/>
  </svg>
);

const StripeLogo = () => (
  <svg className="h-6 md:h-8 w-auto" viewBox="0 0 60 25" fill="currentColor">
    <path d="M5 10.2c0-.7.6-1 1.5-1 1.4 0 3.1.4 4.5 1.2V6.3C9.4 5.7 7.8 5.4 6.2 5.4c-3.4 0-5.7 1.8-5.7 4.8 0 4.7 6.4 3.9 6.4 5.9 0 .8-.7 1.1-1.7 1.1-1.5 0-3.4-.6-4.9-1.4v4c1.7.7 3.4 1 5.1 1 3.5 0 5.9-1.7 5.9-4.8-.1-5.1-6.5-4.1-6.5-6"/>
    <path d="M17.3 3.5l-3.9.8v13.8c0 2.6 1.9 4.4 4.5 4.4 1.4 0 2.5-.3 3.1-.6V18c-.5.2-3.1.9-3.1-1.4v-5.4h3.1V7.5h-3.1V3.5h-.6zm8.4 8.6c0-.5.4-.8 1.1-.8.9 0 2 .3 2.9.8V8.3c-1-.4-2-.5-2.9-.5-2.4 0-4 1.3-4 3.4 0 3.3 4.6 2.8 4.6 4.2 0 .6-.5.8-1.2.8-1 0-2.4-.4-3.5-1v3.8c1.2.5 2.4.7 3.5.7 2.5 0 4.2-1.2 4.2-3.4 0-3.6-4.7-2.9-4.7-4.3zm10.9-4.6h-2.9l-.6 3.2-.9 2.5-.9-2.5-.6-3.2h-3l2.4 5.7-2.6 6h3l.7-2 1-3.1 1 3.1.7 2h3l-2.6-6 2.3-5.7z"/>
  </svg>
);

const SlackLogo = () => (
  <svg className="h-6 md:h-8 w-auto" viewBox="0 0 54 54" fill="currentColor">
    <path d="M19.7 0a5.2 5.2 0 0 0 0 10.4h5.2V5.2A5.2 5.2 0 0 0 19.7 0zM19.7 13.9H5.2a5.2 5.2 0 0 0 0 10.4h14.5a5.2 5.2 0 0 0 0-10.4z"/>
    <path d="M54 19.1a5.2 5.2 0 0 0-10.4 0v5.2h5.2a5.2 5.2 0 0 0 5.2-5.2zM40.1 19.1V4.6a5.2 5.2 0 0 0-10.4 0v14.5a5.2 5.2 0 0 0 10.4 0z" opacity="0.8"/>
    <path d="M34.9 54a5.2 5.2 0 0 0 0-10.4h-5.2v5.2a5.2 5.2 0 0 0 5.2 5.2zM34.9 40.1h14.5a5.2 5.2 0 0 0 0-10.4H34.9a5.2 5.2 0 0 0 0 10.4z" opacity="0.6"/>
    <path d="M0 34.9a5.2 5.2 0 0 0 10.4 0v-5.2H5.2A5.2 5.2 0 0 0 0 34.9zM13.9 34.9v14.5a5.2 5.2 0 0 0 10.4 0V34.9a5.2 5.2 0 0 0-10.4 0z" opacity="0.4"/>
  </svg>
);

const NotionLogo = () => (
  <svg className="h-6 md:h-8 w-auto" viewBox="0 0 100 100" fill="currentColor">
    <path d="M6.017 4.313l55.333-4.08c6.797-.583 8.543-.19 12.817 2.917l17.663 12.443c2.913 2.14 3.883 2.723 3.883 5.053v68.243c0 4.277-1.553 6.807-6.99 7.193L24.467 99.967c-4.08.193-6.023-.39-8.16-3.113L3.3 79.94c-2.333-3.113-3.3-5.443-3.3-8.167V11.113c0-3.497 1.553-6.413 6.017-6.8z" fillRule="evenodd" fill="hsl(var(--foreground))" opacity="0.8"/>
    <path d="M61.35.247l-55.333 4.08C1.553 4.713 0 7.613 0 11.12v60.66c0 2.723.967 5.053 3.3 8.167l13.007 16.913c2.137 2.723 4.08 3.307 8.16 3.113l64.257-3.89c5.433-.387 6.99-2.917 6.99-7.193V20.64c0-2.21-.873-2.847-3.443-4.733L74.167 3.147C69.893-.14 68.15-.533 61.35.247zm1.607 15.14c1.33-.08 2.527.44 2.78 1.56.16.717.247 3.193.247 4.593v47.653c0 1.75-.077 2.867-.327 3.733-.373 1.293-1.28 1.87-2.913 2.02L24.71 78.36c-1.633.15-2.53-.393-2.53-1.783V23.503c0-.867.247-1.85.667-2.72.467-.96 1.05-1.477 2.68-1.583L63 15.387l-.043-.003z" fillRule="evenodd" fill="hsl(var(--background))"/>
  </svg>
);

const LinearLogo = () => (
  <svg className="h-6 md:h-8 w-auto" viewBox="0 0 100 100" fill="currentColor">
    <path d="M1.22541 61.5228c-.2225-.9485.90748-1.5459 1.59638-.857L39.3342 97.1782c.6889.6889.0915 1.8189-.857 1.5765C17.7562 93.4322 6.0663 78.2949 1.22541 61.5228zM.00189279 46.8891c-.01764375.2833.0095 .5765.0817.8619C4.7256 68.2579 20.2141 84.4638 41.5438 94.916c.2853.0722.5765.0994.8619.0817l-41.3919-48.0905c-.00243.0193-.0121.0394-.0121.0588 0 .0005-.00094.0009-.00188.0009zM57.2SEw.000158" opacity="0.7"/>
    <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8" opacity="0.4"/>
  </svg>
);

const VercelLogo = () => (
  <svg className="h-5 md:h-6 w-auto" viewBox="0 0 76 65" fill="currentColor">
    <path d="M37.5274 0L75.0548 65H0L37.5274 0Z"/>
  </svg>
);

export default TrustedCompanies;
