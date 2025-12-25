const stats = [
  { value: "98%", label: "Spam blocked" },
  { value: "12M+", label: "Calls screened" },
  { value: "<50ms", label: "Response time" },
  { value: "24/7", label: "Protection" },
];

const StatsSection = () => {
  return (
    <section className="py-12 sm:py-16 px-4 sm:px-6 md:px-16 bg-background">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {stats.map((stat) => (
            <div 
              key={stat.label} 
              className="text-center p-4 sm:p-5 rounded-xl bg-card/20 border border-white/5 hover:border-white/10 transition-colors duration-300"
            >
              <p className="text-2xl sm:text-3xl md:text-4xl font-light text-foreground tracking-tight">
                {stat.value}
              </p>
              <p className="text-xs text-muted-foreground mt-1.5">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StatsSection;
