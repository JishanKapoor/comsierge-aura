const stats = [
  { value: "98%", label: "Spam blocked" },
  { value: "12M+", label: "Calls screened" },
  { value: "<50ms", label: "Response time" },
  { value: "24/7", label: "Protection" },
];

const StatsSection = () => {
  return (
    <section className="py-24 sm:py-32 px-4 sm:px-6 md:px-16 bg-background">
      <div className="max-w-6xl mx-auto">
        {/* Stats Grid Only */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center p-4 sm:p-6 rounded-2xl bg-card/20 border border-white/5">
              <p className="text-3xl sm:text-4xl md:text-5xl font-light text-foreground tracking-tight">
                {stat.value}
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground mt-2">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StatsSection;
